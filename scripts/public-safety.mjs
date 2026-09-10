import path from 'node:path';
import {createHash} from 'node:crypto';
const forbidden=new Set(['node_modules','__pycache__','.git','.codex','runtime-data','.playwright-cli','dist','coverage']);
const credentials=/(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}|xox[baprs]-[A-Za-z0-9-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
export function inspectFile(name,bytes){
 const errors=[];
 if(name.includes('\\')||path.posix.isAbsolute(name)||name.split('/').some(x=>['..',''].includes(x))||/^[A-Za-z]:/.test(name))errors.push('unsafe-path');
 if(name.split('/').some(x=>forbidden.has(x)))errors.push('private-or-generated-directory');
 const base=path.posix.basename(name);
 if((/^\.env(?:\.|$)/.test(base)&&base!=='.env.example')||/\.(pem|key|p12|pfx|crt|cer|der|kdbx|sqlite|db|zip|mp4|webm|pyc|log)$/i.test(base)||/^(?:id_rsa|id_ed25519|id_ecdsa|id_dsa)(?:\.pub)?$/.test(base)||base==='.localdock.json')errors.push('private-or-generated-file');
 if(/\.(md|json|mjs|js|ts|tsx|py|css|html|yml|yaml|toml|txt|ps1|svg)$/i.test(base)){
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return [...errors,'invalid-utf8'];}
  const knownMalformed=name==='plugins/k-tech-radar/tests/parsers.test.mjs'&&createHash('sha256').update(bytes).digest('hex')==='79eb6cef25968448f92eec24cb9002dcd4059ced21f423bbc89bccf077ccfd86';
  if(text.includes('\ufffd')&&!knownMalformed)errors.push('unexpected-unicode-replacement');
  if(credentials.test(text))errors.push('potential-credential');
  // Developer-machine identifiers are never needed in a published source tree.
  // Explicit negative parser fixtures are reviewed separately, not blanket-exempted for secrets.
  const knownPathFixture=name==='plugins/k-tech-radar/tests/quality-gate.test.mjs'&&createHash('sha256').update(bytes).digest('hex')==='a3c6b3eb4cf454c8fd2841a69362338adf76269c341c1e48f251d78fa3676aea';
  if(!knownPathFixture&&/(?:C:[\\/]+Users[\\/]+(?:Administrator|ADMINI~1)|D:[\\/]+workspace[\\/]+)/i.test(text))errors.push('developer-absolute-path');
 }
 return errors;
}
