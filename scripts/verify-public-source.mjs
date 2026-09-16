import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {inspectFile} from './public-safety.mjs';
const args=process.argv.slice(2),index=args.indexOf('--directory');
const root=index>=0?path.resolve(args[index+1]):fileURLToPath(new URL('../',import.meta.url));
const mode=index>=0?'complete-directory':'git-tracked-source';
const findings=[];let files=[];
function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){
 const absolute=path.join(dir,item.name),name=path.relative(root,absolute).split(path.sep).join('/');
 if(item.isSymbolicLink()){findings.push({file:name,reasons:['symbolic-link']});continue;}
 if(item.isDirectory())walk(absolute);else files.push(name);
}}
if(index>=0)walk(root);else files=execFileSync('git',['ls-files','-z'],{cwd:root}).toString('utf8').split('\0').filter(Boolean);
for(const file of files){
 const absolute=path.join(root,file);
 let reasons;
 try{const stat=fs.lstatSync(absolute);reasons=stat.isSymbolicLink()?['symbolic-link']:inspectFile(file,fs.readFileSync(absolute));}
 catch{reasons=['missing-or-unreadable'];}
 if(reasons.length)findings.push({file,reasons});
}
try{
 const market=JSON.parse(fs.readFileSync(path.join(root,'.agents/plugins/marketplace.json'),'utf8'));
 assert.equal(market.name,'gabeujin-plugins');
 assert.deepEqual(market.plugins.map(p=>p.name),['k-tech-radar','canvas-web-experiences','kgj-design','codex-daily-check']);
 for(const entry of market.plugins){
  assert.equal(entry.source.source,'local');assert.equal(entry.source.path,`./plugins/${entry.name}`);
  const plugin=path.join(root,entry.source.path),manifest=JSON.parse(fs.readFileSync(path.join(plugin,'.codex-plugin/plugin.json'),'utf8'));
  assert.equal(manifest.name,entry.name);
  for(const ref of [manifest.skills,manifest.mcpServers].filter(Boolean)){
   const resolved=path.resolve(plugin,ref);assert(resolved.startsWith(plugin+path.sep));assert(fs.existsSync(resolved));
  }
 }
}catch{findings.push({file:'.agents/plugins/marketplace.json',reasons:['structure-or-reference-error']});}
console.log(JSON.stringify({schemaVersion:1,status:findings.length?'failed':'passed',mode,files:files.length,findings,scope:'Bounded credential and file-class heuristics, strict UTF-8, links and manifest references. Not a security guarantee; review newly added data.'},null,2));
process.exitCode=findings.length?1:0;
