import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

import { exportPublicSnapshot } from "../lib/public-export.mjs";
import {
  buildPublicDataCommitment,
  loadBoundPublicData,
  publicDictionaryRevisionPins,
  validatePublicDataObjects
} from "../lib/public-data.mjs";
import {
  dictionaryCanonicalClaimHash,
  dictionaryPayloadHash,
  dictionaryPublicationGate,
  validateDictionaryEntry
} from "../lib/dictionary.mjs";
import {
  buildSnapshotIdentity,
  stableJson,
  taxonomyHash
} from "../lib/integrity.mjs";
import { pluginRoot } from "../lib/paths.mjs";
import { calculateNegativeReviewScore } from "../lib/quality-score.mjs";
import { sha256 } from "../lib/text.mjs";

const execFileAsync = promisify(execFile);

async function publicDictionaryFixture(
  root,
  finalP2,
  { injectUnknownField = false } = {}
) {
  const sourceDataRoot = join(root, "source");
  await mkdir(sourceDataRoot, { recursive: true });
  const [snapshot, dictionary, taxonomy] =
    await Promise.all([
      readFile(
        join(pluginRoot, "data", "snapshot.json"),
        "utf8"
      ).then(JSON.parse),
      readFile(
        join(pluginRoot, "data", "dictionary.json"),
        "utf8"
      ).then(JSON.parse),
      readFile(
        join(
          pluginRoot,
          "ontology",
          "domain-taxonomy.json"
        ),
        "utf8"
      ).then(JSON.parse)
    ]);
  const previous = dictionary.entries[0];
  const promotedInput = {
    ...structuredClone(previous),
    status: "verified",
    visibility: "public",
    qualityReview: {
      reviewedAt: "2026-07-31T00:00:00.000Z",
      rounds: [1, 2, 3].map((round) => {
        const counts = {
          p0: 0,
          p1: 0,
          p2:
            round === 3
              ? finalP2
              : round === 1
                ? 1
                : 0
        };
        return {
          round,
          ...counts,
          score: calculateNegativeReviewScore(counts),
          summary:
            `LOCAL_REVIEW_SUMMARY_SENTINEL round ${round}`,
          evidenceRefs: [
            {
              kind: "review-report",
              content:
                `public negative review round ${round}`
            }
          ]
        };
      })
    }
  };
  if (calculateNegativeReviewScore({
    p0: 0,
    p1: 0,
    p2: finalP2
  }) < 9.9) {
    dictionary.entries = [promotedInput];
  } else {
    const validated = validateDictionaryEntry(
      promotedInput,
      snapshot.catalog,
      taxonomy
    );
    const payloadHash =
      dictionaryPayloadHash(validated);
    const evidenceSnapshot = {
      snapshotId: snapshot.snapshotId,
      taxonomyHash: taxonomyHash(taxonomy),
      articles: validated.articleIds.map((articleId) => {
        const article = snapshot.catalog.articles.find(
          (candidate) =>
            candidate.articleId === articleId
        );
        return {
          articleId,
          sourceId: article.sourceId,
          contentHash: article.contentHash,
          revisionHash:
            article.revisionHash ??
            article.contentHash,
          ontologyHash: article.ontologyHash
        };
      })
    };
    const provenanceHash = sha256(
      stableJson({
        evidenceSnapshot,
        sourceIds: [...validated.sourceIds].sort(),
        articleIds: [...validated.articleIds].sort(),
        evidence: validated.evidence,
        contextComparisons:
          validated.contextComparisons,
        counterEvidence: validated.counterEvidence,
        application: validated.application,
        status: validated.status,
        visibility: validated.visibility
      })
    );
    const entryRevision = previous.entryRevision + 1;
    const revisionId = `dictrev:${sha256(
      stableJson({
        entryId: previous.entryId,
        entryRevision,
        requestHash: payloadHash,
        provenanceHash
      })
    ).slice(0, 24)}`;
    const promoted = {
      ...validated,
      entryRevision,
      revisionId,
      supersedesRevisionId: previous.revisionId,
      provenanceHash,
      payloadHash,
      canonicalClaimHash:
        dictionaryCanonicalClaimHash(validated),
      evidenceSnapshot:
        evidenceSnapshot,
      publisherContentTrust:
        structuredClone(
          previous.publisherContentTrust
        ),
      createdAt: previous.createdAt,
      updatedAt: "2026-07-31T00:00:00.000Z"
    };
    if (injectUnknownField) {
      promoted.privateNotes =
        "must never cross the public export boundary";
    }
    dictionary.entries = [promoted];
    const idempotencyKey =
      "public-export-test-001";
    dictionary.revisions.push({
      ...structuredClone(promoted),
      recordedAt: "2026-07-31T00:00:00.000Z",
      idempotencyKey,
      noveltyAssessment: {
        decision: "update-existing"
      }
    });
    const committedRevision =
      Number(dictionary.revision) + 1;
    dictionary.idempotency ??= {};
    dictionary.idempotency[idempotencyKey] = {
      inputHash: sha256(stableJson(promotedInput)),
      requestHash: payloadHash,
      entryId: promoted.entryId,
      revisionId,
      committedRevision
    };
    dictionary.revision = committedRevision;
    dictionary.updatedAt =
      "2026-07-31T00:00:00.000Z";
  }
  await Promise.all([
    writeFile(
      join(sourceDataRoot, "snapshot.json"),
      `${JSON.stringify(snapshot, null, 2)}\n`,
      "utf8"
    ),
    writeFile(
      join(sourceDataRoot, "dictionary.json"),
      `${JSON.stringify(dictionary, null, 2)}\n`,
      "utf8"
    )
  ]);
  return {
    sourceDataRoot,
    entry: dictionary.entries[0]
  };
}

