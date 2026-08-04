import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type {
  MapMarkerRenderModel,
  MapRouteRenderModel,
  TripMapRenderModel,
} from '@qingdao/map-core';
import type { Place } from '@qingdao/schema';

import { escapeHtml } from './format.js';

const BASEMAP_STORAGE_KEY = 'qingdao-v3:leaflet-basemap';
const MAP_SCOPE_STORAGE_KEY = 'qingdao-v3:map-scope';
const CATALOG_PANE_NAME = 'catalog-points';
const FALLBACK_ORDER = [
  'osm',
  'carto-voyager',
  'carto-light',
  'hot',
  'opentopo',
  'carto-dark',
] as const;
const DAY_COLORS = ['#ff765e', '#14a9a3', '#e0a72f', '#5069a8'];

const BASEMAPS = {
  osm: {
    name: 'OSM 标准',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  },
  'carto-voyager': {
    name: 'CARTO 导航',
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  'carto-light': {
    name: 'CARTO 浅色',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  hot: {
    name: 'OSM 人道主义',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors, Tiles style by HOT',
  },
  opentopo: {
    name: 'OpenTopoMap 地形',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    maxZoom: 17,
    attribution: 'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap',
  },
  'carto-dark': {
    name: 'CARTO 深色',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
} as const;

export type LeafletBasemapId = keyof typeof BASEMAPS;

export const LEAFLET_BASEMAP_OPTIONS: readonly {
  readonly id: LeafletBasemapId;
  readonly name: string;
}[] = FALLBACK_ORDER.map((id) => ({ id, name: BASEMAPS[id].name }));

interface SavedView {
  readonly center: readonly [number, number];
  readonly zoom: number;
  readonly planId: string;
}

interface MountOptions {
  readonly root: HTMLElement;
  readonly model: TripMapRenderModel | null;
  readonly places: readonly Place[];
  readonly selectedItemId: string | null;
  readonly onSelectItem: (itemId: string) => void;
  readonly onAddPlace: (placeId: string) => void;
}

type MapScope = 'all' | 'plan';

function isBasemapId(value: string | null): value is LeafletBasemapId {
  return value !== null && Object.hasOwn(BASEMAPS, value);
}

function initialBasemap(): LeafletBasemapId {
  try {
    const saved = localStorage.getItem(BASEMAP_STORAGE_KEY);
    return isBasemapId(saved) ? saved : 'carto-voyager';
  } catch {
    return 'carto-voyager';
  }
}

function initialMapScope(): MapScope {
  try {
    return localStorage.getItem(MAP_SCOPE_STORAGE_KEY) === 'plan' ? 'plan' : 'all';
  } catch {
    return 'all';
  }
}

function dayColor(dayId: string): string {
  const number = Number(dayId.match(/\d+$/)?.[0] ?? 1);
  return DAY_COLORS[(number - 1) % DAY_COLORS.length] ?? DAY_COLORS[0] ?? '#14a9a3';
}

function catalogColor(category: Place['category']): string {
  if (['restaurant', 'food'].includes(category)) return '#d85f4a';
  if (['hotel', 'shopping'].includes(category)) return '#8b5cf6';
  if (['transport-hub', 'service'].includes(category)) return '#d18a22';
  if (['seaside', 'park'].includes(category)) return '#14a9a3';
  return '#3d6b99';
}

function dashArray(pattern: MapRouteRenderModel['style']['pattern']): string | undefined {
  if (pattern === 'solid') return undefined;
  return pattern === 'dotted' ? '2 8' : '10 8';
}

function glyphPath(iconId: string): string {
  if (/mountain|hiking/.test(iconId)) return 'M -10 7 L -3 -8 L 2 0 L 6 -6 L 11 7 Z';
  if (/museum|historic|landmark/.test(iconId)) {
    return 'M -10 -6 L 0 -11 L 10 -6 Z M -8 -3 V 7 M -3 -3 V 7 M 3 -3 V 7 M 8 -3 V 7 M -11 9 H 11';
  }
  if (/restaurant|food|breakfast|snack|seafood/.test(iconId)) {
    return 'M -7 -10 V 9 M -11 -10 V -3 C -11 1 -3 1 -3 -3 V -10 M 7 -10 C 2 -7 3 2 7 3 V 9 M 7 -10 V 3';
  }
  if (/hotel|accommodation/.test(iconId)) {
    return 'M -11 8 V -9 H 7 V 8 M -7 -5 H -3 M 1 -5 H 5 M -7 0 H -3 M 1 0 H 5 M 9 -2 H 12 V 8 M -13 8 H 13';
  }
  if (/transport|metro|railway|airport|bus|pier/.test(iconId)) {
    return 'M -9 -8 H 9 V 5 H -9 Z M -5 -4 H 5 M -5 9 V 5 M 5 9 V 5';
  }
  if (/park/.test(iconId)) {
    return 'M 0 10 V 1 M 0 3 C -11 2 -11 -8 -2 -10 C 5 -12 11 -5 8 2 C 6 7 2 7 0 3 Z';
  }
  return 'M -9 -5 C -5 -10 -1 -1 3 -5 C 7 -10 10 -4 11 -3 M -8 3 C -4 -2 0 7 4 2 C 7 -1 9 1 10 3';
}

function markerHtml(marker: MapMarkerRenderModel, selected: boolean): string {
  const number = marker.mapNumber
    ? `<g class="marker-number"><circle cx="25" cy="-23" r="12"></circle><text x="25" y="-19" text-anchor="middle">${escapeHtml(marker.mapNumber)}</text></g>`
    : '';
  return `<div class="leaflet-plan-marker marker-${marker.priority}${selected ? ' is-selected' : ''}"
      data-map-item="${escapeHtml(marker.itemId)}"
      data-marker-icon="${escapeHtml(marker.iconId)}"
      style="--marker-color:${marker.color}"
      aria-label="地图地点 ${escapeHtml(marker.mapNumber)}，${escapeHtml(marker.label)}">
    <svg viewBox="-42 -44 84 98" role="presentation" aria-hidden="true">
      <path class="marker-shadow" d="M -15 33 Q 0 40 15 33 Q 0 29 -15 33 Z"></path>
      <path class="marker-logo" d="M 0 -32 C -18 -32 -29 -19 -29 -3 C -29 17 -9 31 0 43 C 9 31 29 17 29 -3 C 29 -19 18 -32 0 -32 Z"></path>
      <circle class="marker-logo-core" cx="0" cy="-6" r="14"></circle>
      <path class="marker-glyph" d="${glyphPath(marker.iconId)}" transform="translate(0 -4)"></path>
      ${number}
    </svg>
    <span>${escapeHtml(marker.label.replace(/主入口|入口|方向/g, '').slice(0, 12))}</span>
  </div>`;
}

function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLatitude(x: number, y: number): number {
  let result = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  result += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  result += ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3;
  result += ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) * 2) / 3;
  return result;
}

function transformLongitude(x: number, y: number): number {
  let result = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  result += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3;
  result += ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3;
  result += ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2) / 3;
  return result;
}

