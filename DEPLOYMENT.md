# Deployment verification

- Version: v1.0.10
- Publishing mode: GitHub Pages branch publishing from `main` and `/ (root)`
- Root cause: `createTileLayer()` explicitly passed `subdomains: undefined` for basemaps without a custom subdomain list. Leaflet copied that undefined value over its default, then `TileLayer._getSubdomain()` attempted to read `this.options.subdomains.length`.
- Fix: construct tile-layer options conditionally and include `subdomains` only when it is a non-empty string or array. OSM, OpenTopoMap and OSM HOT now inherit Leaflet's default subdomains; CARTO retains its explicit `abcd` value.
- Delivery: replace the chained runtime patch loader with a self-contained v1.0.10 compressed full-page payload.
- Validation: JavaScript syntax, exact payload reconstruction, all six basemap option sets and Leaflet-compatible subdomain selection were checked locally.
- Full HTML SHA-256: `10ca1b095e2164986ad8a9b7d4827987d687afb75fb84c6de8fc31dd04fccf2c`