test("public snapshot export preserves partitions but removes local evidence", async () => {
  const parent = await mkdtemp(
    join(tmpdir(), "k-tech-radar-public-data-")
  );
  const outputDataRoot = join(parent, "data");
  const result = await exportPublicSnapshot({
    pluginRoot,
    sourceDataRoot: join(pluginRoot, "data"),
    outputDataRoot,
    timestamp: "2026-07-31T00:00:00.000Z"
  });
  assert.equal(result.visibility, "public");
  assert.ok(result.articleCount > 0);
  assert.equal(result.dictionaryEntryCount, 0);
  assert.equal(result.insightRunCount, 0);
  assert.equal(
    result.publisherExcerptPolicy,
    "metadata-only"
  );

  const [snapshot, dictionary, insightRuns] =
    await Promise.all([
      readFile(
        join(outputDataRoot, "snapshot.json"),
        "utf8"
      ).then(JSON.parse),
      readFile(
        join(outputDataRoot, "dictionary.json"),
        "utf8"
      ).then(JSON.parse),
      readFile(
        join(outputDataRoot, "insight-runs.json"),
        "utf8"
      ).then(JSON.parse)
    ]);
  assert.equal(snapshot.visibility, "public");
  assert.equal(
    snapshot.catalog.articles.length,
    result.articleCount
  );
  assert.ok(
    snapshot.catalog.articles.every(
      (article) =>
        article.summary === "" &&
        article.storagePolicy.storesFullText === false &&
        article.storagePolicy.publicSnapshot ===
          "metadata-only"
    )
  );
  assert.equal(dictionary.entries.length, 0);
  assert.equal(dictionary.revisions.length, 0);
  assert.equal(insightRuns.runs.length, 0);

  const revisedArticle =
    snapshot.catalog.articles.find(
      (article) => article.revisions?.length
    );
  assert.ok(
    revisedArticle,
    "fixture must retain a revision-bearing public article"
  );
  const runtimeScript = [
    "const { createMcpRuntime } = await import('./mcp/runtime.mjs');",
    "const runtime = createMcpRuntime({ publicMode: true });",
    "await runtime.handleRequest({ method: 'initialize', params: { protocolVersion: '2025-11-25' } });",
    "const article = await runtime.handleRequest({ method: 'tools/call', params: { name: 'get_article', arguments: { articleId: process.env.K_TECH_RADAR_TEST_ARTICLE_ID } } });",
    "const fusion = await runtime.handleRequest({ method: 'tools/call', params: { name: 'prepare_fusion_evidence', arguments: { query: process.env.K_TECH_RADAR_TEST_QUERY } } });",
    "process.stdout.write(JSON.stringify({ articleError: article.isError, fusionError: fusion.isError }));"
  ].join("\n");
  const runtimeResult = await execFileAsync(
    process.execPath,
    ["--input-type=module", "--eval", runtimeScript],
    {
      cwd: pluginRoot,
      env: {
        ...process.env,
        K_TECH_RADAR_DATA_DIR: outputDataRoot,
        K_TECH_RADAR_TEST_ARTICLE_ID:
          revisedArticle.articleId,
        K_TECH_RADAR_TEST_QUERY:
          revisedArticle.title
      }
    }
  );
  assert.deepEqual(JSON.parse(runtimeResult.stdout), {
    articleError: false,
    fusionError: false
  });
});