function wgs84ToGcj02(lat: number, lng: number): readonly [number, number] {
  if (outOfChina(lat, lng)) return [lat, lng];
  const radius = 6_378_245;
  const eccentricity = 0.006693421622965943;
  const latitudeDelta = transformLatitude(lng - 105, lat - 35);
  const longitudeDelta = transformLongitude(lng - 105, lat - 35);
  const radians = (lat / 180) * Math.PI;
  const magic = 1 - eccentricity * Math.sin(radians) ** 2;
  const root = Math.sqrt(magic);
  return [
    lat + (latitudeDelta * 180) / (((radius * (1 - eccentricity)) / (magic * root)) * Math.PI),
    lng + (longitudeDelta * 180) / ((radius / root) * Math.cos(radians) * Math.PI),
  ];
}

function amapPositionUrl(
  name: string,
  location: { readonly lat: number; readonly lng: number },
): string {
  const [lat, lng] = wgs84ToGcj02(location.lat, location.lng);
  const parameters = new URLSearchParams({
    position: `${lng.toFixed(6)},${lat.toFixed(6)}`,
    name,
    src: 'qingdao-travel-plans-v3',
    coordinate: 'gaode',
    callnative: '0',
  });
  return `https://uri.amap.com/marker?${parameters.toString()}`;
}

function popupHtml(marker: MapMarkerRenderModel): string {
  return `<div class="leaflet-plan-popup">
    <strong>${escapeHtml(marker.mapNumber ? `${marker.mapNumber} · ${marker.label}` : marker.label)}</strong>
    <span>${escapeHtml(marker.priority === 'must' ? '一定要去' : marker.priority === 'optional' ? '可选' : '想去')}</span>
    <small>页面坐标：WGS84 ${marker.location.lat.toFixed(6)}, ${marker.location.lng.toFixed(6)}</small>
    <a href="${amapPositionUrl(marker.label, marker.location)}" target="_blank" rel="noopener">在高德地图中打开</a>
  </div>`;
}

