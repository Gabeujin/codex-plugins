# Privacy notice template

Version: 2026-07-30

This file documents the behavior of the released code. A universal public-directory operator must publish an HTTPS privacy URL that matches its actual hosting, logging, retention, and deletion practices.

## Local plugin

The local plugin has no developer telemetry, advertising, account system, cookies, or embedded analytics. It processes:

- official article metadata and bounded excerpts selected by the user;
- search queries and filters;
- locally recorded Dictionary entries and application notes;
- collection status and error messages.
- local append-only Dictionary revisions and InsightRun review receipts.

Mutable data stays on the user's machine in the configured K-Tech Radar data directory. The plugin does not send it to the plugin author. Network requests go only to configured official publisher hosts when the user refreshes or fetches evidence.

Users can remove local runtime data using their operating system's normal file-management tools. The plugin does not perform automatic permanent deletion.

## Hosted public HTTP service

The reference HTTP server is read-only and has no user account or write tool. The hosting operator may still receive IP addresses, request timestamps, user-agent strings, infrastructure logs, and queries through its platform. Before publication, the operator must document:

- legal entity and contact;
- exact log fields and processors;
- retention and deletion windows;
- hosting regions and subprocessors;
- access/deletion request method;
- security-incident contact;
- whether any query analytics are enabled.

Do not claim “no data collection” if the hosting platform keeps access logs. Do not place secrets or personal data in search queries.

The public distribution bundle contains an empty data seed. A hosted service uses a separately exported public snapshot. The exporter defaults to publisher metadata without excerpts, exports only current/verified/explicitly-public Dictionary entries, replaces their raw review artifacts and round summaries with content-withheld hash receipts, accepts only canonical UTC review timestamps, keeps article revision lineage only through a reduced closed public projection, and excludes local Dictionary history, idempotency receipts, detailed source errors, and all InsightRun receipts. The public read validator rejects any article whose summary or storage policy conflicts with the collection-wide excerpt-rights declaration. The packaged quality gate contains only separately sanitized public evidence and rejects generic local paths or credential-like text; raw audit logs remain outside the bundle. This minimization does not replace the operator's publisher-rights, privacy, or logging obligations.