test("publisher excerpts require explicit rights confirmation", async () => {
  const parent = await mkdtemp(
    join(tmpdir(), "k-tech-radar-public-rights-")
  );
  await assert.rejects(
    exportPublicSnapshot({
      pluginRoot,
      sourceDataRoot: join(pluginRoot, "data"),
      outputDataRoot: join(parent, "data"),
      includePublisherExcerpts: true,
      rightsConfirmed: false
    }),
    /explicit rights confirmation/
  );
});

test("public snapshot export refuses to overwrite an existing directory", async () => {
  const parent = await mkdtemp(
    join(tmpdir(), "k-tech-radar-public-existing-")
  );
  await assert.rejects(
    exportPublicSnapshot({
      pluginRoot,
      sourceDataRoot: join(pluginRoot, "data"),
      outputDataRoot: parent
    }),
    /output already exists/
  );
});

test("public export and read gate reject a tampered sub-9.9 Dictionary entry", async () => {
  const parent = await mkdtemp(
    join(tmpdir(), "k-tech-radar-public-bad-gate-")
  );
  const fixture = await publicDictionaryFixture(
    parent,
    10
  );
  assert.equal(
    dictionaryPublicationGate(fixture.entry).passed,
    false
  );
  await assert.rejects(
    exportPublicSnapshot({
      pluginRoot,
      sourceDataRoot: fixture.sourceDataRoot,
      outputDataRoot: join(parent, "public")
    }),
    /three-round quality gate|publication gate/
  );
});

test("public export retains only a hash-pinned Dictionary entry that passed 9.9", async () => {
  const parent = await mkdtemp(
    join(tmpdir(), "k-tech-radar-public-good-gate-")
  );
  const fixture = await publicDictionaryFixture(
    parent,
    5
  );
  assert.equal(
    dictionaryPublicationGate(fixture.entry).passed,
    true
  );
  const result = await exportPublicSnapshot({
    pluginRoot,
    sourceDataRoot: fixture.sourceDataRoot,
    outputDataRoot: join(parent, "public"),
    timestamp: "2026-07-31T00:00:00.000Z"
  });
  assert.equal(result.dictionaryEntryCount, 1);
  assert.match(result.dictionaryHash, /^[a-f0-9]{64}$/u);
  assert.deepEqual(result.dictionaryRevisionPins, [
    {
      entryId: fixture.entry.entryId,
      entryRevision: fixture.entry.entryRevision,
      revisionId: fixture.entry.revisionId,
      provenanceHash: fixture.entry.provenanceHash,
      payloadHash: fixture.entry.payloadHash
    }
  ]);
  const exportedDictionary = JSON.parse(
    await readFile(
      join(parent, "public", "dictionary.json"),
      "utf8"
    )
  );
  assert.equal(
    exportedDictionary.entries[0].qualityReview
      .evidenceMode,
    "content-withheld-public-projection"
  );
  for (const round of
    exportedDictionary.entries[0].qualityReview.rounds) {
    assert.equal(round.summary, "content-withheld");
    for (const reference of round.evidenceRefs) {
      assert.equal(reference.contentWithheld, true);
      assert.equal(
        Object.hasOwn(reference, "content"),
        false
      );
    }
  }
  assert.equal(
    JSON.stringify(exportedDictionary).includes(
      "public negative review round"
    ),
    false
  );
  assert.equal(
    JSON.stringify(exportedDictionary).includes(
      "LOCAL_REVIEW_SUMMARY_SENTINEL"
    ),
    false
  );

  const publicDataRoot = join(parent, "public");
  const verification = await execFileAsync(
    process.execPath,
    [join(pluginRoot, "scripts", "verify.mjs")],
    {
      cwd: pluginRoot,
      env: {
        ...process.env,
        K_TECH_RADAR_DATA_DIR: publicDataRoot
      }
    }
  );
  assert.equal(JSON.parse(verification.stdout).status, "ok");

  const queryScript = [
    "const { searchArticles } = await import('./lib/engine.mjs');",
    "const { createMcpRuntime } = await import('./mcp/runtime.mjs');",
    "const result = await searchArticles({ query: 'BFF', limit: 5 }, { publicMode: true });",
    "const runtime = createMcpRuntime({ publicMode: true });",
    "await runtime.handleRequest({ method: 'initialize', params: { protocolVersion: '2025-11-25' } });",
    "const status = await runtime.handleRequest({ method: 'tools/call', params: { name: 'get_source_status', arguments: {} } });",
    "const article = await runtime.handleRequest({ method: 'tools/call', params: { name: 'get_article', arguments: { articleId: result.articles?.[0]?.articleId ?? result.groups?.[0]?.articles?.[0]?.articleId } } });",
    "process.stdout.write(JSON.stringify({ snapshotId: result.snapshotId, count: result.count, statusError: status.isError, articleError: article.isError }));"
  ].join("\n");
  const queried = await execFileAsync(
    process.execPath,
    ["--input-type=module", "--eval", queryScript],
    {
      cwd: pluginRoot,
      env: {
        ...process.env,
        K_TECH_RADAR_DATA_DIR: publicDataRoot
      }
    }
  );
  const searchResult = JSON.parse(queried.stdout);
  assert.equal(searchResult.snapshotId, result.publicSnapshotId);
  assert.ok(searchResult.count > 0);
  assert.equal(searchResult.statusError, false);
  assert.equal(searchResult.articleError, false);
});

