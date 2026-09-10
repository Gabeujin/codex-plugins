#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {dataRoot,loadSnapshotContext,loadConfig,readJson,taxonomyPath} from '../lib/paths.mjs';
import {validateSnapshotBundle} from '../lib/integrity.mjs';
import {createWatch,compareWatch} from '../lib/watch-brief.mjs';
const [action,...words]=process.argv.slice(2);const topic=words.join(' ').trim();
if(!['save','brief'].includes(action)||!topic)throw new Error('Usage: node scripts/watch-topic.mjs save|brief "topic"');
const snapshot=await loadSnapshotContext();
validateSnapshotBundle(snapshot,await loadConfig(),await readJson(taxonomyPath));
const watch=createWatch(topic,snapshot);
const file=join(dataRoot,'watches',createHash('sha256').update(topic).digest('hex')+'.json');
if(action==='save'){
 await mkdir(join(dataRoot,'watches'),{recursive:true});
 await writeFile(file,JSON.stringify(watch,null,2)+'\n',{encoding:'utf8',flag:'wx'});
 console.log(JSON.stringify({status:'saved',topic,baselineSnapshotId:watch.baselineSnapshotId,note:'Existing baselines are never overwritten.'}));
}else console.log(JSON.stringify(compareWatch(JSON.parse(await readFile(file,'utf8')),snapshot),null,2));
