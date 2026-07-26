# Deployment verification

- Version: v1.0.8
- Publishing mode: GitHub Pages branch publishing from `main` and `/ (root)`
- Root cause: v1.0.7 patch offsets were generated with Python Unicode code-point indexes but applied with JavaScript UTF-16 indexes; Emoji caused the main script to be cut at incorrect positions.
- Fix: regenerate all differential offsets in JavaScript UTF-16 code units and add startup error reporting.
- Validation: Node UTF-16 reconstruction matched the v1.0.8 target exactly; JavaScript syntax, browser startup without Leaflet, self-check completion and offline fallback were verified locally.
- Full HTML SHA-256: `ebdc4ae56b0312b2c2b2bdd6b7024f7fc19e07cb7ee65af3c7dd35a1e9f37942`
