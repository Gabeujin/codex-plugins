import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

test('Windows Dictionary writes retain process fencing without PowerShell on PATH', {skip:process.platform !== 'win32'}, () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'kgj-no-path-'));
  const moduleUrl = new URL('../lib/dictionary.mjs', import.meta.url).href;
  const code = `import {KgjDictionary} from ${JSON.stringify(moduleUrl)};
    const dictionary = new KgjDictionary({root:process.env.KGJ_TEST_ROOT});
    await dictionary.recordEntry({entry:{id:'preference.synthetic-path',type:'preference',title:'Synthetic spacing',guidance:'Use compact rows for the fixture.',scope:{domain:'operations',surface:'console'},traitAxes:['density'],provenance:{role:'user-stated',sourceRef:'synthetic-fixture',evidenceRefs:[]},confidence:0.9,sharingClass:'private',retention:'review-required'},expectedRevision:0,idempotencyKey:'synthetic-path-001',confirmRecordIntent:true});
    const result=await dictionary.verify(); if(!result.ok)throw new Error('Integrity failed');
    console.log(JSON.stringify({ok:result.ok,revision:result.revision}));`;
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.toLowerCase() !== 'path'));
  env.PATH = ''; env.KGJ_TEST_ROOT = root;
  const child = spawnSync(process.execPath, ['--input-type=module','-e',code], {env,encoding:'utf8',timeout:60000,windowsHide:true});
  assert.equal(child.status,0,child.stderr);
  assert.deepEqual(JSON.parse(child.stdout),{ok:true,revision:1});
});
