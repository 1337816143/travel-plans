# Deployment verification

- Status: verified online
- Version: v1.0.1
- Page: https://1337816143.github.io/travel-plans/
- HTML SHA-256: f14e292fb45896281e346d7ce66e8c78a5d1f22c5c55162452ae9fe321563db4
- Archive: versions/2026-07-26-v1.0.1.html
- Archive match: the verified live index was byte-identical to the archived HTML

## Publishing policy

The repository now uses GitHub Pages branch publishing from `main` and `/ (root)`. The custom Pages Actions workflow and 15-minute reconciliation schedule have been removed.

Each completed conversation-round modification must be prepared and verified as one coherent change set, then committed once and pushed once. GitHub Pages publishes that final repository state automatically.
