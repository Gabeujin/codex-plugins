#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveDefaultDataRoot} from '../plugins/k-tech-radar/lib/paths.mjs';
import {dataRoot as kgjDataRoot} from '../plugins/kgj-design/lib/paths.mjs';
const repositoryRoot=fileURLToPath(new URL('../',import.meta.url));
const redact=(p,privatePaths)=>privatePaths?p:'<private-data-path>';

function version(command,runCommand){
 try{
  const result=runCommand(command,['--version'],{encoding:'utf8',timeout:10000,windowsHide:true});
  return result.status===0?result.stdout.trim()||result.stderr.trim():'unavailable';
 }catch{return 'unavailable';}
}

export function readMarketplacePlugins(root=repositoryRoot){
 const marketplace=JSON.parse(fs.readFileSync(path.join(root,'.agents/plugins/marketplace.json'),'utf8'));
 if(!Array.isArray(marketplace.plugins))throw new Error('Marketplace plugins must be an array');
 const names=new Set();
 return marketplace.plugins.map(entry=>{
  // 진단 목록과 배포 목록을 맞추고 저장소 밖의 소스를 읽지 않도록 확인
  if(typeof entry.name!=='string'||!entry.name||names.has(entry.name))throw new Error('Invalid or duplicate marketplace plugin');
  names.add(entry.name);
  if(entry.source?.source!=='local'||typeof entry.source.path!=='string')throw new Error('Doctor requires repository-local plugin sources');
  const base=path.resolve(root,entry.source.path);
  const relative=path.relative(fs.realpathSync(root),fs.realpathSync(base));
  if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw new Error('Plugin source must remain inside the repository');
  const manifest=JSON.parse(fs.readFileSync(path.join(base,'.codex-plugin/plugin.json'),'utf8'));
  if(manifest.name!==entry.name)throw new Error('Marketplace and plugin manifest names differ');
  return {name:entry.name,base,manifest};
 });
}

function protocol(base,probeMcp,runCommand,environment){
 if(!probeMcp)return {status:'not-run',nextAction:'Pass --probe-mcp for initialize/list only; no tools are executed.'};
 const messages=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'read-only-doctor',version:'1'}}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/list'}];
 try{
  const result=runCommand(process.execPath,['mcp/server.mjs'],{cwd:base,env:environment,input:messages.map(x=>JSON.stringify(x)).join('\n')+'\n',encoding:'utf8',timeout:10000,windowsHide:true});
  const replies=result.stdout.trim().split(/\r?\n/).map(x=>JSON.parse(x));
  const init=replies.find(x=>x.id===1),list=replies.find(x=>x.id===2);
  if(result.status!==0||!init?.result?.protocolVersion||!Array.isArray(list?.result?.tools))throw new Error('Incomplete protocol response');
  return {status:'passed',protocolVersion:init.result.protocolVersion,toolCount:list.result.tools.length};
 }catch{return {status:'failed',nextAction:'Check Node PATH and plugin integrity. No tool call was made; raw output is withheld from shared diagnostics.'};}
}

function location(p,privatePaths){
 let candidate=p;while(!fs.existsSync(candidate)&&path.dirname(candidate)!==candidate)candidate=path.dirname(candidate);
 let access='unknown';try{fs.accessSync(candidate,fs.constants.R_OK|fs.constants.W_OK);access='OS access check passed; write probe not performed';}catch{access='access check failed; choose a writable explicit data directory';}
 return {path:redact(p,privatePaths),exists:fs.existsSync(p),access};
}

export function inspectPlugins({root=repositoryRoot,privatePaths=false,probeMcp=false,environment=process.env,platform=process.platform,userHome=os.homedir(),runCommand=spawnSync}={}){
 return readMarketplacePlugins(root).map(({name,base,manifest})=>{
  // 플러그인별 기능을 구분해 진단만 제공하는 플러그인에 데모 검사를 붙이지 않도록 분리
  const result={name,version:manifest.version,mcp:manifest.mcpServers?{transport:'stdio',...protocol(base,probeMcp,runCommand,environment)}:'none'};
  if(name==='k-tech-radar'){
   result.data=location(resolveDefaultDataRoot({environment,platform,userHome,root:base}),privatePaths);
   result.legacyBundledData={...location(path.join(base,'data'),privatePaths),nextAction:'No migration performed. To use an old catalog, explicitly set K_TECH_RADAR_DATA_DIR after verifying its files.'};
  }else if(name==='kgj-design'){
   result.data=location(kgjDataRoot(environment,platform),privatePaths);
  }else if(name==='canvas-web-experiences'){
   result.demoDependencies=fs.existsSync(path.join(base,'demo/node_modules'))?'installed; run tests to verify':'optional; run npm ci in demo to develop it';
  }else if(name==='codex-daily-check'){
   result.diagnostic={status:'not-run',python:'3.12+',nativeFixture:platform==='win32'?'Windows desktop required; not launched':'Windows-only fixture unavailable on this platform',nextAction:'Start a new Codex task and request Codex Daily Check. No browser, native app, notification, or update was launched by doctor.'};
  }
  return result;
 });
}

export function createDoctorReport(options={}){
 const {privatePaths=false,platform=process.platform,userHome=os.homedir(),runCommand=spawnSync}=options;
 const major=Number(process.versions.node.split('.')[0]);
 return {schemaVersion:1,mode:'read-only',writesPerformed:false,networkProbes:false,platform,architecture:process.arch,node:process.version,nodePolicy:[22,24].includes(major)?'maintained major; check latest security patch':major===20?'Node 20 EOL: upgrade to maintained Node 22/24':'outside tested major matrix',git:version('git',runCommand),python:version('python',runCommand),codex:'Run codex --version in the same shell used to start Codex; Desktop version is a separate manual check',home:redact(userHome,privatePaths),plugins:inspectPlugins(options),nextAction:'Try a small first task. A fresh Radar catalog is empty until an explicitly requested refresh.'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 console.log(JSON.stringify(createDoctorReport({privatePaths:process.argv.includes('--private-paths'),probeMcp:process.argv.includes('--probe-mcp')}),null,2));
}
