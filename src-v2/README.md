# v2 canonical source

This directory is the editable source for the optimized branch. It was copied once from the immutable v1.0.15 snapshot. Future releases must build from these files rather than decoding a previous compressed payload.

- template.html: page shell
- styles/: editable styles
- startup.js: global error boundary
- core/: state, request, viewport and overlay infrastructure
- app/legacy-app.js: copied v1.0.15 application logic during migration
- optimization.js: v2 integrations and compatibility layer
- boot.js: explicit startup entry point
