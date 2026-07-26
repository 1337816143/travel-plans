# Deployment verification

- Version: v1.0.11
- Publishing mode: GitHub Pages branch publishing from `main` and `/ (root)`
- Desktop fix: move the edge toggle from `left: var(--panel)` inside the map column to `left: 0`, so its center aligns with the panel/map boundary instead of being offset by a second panel width.
- AMap JS API: embedded credentials, official loader, AMap basemap, controls, geolocation and traffic layer.
- AMap Web API: weather, IP location, input tips, keyword/nearby search, reverse geocoding, GPS coordinate conversion, driving/walking/transit routing, circle traffic status and static maps.
- Delivery: self-contained v1.0.11 gzip/base64 full-page payload split into four transport-safe chunks; no runtime patch chain.
- Validation: JavaScript syntax; exact payload reconstruction; DOM-ID checks; desktop expanded/collapsed/reopened geometry; mocked browser startup; weather, suggestions, POI search, routing and reverse geocoding flows; no console or page errors.
- Public credential note: API credentials are intentionally embedded at the user's request and are readable from the public repository.
- Full HTML SHA-256: `432f8472f9889b70a4cfcbd27b727b5d9fc49429a8d2bfef5a20b9ae50a9972b`
