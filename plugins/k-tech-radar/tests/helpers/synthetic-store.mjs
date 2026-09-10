// Fictional offline fixtures only. Never merge these records into research data.
import { mkdir, mkdtemp, cp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildSearchIndex } from '../../lib/index.mjs';
import { buildSnapshotIdentity, completeSourceStateRecord, configurationHash, partitionFingerprint, taxonomyHash } from '../../lib/integrity.mjs';
import { pluginRoot as sourceRoot } from '../../lib/paths.mjs';
const config = {
  discoveryReferences: [{id: "velopers", url: "https://discovery.invalid", role: "synthetic", ingest: false, reason: "Offline test fixture, not a real source"}],
  sources: [
    {
      id: "source-a",
      companyId: "company-a",
      displayName: "Synthetic A", policy: {authority: "official-primary", storesFullText: false},
      homepage: "https://a.invalid",
      adapter: {
        type: "feed",
        url: "https://a.invalid/feed"
      }
    },
    {
      id: "source-b",
      companyId: "company-b",
      displayName: "Synthetic B", policy: {authority: "official-primary", storesFullText: false},
      homepage: "https://b.invalid",
      adapter: {
        type: "feed",
        url: "https://b.invalid/feed"
      }
    }
  ]
};
const taxonomy = {
  domains: [],
  problemTypes: []
};

function article(sourceId, companyId, suffix) {
  return {
    articleId: `${sourceId}:${suffix}`,
    sourceId,
    companyId,
    sourceName: `Synthetic ${sourceId}`,
    publisherUpdatedAt: null,
    canonicalUrl: `https://${suffix[0]}.invalid/${suffix}`,
    canonicalWorkId: `work:${suffix}`,
    workIndependenceStatus: "confirmed-original",
    title: `SYNTHETIC NOT FOR RESEARCH BFF ${suffix}`,
    summary: `Summary ${suffix}`,
    authors: [],
    tags: [],
    domainIds: [],
    problemTypeIds: [],
    metadataState: "metadata-only",
    contentHash: suffix.padEnd(64, "a").slice(0, 64),
    ontologyHash: suffix.padEnd(64, "b").slice(0, 64),
    taxonomyHash: taxonomyHash(taxonomy),
    recordStatus: "active",
    publishedAt: "2026-07-30T00:00:00.000Z",
    revisions: [
      {
        revisionHash: suffix
          .padEnd(64, "c")
          .slice(0, 64),
        observedAt: "2026-07-29T00:00:00.000Z",
        title: `Prior ${suffix}`,
        summary: `Prior summary ${suffix}`,
        publishedAt: "2026-07-29T00:00:00.000Z",
        publisherUpdatedAt: null,
        authors: [],
        tags: []
      }
    ]
  };
}

function validBundle() {
  const committedAt = "2026-07-30T00:00:00.000Z";
  const articles = [
    article("source-a", "company-a", "a1"),
    article("source-b", "company-b", "b1")
  ];
  const index = buildSearchIndex(articles, committedAt);
  index.snapshotId = null;
  const partitions = Object.fromEntries(
    config.sources.map((source) => {
      const records = articles.filter(
        (item) => item.sourceId === source.id
      );
      return [
        source.id,
        {
          schemaVersion: 2,
          sourceId: source.id,
          companyId: source.companyId,
          snapshotId: null,
          refreshedAt: committedAt,
          dataAsOf: committedAt,
          lastAttemptAt: committedAt,
          lastSuccessAt: committedAt,
          collectionStatus: "ok",
          recordCount: records.length,
          sourceHash: partitionFingerprint(records),
          articles: records
        }
      ];
    })
  );
  const sourceState = {
    schemaVersion: 2,
    updatedAt: committedAt,
    collectionStatus: "ok",
    snapshotId: null,
    sources: Object.fromEntries(
      config.sources.map((source) => [
        source.id,
        completeSourceStateRecord({
          status: "ok",
          lastCheckedAt: committedAt,
          lastAttemptAt: committedAt,
          lastSuccessAt: committedAt,
          dataAsOf: committedAt,
          articleCountSeen: 1,
          endpoint: `${source.homepage}/feed`,
          durationMs: 10,
          warningCount: 0
        })
      ])
    )
  };
  const collection = {
    status: "ok",
    attemptedAt: committedAt,
    mode: "test",
    requestedSourceIds: ["source-a", "source-b"],
    succeededSourceIds: ["source-a", "source-b"],
    failedSourceIds: [],
    unselectedSourceIds: []
  };
  const changeSet = {
    newArticleIds: [],
    updatedArticleIds: [],
    reclassifiedArticleIds: [],
    migratedArticleIds: []
  };
  const catalog = {
    schemaVersion: 2,
    view: "derived-from-source-partitions",
    refreshedAt: committedAt,
    lastAttemptAt: committedAt,
    collectionStatus: "ok",
    taxonomyHash: taxonomyHash(taxonomy),
    configHash: configurationHash(config),
    snapshotId: null,
    catalogHash: index.catalogHash,
    articles
  };
  const identity = buildSnapshotIdentity({
    visibility: "local",
    configHash: configurationHash(config),
    taxonomyHash: taxonomyHash(taxonomy),
    catalogHash: index.catalogHash,
    catalog,
    searchIndex: index,
    partitions,
    sourceState,
    collection,
    committedAt,
    changeSet
  });
  catalog.snapshotId = identity.snapshotId;
  index.snapshotId = identity.snapshotId;
  sourceState.snapshotId = identity.snapshotId;
  for (const partition of Object.values(partitions)) {
    partition.snapshotId = identity.snapshotId;
  }
  return {
    schemaVersion: 2,
    visibility: "local",
    snapshotId: identity.snapshotId,
    integrityHash: identity.integrityHash,
    committedAt,
    configHash: configurationHash(config),
    taxonomyHash: taxonomyHash(taxonomy),
    collection,
    changeSet,
    catalog,
    searchIndex: index,
    sourceState,
    partitions
  };
}

