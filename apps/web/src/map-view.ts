import type { TripMapRenderModel } from '@qingdao/map-core';

import { escapeHtml } from './format.js';
import { LEAFLET_BASEMAP_OPTIONS } from './leaflet-map.js';

export function renderMap(model: TripMapRenderModel | null, catalogCount: number): string {
  const markerCount = model?.markers.length ?? 0;
  const routeCount = model?.routes.length ?? 0;
  return `
    <div class="real-map-shell" data-testid="map-stage" data-real-basemap="true">
      <div class="real-map-toolbar" aria-label="真实地图控制">
        <label>
          <span>底图</span>
          <select data-basemap-select aria-label="选择真实地图底图">
            ${LEAFLET_BASEMAP_OPTIONS.map(
              (option) =>
                `<option value="${escapeHtml(option.id)}">${escapeHtml(option.name)}</option>`,
            ).join('')}
          </select>
        </label>
        <label>
          <span>点位</span>
          <select data-map-scope-select aria-label="选择地图点位范围">
            <option value="all">全部 ${catalogCount} 点</option>
            <option value="plan">仅当前日程</option>
          </select>
        </label>
        <button type="button" data-map-fit>显示全部行程</button>
        <button type="button" data-map-locate>定位我</button>
        <button type="button" data-action="switch-workspace" data-workspace="guide">
          完整高德地图与攻略
        </button>
      </div>
      <div class="leaflet-map-canvas" data-leaflet-map aria-label="青岛行程真实交互地图">
        ${model ? '' : '<p>生成日程后显示真实地图和点位。</p>'}
      </div>
      <div class="map-provider-state" data-map-provider-state data-state="loading" role="status">
        正在准备真实地图底图…
      </div>
      <div class="map-caption">
        <span><i class="legend-tile"></i> 真实地图瓦片</span>
        <span><i class="legend-pin"></i> ${markerCount} 个行程点</span>
        <span><i class="legend-catalog"></i> ${catalogCount} 点候选库</span>
        <span><i class="legend-line"></i> ${routeCount} 段路线</span>
      </div>
    </div>`;
}
