import {createHash} from 'node:crypto';
import {stableJson} from './integrity.mjs';
const hash=value=>createHash('sha256').update(stableJson(value)).digest('hex');
const text=(value,name)=>{if(typeof value!=='string'||!value.trim()||value.length>200)throw new Error(`${name} must be 1-200 characters`);return value.trim();};
export function createWatch(topic,snapshot){
 topic=text(topic,'topic');
 if(!snapshot?.snapshotId||!Array.isArray(snapshot.catalog?.articles))throw new Error('Committed snapshot required');
 const baseline=project(snapshot,topic);
 const identity={schemaVersion:1,topic,baselineSnapshotId:snapshot.snapshotId,baseline};
 return {...identity,baselineHash:hash(identity)};
}
function project(snapshot,topic){
 const terms=topic.toLowerCase().split(/\s+/u);
 const byId=new Map();
 for(const a of snapshot.catalog.articles){
  if(!a||!['articleId','canonicalUrl','sourceId','title'].every(k=>typeof a[k]==='string'&&a[k].trim()))throw new Error('Article identity, source, title and URL required');
  if(a.contentHash!==undefined&&(typeof a.contentHash!=='string'||!a.contentHash))throw new Error('Invalid content hash');
  const hay=[a.title,a.summary,...(a.tags??[])].join(' ').toLowerCase();
  if(!terms.every(t=>hay.includes(t))||(a.recordStatus??'active')!=='active')continue;
  const record={articleId:a.articleId,sourceId:a.sourceId,title:a.title,url:a.canonicalUrl,contentHash:a.contentHash??hash({title:a.title,summary:a.summary??'',tags:a.tags??[]})};
  if(byId.has(a.articleId)&&stableJson(byId.get(a.articleId))!==stableJson(record))throw new Error('Conflicting duplicate article identity');
  byId.set(a.articleId,record);
 }
 return [...byId.values()].sort((a,b)=>a.articleId.localeCompare(b.articleId,'en'));
}
export function compareWatch(watch,snapshot){
 if(watch?.schemaVersion!==1||!Array.isArray(watch.baseline)||!watch.baselineSnapshotId)throw new Error('Unsupported watch schema or missing baseline');
 if(watch.baselineHash!==hash({schemaVersion:watch.schemaVersion,topic:watch.topic,baselineSnapshotId:watch.baselineSnapshotId,baseline:watch.baseline}))throw new Error('Watch baseline hash mismatch; retain and inspect the original baseline');
 const next=createWatch(watch.topic,snapshot),old=new Map(watch.baseline.map(a=>[a.articleId,a]));
 const sources=Object.entries(snapshot.sourceState?.sources??{}).sort(([a],[b])=>a.localeCompare(b,'en'));
 if(sources.some(([,s])=>!s||typeof s!=='object'||Array.isArray(s)||typeof s.status!=='string'))throw new Error('Invalid source state record');
 return {schemaVersion:1,topic:watch.topic,baselineSnapshotId:watch.baselineSnapshotId,snapshotId:snapshot.snapshotId,
  newArticles:next.baseline.filter(a=>!old.has(a.articleId)),
  changedArticles:next.baseline.filter(a=>old.has(a.articleId)&&stableJson(a)!==stableJson(old.get(a.articleId))),
  sourceFailures:sources.filter(([,s])=>['error','failed','blocked','timeout'].includes(s.status)).map(([sourceId,s])=>({sourceId,status:s.status,errorCode:s.errorCode??null,lastSuccessAt:s.lastSuccessAt??null})),
  sourceFreshness:sources.map(([sourceId,s])=>({sourceId,lastSuccessAt:s.lastSuccessAt??null})),
  note:'No collection or baseline update was performed. Missing articles are not proof of publisher deletion.'};
}