function baseEntry() {
  return {
    kind: "cross-source-synthesis",
    title: "기술 부채를 줄이는 점진적 전환",
    summary: "관측성, 작은 배치, 롤백을 결합하는 가설",
    sourceIds: ["source-a", "source-b"],
    articleIds: ["source-a:a1", "source-b:b1"],
    evidence: [
      {
        sourceId: "source-a",
        articleId: "source-a:a1",
        claim: "점진적 전환을 관찰했다.",
        locator: "section-a",
        evidenceLevel: "article-observation",
        role: "observed"
      },
      {
        sourceId: "source-b",
        articleId: "source-b:b1",
        claim: "롤백 기준을 권고했다.",
        locator: "section-b",
        evidenceLevel: "author-claim",
        role: "recommended"
      }
    ],
    counterEvidence: ["두 사례의 런타임과 규모는 다르다."],
    contextComparisons: [
      {
        sourceId: "source-a",
        comparability: "conditional",
        note: "스택 재검증 필요"
      },
      {
        sourceId: "source-b",
        comparability: "conditional",
        note: "트래픽 재검증 필요"
      }
    ],
    status: "reviewed"
  };
}


export async function createSyntheticPlugin() {
 const root=await mkdtemp(join(tmpdir(),'k-tech-radar-synthetic-'));
 for(const folder of ['lib','mcp','config','ontology','scripts']) await cp(join(sourceRoot,folder),join(root,folder),{recursive:true});
 await mkdir(join(root,'data'));
 const snapshot=validBundle();
 const dictionary={schemaVersion:2,revision:0,updatedAt:null,entries:[],revisions:[],idempotency:{}};
 for(const [file,value] of Object.entries({'config/sources.json':config,'ontology/domain-taxonomy.json':taxonomy,'data/snapshot.json':snapshot,'data/dictionary.json':dictionary,'data/insight-runs.json':{schemaVersion:1,revision:0,updatedAt:null,runs:[],idempotency:{}}})) await writeFile(join(root,file),JSON.stringify(value,null,2)+'\n','utf8');
 const script=`const RealDate=Date; globalThis.Date=class extends RealDate {constructor(...args){super(...(args.length?args:['2026-07-30T00:00:00.000Z']));}};
 const {recordDictionaryEntry}=await import('./lib/dictionary.mjs');
 const input=${JSON.stringify(baseEntry())};
 const catalog=${JSON.stringify(snapshot.catalog)};
 const taxonomy=${JSON.stringify(taxonomy)};
 const first=await recordDictionaryEntry(input,catalog,taxonomy,{idempotencyKey:'synthetic-create-001'});
 await recordDictionaryEntry({...input,entryId:first.entryId,summary:'SYNTHETIC revised conditional hypothesis'},catalog,taxonomy,{idempotencyKey:'synthetic-update-002',expectedRevision:1});`;
 execFileSync(process.execPath,['--input-type=module','--eval',script],{cwd:root,env:{...process.env,K_TECH_RADAR_DATA_DIR:join(root,'data')},stdio:'pipe'});
 return root;
}
