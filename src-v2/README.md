# v2 canonical source

This directory is the editable source for the optimized releases. It was copied once from the immutable v1.0.15 snapshot. Future releases build from these files rather than decoding a previous compressed payload.

- `template.html`: page shell.
- `styles/`: legacy styles plus versioned responsive and device-profile layers.
- `startup.js`: global error boundary.
- `core/`: request, viewport, map-view and overlay infrastructure.
- `state/`: persisted user preferences and future application state modules.
- `data/`: itinerary data registry and future extracted static datasets.
- `map/`: map adapters and AMap startup lifecycle.
- `services/`: weather/traffic/search facades and Service Worker update handling.
- `ui/`: floating-layer scheduler and unified mobile route drawer.
- `app/legacy-app.js`: the remaining v1.0.15 business baseline during incremental migration.
- `optimization.js`: compatibility integrations that have not yet moved into a dedicated module.
- `layout-fixes.js`: compatibility layout bridge retained during migration.
- `boot.js`: explicit startup entry point.

v2.1.0 moves all newly added behavior into `state/`, `data/`, `map/`, `services/` and `ui/`. The next migration stage should extract static point/schedule datasets and then split the Leaflet and AMap implementations out of `legacy-app.js` without changing behavior.