import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createDoctorReport,inspectPlugins,readMarketplacePlugins} from './doctor.mjs';

const pluginNames=['k-tech-radar','canvas-web-experiences','kgj-design','codex-daily-check'];
const writeJson=(file,value)=>{
 fs.mkdirSync(path.dirname(file),{recursive:true});
 fs.writeFileSync(file,JSON.stringify(value)+'\n',{encoding:'utf8',flag:'wx'});
};

function fixture(entries=pluginNames.map(name=>({name,source:{source:'local',path:'./plugins/'+name}}))){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'codex-doctor-fixture-'));
 writeJson(path.join(root,'.agents/plugins/marketplace.json'),{name:'synthetic-marketplace',plugins:entries});
 for(const name of new Set(entries.map(entry=>entry.name))){
  const manifest={name,version:'0.0.0-fixture'};
  if(['k-tech-radar','kgj-design'].includes(name))manifest.mcpServers='./.mcp.json';
  writeJson(path.join(root,'plugins',name,'.codex-plugin/plugin.json'),manifest);
 }
 return {root,environment:{LOCALAPPDATA:path.join(root,'user-data')},userHome:path.join(root,'user-home'),platform:'win32'};
}

function files(root){
 return fs.readdirSync(root,{recursive:true}).sort();
}

test('marketplace supplies all four plugins and only Canvas receives demo diagnostics',()=>{
 // 실제 사용자 데이터 대신 만든 경로만 확인하고 진단 전후 파일 목록을 대조
 const options=fixture(),before=files(options.root);
 const report=createDoctorReport({...options,runCommand:()=>({status:0,stdout:'synthetic-version',stderr:''})});
 assert.deepEqual(report.plugins.map(item=>item.name),pluginNames);
 assert.equal(report.plugins.find(item=>item.name==='codex-daily-check').diagnostic.status,'not-run');
 assert.equal(report.plugins.find(item=>item.name==='codex-daily-check').diagnostic.python,'3.12+');
 assert.equal(report.plugins.filter(item=>'demoDependencies' in item).length,1);
 assert.equal(report.plugins.find(item=>'demoDependencies' in item).name,'canvas-web-experiences');
 assert.deepEqual(report.plugins.filter(item=>'data' in item).map(item=>item.name),['k-tech-radar','kgj-design']);
 assert.equal(report.home,'<private-data-path>');
 assert(report.plugins.filter(item=>item.data).every(item=>item.data.path==='<private-data-path>'));
 assert.equal(report.writesPerformed,false);
 assert.equal(report.networkProbes,false);
 assert.deepEqual(files(options.root),before);
 assert(!fs.existsSync(options.environment.LOCALAPPDATA));
});

test('marketplace changes are read without adding unknown plugin capabilities',()=>{
 const names=[...pluginNames,'synthetic-extra'];
 const options=fixture(names.map(name=>({name,source:{source:'local',path:'./plugins/'+name}})));
 const plugins=inspectPlugins({...options,runCommand:()=>{throw new Error('No process expected');}});
 assert.deepEqual(plugins.map(item=>item.name),names);
 assert.deepEqual(plugins.at(-1),{name:'synthetic-extra',version:'0.0.0-fixture',mcp:'none'});
});

test('default doctor runs only version commands and leaves MCP unprobed',()=>{
 const calls=[];
 const report=createDoctorReport({...fixture(),runCommand:(command,args)=>{
  calls.push({command,args});
  return {status:0,stdout:'synthetic-version',stderr:''};
 }});
 assert.deepEqual(calls,[{command:'git',args:['--version']},{command:'python',args:['--version']}]);
 assert(report.plugins.filter(item=>item.mcp!=='none').every(item=>item.mcp.status==='not-run'));
});

test('opt-in MCP probe initializes and lists only the two configured MCP plugins',()=>{
 const calls=[];
 const plugins=inspectPlugins({...fixture(),probeMcp:true,runCommand:(command,args,options)=>{
  calls.push({command,args,options});
  return {status:0,stdout:[{jsonrpc:'2.0',id:1,result:{protocolVersion:'2025-11-25'}},{jsonrpc:'2.0',id:2,result:{tools:[{name:'synthetic_read'}]}}].map(item=>JSON.stringify(item)).join('\n')};
 }});
 assert.equal(calls.length,2);
 assert.deepEqual(calls.map(call=>path.basename(call.options.cwd)),['k-tech-radar','kgj-design']);
 for(const call of calls){
  assert.deepEqual(call.args,['mcp/server.mjs']);
  assert.deepEqual(call.options.input.trim().split('\n').map(line=>JSON.parse(line).method),['initialize','notifications/initialized','tools/list']);
 }
 assert(plugins.filter(item=>item.mcp!=='none').every(item=>item.mcp.status==='passed'&&item.mcp.toolCount===1));
});

test('failed MCP probes withhold raw output and do not imply successful diagnostics',()=>{
 const marker='synthetic-private-output';
 for(const runCommand of [()=>({status:1,stdout:marker,stderr:marker}),()=>{throw new Error(marker);}]){
  const plugins=inspectPlugins({...fixture(),probeMcp:true,runCommand});
  assert(plugins.filter(item=>item.mcp!=='none').every(item=>item.mcp.status==='failed'));
  assert(!JSON.stringify(plugins).includes(marker));
  assert.equal(plugins.find(item=>item.name==='codex-daily-check').diagnostic.status,'not-run');
 }
});

test('private-path mode is explicit and non-Windows native checks stay unlaunched',()=>{
 const options=fixture();
 const plugins=inspectPlugins({...options,privatePaths:true,platform:'linux',environment:{XDG_DATA_HOME:path.join(options.root,'xdg-data')}});
 assert(plugins.filter(item=>item.data).every(item=>item.data.path.startsWith(options.root)));
 const daily=plugins.find(item=>item.name==='codex-daily-check');
 assert.equal(daily.diagnostic.status,'not-run');
 assert.match(daily.diagnostic.nativeFixture,/unavailable/);
 assert(!('demoDependencies' in daily));
});

test('duplicate and escaping marketplace sources are rejected',()=>{
 const duplicate=fixture([{name:'synthetic-extra',source:{source:'local',path:'./plugins/synthetic-extra'}},{name:'synthetic-extra',source:{source:'local',path:'./plugins/synthetic-extra'}}]);
 assert.throws(()=>readMarketplacePlugins(duplicate.root),/duplicate/);
 const escape=fixture([{name:'synthetic-extra',source:{source:'local',path:'..'}}]);
 assert.throws(()=>readMarketplacePlugins(escape.root),/inside the repository/);
});

test('importing doctor performs no diagnostic command or output',()=>{
 const result=spawnSync(process.execPath,['--input-type=module','--eval',`await import(${JSON.stringify(new URL('./doctor.mjs',import.meta.url).href)})`],{encoding:'utf8',timeout:10000,windowsHide:true});
 assert.equal(result.status,0,result.stderr);
 assert.equal(result.stdout,'');
 assert.equal(result.stderr,'');
});
