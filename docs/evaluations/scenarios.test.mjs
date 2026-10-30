import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const fixture=JSON.parse(fs.readFileSync(new URL('./scenarios.json',import.meta.url),'utf8'));
const marketplace=JSON.parse(fs.readFileSync(new URL('../../.agents/plugins/marketplace.json',import.meta.url),'utf8'));
const runner=fileURLToPath(new URL('./run-transcript-evaluation.mjs',import.meta.url));

function runFixture(transcripts){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'codex-scenario-fixture-'));
 const transcriptPath=path.join(root,'transcripts.json'),settingsPath=path.join(root,'settings.json'),output=path.join(root,'result.json');
 fs.writeFileSync(transcriptPath,JSON.stringify(transcripts),{encoding:'utf8',flag:'wx'});
 fs.writeFileSync(settingsPath,JSON.stringify({synthetic:true}),{encoding:'utf8',flag:'wx'});
 const result=spawnSync(process.execPath,[runner,'--transcripts',transcriptPath,'--settings',settingsPath,'--model','synthetic-fixture','--version','not-a-runtime-test','--output',output],{encoding:'utf8',timeout:10000,windowsHide:true});
 return {result,output};
}

test('four marketplace plugins each retain five positive and three negative fixtures',()=>{
 // 배포 목록의 플러그인이 평가 정의에서 빠지지 않도록 목록별 사례 수를 확인
 const names=marketplace.plugins.map(item=>item.name);
 assert.equal(fixture.status,'fixture-definition-only');
 assert.equal(fixture.notModelEvaluation,true);
 assert.equal(new Set(fixture.scenarios.map(item=>item.id)).size,fixture.scenarios.length);
 assert.deepEqual([...new Set(fixture.scenarios.map(item=>item.plugin))].sort(),[...names].sort());
 for(const name of names){
  const scenarios=fixture.scenarios.filter(item=>item.plugin===name);
  assert.equal(scenarios.filter(item=>item.kind==='positive').length,5,name);
  assert.equal(scenarios.filter(item=>item.kind==='negative').length,3,name);
 }
 for(const item of fixture.scenarios){
  assert.deepEqual(Object.keys(item).sort(),['id','plugin','kind','prompt','route','expected','writes'].sort());
  assert(Object.values(item).every(value=>typeof value==='string'&&value.trim()));
 }
});

test('legacy scenario identities and all four first-use rows remain available',()=>{
 const ids=new Set(fixture.scenarios.map(item=>item.id));
 for(const prefix of ['radar','kgj','canvas']){
  for(let number=1;number<=5;number++)assert(ids.has(`${prefix}-p${number}`));
  for(let number=1;number<=3;number++)assert(ids.has(`${prefix}-n${number}`));
 }
 const guide=fs.readFileSync(new URL('../FIRST-USE.md',import.meta.url),'utf8');
 for(const name of ['K-Tech Radar','KGJ Design','Canvas Web Experiences','Codex Daily Check'])assert(guide.includes('| '+name+' |'));
 assert(guide.includes(`defines ${fixture.scenarios.length} routed fixtures`));
 assert.equal(fixture.overlapPrompts.length,4);
});

test('Daily Check fixture transcripts remain pending without a human verdict',()=>{
 const transcripts=fixture.scenarios.filter(item=>item.plugin==='codex-daily-check').map(item=>({scenarioId:item.id,transcript:'Synthetic transport fixture only; no model or native action was executed.'}));
 const {result,output}=runFixture(transcripts);
 assert.equal(result.status,0,result.stderr);
 const actual=JSON.parse(fs.readFileSync(output,'utf8'));
 assert.equal(actual.status,'pending-manual-verdict');
 assert.equal(actual.manualVerdict,null);
 assert.equal(actual.transcripts.length,8);
 assert.deepEqual(actual.transcripts,transcripts.map(item=>({scenarioId:item.scenarioId,sha256:createHash('sha256').update(item.transcript,'utf8').digest('hex')})));
 assert(!JSON.stringify(actual).includes(transcripts[0].transcript));
 assert.match(actual.warning,/not a model evaluation/);
});

test('duplicate and unknown transcript cases still fail before creating a result',()=>{
 for(const transcripts of [[{scenarioId:'daily-p1',transcript:'Synthetic'},{scenarioId:'daily-p1',transcript:'Synthetic duplicate'}],[{scenarioId:'unknown-fixture',transcript:'Synthetic'}]]){
  const {result,output}=runFixture(transcripts);
  assert.notEqual(result.status,0);
  assert(!fs.existsSync(output));
 }
});
