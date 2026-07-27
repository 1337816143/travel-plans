const APP_VERSION='2.0.0';const AMAP_JS_KEY='9f0fd5c87d441d1e6b50a61614ae4663',AMAP_SECURITY_CODE='f64eee00a0b64e682d1e7fd0643a767f',AMAP_WEB_KEY='fcdc5a905725781001576e04d37c0753',AMAP_CITY='青岛',AMAP_ADCODE='370200';

const REQUIRED=["sculpture", "xiaomai", "yanerdao", "sea-love", "xiaoyushan", "xiaoqingdao", "shilaoren", "golden", "yumingzui", "ferry", "zhanqiao", "badaguan", "taiqing", "mayfourth", "signal", "beer", "qinyu"];
const OPTIONAL=["underwater", "naval"];


const POINT_ICONS={"hotel-zone":"🛏","holiday-inn":"🏨","westin":"🏙","haitian":"🌊","fushansuo":"🚇","rent-zone":"👗","sculpture":"🗿","sea-love":"💙","xiaomai":"🌾","shilaoren":"🪨","signal":"📡","zhanqiao":"🌉","xiaoyushan":"🐟","qinyu":"🎻","xiaoqingdao":"🗼","badaguan":"🏛","dhedong":"🎫","taiqing":"⛩","tianmushan":"🚉","golden":"🏖","dayroom":"💤","yumingzui":"🌅","ferry":"⛴","beer":"🍺","yanerdao":"🕊","aofan":"⛵","mayfourth":"🔥","buffer":"🧳","underwater":"🐠","naval":"⚓","rec-redwall":"🧱","rec-comic":"🎨","rec-silverfish":"⏳","rec-xilingxia":"🛤","rec-taidong":"🍢","rec-haipo":"🥬","rec-thirdbeach":"🌃","rec-qianhaiyan":"🍚","rec-zhongpin":"🥟"};
const CATEGORY={"景点":{color:'#2563eb'},"酒店":{color:'#7c3aed'},"住宿区域":{color:'#8b5cf6'},"交通节点":{color:'#0891b2'},"服务":{color:'#d97706'},"行程节点":{color:'#475569'},"备选":{color:'#059669'},"推荐":{color:'#db2777'}};
let map,clusters,routeLayer,hotelLayer,selectedDay=null,routeVisible=true,tileErrors=0,recommendationMode=false,selectedPresetId='';
let activeBasemap='osm',activeTileLayer=null,basemapFailures={},autoFailoverLock=false,amapInstance=null,amapMarkers=[],amapOverlays=[],mapEngine='leaflet',amapApiPromise=null,amapTrafficLayer=null,amapTrafficVisible=false,amapServiceOverlays=[],amapLastLngLat=null,amapSelectedPoi=null,amapSuggestionTimer=null,amapServiceLoaded=false,amapAutoComplete=null,amapPlaceSearch=null,amapGeocoder=null,amapWeatherService=null,amapGeolocationService=null,amapCurrentLocation=null,amapCurrentLabel='当前位置',amapRouteStart=null,amapRouteEnd=null,amapRouteService=null,amapRouteMode='walking',amapSearchPois=[],amapSuggestionPois=[],amapContextLocation=null,amapContextLabel='',amapAssistantReady=false,amapMarkerCluster=null,amapClusterPointMap=new Map(),amapInfoWindow=null,amapTripWeatherByDate={},amapTripWeatherReportTime='',amapWeatherLoading=null,amapTrafficAutoTimer=null,amapTrafficDetailTimer=null;
let presetOrder=[];let currentSearchIds=[];
const markers=new Map();
const STORAGE_KEY='qingdao-v107-booking-progress';
const ORDER_KEY='qingdao-v107-preset-order';
const BASEMAP_KEY='qingdao-v107-basemap';
const AMAP_CONFIG_KEY='qingdao-v107-amap-config';
const PANEL_KEY='qingdao-v107-panel-collapsed';
let bookingProgress=loadJSON(STORAGE_KEY,{});
function loadJSON(key,fallback){try{const v=JSON.parse(localStorage.getItem(key));return v&&typeof v==='object'?v:fallback}catch(e){return fallback}}
function saveJSON(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch(e){}}
function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function outOfChina(lat,lng){return lng<72.004||lng>137.8347||lat<0.8293||lat>55.8271}
function transformLat(x,y){let r=-100+2*x+3*y+.2*y*y+.1*x*y+.2*Math.sqrt(Math.abs(x));r+=(20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;r+=(20*Math.sin(y*Math.PI)+40*Math.sin(y/3*Math.PI))*2/3;r+=(160*Math.sin(y/12*Math.PI)+320*Math.sin(y*Math.PI/30))*2/3;return r}
function transformLng(x,y){let r=300+x+2*y+.1*x*x+.1*x*y+.1*Math.sqrt(Math.abs(x));r+=(20*Math.sin(6*x*Math.PI)+20*Math.sin(2*x*Math.PI))*2/3;r+=(20*Math.sin(x*Math.PI)+40*Math.sin(x/3*Math.PI))*2/3;r+=(150*Math.sin(x/12*Math.PI)+300*Math.sin(x/30*Math.PI))*2/3;return r}
function wgs84ToGcj02(lat,lng){if(outOfChina(lat,lng))return[lat,lng];const a=6378245,ee=.00669342162296594323,dLat=transformLat(lng-105,lat-35),dLng=transformLng(lng-105,lat-35),rad=lat/180*Math.PI,magic=1-ee*Math.sin(rad)*Math.sin(rad),sqrt=Math.sqrt(magic);return[lat+(dLat*180)/((a*(1-ee))/(magic*sqrt)*Math.PI),lng+(dLng*180)/(a/sqrt*Math.cos(rad)*Math.PI)]}
function pointById(id){return POINTS.find(p=>p.id===id)}

function routePoints(schedule){return schedule.route.map(pointById).filter(Boolean)}

 

window.launchAmap=launchAmap;

 
  

 

 

function runSelfCheck(){const errors=[],ids=POINTS.map(p=>p.id),set=new Set(ids),icons=Object.values(POINT_ICONS);if(set.size!==ids.length)errors.push('点位ID重复');POINTS.forEach(p=>{if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||p.lat<35.7||p.lat>36.4||p.lng<119.9||p.lng>120.9)errors.push(`坐标异常:${p.id}`);if(!p.source)errors.push(`来源缺失:${p.id}`);if(!POINT_ICONS[p.id])errors.push(`图标缺失:${p.id}`)});if(new Set(icons).size!==icons.length)errors.push('存在重复点位图标');SCHEDULES.forEach(d=>d.route.forEach(id=>{if(!set.has(id))errors.push(`路线缺点:${d.date}/${id}`)}));[...REQUIRED,...OPTIONAL,...RECOMMENDED].forEach(id=>{if(!set.has(id))errors.push(`清单点缺失:${id}`)});BOOKINGS.forEach(b=>b.pointIds.forEach(id=>{if(!set.has(id))errors.push(`预约点缺失:${b.id}/${id}`)}));const box=document.getElementById('auditBox');if(errors.length){box.className='alert warn';box.innerHTML='<b>页面自检发现问题：</b>'+errors.map(escapeHtml).join('；')}else{box.className='alert ok';box.innerHTML=`<b>页面自检通过：</b>${POINTS.length}个点位、${SCHEDULES.length}天日程、${BOOKINGS.length}项预约联动、${RECOMMENDED.length}个其他推荐；点位图标全部唯一，预约状态（含放弃）跨面板同步，多底图容灾已启用。`}}
function showMapNotice(msg){const el=document.getElementById('mapNotice');el.textContent=msg;el.classList.add('show')}
function initFallback(){document.getElementById('map').style.display='none';document.getElementById('legend').style.display='none';const f=document.getElementById('offlineFallback');f.style.display='block';document.getElementById('offlineList').innerHTML=[...REQUIRED,...OPTIONAL].map(pointById).filter(Boolean).map(p=>`<div><b>${pointIcon(p.id)} ${escapeHtml(p.name)}</b><br>${escapeHtml(p.time)} · ${escapeHtml(p.status)}</div>`).join('')}
const BASEMAPS={
 osm:{name:'OSM 标准',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',maxZoom:19,attribution:'&copy; OpenStreetMap contributors'},
 'carto-light':{name:'CARTO 浅色',url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'},
 'carto-voyager':{name:'CARTO 导航',url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'},
 'carto-dark':{name:'CARTO 深色',url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'},
 opentopo:{name:'OpenTopoMap 地形',url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',maxZoom:17,attribution:'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap'},
 hot:{name:'OSM 人道主义',url:'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',maxZoom:19,attribution:'&copy; OpenStreetMap contributors, Tiles style by HOT'}
};
const FALLBACK_ORDER=['osm','carto-light','carto-voyager','hot','opentopo','carto-dark'];
function setBasemapState(text){const el=document.getElementById('basemapState');if(el)el.textContent=text}
function createTileLayer(id){const c=BASEMAPS[id];if(!c)return null;const options={maxZoom:Number.isFinite(c.maxZoom)?c.maxZoom:19,attribution:c.attribution||'',crossOrigin:true};const sd=c.subdomains;if((typeof sd==='string'&&sd.length)||(Array.isArray(sd)&&sd.length))options.subdomains=sd;const layer=L.tileLayer(c.url,options);let errors=0,first=Date.now();layer.on('tileload',()=>{errors=Math.max(0,errors-1);setBasemapState(`${c.name} · 正常`)});layer.on('tileerror',()=>{errors++;basemapFailures[id]=(basemapFailures[id]||0)+1;if(Date.now()-first<12000&&errors>=5)autoSwitchBasemap(id)});return layer}
function autoSwitchBasemap(failedId){
  if(autoFailoverLock||mapEngine!=='leaflet')return;
  autoFailoverLock=true;
  const fallback=()=>{
    const current=FALLBACK_ORDER.indexOf(failedId),candidates=[...FALLBACK_ORDER.slice(Math.max(0,current+1)),...FALLBACK_ORDER.slice(0,Math.max(0,current+1))];
    const next=candidates.find(id=>id!==failedId&&(basemapFailures[id]||0)<10);
    if(next){showMapNotice('高德底图暂不可用，已切换到'+BASEMAPS[next].name);switchLeafletBasemap(next)}
    else showMapNotice('高德及常规底图均加载失败，请检查网络连接。');
  };
  showMapNotice((BASEMAPS[failedId]?.name||failedId)+'加载异常，正在自动切换高德地图');
  switchToAmap({fallbackToLeaflet:false}).catch(fallback).finally(()=>setTimeout(()=>autoFailoverLock=false,2500));
} function switchLeafletBasemap(id){if(!map||!BASEMAPS[id])return;const config=BASEMAPS[id],layerMax=Number.isFinite(config.maxZoom)?config.maxZoom:19;map.setMaxZoom(layerMax);if(map.getZoom()>layerMax)map.setZoom(layerMax);if(activeTileLayer)map.removeLayer(activeTileLayer);activeBasemap=id;activeTileLayer=createTileLayer(id);activeTileLayer.addTo(map);mapEngine='leaflet';document.getElementById('map').classList.remove('leaflet-map-hidden');document.getElementById('amapMap').classList.remove('active');document.getElementById('amapMap').hidden=true;saveJSON(BASEMAP_KEY,{id});document.getElementById('basemapSelect').value=id;setTimeout(()=>map.invalidateSize(),80)}
function promptAmapConfig(){toggleAmapServicePanel(true);showMapNotice('高德JS API与Web API凭证已内置，无需手动配置。');return true} function loadAmapApi(){if(window.AMap)return Promise.resolve(window.AMap);if(amapApiPromise)return amapApiPromise;window._AMapSecurityConfig={securityJsCode:AMAP_SECURITY_CODE};const plugins=['AMap.Scale','AMap.ToolBar','AMap.Geolocation','AMap.AutoComplete','AMap.PlaceSearch','AMap.Geocoder','AMap.Weather','AMap.Driving','AMap.Walking','AMap.Transfer','AMap.MarkerCluster'];amapApiPromise=new Promise((resolve,reject)=>{const done=()=>window.AMapLoader.load({key:AMAP_JS_KEY,version:'2.0',plugins}).then(resolve).catch(reject);if(window.AMapLoader){done();return}const script=document.createElement('script');script.src='https://webapi.amap.com/loader.js';script.onload=done;script.onerror=()=>reject(new Error('高德地图加载器下载失败'));document.head.appendChild(script)}).catch(error=>{amapApiPromise=null;throw error});return amapApiPromise}  
 
function switchToAmap({fallbackToLeaflet=true}={}){
  if(mapEngine==='amap'&&amapInstance){
    document.getElementById('basemapSelect').value='amap';
    setBasemapState('高德地图 · 实时路况'+(amapTrafficVisible?'已开启':'已关闭'));
    return Promise.resolve(amapInstance)
  }
  setBasemapState('正在加载高德地图…');
  return loadAmapApi().then(()=>{
    mapEngine='amap';
    document.getElementById('map').classList.add('leaflet-map-hidden');
    const container=document.getElementById('amapMap');
    container.hidden=false;
    container.classList.add('active');
    if(!amapInstance){
      amapInstance=new AMap.Map('amapMap',{zoom:12,center:[120.38,36.066],viewMode:'2D',resizeEnable:true,showIndoorMap:false});
      try{amapInstance.addControl(new AMap.Scale())}catch(e){}
      if(innerWidth>800)try{amapInstance.addControl(new AMap.ToolBar({position:{right:'16px',bottom:'88px'}}))}catch(e){}
      amapInstance.on('click',amapHandleMapClick);
      amapInstance.on('moveend',amapScheduleTrafficSummary);
      amapInstance.on('zoomend',amapScheduleTrafficSummary)
    }
    renderAmapView();
    amapSetTrafficVisible(amapTrafficPreference());
    document.getElementById('basemapSelect').value='amap';
    saveJSON(BASEMAP_KEY,{id:'amap'});
    setBasemapState('高德地图 · 实时路况'+(amapTrafficVisible?'已开启':'已关闭'));
    const panel=document.getElementById('amapServicePanel');
    if(panel&&!panel.hidden)setTimeout(()=>amapTrafficAtCenter().catch(()=>{}),650);
    return amapInstance
  }).catch(error=>{
    showMapNotice('高德地图加载失败：'+error.message);
    document.getElementById('basemapSelect').value=activeBasemap;
    if(fallbackToLeaflet)switchLeafletBasemap(activeBasemap&&BASEMAPS[activeBasemap]?activeBasemap:'carto-light');
    throw error
  })
} function switchBasemap(id,{manual=true}={}){if(id==='amap'){switchToAmap();return}switchLeafletBasemap(id);if(manual)showMapNotice(`已切换到${BASEMAPS[id].name}`)}
function initFallback(){document.getElementById('map').style.display='none';document.getElementById('legend').style.display='none';const f=document.getElementById('offlineFallback');f.style.display='block';document.getElementById('offlineList').innerHTML=[...REQUIRED,...OPTIONAL].map(pointById).filter(Boolean).map(p=>`<div><b>${escapeHtml(p.name)}</b><br>${escapeHtml(p.time)} · ${escapeHtml(p.status)}</div>`).join('')}
function amapSetStatus(text,tone=''){const el=document.getElementById('amapAssistantStatus');if(!el)return;el.textContent=text;el.classList.toggle('amap-assistant-status-error',tone==='error');el.classList.toggle('amap-assistant-status-ok',tone==='ok')}
function amapShowPane(name){document.querySelectorAll('[data-amap-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.amapTab===name));document.querySelectorAll('[data-amap-pane]').forEach(pane=>{const active=pane.dataset.amapPane===name;pane.classList.toggle('active',active);pane.hidden=!active})}
function amapButtonBusy(button,busy,busyText){if(!button)return;button.disabled=busy;if(busy){button.dataset.originalText=button.textContent;button.textContent=busyText||'处理中…'}else if(button.dataset.originalText){button.textContent=button.dataset.originalText;delete button.dataset.originalText}}

 

 

 const TRIP_YEAR='2026',TRIP_WEATHER_CACHE_KEY='travel-plans-weather-v1.0.14',AMAP_TRAFFIC_PREF_KEY='travel-plans-amap-traffic-v1.0.14',LEGEND_STATE_KEY='travel-plans-legend-v1.0.14';
function syncViewportHeight(){const height=window.visualViewport&&window.visualViewport.height?window.visualViewport.height:window.innerHeight;document.documentElement.style.setProperty('--app-height',Math.max(320,Math.round(height))+'px')}

function weatherRainHint(text=''){return/雨|雷|冰雹|雪/.test(text)?'有降水可能':'未显示明显降水'}
function tripWeatherRecord(date){return amapTripWeatherByDate[tripIsoDate(date)]||null}

function amapFindClusterPoint(position){const key=amapMarkerPositionKey(position);if(amapClusterPointMap.has(key))return amapClusterPointMap.get(key);const loc=amapPoiLocation(position);return visiblePoints(selectedDay).find(p=>{const pp=amapPointPosition(p);return Math.abs(pp[0]-loc[0])<.00002&&Math.abs(pp[1]-loc[1])<.00002})||null}

function amapSetTrafficVisible(enabled,{announce=false}={}){if(!amapInstance||!window.AMap)return;if(!amapTrafficLayer)amapTrafficLayer=new AMap.TileLayer.Traffic({zIndex:10,autoRefresh:true,interval:60});amapTrafficVisible=Boolean(enabled);try{if(amapTrafficVisible)amapInstance.add(amapTrafficLayer);else amapInstance.remove(amapTrafficLayer)}catch(e){}saveJSON(AMAP_TRAFFIC_PREF_KEY,{enabled:amapTrafficVisible});const outside=document.getElementById('trafficToggleBtn'),inside=document.getElementById('amapTrafficLayerBtn');if(outside){outside.classList.toggle('traffic-active',amapTrafficVisible);outside.textContent=amapTrafficVisible?'路况已开':'实时路况'}if(inside){inside.classList.toggle('traffic-active',amapTrafficVisible);inside.textContent=amapTrafficVisible?'图层：开启':'图层：关闭'}if(announce){amapSetStatus(amapTrafficVisible?'实时路况已开启':'实时路况已关闭','ok');showMapNotice(amapTrafficVisible?'已开启高德实时路况图层':'已关闭高德实时路况图层')}}


 

 

function clearAmapServiceOverlays(){if(!amapInstance)return;amapServiceOverlays.forEach(item=>{try{amapInstance.remove(item)}catch(e){}});amapServiceOverlays=[]}

function toggleAmapServicePanel(force){const panel=document.getElementById('amapServicePanel'),button=document.getElementById('amapConfigBtn'),open=typeof force==='boolean'?force:panel.hidden;panel.hidden=!open;button.setAttribute('aria-expanded',String(open));document.querySelector('.map-wrap')?.classList.toggle('amap-assistant-open',open);if(open){amapPopulateTripDestinations();amapSetStatus('正在连接高德服务…');amapEnsureServices().then(()=>{if(!amapServiceLoaded){amapServiceLoaded=true;Promise.allSettled([amapWeatherAtCenter(),amapTrafficAtCenter()])}}).catch(error=>amapSetStatus(error.message,'error'))}} function amapRenderPlaces(title,pois){if(!pois?.length){amapSetOutput(title,'<p>没有找到匹配地点。</p>');return}amapSetOutput(title,pois.slice(0,12).map(p=>'<button class="amap-result" data-amap-location="'+escapeHtml(p.location||'')+'" data-amap-name="'+escapeHtml(p.name||'')+'"><b>'+escapeHtml(p.name||'未命名地点')+'</b><small>'+escapeHtml([p.type,p.address,p.distance?amapFormatDistance(p.distance):''].filter(Boolean).join(' · '))+'</small></button>').join(''))}
      
  function resolveAmapLocation(text,fallback){const direct=amapNormalizeLocation(String(text||'').trim());if(direct)return Promise.resolve(direct);if(!String(text||'').trim())return fallback?Promise.resolve(fallback):Promise.reject(new Error('地点不能为空'));return amapEnsureServices().then(()=>new Promise((resolve,reject)=>amapGeocoder.getLocation(String(text).trim(),(status,result)=>{const location=amapPoiLocation(result?.geocodes?.[0]);status==='complete'&&location?resolve(location):reject(new Error('无法解析地点：'+text))}))) } function amapCollectPolyline(path){const points=[];(path?.steps||[]).forEach(step=>String(step.polyline||'').split(';').forEach(value=>{const p=amapNormalizeLocation(value);if(p)points.push(p)}));return points}

function amapPlanRoute(){const button=document.getElementById('amapRouteBtn');amapButtonBusy(button,true,'规划中…');amapSetStatus('正在规划路线…');const fallback=amapCurrentLocation||amapCenter();return Promise.all([amapResolveInput('amapRouteFrom',fallback),amapResolveInput('amapRouteTo')]).then(([origin,destination])=>amapEnsureServices().then(()=>({origin,destination}))).then(({origin,destination})=>new Promise((resolve,reject)=>{amapClearRouteService();const options={map:amapInstance,panel:'amapRouteSteps',hideMarkers:false,autoFitView:document.getElementById('amapAutoFitRoute')?.checked!==false,extensions:'all'};if(amapRouteMode==='driving')amapRouteService=new AMap.Driving({...options,policy:AMap.DrivingPolicy?.REAL_TRAFFIC??0,showTraffic:true});else if(amapRouteMode==='transit')amapRouteService=new AMap.Transfer({...options,city:AMAP_CITY,policy:0,nightflag:true});else amapRouteService=new AMap.Walking(options);amapRouteService.search(origin,destination,(status,result)=>{if(status==='complete'){amapRouteStart=origin;amapRouteEnd=destination;amapRouteSummary(amapRouteMode,result,origin,destination);resolve(result)}else reject(new Error(result?.info||'未找到可用路线'))})})).then(result=>{amapSetStatus('路线规划完成','ok');return result}).catch(error=>{document.getElementById('amapRouteSummary').innerHTML='<div class="amap-empty">'+escapeHtml(error.message)+'</div>';amapSetStatus(error.message,'error')}).finally(()=>amapButtonBusy(button,false))}  function bindAmapServiceUI(){document.getElementById('amapConfigBtn').onclick=()=>toggleAmapServicePanel();document.getElementById('amapServiceClose').onclick=()=>toggleAmapServicePanel(false);document.getElementById('trafficToggleBtn').onclick=toggleAmapTraffic;document.getElementById('amapTrafficLayerBtn').onclick=toggleAmapTraffic;document.querySelectorAll('[data-amap-tab]').forEach(button=>button.onclick=()=>amapShowPane(button.dataset.amapTab));document.getElementById('amapSearchBtn').onclick=amapSearchPlaces;document.getElementById('amapSearchInput').oninput=amapInputTips;document.getElementById('amapSearchInput').onkeydown=event=>{if(event.key==='Enter')amapSearchPlaces()};document.getElementById('amapSuggestions').onclick=event=>{const button=event.target.closest('[data-amap-suggestion]');if(!button)return;const tip=amapSuggestionPois[Number(button.dataset.amapSuggestion)];document.getElementById('amapSuggestions').hidden=true;document.getElementById('amapSearchInput').value=tip.name;if(amapPoiLocation(tip)){amapSearchPois=[tip];amapSelectSearchPoi(0,'route')}else amapSearchPlaces()};document.getElementById('amapSearchResults').onclick=event=>{const button=event.target.closest('[data-amap-result-action]');if(button)amapSelectSearchPoi(button.dataset.amapResultIndex,button.dataset.amapResultAction)};document.querySelectorAll('[data-amap-nearby]').forEach(button=>button.onclick=()=>amapNearbySearch(button.dataset.amapNearby));document.getElementById('amapLocateBtn').onclick=amapLocate;document.getElementById('amapUseLocationBtn').onclick=()=>amapCurrentLocation?amapSetInputLocation('amapRouteFrom',amapCurrentLabel,amapCurrentLocation):amapLocate();document.getElementById('amapReturnHotelBtn').onclick=()=>{const p=pointById('hotel-zone'),location=amapPointPosition(p);amapSetInputLocation('amapRouteTo','住宿区：五四广场—浮山所',location);amapShowPane('route')};['amapRouteFrom','amapRouteTo'].forEach(id=>document.getElementById(id).addEventListener('input',()=>amapClearInputLocation(id)));document.getElementById('amapSwapRouteBtn').onclick=()=>{const from=document.getElementById('amapRouteFrom'),to=document.getElementById('amapRouteTo'),value=from.value,location=from.dataset.location||'',poi=from.dataset.poiId||'';from.value=to.value;from.dataset.location=to.dataset.location||'';from.dataset.poiId=to.dataset.poiId||'';to.value=value;to.dataset.location=location;to.dataset.poiId=poi};document.querySelectorAll('[data-amap-route-mode]').forEach(button=>button.onclick=()=>{amapRouteMode=button.dataset.amapRouteMode;document.querySelectorAll('[data-amap-route-mode]').forEach(item=>item.classList.toggle('active',item===button))});document.getElementById('amapPickMapBtn').onclick=()=>{toggleAmapServicePanel(false);showMapNotice('请点击高德地图上的位置，然后选择“设为终点”')};document.getElementById('amapRouteBtn').onclick=amapPlanRoute;document.getElementById('amapWeatherBtn').onclick=amapWeatherAtCenter;document.getElementById('amapReverseBtn').onclick=()=>amapReverseAtLocation();document.getElementById('amapTrafficStatusBtn').onclick=amapTrafficAtCenter;document.getElementById('amapTrafficRadius').onchange=amapTrafficAtCenter;document.getElementById('amapTrafficLevel').onchange=amapTrafficAtCenter;document.getElementById('amapStaticMapBtn').onclick=amapStaticMap;document.getElementById('amapTaxiPickupBtn').onclick=()=>{amapShowPane('search');amapNearbySearch('出租车站')};document.getElementById('amapTaxiRouteBtn').onclick=()=>{amapRouteMode='driving';document.querySelectorAll('[data-amap-route-mode]').forEach(item=>item.classList.toggle('active',item.dataset.amapRouteMode==='driving'));amapShowPane('route');const to=document.getElementById('amapRouteTo');if(to.value.trim())amapPlanRoute();else amapSetStatus('已切换到驾车 / 打车模式，请设置终点','ok')};document.getElementById('amapContextOutput').onclick=event=>{const button=event.target.closest('[data-amap-context]');if(button)amapUseContext(button.dataset.amapContext)};document.getElementById('amapTripViewBtn').onclick=()=>amapTripAction('view');document.getElementById('amapTripRouteBtn').onclick=()=>amapTripAction('route');document.getElementById('amapTripNavigateBtn').onclick=()=>amapTripAction('nav')} function initMap(){
  if(typeof L==='undefined'){initFallback();return}
  map=L.map('map',{zoomControl:true,preferCanvas:true,minZoom:2,maxZoom:20}).setView([36.066,120.38],12);
  const saved=loadJSON(BASEMAP_KEY,{id:'osm'}).id||'osm',initialBasemap=saved==='amap'?'osm':(BASEMAPS[saved]?saved:'osm');
  switchLeafletBasemap(initialBasemap);clusters=markerGroup();routeLayer=L.layerGroup().addTo(map);hotelLayer=L.layerGroup().addTo(map);
  POINTS.forEach(p=>{const m=L.marker([p.lat,p.lng],{icon:iconFor(p),title:p.name}).bindPopup(popup(p),{maxWidth:370});markers.set(p.id,m)});
  rebuildMarkers(null);clusters.addTo(map);L.circle([36.0648,120.3778],{radius:850,color:'#7c3aed',weight:2,fillColor:'#a78bfa',fillOpacity:.14,dashArray:'5 6'}).bindTooltip('推荐住宿核心区：五四广场—浮山所').addTo(hotelLayer);
  map.on('click',e=>{const gcj=wgs84ToGcj02(e.latlng.lat,e.latlng.lng);amapLastLngLat=[gcj[1],gcj[0]]});
  drawRoutes(null);fitPoints(POINTS.filter(p=>p.category!=='行程节点'&&p.category!=='推荐'),11);if(saved==='amap')setTimeout(()=>switchToAmap().catch(()=>{}),150)
} function activateTab(name,silent=false){document.querySelectorAll('.tab-btn').forEach(btn=>{const active=btn.dataset.tab===name;btn.classList.toggle('active',active);btn.setAttribute('aria-selected',String(active))});document.querySelectorAll('.tab-panel').forEach(panel=>panel.classList.toggle('active',panel.dataset.panel===name));if(name==='recommend'&&!silent){recommendationMode=true;selectedDay=null;routeVisible=false;rebuildMarkers(null);if(routeLayer)routeLayer.clearLayers();setDayRouteCard(null);if(mapEngine==='amap')syncAmapView();else fitPoints(RECOMMENDED.map(pointById).filter(Boolean),12)}else if(name!=='recommend'&&recommendationMode&&!silent){recommendationMode=false;routeVisible=true;rebuildMarkers(selectedDay);drawRoutes(selectedDay);if(mapEngine==='amap')syncAmapView();else if(!selectedDay)fitPoints(POINTS.filter(p=>p.category!=='推荐'&&p.category!=='行程节点'),11)}}
function bindTabs(){document.querySelectorAll('.tab-btn').forEach(btn=>btn.onclick=()=>activateTab(btn.dataset.tab))}
function setPanelCollapsed(collapsed){const app=document.querySelector('.app'),panel=document.getElementById('panel'),edge=document.getElementById('panelEdgeToggle');app.classList.toggle('panel-collapsed',collapsed);if(innerWidth<=800){panel.classList.toggle('open',!collapsed);document.getElementById('menuBtn').setAttribute('aria-expanded',String(!collapsed))}edge.setAttribute('aria-expanded',String(!collapsed));saveJSON(PANEL_KEY,{collapsed});setTimeout(()=>{if(map)map.invalidateSize();if(amapInstance)amapInstance.resize()},240)}
function bindUI(){
  document.getElementById('showAll').onclick=showAll;document.getElementById('clearRoutes').onclick=clearRoutes;
  document.getElementById('fitHotels').onclick=()=>{recommendationMode=false;rebuildMarkers(null);if(mapEngine==='amap'&&amapInstance)amapInstance.setZoomAndCenter(14,[120.3778,36.0648]);else if(map)map.setView([36.0648,120.3778],14);activateTab('stay')};
  document.getElementById('searchBtn').onclick=searchPoints;document.getElementById('searchInput').oninput=searchPoints;document.getElementById('searchInput').onkeydown=e=>{if(e.key==='Enter')searchPoints()};
  document.getElementById('presetDestination').onchange=e=>selectPresetDestination(e.target.value,{promote:true,from:'dropdown'});document.getElementById('basemapSelect').onchange=e=>switchBasemap(e.target.value);
  document.getElementById('menuBtn').onclick=()=>setPanelCollapsed(document.getElementById('panel').classList.contains('open'));document.getElementById('panelEdgeToggle').onclick=()=>setPanelCollapsed(!document.querySelector('.app').classList.contains('panel-collapsed'));
  document.addEventListener('change',e=>{if(e.target.matches('[data-booking-progress]'))setBookingProgress(e.target.dataset.bookingProgress,e.target.value)});document.addEventListener('click',e=>{const b=e.target.closest('[data-booking-channel]');if(b)openBookingChannel(b.dataset.bookingChannel,Number(b.dataset.channelIndex))});document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!document.getElementById('amapServicePanel').hidden)toggleAmapServicePanel(false);else setPanelCollapsed(true)}});
  bindTabs();bindAmapServiceUI();const saved=loadJSON(PANEL_KEY,{collapsed:innerWidth<=800});setPanelCollapsed(Boolean(saved.collapsed));window.addEventListener('resize',()=>{if(innerWidth>800)document.getElementById('panel').classList.remove('open');setTimeout(()=>{if(map)map.invalidateSize();if(amapInstance)amapInstance.resize()},80)})
} function bootstrapApp(){try{normalizePresetOrder();renderBookingChecklist();renderDays();renderSources();renderHotels();renderLegend();renderPresetDestinations();renderRecommendations();runSelfCheck();bindUI();initMap()}catch(err){console.error('Travel map startup failed',err);const box=document.getElementById('auditBox');if(box){box.className='alert warn';box.innerHTML='<b>页面初始化失败：</b>'+escapeHtml(err&&err.message?err.message:String(err))}try{if(typeof L==='undefined')initFallback()}catch(_){}}}
