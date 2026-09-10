import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectFile} from './public-safety.mjs';
test('credentials fail without returning credential values',()=>{
 for(const prefix of ['ghp_','github_pat_','sk-proj-','xoxb-']){
  const value=prefix+'A'.repeat(40),result=inspectFile('docs/decoy.md',Buffer.from(value));
  assert(result.includes('potential-credential'));assert(!JSON.stringify(result).includes(value));
 }
});
test('artifact paths and generated/private classes fail; ordinary Korean survives',()=>{
 for(const p of ['../escape.md','/root.md','node_modules/x.js','plugins/x/.env','x.sqlite','credentials.pfx','id_rsa'])assert(inspectFile(p,Buffer.from('safe')).length);
 assert.deepEqual(inspectFile('docs/guide.md',Buffer.from('정상적인 설치 안내')),[]);
 assert(inspectFile('docs/guide.md',Buffer.from([0xff])).includes('invalid-utf8'));
});
test('new tests do not inherit an absolute-path exception',()=>{
 const value=['C:', 'Users', 'Administrator', 'private'].join('\\');
 assert(inspectFile('plugins/k-tech-radar/tests/new.test.mjs',Buffer.from(value)).includes('developer-absolute-path'));
 assert(inspectFile('plugins/k-tech-radar/tests/new.test.mjs',Buffer.from(JSON.stringify(value))).includes('developer-absolute-path'));
});
