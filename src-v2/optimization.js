(function(){
  'use strict';
  const core=window.TravelCore;
  if(!core)throw new Error('TravelCore runtime is missing');

  const original={
    switchToAmap,
    switchLeafletBasemap,
    renderDays,
    renderLegend,
    toggleAmapServicePanel,
    amapSetStatus,
    showMapNotice,
    travelMarkerHtml,
    travelRouteMarkerHtml
  };

  syncViewportHeight=core.viewport.sync;

  function gcjToWgs(lat,lng){
    const converted=wgs84ToGcj02(lat,lng);
    return[lat*2-converted[0],lng*2-converted[1]];
  }
  function currentMapExtra(){return{selectedDay:selectedDay||null,selectedPoint:amapSelectedPoi?.id||null,traffic:Boolean(amapTrafficVisible)}}
  function bindViewEvents(){
    if(map&&!map.__travelV2StateBound){
      map.__travelV2StateBound=true;
      map.on('moveend zoomend',()=>{if(mapEngine==='leaflet')core.mapView.captureLeaflet(map,currentMapExtra())});
    }
    if(amapInstance&&!amapInstance.__travelV2StateBound){
      amapInstance.__travelV2StateBound=true;
      const capture=()=>{if(mapEngine==='amap')core.mapView.captureAmap(amapInstance,currentMapExtra())};
      amapInstance.on('moveend',capture);amapInstance.on('zoomend',capture);
    }
  }

  switchToAmap=function(options={}){
    const leafletView=mapEngine==='leaflet'&&map?{center:map.getCenter(),zoom:map.getZoom()}:null;
    return original.switchToAmap(options).then(instance=>{
      bindViewEvents();
      if(leafletView){
        const gcj=wgs84ToGcj02(leafletView.center.lat,leafletView.center.lng);
        instance.setZoomAndCenter(leafletView.zoom,[gcj[1],gcj[0]],true);
      }
      core.mapView.captureAmap(instance,currentMapExtra());
      return instance;
    });
  };

  switchLeafletBasemap=function(id){
    const amapView=mapEngine==='amap'&&amapInstance?{center:amapInstance.getCenter(),zoom:amapInstance.getZoom()}:null;
    original.switchLeafletBasemap(id);
    bindViewEvents();
    if(amapView&&map){
      const wgs=gcjToWgs(amapView.center.lat,amapView.center.lng);
      map.setView(wgs,amapView.zoom,{animate:false});
    }
    if(map)core.mapView.captureLeaflet(map,currentMapExtra());
  };

  travelMarkerHtml=window.TravelRenderModel.markerHtml;
  travelRouteMarkerHtml=window.TravelRenderModel.routeMarkerHtml;
  travelDirectionHtml=window.TravelRenderModel.directionHtml;

  function tagWeatherNodes(){
    document.querySelectorAll('.day-card[data-day]').forEach(card=>{
      const date=card.dataset.day;
      const chip=card.querySelector('.day-weather-chip');
      const detail=card.querySelector('.day-weather-detail');
      if(chip)chip.dataset.weatherDate=date;
      if(detail)detail.dataset.weatherDate=date;
    });
  }
  function updateWeatherNodes(){
    tagWeatherNodes();
    document.querySelectorAll('[data-weather-date]').forEach(node=>{
      const date=node.dataset.weatherDate;
      if(node.classList.contains('day-weather-chip'))node.textContent=tripWeatherCompact(date);
      else if(node.classList.contains('day-weather-detail'))node.outerHTML=tripWeatherDetailHtml(date).replace('class="day-weather-detail"',`class="day-weather-detail" data-weather-date="${date}"`);
    });
    original.renderLegend(selectedDay||SCHEDULES[1]?.date);
    if(selectedDay&&routeVisible){const d=SCHEDULES.find(x=>x.date===selectedDay);if(d)setDayRouteCard(d)}
  }
  renderDays=function(){original.renderDays();tagWeatherNodes()};
  renderLegend=function(date){original.renderLegend(date)};
  applyTripWeather=function(data){
    const forecast=data?.forecasts?.[0],casts=forecast?.casts||[];
    amapTripWeatherByDate={};
    casts.forEach(cast=>{const date=weatherValue(cast,'date');if(date!=='--')amapTripWeatherByDate[date]=cast});
    amapTripWeatherReportTime=weatherValue(forecast,'reporttime','reportTime');
    if(document.querySelector('.day-card'))updateWeatherNodes();else renderDays();
  };

  function controlledWebRequest(key,endpoint,params={},maxAge=0){
    const ticket=core.requests.begin(key);
    const url=new URL('https://restapi.amap.com'+endpoint);
    Object.entries({...params,key:AMAP_WEB_KEY,output:'JSON'}).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')url.searchParams.set(k,String(v))});
    const cacheKey=url.pathname+'?'+[...url.searchParams.entries()].filter(([k])=>k!=='key').sort().map(([k,v])=>`${k}=${v}`).join('&');
    const cached=maxAge?core.cache.get(cacheKey,maxAge):null;
    if(cached)return Promise.resolve({data:cached,ticket,cached:true});
    return fetch(url.toString(),{mode:'cors',cache:'no-store',signal:ticket.signal||undefined})
      .then(response=>{if(!response.ok)throw new Error('HTTP '+response.status);return response.json()})
      .catch(error=>{if(ticket.signal?.aborted)throw error;return amapJsonp(url)})
      .then(amapValidateResponse)
      .then(data=>{if(!core.requests.current(ticket))throw new DOMException('Stale request','AbortError');if(maxAge)core.cache.set(cacheKey,data);return{data,ticket,cached:false}})
      .finally(()=>core.requests.finish(ticket));
  }

  amapInputTips=function(){
    const input=document.getElementById('amapSearchInput'),keywords=input.value.trim();
    clearTimeout(amapSuggestionTimer);core.requests.cancel('tips');
    if(keywords.length<2){amapRenderSuggestions([]);return}
    amapSuggestionTimer=setTimeout(()=>{
      const ticket=core.requests.begin('tips');
      amapEnsureServices().then(()=>amapAutoComplete.search(keywords,(status,result)=>{
        if(!core.requests.current(ticket)||input.value.trim()!==keywords)return;
        amapRenderSuggestions(status==='complete'?(result?.tips||[]):[]);core.requests.finish(ticket);
      })).catch(()=>core.requests.finish(ticket));
    },220);
  };

  amapSearchPlaces=function(){
    const input=document.getElementById('amapSearchInput'),keywords=input.value.trim(),button=document.getElementById('amapSearchBtn');
    if(!keywords){amapSetStatus('请输入地点或关键词','error');input.focus();return Promise.resolve()}
    const ticket=core.requests.begin('place-search');
    document.getElementById('amapSuggestions').hidden=true;amapButtonBusy(button,true,'搜索中…');amapSetStatus(`正在搜索“${keywords}”…`);
    return amapEnsureServices().then(()=>new Promise((resolve,reject)=>amapPlaceSearch.search(keywords,(status,result)=>status==='complete'?resolve(result):reject(new Error('没有找到匹配地点')))))
      .then(result=>{if(!core.requests.current(ticket))return;amapRenderSearchResults(result?.poiList?.pois||[],`“${keywords}”`);amapSetStatus('搜索完成','ok')})
      .catch(error=>{if(core.requests.current(ticket)){amapRenderSearchResults([]);amapSetStatus(error.message,'error')}})
      .finally(()=>{if(core.requests.current(ticket))amapButtonBusy(button,false);core.requests.finish(ticket)});
  };

  amapNearbySearch=function(keyword,center){
    const target=amapPoiLocation(center)||amapCurrentLocation||amapCenter(),ticket=core.requests.begin('nearby-search');
    amapShowPane('search');amapSetStatus(`正在搜索附近${keyword}…`);
    return amapEnsureServices().then(()=>new Promise((resolve,reject)=>amapPlaceSearch.searchNearBy(keyword,target,3000,(status,result)=>status==='complete'?resolve(result):reject(new Error(`附近没有找到${keyword}`)))))
      .then(result=>{if(!core.requests.current(ticket))return;amapRenderSearchResults(result?.poiList?.pois||[],`附近${keyword}`);amapSetStatus('周边搜索完成','ok')})
      .catch(error=>{if(core.requests.current(ticket)){amapRenderSearchResults([]);amapSetStatus(error.message,'error')}})
      .finally(()=>core.requests.finish(ticket));
  };

  amapTrafficAtCenter=function(){
    const center=amapCurrentLocation||amapCenter(),radius=Number(document.getElementById('amapTrafficRadius')?.value||3000),level=Number(document.getElementById('amapTrafficLevel')?.value||5),box=document.getElementById('amapTrafficDetail');
    if(box)box.innerHTML='<div class="amap-empty">正在查询周边道路态势…</div>';
    return controlledWebRequest('traffic-detail','/v3/traffic/status/circle',{location:center.join(','),radius,level,extensions:'all'},30000)
      .then(({data,cached})=>{const traffic=data.trafficinfo||{},roads=[...(traffic.roads||[])],rank=status=>/严重|拥堵/.test(status)?0:/缓行/.test(status)?1:/畅通/.test(status)?2:3;roads.sort((a,b)=>rank(String(a.status))-rank(String(b.status)));const sourceLabel=amapCurrentLocation?amapCurrentLabel:'地图中心';const content=`<p><b>${escapeHtml(traffic.description||'未返回总体描述')}</b></p><p>数据中心：${escapeHtml(sourceLabel)} · 半径 ${radius/1000} km · 道路等级 ${level} · ${new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}${cached?' · 缓存':''}</p>${roads.slice(0,12).map(r=>`<div class="traffic-summary-line"><span>${escapeHtml(r.name||'道路')}</span><span class="traffic-status ${amapTrafficClass(r.status)}">${escapeHtml(r.status||'未知')}${r.speed?` · ${escapeHtml(r.speed)} km/h`:''}</span></div>`).join('')||'<div class="amap-empty">该范围内未返回道路明细。</div>'}`;if(box)box.innerHTML=content;amapSetStatus('路况分析已更新','ok');return data})
      .catch(error=>{if(error?.name==='AbortError')return;if(box)box.innerHTML=`<div class="amap-empty">路况查询失败：${escapeHtml(error.message)}</div>`;amapSetStatus('路况查询失败','error');throw error});
  };

  amapWeatherAtCenter=function(){
    const center=amapCurrentLocation||amapCenter(),box=document.getElementById('amapWeatherCard'),ticket=core.requests.begin('weather');
    box.textContent='正在查询天气…';
    return amapEnsureServices().then(()=>amapReverseLookup(center)).then(regeo=>{
      const component=regeo.addressComponent||{},city=component.adcode||component.city||AMAP_CITY;
      const cacheKey='weather:'+city,cached=core.cache.get(cacheKey,5*60*1000);
      if(cached)return cached;
      return Promise.all([new Promise((resolve,reject)=>amapWeatherService.getLive(city,(error,data)=>error?reject(error):resolve(data))),new Promise((resolve,reject)=>amapWeatherService.getForecast(city,(error,data)=>error?reject(error):resolve(data))),loadTripWeather(false).catch(()=>null)]).then(value=>core.cache.set(cacheKey,value));
    }).then(([live,forecast])=>{if(!core.requests.current(ticket))return;const casts=forecast?.forecasts||[];box.innerHTML=`<b>${escapeHtml(live?.city||AMAP_CITY)} · ${weatherIcon(live?.weather||'')} ${escapeHtml(live?.weather||'--')} ${escapeHtml(live?.temperature||'--')}℃</b><div>湿度 ${escapeHtml(live?.humidity||'--')}% · ${escapeHtml(live?.windDirection||live?.winddirection||'--')}风 ${escapeHtml(live?.windPower||live?.windpower||'--')}级</div><div>${casts.slice(0,4).map(c=>`${escapeHtml(c.date||c.day||'')}：${escapeHtml(c.dayWeather||c.dayweather||'--')} / ${escapeHtml(c.nightWeather||c.nightweather||'--')} ${escapeHtml(c.nightTemp||c.nighttemp||'--')}–${escapeHtml(c.dayTemp||c.daytemp||'--')}℃`).join('<br>')}</div><small>高德公开天气为当前实况及4日内日/夜预报。</small>`;amapSetStatus('天气已更新','ok')})
      .catch(error=>{if(error?.name==='AbortError')return;if(core.requests.current(ticket)){box.textContent='天气查询失败：'+(error.message||error);amapSetStatus('天气查询失败','error')}})
      .finally(()=>core.requests.finish(ticket));
  };

  clearAmapServiceOverlays=function(){if(!amapInstance)return;core.overlays.clear('serviceSelection',amapInstance);amapServiceOverlays=[]};
  amapMarkSelectedLocation=function(location,name='选定位置'){
    amapLastLngLat=amapNormalizeLocation(location);if(!amapLastLngLat||!amapInstance||!window.AMap)return;
    const marker=new AMap.Marker({position:amapLastLngLat,title:name,label:{content:escapeHtml(name),direction:'right'}});
    amapInstance.add(marker);core.overlays.replace('serviceSelection',[marker],amapInstance);amapServiceOverlays=[marker];amapInstance.setZoomAndCenter(16,amapLastLngLat);
  };

  amapSetStatus=function(text,tone=''){original.amapSetStatus(text,tone);if(tone==='error'||tone==='ok')core.announce(text,tone==='error'?'assertive':'polite')};
  showMapNotice=function(text){original.showMapNotice(text);core.announce(text)};
  toggleAmapServicePanel=function(force){const result=original.toggleAmapServicePanel(force);core.refreshers.sync();return result};

  function afterBootstrap(){
    core.viewport.start();bindViewEvents();
    ['amapAssistantStatus','basemapState','amapTrafficDetail','mapNotice','dayRouteCard'].forEach(id=>{const node=document.getElementById(id);if(node){node.setAttribute('aria-live',id==='amapAssistantStatus'?'polite':'polite');node.setAttribute('aria-atomic','true')}});
    const wrap=document.querySelector('.map-wrap');if(wrap&&!document.getElementById('mapEngineBadge')){const badge=document.createElement('div');badge.id='mapEngineBadge';badge.className='map-engine-badge';badge.textContent='模块化运行核心 v2.0';wrap.appendChild(badge)}
    document.addEventListener('keydown',event=>{const marker=event.target.closest?.('.marker-wrap[role="button"]');if(marker&&(event.key==='Enter'||event.key===' ')){event.preventDefault();marker.click()}});
    core.refreshers.register('traffic-details',()=>{const panel=document.getElementById('amapServicePanel');if(mapEngine==='amap'&&amapTrafficVisible&&panel&&!panel.hidden)return amapTrafficAtCenter()},90000,()=>true);
    core.mapView.save(currentMapExtra());
  }

  window.TravelV2={afterBootstrap,updateWeatherNodes,bindViewEvents};
})();
