import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {spawn} from 'node:child_process';

export function resolveCodex(environment = process.env, platform = process.platform, arch = process.arch) {
  const override = environment.SESSION_STATUS_CODEX_BIN;
  if (override) {
    if (!path.isAbsolute(override) || !fs.statSync(override).isFile()) throw new Error('Invalid Codex executable override');
    return override;
  }
  const windows = platform === 'win32';
  const triple = windows ? `${arch === 'arm64' ? 'aarch64' : 'x86_64'}-pc-windows-msvc`
    : `${arch === 'arm64' ? 'aarch64' : 'x86_64'}-${platform === 'darwin' ? 'apple-darwin' : 'unknown-linux-musl'}`;
  const binary = windows ? 'codex.exe' : 'codex';
  for (const directory of (environment.PATH ?? environment.Path ?? '').split(path.delimiter).filter(Boolean)) {
    const direct = path.join(directory, binary);
    if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return fs.realpathSync(direct);
    // Windows npm shim을 셸로 실행하지 않고 같은 설치의 native 실행 파일 탐색
    const base = path.join(directory, 'node_modules', '@openai', 'codex');
    for (const vendor of [path.join(base, 'node_modules', '@openai', `codex-${platform}-${arch}`, 'vendor'), path.join(base, 'vendor')]) {
      for (const folder of ['bin', 'codex']) {
        const candidate = path.join(vendor, triple, folder, binary);
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
      }
    }
  }
  throw new Error('Codex executable unavailable; set SESSION_STATUS_CODEX_BIN to its absolute path');
}

export class CodexRpc {
  constructor({command, args = ['app-server', '--stdio'], timeout = 8000} = {}) {
    this.child = spawn(command ?? resolveCodex(), args, {stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true, shell: false});
    this.pending = new Map();
    this.sequence = 0;
    this.closed = false;
    this.lines = readline.createInterface({input: this.child.stdout, crlfDelay: Infinity});
    this.lines.on('line', line => this.receive(line));
    this.child.stdin.on('error', () => this.close());
    this.child.once('error', () => this.close());
    this.child.once('exit', () => this.close());
    this.timer = setTimeout(() => this.close(), timeout);
  }

  receive(line) {
    if (Buffer.byteLength(line) > 2 * 1024 * 1024) return this.close();
    let message;
    try { message = JSON.parse(line); } catch { this.close(); return; }
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    if (message.error) pending.reject(new Error('Codex API request failed'));
    else pending.resolve(message.result);
  }

  call(method, params) {
    if (this.closed) return Promise.reject(new Error('Codex API unavailable or timed out'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
      this.child.stdin.write(JSON.stringify({id, method, params}) + '\n');
    });
  }

  notify(method, params = {}) {
    if (this.closed) throw new Error('Codex API unavailable or timed out');
    this.child.stdin.write(JSON.stringify({method, params}) + '\n');
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    for (const pending of this.pending.values()) pending.reject(new Error('Codex API unavailable or timed out'));
    this.pending.clear();
    this.lines.close();
    this.child.stdin.destroy();
    this.child.kill();
    const force = setTimeout(() => { if (this.child.exitCode === null) this.child.kill('SIGKILL'); }, 1000);
    force.unref();
  }
}

export async function withCodex(action, options) {
  const rpc = new CodexRpc(options);
  try {
    await rpc.call('initialize', {clientInfo: {name: 'session-status', version: '0.3.1'}});
    rpc.notify('initialized');
    return await action(rpc);
  } finally { rpc.close(); }
}
