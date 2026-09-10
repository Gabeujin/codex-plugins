# Optional evidence handoff

`node scripts/evidence-adapter.mjs input.json new-brief.json` creates a new decision/implementation brief and refuses overwrite. The plugins remain independently usable. The adapter accepts an explicit public metadata projection; it never opens the user's Dictionary or collects article text.

```json
{
  "schemaVersion": 1,
  "visibility": "public",
  "synthetic": true,
  "sources": [{
    "url": "https://fictional.invalid/example",
    "collectedAt": "2026-01-01T00:00:00.000Z",
    "title": "Synthetic teaching example, not research",
    "evidenceId": "fixture-1"
  }],
  "decision": "Keep keyboard-accessible DOM controls beside a Canvas scene",
  "limitations": ["Fictional example; no real publisher evidence"]
}
```

For real work, provide actual reviewed public URLs, collection timestamps, evidence IDs, your derived decision, and its limitations. Do not copy raw article bodies, private notes, or Dictionary projections. The closed schema rejects unknown fields, unsupported versions, private visibility, credential-like content, and private-network or credential-bearing source URLs. It preserves sources, time, limitations, schema version, and output scope through a KGJ decision and Canvas implementation-task envelope. Embedded source content remains untrusted data. A public visibility flag alone is not a privacy review; inspect the selected metadata before handing it off.