test("public export rejects unknown local Dictionary fields in terminal history", async () => {
  const parent = await mkdtemp(
    join(tmpdir(), "k-tech-radar-public-projection-")
  );
  const fixture = await publicDictionaryFixture(
    parent,
    5,
    { injectUnknownField: true }
  );
  const outputDataRoot = join(parent, "public");
  await assert.rejects(
    exportPublicSnapshot({
      pluginRoot,
      sourceDataRoot: fixture.sourceDataRoot,
      outputDataRoot,
      timestamp: "2026-07-31T00:00:00.000Z"
    }),
    /hashes or payload are invalid/
  );
});

test("public reads reject a self-consistent legacy review-summary leak", async () => {
  const parent = await mkdtemp(
    join(tmpdir(), "k-tech-radar-public-summary-leak-")
  );
  const fixture = await publicDictionaryFixture(
    parent,
    5
  );
  const outputDataRoot = join(parent, "public");
  await exportPublicSnapshot({
    pluginRoot,
    sourceDataRoot: fixture.sourceDataRoot,
    outputDataRoot,
    timestamp: "2026-07-31T00:00:00.000Z"
  });
  const [
    snapshot,
    dictionary,
    insightRuns,
    manifest
  ] = await Promise.all(
    [
      "snapshot.json",
      "dictionary.json",
      "insight-runs.json",
      "PUBLIC-SNAPSHOT-MANIFEST.json"
    ].map((file) =>
      readFile(join(outputDataRoot, file), "utf8").then(
        JSON.parse
      )
    )
  );
  dictionary.entries[0].qualityReview.rounds[0].summary =
    "legacy local negative-review summary";
  const publicData = buildPublicDataCommitment(
    dictionary,
    insightRuns
  );
  snapshot.publicData = publicData;
  const identity = buildSnapshotIdentity({
    visibility: snapshot.visibility,
    configHash: snapshot.configHash,
    taxonomyHash: snapshot.taxonomyHash,
    catalogHash: snapshot.catalog.catalogHash,
    catalog: snapshot.catalog,
    searchIndex: snapshot.searchIndex,
    partitions: snapshot.partitions,
    sourceState: snapshot.sourceState,
    collection: snapshot.collection,
    committedAt: snapshot.committedAt,
    changeSet: snapshot.changeSet,
    publicData
  });
  snapshot.snapshotId = identity.snapshotId;
  snapshot.integrityHash = identity.integrityHash;
  snapshot.catalog.snapshotId = identity.snapshotId;
  snapshot.searchIndex.snapshotId = identity.snapshotId;
  snapshot.sourceState.snapshotId = identity.snapshotId;
  for (const partition of Object.values(
    snapshot.partitions
  )) {
    partition.snapshotId = identity.snapshotId;
  }
  Object.assign(manifest, {
    publicSnapshotId: identity.snapshotId,
    dictionaryHash: publicData.dictionaryHash,
    dictionaryRevisionPins:
      publicDictionaryRevisionPins(dictionary),
    insightRunsHash: publicData.insightRunsHash,
    publicDataHash: sha256(stableJson(publicData)),
    integrityHash: identity.integrityHash
  });

  assert.throws(
    () =>
      validatePublicDataObjects(
        snapshot,
        dictionary,
        insightRuns,
        manifest
      ),
    /content-withheld receipt projection/
  );
});

