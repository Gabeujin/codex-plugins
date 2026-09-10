# Support

For installation and usage questions, [open an issue](https://github.com/Gabeujin/codex-plugins/issues/new/choose). Include plugin version, OS, Node version, Codex CLI or Desktop version, the exact action, expected result, and a synthetic reproduction.

Run `node scripts/doctor.mjs` from a source checkout for a read-only, redacted diagnostic. It creates no Dictionary and makes no network request. `--private-paths` is for your own local diagnosis only; do not attach that output publicly. OS permission checks do not prove a write will succeed.

An empty Radar catalog is expected before the first explicit refresh. Try `node plugins/k-tech-radar/scripts/offline-demo.mjs` to learn the result shape without networking or data writes. If an existing catalog was in an older source checkout, point `K_TECH_RADAR_DATA_DIR` to it after verifying its files; no automatic move occurs.

If KGJ reports recovery-required, stop design decisions based on that store, retain its files, inspect integrity, then explicitly recover only from validated immutable history. Do not initialize an empty replacement or upload the store to an issue.

Report vulnerabilities through SECURITY.md, not public issues. Volunteer maintenance has no guaranteed response time.
