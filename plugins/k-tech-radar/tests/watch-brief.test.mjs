import test from 'node:test';
import assert from 'node:assert/strict';
import {createWatch,compareWatch} from '../lib/watch-brief.mjs';
const a={articleId:'a',sourceId:'a',title:'canvas',canonicalUrl:'https://a.invalid/a',contentHash:'1'};
const s={snapshotId:'one',catalog:{articles:[a]},sourceState:{sources:{a:{status:'error',errorCode:'TIMEOUT',lastSuccessAt:null}}}};
test('watch delta is deterministic, deduplicated and preserves failures/freshness',()=>{
 const w=createWatch('canvas',s);const next=structuredClone(s);next.snapshotId='two';next.catalog.articles=[{...a,contentHash:'2'},{...a,articleId:'b'},{...a,articleId:'b'}];
 const result=compareWatch(w,next);assert.equal(result.newArticles.length,1);assert.equal(result.changedArticles.length,1);assert.equal(result.sourceFailures[0].errorCode,'TIMEOUT');assert.deepEqual(compareWatch(w,next),result);assert.equal(w.baseline[0].contentHash,'1');
});
test('same baseline is empty and malformed schema/conflicting identity is refused',()=>{
 assert.equal(compareWatch(createWatch('canvas',s),s).newArticles.length,0);
 assert.throws(()=>compareWatch({schemaVersion:2},s));assert.throws(()=>createWatch('',s));
 assert.throws(()=>createWatch('canvas',{...s,catalog:{articles:[a,{...a,contentHash:'2'}]}}),/Conflicting/);
});
test('watch identity and malformed source records fail closed',()=>{
 const w=createWatch('canvas',s);
 for(const field of ['topic','baselineSnapshotId'])assert.throws(()=>compareWatch({...w,[field]:'forged'},s),/hash mismatch/);
 assert.throws(()=>compareWatch(w,{...s,sourceState:{sources:{x:null}}}),/Invalid source state/);
 assert.throws(()=>createWatch('canvas',{...s,catalog:{articles:[{...a,sourceId:''}]}}),/source/);
 const unknown={...s,sourceState:{sources:{a:{status:'never-checked',lastSuccessAt:null}}}};
 assert.equal(compareWatch(w,unknown).sourceFailures.length,0);
});