function catalogPopupHtml(place: Place): string {
  return `<div class="leaflet-plan-popup catalog-popup">
    <strong>${escapeHtml(place.name)}</strong>
    <span>${escapeHtml(place.category)} · 49 点候选库</span>
    <small>${escapeHtml(place.address || '地址待核验')}</small>
    <div>
      <button type="button" data-add-map-place="${escapeHtml(place.id)}">加入所选日期</button>
      <a href="${amapPositionUrl(place.name, place.location)}" target="_blank" rel="noopener">高德打开</a>
    </div>
  </div>`;
}

export class LeafletWebMapAdapter {
  private map: L.Map | null = null;
  private tileLayer: L.TileLayer | null = null;
  private activeBasemap: LeafletBasemapId = initialBasemap();
  private activeScope: MapScope = initialMapScope();
  private savedView: SavedView | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private currentModel: TripMapRenderModel | null = null;
  private markerByItemId = new Map<string, L.Marker>();
  private openPopupItemId: string | null = null;
  private destroying = false;
  private mapGeneration = 0;
  private catalogLayer: L.LayerGroup | null = null;
  private fallbackAttempts = new Set<LeafletBasemapId>();

  mount(options: MountOptions): void {
    this.destroy();
    const host = options.root.querySelector<HTMLElement>('[data-leaflet-map]');
    if (!host || !options.model) return;
    this.mapGeneration += 1;
    const model = options.model;
    this.currentModel = model;
    this.map = L.map(host, {
      center: [36.066, 120.382],
      zoom: 11,
      minZoom: 4,
      maxZoom: BASEMAPS[this.activeBasemap].maxZoom,
      zoomControl: true,
      preferCanvas: false,
    });
    const catalogPane = this.map.createPane(CATALOG_PANE_NAME);
    catalogPane.style.zIndex = '625';
    catalogPane.dataset.mapCatalogPane = 'true';
    this.map.attributionControl.setPrefix(false);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(this.map);
    this.useBasemap(this.activeBasemap, options.root);

    for (const route of model.routes) this.addRoute(route);
    for (const marker of model.markers) {
      this.addMarker(marker, options.selectedItemId === marker.itemId, options.onSelectItem);
    }
    this.addCatalogLayer(options.places, model, options.onAddPlace);
    if (this.openPopupItemId && this.openPopupItemId !== options.selectedItemId) {
      this.openPopupItemId = null;
    }
    if (this.openPopupItemId) {
      this.markerByItemId.get(this.openPopupItemId)?.openPopup();
    }

    if (this.savedView?.planId === model.planId) {
      this.map.setView([...this.savedView.center] as L.LatLngTuple, this.savedView.zoom, {
        animate: false,
      });
    } else {
      this.fitToScope(model, options.places);
    }
    this.map.on('moveend zoomend', () => this.captureView());

    const selector = options.root.querySelector<HTMLSelectElement>('[data-basemap-select]');
    if (selector) {
      selector.value = this.activeBasemap;
      selector.addEventListener('change', () => {
        if (!isBasemapId(selector.value)) return;
        this.fallbackAttempts.clear();
        this.useBasemap(selector.value, options.root);
      });
    }
    const scopeSelector = options.root.querySelector<HTMLSelectElement>('[data-map-scope-select]');
    if (scopeSelector) {
      scopeSelector.value = this.activeScope;
      scopeSelector.addEventListener('change', () => {
        if (scopeSelector.value !== 'all' && scopeSelector.value !== 'plan') return;
        this.setMapScope(scopeSelector.value, model, options.places);
      });
    }
    options.root.querySelector<HTMLElement>('[data-map-fit]')?.addEventListener('click', () => {
      if (this.currentModel) this.fitToScope(this.currentModel, options.places);
    });
    options.root.querySelector<HTMLElement>('[data-map-locate]')?.addEventListener('click', () => {
      this.locateUser(options.root);
    });

    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize({ pan: false }));
    this.resizeObserver.observe(host);
    requestAnimationFrame(() => this.map?.invalidateSize({ pan: false }));
  }

  destroy(): void {
    this.mapGeneration += 1;
    this.captureView();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.markerByItemId.clear();
    this.catalogLayer = null;
    this.tileLayer = null;
    this.fallbackAttempts.clear();
    this.destroying = true;
    this.map?.remove();
    this.destroying = false;
    this.map = null;
    this.currentModel = null;
  }

  private captureView(): void {
    if (!this.map || !this.currentModel) return;
    const center = this.map.getCenter();
    this.savedView = {
      center: [center.lat, center.lng],
      zoom: this.map.getZoom(),
      planId: this.currentModel.planId,
    };
  }

  private useBasemap(id: LeafletBasemapId, root: HTMLElement): void {
    if (!this.map) return;
    if (this.tileLayer) this.tileLayer.removeFrom(this.map);
    this.fallbackAttempts.add(id);
    const config = BASEMAPS[id];
    this.activeBasemap = id;
    this.map.setMaxZoom(config.maxZoom);
    if (this.map.getZoom() > config.maxZoom) this.map.setZoom(config.maxZoom);
    let tileErrors = 0;
    const layer = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      attribution: config.attribution,
      crossOrigin: true,
      ...('subdomains' in config ? { subdomains: config.subdomains } : {}),
    });
    this.tileLayer = layer;
    this.setProviderState(root, `${config.name} · 正在加载真实地图瓦片`, 'loading');
    layer.on('tileload', () => {
      tileErrors = 0;
      this.setProviderState(root, `${config.name} · 真实底图已加载`, 'ready');
    });
    layer.on('tileerror', () => {
      tileErrors += 1;
      if (tileErrors >= 5 && this.activeBasemap === id && this.tileLayer === layer) {
        this.useNextBasemap(id, root);
      }
    });
    layer.addTo(this.map);
    try {
      localStorage.setItem(BASEMAP_STORAGE_KEY, id);
    } catch {
      // The map remains functional when browser storage is unavailable.
    }
    const selector = root.querySelector<HTMLSelectElement>('[data-basemap-select]');
    if (selector) selector.value = id;
  }

  private useNextBasemap(failedId: LeafletBasemapId, root: HTMLElement): void {
    const currentIndex = FALLBACK_ORDER.indexOf(failedId);
    let next: LeafletBasemapId | undefined;
    for (let offset = 1; offset < FALLBACK_ORDER.length; offset += 1) {
      const candidate = FALLBACK_ORDER[(currentIndex + offset) % FALLBACK_ORDER.length];
      if (candidate && !this.fallbackAttempts.has(candidate)) {
        next = candidate;
        break;
      }
    }
    if (!next) {
      this.setProviderState(
        root,
        '全部真实底图源暂不可用；已停止自动重试，可稍后手动切换底图重试',
        'warning',
      );
      return;
    }
    this.setProviderState(
      root,
      `${BASEMAPS[failedId].name} 加载异常，已切换 ${BASEMAPS[next].name}`,
      'warning',
    );
    this.useBasemap(next, root);
  }

  private setProviderState(
    root: HTMLElement,
    message: string,
    state: 'loading' | 'ready' | 'warning',
  ): void {
    const element = root.querySelector<HTMLElement>('[data-map-provider-state]');
    if (!element) return;
    element.textContent = message;
    element.dataset.state = state;
  }

  private addRoute(route: MapRouteRenderModel): void {
    if (!this.map || !route.style.visible) return;
    const color = route.routeStyleId ? route.style.color : dayColor(route.dayId);
    const polyline = L.polyline(
      route.points.map((point) => [point.lat, point.lng] as L.LatLngTuple),
      {
        color,
        weight: route.style.width,
        opacity: route.style.opacity,
        dashArray: dashArray(route.style.pattern),
        lineCap: 'round',
        lineJoin: 'round',
        className: 'map-route',
      },
    ).addTo(this.map);
    const element = polyline.getElement();
    element?.setAttribute('data-route-segment', route.segmentId);
    element?.setAttribute('data-route-style', route.routeStyleId ?? '');
    element?.setAttribute('data-arrow-spacing', String(route.style.arrowSpacing));
    element?.setAttribute('data-route-estimated', String(route.estimated));
  }

  private addMarker(
    markerModel: MapMarkerRenderModel,
    selected: boolean,
    onSelectItem: (itemId: string) => void,
  ): void {
    if (!this.map) return;
    const icon = L.divIcon({
      className: 'leaflet-plan-marker-shell',
      html: markerHtml(markerModel, selected),
      iconSize: [84, 98],
      iconAnchor: [42, 74],
      popupAnchor: [0, -70],
      tooltipAnchor: [0, -70],
    });
    const marker = L.marker([markerModel.location.lat, markerModel.location.lng], {
      icon,
      keyboard: true,
      title: markerModel.label,
      alt: `${markerModel.mapNumber} ${markerModel.label}`.trim(),
      riseOnHover: true,
      zIndexOffset: selected ? 1000 : 0,
    });
    marker.bindPopup(popupHtml(markerModel), { minWidth: 210, closeButton: true });
    const markerGeneration = this.mapGeneration;
    marker.on('click', (event) => {
      L.DomEvent.stopPropagation(event.originalEvent);
      this.openPopupItemId = markerModel.itemId;
      queueMicrotask(() => onSelectItem(markerModel.itemId));
    });
    marker.on('popupclose', () => {
      if (
        markerGeneration === this.mapGeneration &&
        !this.destroying &&
        this.openPopupItemId === markerModel.itemId
      ) {
        this.openPopupItemId = null;
      }
    });
    marker.addTo(this.map);
    const element = marker.getElement();
    element?.setAttribute('role', 'button');
    element?.setAttribute('aria-label', `${markerModel.mapNumber} ${markerModel.label}`.trim());
    this.markerByItemId.set(markerModel.itemId, marker);
  }

  private addCatalogLayer(
    places: readonly Place[],
    model: TripMapRenderModel,
    onAddPlace: (placeId: string) => void,
  ): void {
    if (!this.map) return;
    const activePlaceIds = new Set(model.markers.map((marker) => marker.placeId));
    const layer = L.layerGroup();
    for (const place of places) {
      if (activePlaceIds.has(place.id) || place.location.coordinateSystem !== 'WGS84') continue;
      const marker = L.circleMarker([place.location.lat, place.location.lng], {
        pane: CATALOG_PANE_NAME,
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: catalogColor(place.category),
        fillOpacity: 0.88,
        className: 'catalog-place-marker',
      });
      marker.bindPopup(catalogPopupHtml(place), { minWidth: 220, closeButton: true });
      marker.on('add', () => {
        const element = marker.getElement();
        element?.setAttribute('data-map-catalog-place', place.id);
        element?.setAttribute('role', 'button');
        element?.setAttribute('aria-label', `候选地点 ${place.name}`);
      });
      marker.on('popupopen', (event: L.PopupEvent) => {
        const button = event.popup
          .getElement()
          ?.querySelector<HTMLButtonElement>(`[data-add-map-place="${CSS.escape(place.id)}"]`);
        button?.addEventListener(
          'click',
          () => {
            queueMicrotask(() => onAddPlace(place.id));
          },
          { once: true },
        );
      });
      layer.addLayer(marker);
    }
    this.catalogLayer = layer;
    if (this.activeScope === 'all') layer.addTo(this.map);
  }

  private setMapScope(scope: MapScope, model: TripMapRenderModel, places: readonly Place[]): void {
    if (!this.map || !this.catalogLayer) return;
    this.activeScope = scope;
    if (scope === 'all') this.catalogLayer.addTo(this.map);
    else this.catalogLayer.removeFrom(this.map);
    try {
      localStorage.setItem(MAP_SCOPE_STORAGE_KEY, scope);
    } catch {
      // The map remains functional when browser storage is unavailable.
    }
    this.fitToScope(model, places);
  }

  private fitToScope(model: TripMapRenderModel, places: readonly Place[]): void {
    if (!this.map || this.activeScope === 'plan') {
      this.fitToModel(model);
      return;
    }
    const coordinates = places
      .filter((place) => place.location.coordinateSystem === 'WGS84')
      .map((place) => [place.location.lat, place.location.lng] as L.LatLngTuple);
    if (coordinates.length === 0) {
      this.fitToModel(model);
      return;
    }
    this.map.fitBounds(L.latLngBounds(coordinates), {
      padding: [36, 36],
      maxZoom: 13,
      animate: false,
    });
  }

  private fitToModel(model: TripMapRenderModel): void {
    if (!this.map) return;
    if (!model.bounds) {
      this.map.setView([36.066, 120.382], 11, { animate: false });
      return;
    }
    const bounds = L.latLngBounds(
      [model.bounds.south, model.bounds.west],
      [model.bounds.north, model.bounds.east],
    );
    this.map.fitBounds(bounds, { padding: [42, 42], maxZoom: 14, animate: false });
  }

  private locateUser(root: HTMLElement): void {
    if (!this.map) return;
    this.setProviderState(root, '正在请求浏览器定位…', 'loading');
    this.map.once('locationfound', (event: L.LocationEvent) => {
      this.map?.setView(event.latlng, Math.max(this.map.getZoom(), 14));
      L.circleMarker(event.latlng, {
        radius: 8,
        color: '#ffffff',
        fillColor: '#1677ff',
        fillOpacity: 1,
        weight: 3,
      })
        .bindTooltip('当前位置', { permanent: false })
        .addTo(this.map!);
      this.setProviderState(root, '定位成功 · 坐标仅在当前浏览器地图中使用', 'ready');
    });
    this.map.once('locationerror', () => {
      this.setProviderState(root, '定位失败，请检查浏览器位置权限', 'warning');
    });
    this.map.locate({ enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 });
  }
}
