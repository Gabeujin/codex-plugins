# Contributing

This public repository is the release source of truth for all three plugins. Bring changes from personal development copies as reviewed patches; never replace a plugin folder wholesale with a private working copy.

1. Create a branch and reproduce the issue using synthetic data. Keep runtime folders outside Git.
2. Use maintained Node 22/24 and Python 3.12+. Run `node scripts/verify-release.mjs` from the repository root.
3. For Canvas demo work, run `npm ci --ignore-scripts --no-audit --no-fund`, `npm test`, and `npm run build` inside `plugins/canvas-web-experiences/demo`. Its build retains prior ignored outputs; release packaging reads Git objects, never dist.
4. Run `node scripts/verify-public-source.mjs` after staging new source files. This checks tracked working-tree bytes. Review `git status --short` for unintended data before committing.
5. Open a PR with the problem, observable result, exact test commands, compatibility impact, and unresolved manual checks. A maintainer reviews before release.

Tests retain isolated temporary fixtures for diagnosis; they never need the maintainer's Dictionary or web collection history. Do not add cleanup that permanently deletes user data. Do not claim browser/model/live-network verification from unit tests.

All contributions are under MIT. Files fetched from publishers remain subject to their own rights; do not commit article bodies. The owner reviews all plugin areas; see `.github/CODEOWNERS`.
