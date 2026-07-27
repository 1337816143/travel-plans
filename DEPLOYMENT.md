# Deployment verification

- Version: v1.0.14
- Fallback: v1.0.13
- Browser title: 青岛旅行计划
- Shared markers: Leaflet and AMap use the same marker/route/direction HTML factories.
- AMap clustering: MarkerCluster with custom point and cluster rendering.
- Traffic: enabled by default on AMap, auto-refresh 60 seconds, selectable circle analysis, driving TMC breakdown.
- Weather: AMap current and four-day day/night forecasts embedded in itinerary and route overview; no fabricated hourly rain probability.
- Taxi: no public queue-count endpoint; nearby pickup points, traffic-aware route and available fare estimate only.
- Mobile: dynamic visual viewport, safe-area placement, non-overlapping top controls/notice/route card, bounded collapsible legend.
- Full HTML SHA-256: `623c8996735782504aee3161584a9125d918769a56a1e86a26c5ef47c9e6c88d`
