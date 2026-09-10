#!/usr/bin/env node
// No imports from runtime paths, network calls, or filesystem writes.
import {createWatch,compareWatch} from '../lib/watch-brief.mjs';
const label='SYNTHETIC — NOT FOR RESEARCH';
const article={articleId:'synthetic:a',sourceId:'fictional-a',title:'Synthetic canvas accessibility example',canonicalUrl:'https://fictional-a.invalid/example',contentHash:'fixture-v1'};
const before={snapshotId:'synthetic:before',catalog:{articles:[article]},sourceState:{sources:{'fictional-a':{status:'ok',lastSuccessAt:'2026-01-01T00:00:00.000Z'}}}};
const after=structuredClone(before);after.snapshotId='synthetic:after';after.catalog.articles.push({...article,articleId:'synthetic:b',title:'Synthetic canvas keyboard example'});
console.log(JSON.stringify({label,networkUsed:false,userDataWritten:false,brief:compareWatch(createWatch('canvas',before),after),applicationExample:{label,decision:'Keep keyboard controls alongside canvas interactions',limitation:'Fictional teaching example; no real research evidence or citation.'}},null,2));
