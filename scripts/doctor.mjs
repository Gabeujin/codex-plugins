#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveDefaultDataRoot} from '../plugins/k-tech-radar/lib/paths.mjs';
import {dataRoot as kgjDataRoot} from '../plugins/kgj-design/lib/paths.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const privatePaths=process.argv.includes('--private-paths');
const probe=process.argv.includes('--probe-mcp');
const redact=p=>privatePaths?p:'<private-data-path>';
const version=command=>{const r=spawnSync(command,['--version'],{encoding:'utf8',timeout:10000,windowsHide:true});return r.status===0?r.stdout.trim()||r.stderr.trim():'unavailable';};
function protocol(base){
 if(!probe)return {status:'not-run',nextAction:'Pass --probe-mcp for initialize/list only; no tools are executed.'};
 const messages=[{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',capabilities:{},clientInfo:{name:'read-only-doctor',version:'1'}}},{jsonrpc:'2.0',method:'notifications/initialized'},{jsonrpc:'2.0',id:2,method:'tools/list'}];
 const r=spawnSync(process.execPath,['mcp/server.mjs'],{cwd:base,input:messages.map(x=>JSON.stringify(x)).join('\n')+'\n',encoding:'utf8',timeout:10000,windowsHide:true});
 try{const replies=r.stdout.trim().split(/\r?\n/).map(x=>JSON.parse(x));const init=replies.find(x=>x.id===1),list=replies.find(x=>x.id===2);if(r.status!==0||!init?.result?.protocolVersion||!Array.isArray(list?.result?.tools))throw new Error();return {status:'passed',protocolVersion:init.result.protocolVersion,toolCount:list.result.tools.length};}catch{return {status:'failed',nextAction:'Check Node PATH and plugin integrity. No tool call was made; raw output is withheld from shared diagnostics.'};}
}
function location(p){
 let candidate=p;while(!fs.existsSync(candidate)&&path.dirname(candidate)!==candidate)candidate=path.dirname(candidate);
 let access='unknown';try{fs.accessSync(candidate,fs.constants.R_OK|fs.constants.W_OK);access='OS access check passed; write probe not performed';}catch{access='access check failed; choose a writable explicit data directory';}
 return {path:redact(p),exists:fs.existsSync(p),access};
}
const plugins=['k-tech-radar','kgj-design','canvas-web-experiences'].map(name=>{
 const base=path.join(root,'plugins',name),manifest=JSON.parse(fs.readFileSync(path.join(base,'.codex-plugin/plugin.json'),'utf8'));
 return {name,version:manifest.version,mcp:manifest.mcpServers?{transport:'stdio',...protocol(base)}:'none',...(name==='k-tech-radar'?{data:location(resolveDefaultDataRoot()),legacyBundledData:{...location(path.join(base,'data')),nextAction:'No migration performed. To use an old catalog, explicitly set K_TECH_RADAR_DATA_DIR after verifying its files.'}}:name==='kgj-design'?{data:location(kgjDataRoot())}:{demoDependencies:fs.existsSync(path.join(base,'demo/node_modules'))?'installed; run tests to verify':'optional; run npm ci in demo to develop it'})};
});
const major=Number(process.versions.node.split('.')[0]);
console.log(JSON.stringify({schemaVersion:1,mode:'read-only',writesPerformed:false,networkProbes:false,platform:process.platform,architecture:process.arch,node:process.version,nodePolicy:[22,24].includes(major)?'maintained major; check latest security patch':major===20?'Node 20 EOL: upgrade to maintained Node 22/24':'outside tested major matrix',git:version('git'),python:version('python'),codex:'Run codex --version in the same shell used to start Codex; Desktop version is a separate manual check',home:redact(os.homedir()),plugins,nextAction:'Try the offline example first. A fresh Radar catalog is empty until an explicitly requested refresh.'},null,2));