test("public reads reject self-consistent noncanonical timestamps and extra fields", async () => {
  const parent = await mkdtemp(
    join(tmpdir(), "k-tech-radar-public-review-date-")
  );
  const fixture = await publicDictionaryFixture(
    parent,
    5
  );
  const outputDataRoot = join(parent, "public");
  await exportPublicSnapshot({
    pluginRoot,
    sourceDataRoot: fixture.sourceDataRoot,
    outputDataRoot,
    timestamp: "2026-07-31T00:00:00.000Z"
  });
  const [
    originalSnapshot,
    originalDictionary,
    insightRuns,
    originalManifest
  ] = await Promise.all(
    [
      "snapshot.json",
      "dictionary.json",
      "insight-runs.json",
      "PUBLIC-SNAPSHOT-MANIFEST.json"
    ].map((file) =>
      readFile(join(outputDataRoot, file), "utf8").then(
        JSON.parse
      )
    )
  );

  for (const { mutate, expected } of [
    {
      mutate: (dictionary) => {
        dictionary.entries[0].qualityReview.reviewedAt =
          "SECRET=sk-proj-abcdefghijkl";
      },
      expected: /canonical ISO-8601 UTC instant/
    },
    {
      mutate: (dictionary) => {
        dictionary.entries[0].verification.reviewedAt =
          "SECRET=sk-proj-abcdefghijkl";
      },
      expected: /canonical ISO-8601 UTC instant/
    },
    {
      mutate: (dictionary) => {
        dictionary.entries[0].createdAt =
          "SECRET=sk-proj-abcdefghijkl";
      },
      expected: /canonical ISO-8601 UTC instant/
    },
    {
      mutate: (dictionary) => {
        dictionary.entries[0].updatedAt =
          "2026-07-30T00:00:00Z";
      },
      expected: /canonical ISO-8601 UTC instant/
    },
    {
      mutate: (dictionary) => {
        dictionary.updatedAt =
          "SECRET=sk-proj-abcdefghijkl";
      },
      expected: /canonical ISO-8601 UTC instant/
    },
    {
      mutate: (dictionary) => {
        dictionary.entries[0].privateNotes =
          "undeclared public projection field";
      },
      expected: /outside the exact public projection/
    }
  ]) {
    const snapshot = structuredClone(originalSnapshot);
    const dictionary =
      structuredClone(originalDictionary);
    const manifest = structuredClone(originalManifest);
    mutate(dictionary);
    const publicData = buildPublicDataCommitment(
      dictionary,
      insightRuns
    );
    snapshot.publicData = publicData;
    const identity = buildSnapshotIdentity({
      visibility: snapshot.visibility,
      configHash: snapshot.configHash,
      taxonomyHash: snapshot.taxonomyHash,
      catalogHash: snapshot.catalog.catalogHash,
      catalog: snapshot.catalog,
      searchIndex: snapshot.searchIndex,
      partitions: snapshot.partitions,
      sourceState: snapshot.sourceState,
      collection: snapshot.collection,
      committedAt: snapshot.committedAt,
      changeSet: snapshot.changeSet,
      publicData
    });
    snapshot.snapshotId = identity.snapshotId;
    snapshot.integrityHash = identity.integrityHash;
    snapshot.catalog.snapshotId = identity.snapshotId;
    snapshot.searchIndex.snapshotId = identity.snapshotId;
    snapshot.sourceState.snapshotId = identity.snapshotId;
    for (const partition of Object.values(
      snapshot.partitions
    )) {
      partition.snapshotId = identity.snapshotId;
    }
    Object.assign(manifest, {
      publicSnapshotId: identity.snapshotId,
      dictionaryHash: publicData.dictionaryHash,
      dictionaryRevisionPins:
        publicDictionaryRevisionPins(dictionary),
      insightRunsHash: publicData.insightRunsHash,
      publicDataHash: sha256(stableJson(publicData)),
      integrityHash: identity.integrityHash
    });

    assert.throws(
      () =>
        validatePublicDataObjects(
          snapshot,
          dictionary,
          insightRuns,
          manifest
        ),
      expected
    );
  }
});

