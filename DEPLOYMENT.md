# Deployment verification

- Version: v1.0.9
- Publishing mode: GitHub Pages branch publishing from `main` and `/ (root)`
- Root cause: the multi-basemap refactor added `MarkerClusterGroup` before the initial tile layer. The Leaflet map had no explicit finite `maxZoom`, so MarkerCluster aborted with `Map has no maxZoom specified`.
- Fix: set finite map zoom limits, load the initial Leaflet basemap before adding clusters, and synchronize map `maxZoom` with the active basemap.
- Delivery: rebuild the verified v1.0.8 page, assert each replacement target exists, then apply the v1.0.9 initialization fixes without character-offset patching.
- Validation: JavaScript syntax, exact transformation to the v1.0.9 target HTML, initialization ordering and zoom-limit assertions checked locally.
- Full HTML SHA-256: `41723ad61427380dfe86d3295dfeaab0aff56af3d374196bda356c09dfb94cca`
