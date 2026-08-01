import type { TripMapRenderModel } from '@qingdao/map-core';

import { escapeHtml } from './format.js';

const MAP_WIDTH = 860;
const MAP_HEIGHT = 500;
const MAP_PADDING = 68;
const DAY_COLORS = ['#ff765e', '#14a9a3', '#e0a72f', '#5069a8'];

interface ScreenPoint {
  readonly x: number;
  readonly y: number;
}

function project(
  location: { readonly lat: number; readonly lng: number },
  model: TripMapRenderModel,
): ScreenPoint {
  const bounds = model.bounds;
  if (!bounds) return { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
  const longitudeRange = Math.max(0.002, bounds.east - bounds.west);
  const latitudeRange = Math.max(0.002, bounds.north - bounds.south);
  return {
    x:
      MAP_PADDING +
      ((location.lng - bounds.west) / longitudeRange) * (MAP_WIDTH - MAP_PADDING * 2),
    y:
      MAP_PADDING +
      ((bounds.north - location.lat) / latitudeRange) * (MAP_HEIGHT - MAP_PADDING * 2),
  };
}

function dayColor(dayId: string): string {
  const number = Number(dayId.match(/\d+$/)?.[0] ?? 1);
  return DAY_COLORS[(number - 1) % DAY_COLORS.length] ?? DAY_COLORS[0] ?? '#ff765e';
}

function routeSvg(model: TripMapRenderModel): string {
  return model.routes
    .map((route) => {
      const points = route.points
        .map((point) => {
          const projected = project(point, model);
          return `${projected.x.toFixed(1)},${projected.y.toFixed(1)}`;
        })
        .join(' ');
      return `<polyline class="map-route" points="${points}" stroke="${dayColor(route.dayId)}" data-route-estimated="${String(route.estimated)}" />`;
    })
    .join('');
}

function markerSvg(model: TripMapRenderModel, selectedItemId: string | null): string {
  return model.markers
    .map((marker) => {
      const point = project(marker.location, model);
      const selected = marker.itemId === selectedItemId;
      const priorityClass = `marker-${marker.priority}`;
      return `
        <g class="map-marker ${priorityClass}${selected ? ' is-selected' : ''}"
          transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})"
          role="button"
          tabindex="0"
          data-map-item="${escapeHtml(marker.itemId)}"
          aria-label="地图地点 ${escapeHtml(marker.mapNumber)}，${escapeHtml(marker.label)}">
          <path class="marker-shadow" d="M -14 20 Q 0 27 14 20 Q 0 17 -14 20 Z" />
          <path class="marker-logo" d="M 0 -28 C -17 -28 -27 -16 -27 -1 C -27 17 -8 29 0 39 C 8 29 27 17 27 -1 C 27 -16 17 -28 0 -28 Z" />
          <circle class="marker-logo-core" cx="0" cy="-3" r="13" />
          <path class="marker-wave" d="M -9 -5 C -5 -9 -1 -1 3 -5 C 7 -9 10 -4 11 -3 M -8 2 C -4 -2 0 6 4 2 C 7 -1 9 1 10 2" />
          <g class="marker-number" transform="translate(19 -30)">
            <rect x="-1" y="-12" width="28" height="24" rx="12" />
            <text x="13" y="5" text-anchor="middle">${escapeHtml(marker.mapNumber)}</text>
          </g>
          <text class="marker-label" x="0" y="60" text-anchor="middle">${escapeHtml(marker.label.replace(/主入口|入口|方向/g, '').slice(0, 10))}</text>
        </g>`;
    })
    .join('');
}

export function renderMap(model: TripMapRenderModel | null, selectedItemId: string | null): string {
  if (!model) {
    return '<div class="map-empty"><span class="map-empty-orbit"></span><p>生成日程后显示地图 RenderModel</p></div>';
  }

  return `
    <div class="map-stage" data-testid="map-stage">
      <svg class="trip-map" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" role="img" aria-labelledby="map-title map-description">
        <title id="map-title">青岛行程地图 RenderModel 预览</title>
        <desc id="map-description">地点编号与日程同步；路线为直线降级示意，不是真实道路路线。</desc>
        <defs>
          <linearGradient id="sea-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#eaf6f2" />
            <stop offset="1" stop-color="#c9e8e8" />
          </linearGradient>
          <filter id="marker-shadow-filter" x="-80%" y="-80%" width="260%" height="260%">
            <feDropShadow dx="0" dy="7" stdDeviation="7" flood-color="#123b49" flood-opacity=".2" />
          </filter>
          <pattern id="map-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#287b87" stroke-opacity=".08" stroke-width="1" />
          </pattern>
        </defs>
        <rect width="${MAP_WIDTH}" height="${MAP_HEIGHT}" rx="28" fill="url(#sea-gradient)" />
        <rect width="${MAP_WIDTH}" height="${MAP_HEIGHT}" rx="28" fill="url(#map-grid)" />
        <path class="coast-shape" d="M -20 0 H 250 C 285 68 246 112 303 156 C 348 192 330 246 383 285 C 431 321 407 390 468 520 H -20 Z" />
        <path class="coast-line" d="M 250 0 C 285 68 246 112 303 156 C 348 192 330 246 383 285 C 431 321 407 390 468 520" />
        <path class="sea-current" d="M 510 72 C 608 31 711 46 814 95 M 492 396 C 590 350 720 374 842 324" />
        <g class="route-layer">${routeSvg(model)}</g>
        <g class="marker-layer" filter="url(#marker-shadow-filter)">${markerSvg(model, selectedItemId)}</g>
        <g class="map-compass" transform="translate(795 62)">
          <circle r="28" />
          <path d="M 0 -18 L 6 4 L 0 1 L -6 4 Z" />
          <text x="0" y="18" text-anchor="middle">N</text>
        </g>
      </svg>
      <div class="map-caption">
        <span><i class="legend-line"></i> 直线降级示意</span>
        <span><i class="legend-pin"></i> Logo</span>
        <span><i class="legend-number">1</i> 独立编号</span>
      </div>
    </div>`;
}
