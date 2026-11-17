import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {LineageStore} from '../lib/lineage.mjs';
import {prepareModelChoice, resolveModelChoice, getModelChoice} from '../lib/model-choice.mjs';

const id='00000000-0000-0000-0000-000000000001';
const catalog=JSON.stringify([{model:'gpt-6-luna',efforts:['low']},{model:'gpt-6.1-terra',efforts:['medium']},
  {model:'gpt-6.1-sol',efforts:['low','medium','high','xhigh']},{model:'gpt-6-astra',efforts:['low','high']}]);
const fixture=()=>new LineageStore(fs.mkdtempSync(path.join(os.tmpdir(),'model-choice-fixture-')));
const request=(extra={})=>({thread_id:id,scope_key:'sample-1',task_description:'합성 계산 검증',destination_host:'local',
  default_model:'gpt-6.1-sol',default_effort:'high',workload:'extraction',live_catalog:catalog,...extra});
const reply=(choice,answer)=>({choice_id:choice.choiceId,reply:answer,human_evidence:'Synthetic human answer fixture; no actual authorization is asserted.'});

test('no response stays pending across restart and exposes no create overrides',()=>{
  const store=fixture(), prepared=prepareModelChoice(store,request());
  assert.equal(prepared.state,'pending');assert.equal(prepared.createOverrides,null);
  assert(prepared.question.includes('gpt-6-luna / low'));assert(prepared.question.includes('gpt-6.1-sol / high'));
  const resumed=getModelChoice(new LineageStore(store.directory),prepared.choiceId);
  assert.equal(resumed.createOverrides,null);assert.equal(prepareModelChoice(store,request()).choiceId,prepared.choiceId);
});
test('human Y selects exactly the named model/effort; N omits both fields',()=>{
  const store=fixture(), yes=prepareModelChoice(store,request());
  assert.deepEqual(resolveModelChoice(store,reply(yes,'Y')).createOverrides,{model:'gpt-6-luna',thinking:'low'});
  const no=prepareModelChoice(store,request({scope_key:'sample-2',workload:'scoped_fix'}));
  const declined=resolveModelChoice(store,reply(no,'N'));
  assert.equal(declined.state,'declined');assert.deepEqual(declined.createOverrides,{});
  assert(!Object.hasOwn(declined.createOverrides,'model'));assert(!Object.hasOwn(declined.createOverrides,'thinking'));
});
test('same reply is idempotent and changed/empty/agent-implied answers do not replace it',()=>{
  const store=fixture(), choice=prepareModelChoice(store,request());
  assert.throws(()=>resolveModelChoice(store,reply(choice,'')));
  assert.throws(()=>resolveModelChoice(store,reply(choice,'maybe')));
  assert.throws(()=>resolveModelChoice(store,{...reply(choice,'Y'),human_evidence:''}));
  const result=resolveModelChoice(store,reply(choice,'Y'));
  assert.deepEqual(resolveModelChoice(store,reply(choice,' y ')),result);
  assert.throws(()=>resolveModelChoice(store,reply(choice,'N')),/new scope/);
});
test('task, destination, recommendation and default changes supersede old pending answers',()=>{
  // 같은 작업 키라도 제안 내용이 달라지면 이전 응답을 재사용할 수 없는지 확인
  const changes=[{task_description:'다른 합성 작업'},{destination_host:'remote-fixture'},{workload:'technical'},{default_effort:'medium'}];
  for(const change of changes){
    const store=fixture(), old=prepareModelChoice(store,request()), next=prepareModelChoice(store,request(change));
    assert.notEqual(next.choiceId,old.choiceId);assert.equal(getModelChoice(store,old.choiceId).active,false);
    assert.equal(getModelChoice(store,old.choiceId).createOverrides,null);
    assert.throws(()=>resolveModelChoice(store,reply(old,'Y')),/Stale/);
    assert.equal(next.state,'pending');assert.equal(next.createOverrides,null);
  }
});
test('old approved decisions cannot execute after a newer proposal or silently revive',()=>{
  const store=fixture(), old=prepareModelChoice(store,request());resolveModelChoice(store,reply(old,'Y'));
  prepareModelChoice(store,request({workload:'technical'}));
  assert.equal(getModelChoice(store,old.choiceId).createOverrides,null);
  assert.throws(()=>resolveModelChoice(store,reply(old,'Y')),/Stale/);
  assert.throws(()=>prepareModelChoice(store,request()),/new scope/);
});
test('catalog removal invalidates both pending and approved choices in the same scope',()=>{
  for(const approved of [false,true]){
    const store=fixture(),old=prepareModelChoice(store,request());
    if(approved)resolveModelChoice(store,reply(old,'Y'));
    const unavailable=prepareModelChoice(store,request({live_catalog:JSON.stringify([{model:'gpt-6.1-sol',efforts:['high']}])}));
    assert.equal(unavailable.state,'unavailable');assert.deepEqual(unavailable.createOverrides,{});
    assert.equal(getModelChoice(store,old.choiceId).active,false);
    assert.equal(getModelChoice(store,old.choiceId).createOverrides,null);
    assert.throws(()=>resolveModelChoice(store,reply(old,'Y')),/Stale/);
  }
});
test('Astra requires necessity and remains low; unavailable proposals preserve native defaults',()=>{
  const store=fixture();
  assert.throws(()=>prepareModelChoice(store,request({user_model:'gpt-6-astra'})),/necessity/);
  assert.throws(()=>prepareModelChoice(store,request({astra_necessity:'Synthetic Sol failure',user_effort:'high'})),/remain low/);
  const astra=prepareModelChoice(store,request({astra_necessity:'Synthetic Sol failure'}));
  assert.deepEqual(resolveModelChoice(store,reply(astra,'Y')).createOverrides,{model:'gpt-6-astra',thinking:'low'});
  const unavailable=prepareModelChoice(store,request({scope_key:'missing',workload:'scoped_fix',live_catalog:JSON.stringify([{model:'gpt-6.1-sol',efforts:['high']}])}));
  assert.equal(unavailable.state,'unavailable');assert.deepEqual(unavailable.createOverrides,{});
});
test('corrupt choice binding fails before unrelated registry writes and preserves prior bytes',()=>{
  const store=fixture(), choice=prepareModelChoice(store,request());
  const value=store.read();value.modelChoices.requests[choice.choiceId].proposal.model='changed';
  fs.writeFileSync(store.file,JSON.stringify(value),'utf8');const before=fs.readFileSync(store.file,'utf8');
  assert.throws(()=>store.register({thread_id:id}),/binding/);
  assert.equal(fs.readFileSync(store.file,'utf8'),before);
});
test('real stdio tools prepare a pending choice and resolve a synthetic human N after restart',()=>{
  // 실제 MCP 경로를 검사하되 모델 실행이나 실제 사용자의 동의로 처리하지 않음
  const store=fixture(), server=fileURLToPath(new URL('../mcp/server.mjs',import.meta.url));
  const call=(n,name,args)=>({jsonrpc:'2.0',id:n,method:'tools/call',params:{name,arguments:args}});
  const run=messages=>{
    const result=spawnSync(process.execPath,[server],{input:messages.map(x=>JSON.stringify(x)).join('\n')+'\n',encoding:'utf8',timeout:10000,windowsHide:true,env:{...process.env,SESSION_STATUS_DATA_DIR:store.directory}});
    assert.equal(result.status,0,result.stderr);return result.stdout.trim().split('\n').map(line=>JSON.parse(line));
  };
  const init={jsonrpc:'2.0',id:1,method:'initialize',params:{}};
  const first=run([init,call(2,'prepare_model_choice',request())]);
  const prepared=JSON.parse(first[1].result.content[0].text);assert.equal(prepared.createOverrides,null);
  const second=run([init,call(2,'resolve_model_choice',reply(prepared,'N')),call(3,'get_model_choice',{choice_id:prepared.choiceId})]);
  assert.deepEqual(JSON.parse(second[1].result.content[0].text).createOverrides,{});
  assert.equal(JSON.parse(second[2].result.content[0].text).state,'declined');
});
