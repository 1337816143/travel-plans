# Deployment verification

- Active loader: v1.0.12-recovery
- Stable page payload: v1.0.10
- Publishing mode: GitHub Pages branch publishing from `main` and `/ (root)`
- Root cause: the repository's v1.0.11 gzip/Base64 payload is corrupted. Each file can be Base64-decoded after normalization, but the resulting gzip stream fails with `Z_DATA_ERROR: invalid distance too far back`; no ordering of the four decoded chunks produces valid HTML.
- Recovery: the root loader now attempts v1.0.11 first and automatically falls back to the validated v1.0.10 payload when integrity checks fail.
- Validation: GitHub Actions scans available payload versions, confirms v1.0.10 decodes and gunzips to HTML, and checks the inline loader JavaScript syntax.
- v1.0.11 status: retained for diagnosis but not treated as a deployable release until a complete source page is rebuilt and a new valid payload is generated.
