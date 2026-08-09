/* v2.5.7 check-in camera spot, food and sea-view layer. */
(function () {
  'use strict';
  const VERSION = '2.5.7';
  const DATA = window.__QINGDAO_CHECKIN_V257__;
  if (!DATA) return;

  let panel = null;
  let tabButton = null;
  let filter = 'all';
  let leafletLayer = null;
  let amapOverlays = [];
  const photoCache = new Map();
  const resolvedCoords = new Map();
  const extraPopular = [
    {
      id: 'popular-redwall',
      name: '大学路—龙口路网红墙',
      day: '08-10',
      basePointId: 'rec-redwall',
      amapQuery: '大学路 龙口路 网红墙 青岛',
      precision: '沿用现有已核验推荐点',
      cameras: [
        {
          name: '红墙转角',
          direction: '利用转角两面红墙',
          light: '08:00前/傍晚',
          detail: '排队超过15分钟就跳过，人物靠人行区域。',
        },
        {
          name: '街牌＋红墙',
          direction: '斜45°',
          light: '柔光',
          detail: '把路牌、红墙和老城树影同时纳入。',
        },
      ],
    },
    {
      id: 'popular-xilingxia',
      name: '西陵峡路通海街景',
      basePointId: 'rec-xilingxia',
      amapQuery: '西陵峡路 青岛',
      precision: '沿用现有推荐点',
      cameras: [
        {
          name: '道路尽头见海',
          direction: '沿道路向海',
          light: '清晨/日落前',
          detail: '只在人行区域拍摄，禁止站车道中央。',
        },
        {
          name: '坡路＋海岸',
          direction: '长焦压缩',
          light: '傍晚',
          detail: '选不挡居民出入口的位置。',
        },
      ],
    },
    {
      id: 'popular-thirdbeach',
      name: '第三海水浴场城市夜景',
      basePointId: 'rec-thirdbeach',
      amapQuery: '第三海水浴场 青岛',
      precision: '沿用现有推荐点',
      cameras: [
        {
          name: '海岸看城市楼群',
          direction: '向北/东北',
          light: '蓝调时刻',
          detail: '海面当前景，城市灯光作背景。',
        },
        {
          name: '沙滩侧向天际线',
          direction: '沿岸线',
          light: '日落后30分钟',
          detail: '只在开放沙滩/步道。',
        },
      ],
    },
    {
      id: 'popular-church',
      name: '圣弥厄尔教堂老城街景',
      amapQuery: '圣弥厄尔教堂 青岛',
      lat: 36.06702,
      lng: 120.31425,
      precision: '老城景点参考坐标',
      cameras: [
        {
          name: '浙江路正轴线',
          lat: 36.0671,
          lng: 120.31435,
          direction: '正对双塔',
          light: '上午',
          detail: '退远用2×减少广角畸变。',
        },
        {
          name: '街角生活感',
          lat: 36.06685,
          lng: 120.3145,
          direction: '斜拍教堂＋街巷',
          light: '傍晚',
          detail: '避开礼拜和人流出入口。',
        },
      ],
    },
  ];

  function esc(value) {
    return typeof escapeHtml === 'function'
      ? escapeHtml(value)
      : String(value ?? '').replace(
          /[&<>"']/g,
          (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
        );
  }
  function isMobile() {
    return matchMedia('(max-width:800px)').matches;
  }
  function basePoint(location) {
    return location.basePointId && typeof pointById === 'function'
      ? pointById(location.basePointId)
      : null;
  }
  function normalizeDataCoord(owner, lat, lng) {
    const a = Number(lat),
      b = Number(lng);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (owner?.coordSystem === 'wgs84' || !window.TravelCoordinates?.gcj02ToWgs84) return [a, b];
    const value = window.TravelCoordinates.gcj02ToWgs84(a, b);
    return [Number(value[0]), Number(value[1])];
  }
  function locationCoord(location) {
    const cached = resolvedCoords.get(location.id);
    if (cached) return cached;
    const p = basePoint(location);
    if (p) return [Number(p.lat), Number(p.lng)];
    if (Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng)))
      return normalizeDataCoord(location, location.lat, location.lng);
    return null;
  }
  function cameraCoord(location, camera) {
    const p = basePoint(location);
    if (p) return [Number(p.lat), Number(p.lng)];
    if (Number.isFinite(Number(camera.lat)) && Number.isFinite(Number(camera.lng)))
      return normalizeDataCoord(camera, camera.lat, camera.lng);
    return locationCoord(location);
  }
  async function resolveAmapLocation(location) {
    const current = locationCoord(location);
    if (current) return current;
    if (!location?.amapQuery || typeof amapWebRequest !== 'function') return null;
    try {
      const data = await amapWebRequest('/v5/place/text', {
        keywords: location.amapQuery,
        region: '青岛',
        city_limit: 'true',
        show_fields: 'photos',
      });
      const poi = data?.pois?.[0],
        raw = poi?.location;
      const pair =
        typeof raw === 'string'
          ? raw.split(',').map(Number)
          : [Number(raw?.lng ?? raw?.getLng?.()), Number(raw?.lat ?? raw?.getLat?.())];
      if (!Number.isFinite(pair[0]) || !Number.isFinite(pair[1])) return null;
      const value = window.TravelCoordinates?.gcj02ToWgs84
        ? window.TravelCoordinates.gcj02ToWgs84(pair[1], pair[0])
        : [pair[1], pair[0]];
      const coord = [Number(value[0]), Number(value[1])];
      resolvedCoords.set(location.id, coord);
      const photos = Array.isArray(poi?.photos)
        ? poi.photos
            .map((item) => (typeof item === 'string' ? item : item?.url))
            .filter(Boolean)
            .slice(0, 3)
        : [];
      if (photos.length && !photoCache.has(location.id)) photoCache.set(location.id, photos);
      return coord;
    } catch {
      return null;
    }
  }
  let fallbackLocationCache = null;
  function itineraryFallbackLocations() {
    if (fallbackLocationCache) return fallbackLocationCache;
    if (typeof POINTS === 'undefined') {
      fallbackLocationCache = [];
      return fallbackLocationCache;
    }
    const explicit = [...(DATA.locations || []), ...extraPopular],
      covered = new Set();
    for (const location of explicit) {
      if (location.basePointId) covered.add(location.basePointId);
      if (location.id?.endsWith('-checkin')) covered.add(location.id.slice(0, -8));
    }
    const routeIds = new Set(
      typeof SCHEDULES === 'undefined' ? [] : SCHEDULES.flatMap((day) => day.route || []),
    );
    const ignored = new Set(['住宿区域', '酒店', '服务', '交通节点', '行程节点']);
    fallbackLocationCache = POINTS.filter(
      (point) =>
        point &&
        !ignored.has(point.category) &&
        (routeIds.has(point.id) || point.category === '备选') &&
        !covered.has(point.id),
    ).map((point) => ({
      id: 'auto-' + point.id,
      name: point.name,
      day: Array.isArray(point.days) ? point.days[0] : undefined,
      basePointId: point.id,
      amapQuery: point.name + ' 青岛',
      precision: '沿用已核验行程地点锚点；暂无独立精确机位，现场按人流和围栏微调',
      autoFallback: true,
      cameras: [
        {
          name: '主地标／入口全景',
          direction: '以主地标或入口为背景，人物站在人行区域',
          light: '顺光、阴天柔光或傍晚',
          detail:
            '使用行程中已核验地点坐标作为地点锚点，不伪造独立站位；优先拍完整地标与环境关系。',
        },
        {
          name: '环境纵深／人物机位',
          direction: '沿主要步道、街景、建筑或海岸线形成纵深',
          light: '上午或日落前',
          detail: '用道路、栏杆、建筑边线或海岸线作引导线；具体站位根据现场开放边界微调。',
        },
      ],
    }));
    return fallbackLocationCache;
  }
  function allLocations() {
    return [...(DATA.locations || []), ...extraPopular, ...itineraryFallbackLocations()];
  }
  function isPriority(location) {
    return Boolean(location.priority || (DATA.priorityIds || []).includes(location.id));
  }
  function amapUrl(query) {
    return 'https://ditu.amap.com/search?query=' + encodeURIComponent(query || '青岛');
  }
  function activeLocations() {
    return allLocations().filter(
      (location) =>
        filter === 'all' ||
        (filter === 'priority' && isPriority(location)) ||
        (filter === 'oldcity' && ['08-10', '08-12'].includes(location.day)) ||
        (filter === 'westcoast' && location.day === '08-14') ||
        (filter === 'itinerary' && Boolean(location.day)),
    );
  }

  function galleryPlaceholder(location) {
    const url = amapUrl(location.amapQuery || location.name);
    return `<a href="${url}" target="_blank" rel="noopener">高德地点照片</a><a href="${url}" target="_blank" rel="noopener">地图核验</a><span>展开后自动加载</span>`;
  }
  function cameraHtml(location, camera, index) {
    const coord = cameraCoord(location, camera, index);
    return `<article class="v257-camera"><div class="v257-camera-head"><b>${esc(camera.name)}</b><em>${esc(camera.light || '按现场光线')}</em></div><p>${esc(camera.detail || '现场按人流和安全边界微调。')}<br><b>拍摄方向：</b>${esc(camera.direction || '现场判断')}</p>${coord ? `<code>${basePoint(location) ? '地点锚点' : Number.isFinite(Number(camera.lat)) && Number.isFinite(Number(camera.lng)) ? '机位参考' : '地点锚点'} WGS84 ${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}${basePoint(location) || !Number.isFinite(Number(camera.lat)) || !Number.isFinite(Number(camera.lng)) ? ' · 具体站位现场微调' : ''}</code>` : '<code>机位待现场/高德确认，不生成假坐标</code>'}<div class="v257-gallery" data-v257-gallery="${esc(location.id)}">${galleryPlaceholder(location)}</div><div class="v257-gallery-note">同地点参考图用于构图；真正站位以现场人流、围栏和安全条件微调。</div></article>`;
  }
  function locationHtml(location) {
    const priority = isPriority(location),
      coord = locationCoord(location),
      searchOnly = Boolean(!coord && location.amapQuery);
    return `<article class="v257-location-card ${priority ? 'v257-priority' : ''}" data-v257-location-card="${esc(location.id)}"><div class="v257-location-head"><div><h3>${priority ? '⭐ ' : ''}${esc(location.name)}</h3><small>${esc(location.address || location.precision || '青岛打卡机位')} · ${esc(location.precision || '机位参考')}</small></div><button type="button" data-v257-focus="${esc(location.id)}" class="${searchOnly ? 'v257-search-only' : ''}">${searchOnly ? '高德确认' : '地图机位'}</button></div><details data-v257-location="${esc(location.id)}" ${priority ? 'open' : ''}><summary>${(location.cameras || []).length} 个机位 · 构图/光线/参考图</summary><div class="v257-location-body"><div class="v257-camera-list">${(location.cameras || []).map((camera, index) => cameraHtml(location, camera, index)).join('')}</div><div class="v257-actions"><a href="${amapUrl(location.amapQuery || location.name)}" target="_blank" rel="noopener">高德核验/导航</a><button type="button" data-v257-load-photos="${esc(location.id)}">刷新参考图</button></div></div></details></article>`;
  }
  function routeHtml(route) {
    return `<article class="v257-route-card ${route.priority ? 'v257-priority' : ''}"><h3>⭐ ${esc(route.name)}</h3><p>${esc(route.note)}</p><div class="v257-route-nodes">${(route.anchors || []).map((a, index) => `${index ? '<i>→</i>' : ''}<span>${esc(a.name)}</span>`).join('')}</div><div class="v257-actions"><button type="button" data-v257-route="${esc(route.id)}">地图显示整条路线</button></div></article>`;
  }
  function foodCard(item) {
    return `<article class="v257-food-card"><b>${esc(item.name)}</b><p>${esc(item.status || item.note || item.address || '按当天位置高德确认门店')}</p><button type="button" data-v257-search="${esc(item.amapQuery || item.name)}">高德找店</button></article>`;
  }
  function foodHtml() {
    const food = DATA.food || {};
    return `<section class="v257-food-section"><div class="v257-section-title"><h3>新增必吃 / 必喝</h3><span>不删原清单，只做加法</span></div><div class="v257-food-grid">${(food.mustEatDrink || []).map(foodCard).join('')}</div><div class="v257-subhead">烤肉参考池 · 不强行替你选一家</div><div class="v257-bbq-strip">${(food.bbqReference || []).map((item) => `<button type="button" data-v257-search="${esc(item.name + ' 青岛')}">${esc(item.name)}</button>`).join('')}</div><div class="v257-subhead">外卖 / 路过可尝</div><div class="v257-food-grid">${(food.deliveryOrTry || []).map(foodCard).join('')}</div></section>`;
  }
  function seaHtml() {
    return `<section class="v257-sea-section"><div class="v257-section-title"><h3>海景与沙滩候选</h3><span>沙滩可去 ≠ 允许下水</span></div><div class="v257-sea-grid">${(DATA.seaViews || []).map((item) => `<article class="v257-sea-card"><b>${esc(item.name)}</b><p>${esc(item.note)}</p><button type="button" data-v257-search="${esc(item.amapQuery || item.name)}">高德查看</button></article>`).join('')}${(DATA.beachPlay || []).map((item) => `<article class="v257-beach-card"><b>${esc(item.name)}</b><span class="v257-beach-type ${item.type === 'officialBathingBeach' ? 'official' : 'visit'}">${item.type === 'officialBathingBeach' ? '官方海水浴场' : '海岸/沙滩候选'}</span><p>${esc(item.tripHours || '')}${item.tripHours ? ' · ' : ''}${esc(item.note)}</p></article>`).join('')}</div></section>`;
  }
  function panelHtml() {
    return `<div class="v257-checkin-hero"><span>PHOTO SPOTS · v${VERSION}</span><h2>打卡机位</h2><p>地点不是一个点：每处拆成多个站位、拍摄方向和光线建议。重点项用橙色标识；没有可靠坐标的“黄岛站路牌、五仁杂货铺”等只提供高德确认，不编假位置。</p></div><div class="v257-checkin-map-hint">打开本标签页时，地图只叠加打卡机位与两条重点拍照路线；切回其他标签会自动清理，避免污染原行程地图。</div><div class="v257-filter-row"><button data-v257-filter="all" class="${filter === 'all' ? 'active' : ''}">全部</button><button data-v257-filter="priority" class="${filter === 'priority' ? 'active' : ''}">⭐重点</button><button data-v257-filter="itinerary" class="${filter === 'itinerary' ? 'active' : ''}">逐日行程内</button><button data-v257-filter="oldcity" class="${filter === 'oldcity' ? 'active' : ''}">老城</button><button data-v257-filter="westcoast" class="${filter === 'westcoast' ? 'active' : ''}">黄岛/西海岸</button></div><div class="v257-route-list">${(DATA.routes || []).map(routeHtml).join('')}</div><div class="v257-location-list">${activeLocations().map(locationHtml).join('')}</div>${foodHtml()}${seaHtml()}`;
  }

  function ensurePanel() {
    const tabs = document.getElementById('mainTabs') || document.querySelector('.tabs');
    if (!tabs) return null;
    tabButton = tabs.querySelector('[data-tab="checkin"]');
    if (!tabButton) {
      tabButton = document.createElement('button');
      tabButton.type = 'button';
      tabButton.className = 'tab-btn';
      tabButton.dataset.tab = 'checkin';
      tabButton.setAttribute('role', 'tab');
      tabButton.setAttribute('aria-selected', 'false');
      tabButton.textContent = '打卡机位';
      const food = tabs.querySelector('[data-tab="food"]');
      tabs.insertBefore(tabButton, food || tabs.lastElementChild);
    }
    panel = document.querySelector('[data-panel="checkin"]');
    if (!panel) {
      panel = document.createElement('section');
      panel.className = 'section tab-panel v257-checkin-panel';
      panel.dataset.panel = 'checkin';
      const foodPanel = document.querySelector('[data-panel="food"]');
      (foodPanel?.parentNode || tabs.parentNode).insertBefore(panel, foodPanel || null);
    }
    if (!tabButton.dataset.v257Bound) {
      tabButton.dataset.v257Bound = '1';
      tabButton.addEventListener('click', openPanel);
    }
    return panel;
  }
  function renderPanel() {
    const root = ensurePanel();
    if (!root) return;
    root.innerHTML = panelHtml();
    (DATA.priorityIds || []).forEach((id) => void loadPhotos(id));
  }
  function openPanel() {
    renderPanel();
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn === tabButton);
      btn.setAttribute('aria-selected', String(btn === tabButton));
    });
    document
      .querySelectorAll('.tab-panel')
      .forEach((node) => node.classList.toggle('active', node === panel));
    panel.hidden = false;
    renderMapLayer();
    void resolveVisibleLocations();
    try {
      history.replaceState(null, '', location.pathname + location.search + '#checkin');
    } catch {}
  }
  async function resolveVisibleLocations() {
    let changed = false;
    for (const location of activeLocations()) {
      if (locationCoord(location) || !location.amapQuery) continue;
      const coord = await resolveAmapLocation(location);
      if (coord) changed = true;
    }
    if (changed && panel?.classList.contains('active')) {
      renderPanel();
      renderMapLayer();
    }
  }

  function toGcj(coord) {
    if (window.TravelCoordinates?.wgs84ToGcj02) {
      const p = window.TravelCoordinates.wgs84ToGcj02(coord[0], coord[1]);
      return [p[1], p[0]];
    }
    return [coord[1], coord[0]];
  }
  function clearMapLayer() {
    if (leafletLayer && typeof map !== 'undefined') {
      try {
        map.removeLayer(leafletLayer);
      } catch {}
      leafletLayer = null;
    }
    if (amapOverlays.length && typeof amapInstance !== 'undefined' && amapInstance) {
      try {
        amapInstance.remove(amapOverlays);
      } catch {}
      amapOverlays = [];
    }
  }
  function markerPopup(location, camera, index) {
    return `<div class="pop"><h3>${esc(location.name)} · ${esc(camera.name)}</h3><p>${esc(camera.detail || '现场微调')}</p><p class="meta">${esc(camera.direction || '')} · ${esc(camera.light || '')}</p><div class="pop-actions"><a href="${amapUrl(location.amapQuery || location.name)}" target="_blank" rel="noopener">高德导航/核验</a></div></div>`;
  }
  function routeAnchorCoord(route, anchor, index) {
    const pointIds =
      route.id === 'route-longjiang'
        ? ['rec-redwall', 'rec-comic', null]
        : route.id === 'route-fushan'
          ? ['xiaoyushan', null, null]
          : [];
    const id = pointIds[index],
      p = id && typeof pointById === 'function' ? pointById(id) : null;
    if (p) return [Number(p.lat), Number(p.lng)];
    if (!Number.isFinite(Number(anchor.lat)) || !Number.isFinite(Number(anchor.lng))) return null;
    if (route.id === 'route-fushan' && index > 2) return null;
    return normalizeDataCoord(anchor, anchor.lat, anchor.lng);
  }
  function routeAnchorMarkersLeaflet() {
    if (!leafletLayer || typeof L === 'undefined') return;
    (DATA.routes || []).forEach((route) =>
      (route.anchors || []).forEach((anchor, index) => {
        const coord = routeAnchorCoord(route, anchor, index);
        if (!coord) return;
        const icon = L.divIcon({
          className: '',
          html: `<div class="v257-photo-route-label">${index + 1} · ${esc(anchor.name)}</div>`,
          iconAnchor: [8, 14],
        });
        L.marker(coord, { icon, title: route.name + ' · ' + anchor.name, interactive: true }).addTo(
          leafletLayer,
        );
      }),
    );
  }
  function routeAnchorMarkersAmap() {
    if (typeof AMap === 'undefined' || !amapInstance) return;
    (DATA.routes || []).forEach((route) =>
      (route.anchors || []).forEach((anchor, index) => {
        const coord = routeAnchorCoord(route, anchor, index);
        if (!coord) return;
        const marker = new AMap.Marker({
          position: toGcj(coord),
          title: route.name + ' · ' + anchor.name,
          content: `<div class="v257-photo-route-label">${index + 1} · ${esc(anchor.name)}</div>`,
          offset: new AMap.Pixel(-8, -14),
        });
        amapOverlays.push(marker);
      }),
    );
  }
  function renderMapLayer() {
    clearMapLayer();
    const locations = activeLocations();
    if (
      typeof mapEngine !== 'undefined' &&
      mapEngine === 'amap' &&
      typeof amapInstance !== 'undefined' &&
      amapInstance &&
      typeof AMap !== 'undefined'
    ) {
      locations.forEach((location) =>
        (location.cameras || []).forEach((camera, index) => {
          const coord = cameraCoord(location, camera, index);
          if (!coord) return;
          const marker = new AMap.Marker({
            position: toGcj(coord),
            title: location.name + ' · ' + camera.name,
            content: `<div class="v257-map-pin ${isPriority(location) ? 'priority' : ''}">📷</div>`,
            offset: new AMap.Pixel(-14, -14),
          });
          marker.on('click', () => {
            amapInstance.setZoomAndCenter(17, toGcj(coord));
          });
          amapOverlays.push(marker);
        }),
      );
      routeAnchorMarkersAmap();
      if (amapOverlays.length) amapInstance.add(amapOverlays);
      return;
    }
    if (typeof L === 'undefined' || typeof map === 'undefined') return;
    leafletLayer = L.layerGroup().addTo(map);
    locations.forEach((location) =>
      (location.cameras || []).forEach((camera, index) => {
        const coord = cameraCoord(location, camera, index);
        if (!coord) return;
        const icon = L.divIcon({
          className: '',
          html: `<div class="v257-map-pin ${isPriority(location) ? 'priority' : ''}">📷</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker(coord, { icon, title: location.name + ' · ' + camera.name })
          .bindPopup(markerPopup(location, camera, index))
          .addTo(leafletLayer);
      }),
    );
    routeAnchorMarkersLeaflet();
  }
  async function focusLocation(id) {
    const location = allLocations().find((item) => item.id === id);
    if (!location) return;
    let coord = locationCoord(location);
    if (!coord) coord = await resolveAmapLocation(location);
    if (!coord) {
      searchAmap(location.amapQuery || location.name);
      return;
    }
    renderPanel();
    renderMapLayer();
    if (isMobile()) {
      const side = document.getElementById('panel');
      if (side?.classList.contains('open')) document.getElementById('menuBtn')?.click();
    }
    if (
      typeof mapEngine !== 'undefined' &&
      mapEngine === 'amap' &&
      typeof amapInstance !== 'undefined' &&
      amapInstance
    ) {
      amapInstance.setZoomAndCenter(17, toGcj(coord));
      return;
    }
    if (typeof map !== 'undefined') map.setView(coord, 17, { animate: true });
  }
  function collectRoutePolyline(node, out = []) {
    if (node == null) return out;
    if (typeof node === 'string') {
      for (const token of node.split(';')) {
        const [lng, lat] = token.split(',').map(Number);
        if (Number.isFinite(lat) && Number.isFinite(lng)) out.push([lng, lat]);
      }
      return out;
    }
    if (Array.isArray(node)) {
      for (const item of node) collectRoutePolyline(item, out);
      return out;
    }
    if (typeof node === 'object') {
      if (node.polyline) collectRoutePolyline(node.polyline, out);
      for (const [key, value] of Object.entries(node)) {
        if (key === 'polyline') continue;
        if (value && typeof value === 'object') collectRoutePolyline(value, out);
      }
    }
    return out;
  }
  async function queryWalkingLeg(a, b) {
    if (typeof amapWebRequest !== 'function') throw new Error('高德Web路线服务尚未加载');
    const origin = toGcj(a),
      destination = toGcj(b);
    const data = await amapWebRequest('/v5/direction/walking', {
      origin: origin.join(','),
      destination: destination.join(','),
      show_fields: 'cost,navi,polyline',
    });
    const path = data?.route?.paths?.[0];
    if (!path) throw new Error('高德未返回步行路线');
    const points = collectRoutePolyline(path, []);
    if (points.length < 2) throw new Error('高德步行路线缺少道路折线');
    return points;
  }
  function gcjPathToWgs(points) {
    return points.map(([lng, lat]) => {
      if (window.TravelCoordinates?.gcj02ToWgs84) {
        const value = window.TravelCoordinates.gcj02ToWgs84(lat, lng);
        return [value[0], value[1]];
      }
      return [lat, lng];
    });
  }
  async function focusRoute(id) {
    const route = (DATA.routes || []).find((item) => item.id === id);
    if (!route) return;
    const anchors = (route.anchors || [])
      .map((anchor, index) => routeAnchorCoord(route, anchor, index))
      .filter(Boolean);
    renderMapLayer();
    if (isMobile()) {
      const side = document.getElementById('panel');
      if (side?.classList.contains('open')) document.getElementById('menuBtn')?.click();
    }
    try {
      let gcjPath = [];
      for (let index = 1; index < anchors.length; index += 1) {
        const leg = await queryWalkingLeg(anchors[index - 1], anchors[index]);
        if (gcjPath.length && leg.length) leg.shift();
        gcjPath.push(...leg);
      }
      if (gcjPath.length < 2) throw new Error('高德未返回完整路线');
      if (
        typeof mapEngine !== 'undefined' &&
        mapEngine === 'amap' &&
        typeof amapInstance !== 'undefined' &&
        amapInstance &&
        typeof AMap !== 'undefined'
      ) {
        const line = new AMap.Polyline({
          path: gcjPath,
          strokeColor: '#e18a20',
          strokeWeight: 6,
          strokeOpacity: 0.9,
          showDir: true,
        });
        amapOverlays.push(line);
        amapInstance.add(line);
        amapInstance.setFitView(amapOverlays, false, [80, 30, 50, 30], 17);
      } else if (typeof map !== 'undefined' && leafletLayer && typeof L !== 'undefined') {
        const wgs = gcjPathToWgs(gcjPath);
        L.polyline(wgs, { weight: 6, opacity: 0.9, color: '#d97818' }).addTo(leafletLayer);
        map.fitBounds(wgs, { padding: [34, 34], maxZoom: 17 });
      }
      if (typeof showMapNotice === 'function')
        showMapNotice('已加载高德实际步行道路路线；不是直线示意。');
    } catch {
      if (typeof showMapNotice === 'function')
        showMapNotice('高德实际步行路线暂不可用；仅显示打卡顺序点，不绘制直线路线。');
      if (
        typeof mapEngine !== 'undefined' &&
        mapEngine === 'amap' &&
        amapInstance &&
        amapOverlays.length
      )
        amapInstance.setFitView(amapOverlays, false, [80, 30, 50, 30], 16);
      else if (typeof map !== 'undefined' && anchors.length)
        map.fitBounds(anchors, { padding: [30, 30], maxZoom: 16 });
    }
  }
  function searchAmap(keyword) {
    if (window.TravelLeisureBackups?.search) {
      window.TravelLeisureBackups.search(keyword);
      return;
    }
    window.open(amapUrl(keyword), '_blank', 'noopener');
  }

  async function fetchAmapPhotos(location) {
    if (typeof amapWebRequest !== 'function') return [];
    try {
      const data = await amapWebRequest('/v5/place/text', {
        keywords: location.amapQuery || location.name,
        region: '青岛',
        city_limit: 'true',
        show_fields: 'photos',
      });
      const poi = data?.pois?.[0];
      const photos = Array.isArray(poi?.photos) ? poi.photos : [];
      return photos
        .map((item) => (typeof item === 'string' ? item : item?.url))
        .filter(Boolean)
        .slice(0, 3);
    } catch {
      return [];
    }
  }
  async function loadPhotos(id) {
    const location = allLocations().find((item) => item.id === id);
    if (!location) return;
    if (photoCache.has(id)) {
      fillGalleries(id, photoCache.get(id));
      return;
    }
    let urls = [...(location.curatedImages || [])];
    if (urls.length < 3) urls = [...urls, ...(await fetchAmapPhotos(location))];
    urls = [...new Set(urls)].slice(0, 3);
    photoCache.set(id, urls);
    fillGalleries(id, urls);
  }
  function fillGalleries(id, urls) {
    const location = allLocations().find((item) => item.id === id);
    document.querySelectorAll(`[data-v257-gallery="${CSS.escape(id)}"]`).forEach((box) => {
      if (urls.length) {
        box.innerHTML =
          urls
            .map(
              (url, index) =>
                `<a href="${esc(url)}" target="_blank" rel="noopener" aria-label="${esc(location?.name || id)}参考图${index + 1}"><img src="${esc(url)}" alt="${esc(location?.name || id)}构图参考${index + 1}" loading="lazy" referrerpolicy="no-referrer"></a>`,
            )
            .join('') +
          (urls.length < 3
            ? `<a href="${amapUrl(location?.amapQuery || location?.name)}" target="_blank" rel="noopener">更多高德照片</a>`
            : '');
      } else
        box.innerHTML = `<a href="${amapUrl(location?.amapQuery || location?.name)}" target="_blank" rel="noopener">高德地点照片</a><span>暂无稳定外链图</span><span>现场按构图说明拍</span>`;
    });
  }

  function decorateDays() {
    Object.entries(DATA.itineraryAdditions || {}).forEach(([date, items]) => {
      const card = document.querySelector(`details.day-card[data-day="${date}"]`);
      const body = card?.querySelector('.day-body');
      if (!body || body.querySelector('[data-v257-day-additions]')) return;
      const box = document.createElement('section');
      box.className = 'v257-day-additions';
      box.dataset.v257DayAdditions = date;
      box.innerHTML = `<b>📷 v2.5.7 新增打卡支线（已纳入本日）</b><ul>${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
      const planB = body.querySelector('.planb');
      body.insertBefore(box, planB || null);
    });
  }
  function decorateFood() {
    const foodPanel = document.querySelector('[data-panel="food"]');
    if (!foodPanel || foodPanel.querySelector('[data-v257-food]')) return;
    const wrap = document.createElement('div');
    wrap.dataset.v257Food = '1';
    wrap.innerHTML = foodHtml();
    foodPanel.appendChild(wrap);
  }
  function decorateLeisure() {
    const rec = document.querySelector('[data-panel="recommend"]');
    if (!rec || rec.querySelector('[data-v257-sea]')) return;
    const wrap = document.createElement('div');
    wrap.dataset.v257Sea = '1';
    wrap.innerHTML = seaHtml();
    rec.appendChild(wrap);
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      const f = target.closest('[data-v257-filter]');
      if (f) {
        filter = f.dataset.v257Filter || 'all';
        renderPanel();
        renderMapLayer();
        return;
      }
      const focus = target.closest('[data-v257-focus]');
      if (focus) {
        focusLocation(focus.dataset.v257Focus);
        return;
      }
      const route = target.closest('[data-v257-route]');
      if (route) {
        focusRoute(route.dataset.v257Route);
        return;
      }
      const photo = target.closest('[data-v257-load-photos]');
      if (photo) {
        void loadPhotos(photo.dataset.v257LoadPhotos);
        return;
      }
      const search = target.closest('[data-v257-search]');
      if (search) {
        searchAmap(search.dataset.v257Search);
        return;
      }
      const tab = target.closest('.tab-btn');
      if (tab && tab !== tabButton) {
        clearMapLayer();
        [0, 80, 260, 650].forEach((delay) =>
          setTimeout(() => {
            decorateDays();
            decorateFood();
            decorateLeisure();
          }, delay),
        );
      }
    });
    document.addEventListener(
      'toggle',
      (event) => {
        const details = event.target;
        if (!(details instanceof HTMLDetailsElement) || !details.open) return;
        const id = details.dataset.v257Location;
        if (id) void loadPhotos(id);
      },
      true,
    );
    document.getElementById('basemapSelect')?.addEventListener('change', () => {
      if (panel?.classList.contains('active')) setTimeout(renderMapLayer, 350);
    });
  }

  function install() {
    ensurePanel();
    renderPanel();
    decorateDays();
    decorateFood();
    decorateLeisure();
    bindEvents();
    const observer = new MutationObserver(() => {
      decorateDays();
      decorateFood();
      decorateLeisure();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const v257ReconcileTimer = window.setInterval(() => {
      decorateDays();
      decorateFood();
      decorateLeisure();
    }, 400);
    window.addEventListener('pagehide', () => window.clearInterval(v257ReconcileTimer), {
      once: true,
    });
    window.TravelCheckinSpots = Object.freeze({
      version: VERSION,
      data: DATA,
      open: openPanel,
      focus: focusLocation,
      route: focusRoute,
      photos: loadPhotos,
      clear: clearMapLayer,
    });
    const dedicatedCheckinEntry =
      location.hash === '#checkin' || new URLSearchParams(location.search).get('checkin') === '1';
    if (dedicatedCheckinEntry) {
      setTimeout(openPanel, 180);
    }
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => setTimeout(install, 0), { once: true });
  else setTimeout(install, 0);
})();
