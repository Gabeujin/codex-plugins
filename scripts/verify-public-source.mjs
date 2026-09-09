import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('../',import.meta.url));
const marketplace=JSON.parse(fs.readFileSync(path.join(root,'.agents/plugins/marketplace.json'),'utf8'));
const expected=['k-tech-radar','canvas-web-experiences','kgj-design'];
assert.equal(marketplace.name,'gabeujin-plugins');
assert.deepEqual(marketplace.plugins.map(p=>p.name),expected);
const forbidden=new Set(['node_modules','__pycache__','.git','.codex','runtime-data']);
const secret=/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
let count=0;
function inspect(dir){
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  const p=path.join(dir,item.name);
  assert(!item.isSymbolicLink(),`Symlink requires explicit review: ${p}`);
  assert(!forbidden.has(item.name),`Generated/private directory: ${p}`);
  if(item.isDirectory()){inspect(p);continue;}
  assert(!/^\.env(?:\.|$)/.test(item.name)||item.name==='.env.example',`Environment file: ${p}`);
  assert(!/\.(pem|key|sqlite|db|zip|mp4|webm|pyc)$/i.test(item.name),`Private/generated file: ${p}`);
  assert(item.name!=='.localdock.json',`Local registration: ${p}`);
  const bytes=fs.readFileSync(p);count++;
  if(!/\.(md|json|mjs|js|ts|tsx|py|css|html|yml|yaml|toml|txt|ps1)$/i.test(item.name))continue;
  const s=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  // The unchanged Radar parser negative fixture intentionally contains U+FFFD.
  const intentionalMalformedFixture=path.relative(root,p).split(path.sep).join('/')==='plugins/k-tech-radar/tests/parsers.test.mjs'
   && createHash('sha256').update(bytes).digest('hex')==='79eb6cef25968448f92eec24cb9002dcd4059ced21f423bbc89bccf077ccfd86';
  assert(!s.includes('\ufffd')||intentionalMalformedFixture,`Unicode replacement character: ${p}`);
  assert(!secret.test(s),`Potential credential: ${p}`);
 }
}
for(const entry of marketplace.plugins){
 assert.equal(entry.source.source,'local');
 assert.equal(entry.source.path,`./plugins/${entry.name}`);
 const plugin=path.join(root,entry.source.path);
 const manifest=JSON.parse(fs.readFileSync(path.join(plugin,'.codex-plugin/plugin.json'),'utf8'));
 assert.equal(manifest.name,entry.name);
 assert(fs.statSync(path.join(plugin,manifest.skills)).isDirectory());
 if(manifest.mcpServers)assert(fs.statSync(path.join(plugin,manifest.mcpServers)).isFile());
 inspect(plugin);
}
console.log(JSON.stringify({publicSource:'pass',plugins:expected,files:count,scope:'structure, UTF-8 and bounded secret/file-class heuristics; not a security guarantee'}));
