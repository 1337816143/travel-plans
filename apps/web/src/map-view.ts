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

function dashArray(pattern: 'solid' | 'dashed' | 'dotted'): string {
  if (pattern === 'solid') return 'none';
  return pattern === 'dotted' ? '2 7' : '9 7';
}

function spacedRoutePoints(
  points: readonly ScreenPoint[],
  requestedSpacing: number,
): readonly ScreenPoint[] {
  if (points.length < 2) return points;
  const spacing = Math.max(12, requestedSpacing);
  const result: ScreenPoint[] = [points[0] ?? { x: 0, y: 0 }];
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (!start || !end) continue;
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const divisions = Math.min(200, Math.floor(distance / spacing));
    for (let step = 1; step <= divisions; step += 1) {
      const ratio = step / (divisions + 1);
      result.push({
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      });
    }
    result.push(end);
  }
  return result;
}

function arrowPath(direction: 'forward' | 'reverse' | 'both'): string {
  if (direction === 'reverse') return 'M 10 0 L 0 5 L 10 10 Z';
  if (direction === 'both') {
    return 'M 4 0 L 10 5 L 4 10 Z M 6 0 L 0 5 L 6 10 Z';
  }
  return 'M 0 0 L 10 5 L 0 10 Z';
}

function logoGlyph(iconId: string): string {
  if (/mountain|hiking/.test(iconId)) {
    return '<path class="marker-glyph" d="M -11 7 L -3 -9 L 2 0 L 6 -6 L 12 7 Z" />';
  }
  if (/museum|historic|landmark/.test(iconId)) {
    return '<path class="marker-glyph" d="M -10 -6 L 0 -11 L 10 -6 Z M -8 -3 V 7 M -3 -3 V 7 M 3 -3 V 7 M 8 -3 V 7 M -11 9 H 11" />';
  }
  if (/restaurant|food|breakfast|snack|seafood/.test(iconId)) {
    return '<path class="marker-glyph" d="M -7 -10 V 9 M -11 -10 V -3 C -11 1 -3 1 -3 -3 V -10 M 7 -10 C 2 -7 3 2 7 3 V 9 M 7 -10 V 3" />';
  }
  if (/hotel|accommodation/.test(iconId)) {
    return '<path class="marker-glyph" d="M -11 8 V -9 H 7 V 8 M -7 -5 H -3 M 1 -5 H 5 M -7 0 H -3 M 1 0 H 5 M 9 -2 H 12 V 8 M -13 8 H 13" />';
  }
  if (/transport|metro|railway|airport|bus|pier/.test(iconId)) {
    return '<path class="marker-glyph" d="M -9 -8 H 9 V 5 H -9 Z M -5 9 A 2 2 0 1 0 -5 5 A 2 2 0 1 0 -5 9 M 5 9 A 2 2 0 1 0 5 5 A 2 2 0 1 0 5 9 M -5 -4 H 5" />';
  }
  if (/park/.test(iconId)) {
    return '<path class="marker-glyph" d="M 0 10 V 1 M 0 3 C -11 2 -11 -8 -2 -10 C 5 -12 11 -5 8 2 C 6 7 2 7 0 3 Z" />';
  }
  return '<path class="marker-glyph" d="M -9 -5 C -5 -10 -1 -1 3 -5 C 7 -10 10 -4 11 -3 M -8 3 C -4 -2 0 7 4 2 C 7 -1 9 1 10 3" />';
}

function routeSvg(model: TripMapRenderModel): string {
  return [...model.routes]
    .sort((left, right) => left.style.zIndex - right.style.zIndex)
    .map((route) => {
      if (!route.style.visible) return '';
      const screenPoints = route.points.map((point) => project(point, model));
      const renderedPoints = route.style.arrowsVisible
        ? spacedRoutePoints(screenPoints, route.style.arrowSpacing)
        : screenPoints;
      const points = renderedPoints
        .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
        .join(' ');
      const color = route.routeStyleId ? route.style.color : dayColor(route.dayId);
      const markerId = `route-arrow-${escapeHtml(route.id)}`;
      const arrow = route.style.arrowsVisible
        ? `<marker id="${markerId}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="${route.style.arrowSize}" markerHeight="${route.style.arrowSize}" orient="auto"><path d="${arrowPath(route.style.arrowDirection)}" fill="${color}" /></marker>`
        : '';
      const markerStart =
        route.style.arrowsVisible && ['reverse', 'both'].includes(route.style.arrowDirection)
          ? ` marker-start="url(#${markerId})"`
          : '';
      const markerEnd =
        route.style.arrowsVisible && ['forward', 'both'].includes(route.style.arrowDirection)
          ? ` marker-end="url(#${markerId})"`
          : '';
      const markerMid = route.style.arrowsVisible ? ` marker-mid="url(#${markerId})"` : '';
      return `<defs>${arrow}</defs><polyline class="map-route" points="${points}" stroke="${color}" stroke-width="${route.style.width}" stroke-opacity="${route.style.opacity}" stroke-dasharray="${dashArray(route.style.pattern)}"${markerStart}${markerMid}${markerEnd} data-route-segment="${escapeHtml(route.segmentId)}" data-route-style="${escapeHtml(route.routeStyleId ?? '')}" data-arrow-spacing="${route.style.arrowSpacing}" data-route-estimated="${String(route.estimated)}" />`;
    })
    .join('');
}

function markerSvg(model: TripMapRenderModel, selectedItemId: string | null): string {
  return model.markers
    .map((marker) => {
      const point = project(marker.location, model);
      const selected = marker.itemId === selectedItemId;
      const priorityClass = `marker-${marker.priority}`;
      const number = marker.mapNumber
        ? `<g class="marker-number" transform="translate(19 -30)"><rect x="-1" y="-12" width="28" height="24" rx="12" /><text x="13" y="5" text-anchor="middle">${escapeHtml(marker.mapNumber)}</text></g>`
        : '';
      return `
        <g class="map-marker ${priorityClass}${selected ? ' is-selected' : ''}"
          transform="translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})"
          role="button"
          tabindex="0"
          data-map-item="${escapeHtml(marker.itemId)}"
          data-marker-icon="${escapeHtml(marker.iconId)}"
          aria-label="地图地点 ${escapeHtml(marker.mapNumber)}，${escapeHtml(marker.label)}">
          <path class="marker-shadow" d="M -14 20 Q 0 27 14 20 Q 0 17 -14 20 Z" />
          <path class="marker-logo" style="fill:${marker.color}" d="M 0 -28 C -17 -28 -27 -16 -27 -1 C -27 17 -8 29 0 39 C 8 29 27 17 27 -1 C 27 -16 17 -28 0 -28 Z" />
          <circle class="marker-logo-core" cx="0" cy="-3" r="13" />
          ${logoGlyph(marker.iconId)}
          ${number}
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