test("public sidecars are cryptographically bound to the public snapshot", async () => {
  for (const sidecar of [
    "dictionary.json",
    "insight-runs.json"
  ]) {
    const parent = await mkdtemp(
      join(tmpdir(), "k-tech-radar-public-tamper-")
    );
    const outputDataRoot = join(parent, "public");
    await exportPublicSnapshot({
      pluginRoot,
      sourceDataRoot: join(pluginRoot, "data"),
      outputDataRoot,
      timestamp: "2026-07-31T00:00:00.000Z"
    });
    const snapshot = JSON.parse(
      await readFile(
        join(outputDataRoot, "snapshot.json"),
        "utf8"
      )
    );
    const document = JSON.parse(
      await readFile(
        join(outputDataRoot, sidecar),
        "utf8"
      )
    );
    if (sidecar === "dictionary.json") {
      document.entries.push({
        entryId: "tampered-public-entry"
      });
    } else {
      document.runs.push({
        runId: "tampered-public-run"
      });
    }
    await writeFile(
      join(outputDataRoot, sidecar),
      `${JSON.stringify(document, null, 2)}\n`,
      "utf8"
    );
    await assert.rejects(
      loadBoundPublicData(snapshot, {
        root: outputDataRoot
      }),
      /sidecar does not match the snapshot commitment/
    );
  }
});

test("public data loading never falls back when its manifest is absent", async () => {
  const parent = await mkdtemp(
    join(tmpdir(), "k-tech-radar-public-no-manifest-")
  );
  const exportedRoot = join(parent, "exported");
  await exportPublicSnapshot({
    pluginRoot,
    sourceDataRoot: join(pluginRoot, "data"),
    outputDataRoot: exportedRoot,
    timestamp: "2026-07-31T00:00:00.000Z"
  });
  const incompleteRoot = join(parent, "incomplete");
  await mkdir(incompleteRoot, { recursive: true });
  for (const file of [
    "snapshot.json",
    "dictionary.json",
    "insight-runs.json"
  ]) {
    await writeFile(
      join(incompleteRoot, file),
      await readFile(join(exportedRoot, file)),
    );
  }
  const snapshot = JSON.parse(
    await readFile(
      join(incompleteRoot, "snapshot.json"),
      "utf8"
    )
  );
  await assert.rejects(
    loadBoundPublicData(snapshot, {
      root: incompleteRoot
    }),
    (error) =>
      error?.code === "ENOENT" &&
      /PUBLIC-SNAPSHOT-MANIFEST\.json/u.test(
        error.message
      )
  );
});

test("public manifest is an exact closed projection of committed lineage and rights policy", async () => {
  const parent = await mkdtemp(
    join(tmpdir(), "k-tech-radar-public-manifest-")
  );
  const outputDataRoot = join(parent, "public");
  await exportPublicSnapshot({
    pluginRoot,
    sourceDataRoot: join(pluginRoot, "data"),
    outputDataRoot,
    timestamp: "2026-07-31T00:00:00.000Z"
  });
  const [
    snapshot,
    dictionary,
    insightRuns,
    manifest
  ] = await Promise.all(
    [
      "snapshot.json",
      "dictionary.json",
      "insight-runs.json",
      "PUBLIC-SNAPSHOT-MANIFEST.json"
    ].map((file) =>
      readFile(join(outputDataRoot, file), "utf8").then(
        JSON.parse
      )
    )
  );
  for (const mutate of [
    (value) => {
      value.exportedAt = "2026-08-01T00:00:00.000Z";
    },
    (value) => {
      value.sourceSnapshotId = "snapshot:false-lineage";
    },
    (value) => {
      value.publisherExcerptPolicy =
        "bounded-rights-confirmed";
    },
    (value) => {
      value.approvedBy = "fabricated-approval";
    }
  ]) {
    const tampered = structuredClone(manifest);
    mutate(tampered);
    assert.throws(
      () =>
        validatePublicDataObjects(
          snapshot,
          dictionary,
          insightRuns,
          tampered
        ),
      /does not match the committed public snapshot/
    );
  }
});
