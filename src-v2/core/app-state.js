/* v2.5.2 explicit application state, wishlist map categories and compatibility utilities. */
const APP_VERSION='2.0.0';
const AMAP_JS_KEY='9f0fd5c87d441d1e6b50a61614ae4663',AMAP_SECURITY_CODE='f64eee00a0b64e682d1e7fd0643a767f',AMAP_WEB_KEY='fcdc5a905725781001576e04d37c0753',AMAP_CITY='青岛',AMAP_ADCODE='370200';
const REQUIRED=["sculpture", "xiaomai", "yanerdao", "sea-love", "xiaoyushan", "xiaoqingdao", "shilaoren", "golden", "yumingzui", "ferry", "zhanqiao", "badaguan", "taiqing", "mayfourth", "signal", "beer", "qinyu"];
const OPTIONAL=["underwater", "naval"];
const POINT_ICONS={"hotel-zone":"🛏","holiday-inn":"🏨","westin":"🏙","haitian":"🌊","fushansuo":"🚇","rent-zone":"👗","sculpture":"🗿","sea-love":"💙","xiaomai":"🌾","shilaoren":"🪨","signal":"📡","zhanqiao":"🌉","xiaoyushan":"🐟","qinyu":"🎻","xiaoqingdao":"🗼","badaguan":"🏛","dhedong":"🎫","taiqing":"⛩","tianmushan":"🚉","golden":"🏖","dayroom":"💤","yumingzui":"🌅","ferry":"⛴","beer":"🍺","yanerdao":"🕊","aofan":"⛵","mayfourth":"🔥","buffer":"🧳","underwater":"🐠","naval":"⚓","rec-redwall":"🧱","rec-comic":"🎨","rec-silverfish":"⏳","rec-xilingxia":"🛤","rec-taidong":"🍢","rec-haipo":"🥬","rec-thirdbeach":"🌃","rec-qianhaiyan":"🍚","rec-zhongpin":"🥟","wishmap-wanhechun":"🍖","wishmap-wangjie":"🦑","wishmap-gaojia":"🍓","wishmap-qianhaiyan":"🥘","wishmap-lizhizha":"🥓","wishmap-laoshan-drinks":"🥤","wishmap-yingkou-seafood":"🐚","wishmap-jimiya-seafood":"🦀","wishmap-xiaomujia":"🍲","wishmap-yunnan-noodle":"🌿"};
const CATEGORY={"景点":{color:'#2563eb'},"酒店":{color:'#7c3aed'},"住宿区域":{color:'#8b5cf6'},"交通节点":{color:'#0891b2'},"服务":{color:'#d97706'},"行程节点":{color:'#475569'},"备选":{color:'#059669'},"推荐":{color:'#db2777'},"必吃":{color:'#ef5b5b'},"必买":{color:'#d97706'}};
let map,clusters,routeLayer,hotelLayer,selectedDay=null,routeVisible=true,tileErrors=0,recommendationMode=false,selectedPresetId='';
let activeBasemap='osm',activeTileLayer=null,basemapFailures={},autoFailoverLock=false,amapInstance=null,amapMarkers=[],amapOverlays=[],mapEngine='leaflet',amapApiPromise=null,amapTrafficLayer=null,amapTrafficVisible=false,amapServiceOverlays=[],amapLastLngLat=null,amapSelectedPoi=null,amapSuggestionTimer=null,amapServiceLoaded=false,amapAutoComplete=null,amapPlaceSearch=null,amapGeocoder=null,amapWeatherService=null,amapGeolocationService=null,amapCurrentLocation=null,amapCurrentLabel='当前位置',amapRouteStart=null,amapRouteEnd=null,amapRouteService=null,amapRouteMode='walking',amapSearchPois=[],amapSuggestionPois=[],amapContextLocation=null,amapContextLabel='',amapAssistantReady=false,amapMarkerCluster=null,amapClusterPointMap=new Map(),amapInfoWindow=null,amapTripWeatherByDate={},amapTripWeatherReportTime='',amapWeatherLoading=null,amapTrafficAutoTimer=null,amapTrafficDetailTimer=null;
let presetOrder=[];
let currentSearchIds=[];
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
function pointById(id){return POINTS.find(p=>p.id===id)}
function routePoints(schedule){return schedule.route.map(pointById).filter(Boolean)}
function runSelfCheck(){const errors=[],ids=POINTS.map(p=>p.id),set=new Set(ids),icons=Object.values(POINT_ICONS);if(set.size!==ids.length)errors.push('点位ID重复');POINTS.forEach(p=>{if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||p.lat<35.7||p.lat>36.4||p.lng<119.9||p.lng>120.9)errors.push(`坐标异常:${p.id}`);if(!p.source)errors.push(`来源缺失:${p.id}`);if(!POINT_ICONS[p.id])errors.push(`图标缺失:${p.id}`)});if(new Set(icons).size!==icons.length)errors.push('存在重复点位图标');SCHEDULES.forEach(d=>d.route.forEach(id=>{if(!set.has(id))errors.push(`路线缺点:${d.date}/${id}`)}));[...REQUIRED,...OPTIONAL,...RECOMMENDED].forEach(id=>{if(!set.has(id))errors.push(`清单点缺失:${id}`)});BOOKINGS.forEach(b=>b.pointIds.forEach(id=>{if(!set.has(id))errors.push(`预约点缺失:${b.id}/${id}`)}));const box=document.getElementById('auditBox'),wishlistCount=POINTS.filter(p=>p.wishlistPoint).length;if(errors.length){box.className='alert warn';box.innerHTML='<b>页面自检发现问题：</b>'+errors.map(escapeHtml).join('；')}else{box.className='alert ok';box.innerHTML=`<b>页面自检通过：</b>${POINTS.length}个点位（含${wishlistCount}个必吃/必买地图点）、${SCHEDULES.length}天日程、${BOOKINGS.length}项预约联动、${RECOMMENDED.length}个其他推荐；点位图标全部唯一，预约状态（含放弃）跨面板同步，多底图容灾已启用。`}}
function showMapNotice(msg){const el=document.getElementById('mapNotice');el.textContent=msg;el.classList.add('show')}

const BASEMAPS={
 osm:{name:'OSM 标准',url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',maxZoom:19,attribution:'&copy; OpenStreetMap contributors'},
 'carto-light':{name:'CARTO 浅色',url:'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'},
 'carto-voyager':{name:'CARTO 导航',url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'},
 'carto-dark':{name:'CARTO 深色',url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',subdomains:'abcd',maxZoom:20,attribution:'&copy; OpenStreetMap contributors &copy; CARTO'},
 opentopo:{name:'OpenTopoMap 地形',url:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',maxZoom:17,attribution:'Map data &copy; OpenStreetMap contributors, SRTM | Map style &copy; OpenTopoMap'},
 hot:{name:'OSM 人道主义',url:'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',maxZoom:19,attribution:'&copy; OpenStreetMap contributors, Tiles style by HOT'}
};
const FALLBACK_ORDER=['osm','carto-light','carto-voyager','hot','opentopo','carto-dark'];
function initFallback(){document.getElementById('map').style.display='none';document.getElementById('legend').style.display='none';const f=document.getElementById('offlineFallback');f.style.display='block';document.getElementById('offlineList').innerHTML=[...REQUIRED,...OPTIONAL].map(pointById).filter(Boolean).map(p=>`<div><b>${escapeHtml(p.name)}</b><br>${escapeHtml(p.time)} · ${escapeHtml(p.status)}</div>`).join('')}
const TRIP_YEAR='2026',TRIP_WEATHER_CACHE_KEY='travel-plans-weather-v1.0.14',AMAP_TRAFFIC_PREF_KEY='travel-plans-amap-traffic-v1.0.14',LEGEND_STATE_KEY='travel-plans-legend-v1.0.14';
(function(){
  const state={};
  Object.defineProperties(state,{
    selectedDay:{get:()=>selectedDay,set:value=>{selectedDay=value}},routeVisible:{get:()=>routeVisible,set:value=>{routeVisible=value}},recommendationMode:{get:()=>recommendationMode,set:value=>{recommendationMode=value}},selectedPresetId:{get:()=>selectedPresetId,set:value=>{selectedPresetId=value}},mapEngine:{get:()=>mapEngine,set:value=>{mapEngine=value}},activeBasemap:{get:()=>activeBasemap,set:value=>{activeBasemap=value}}
  });
  const leaflet={};Object.defineProperties(leaflet,{map:{get:()=>map,set:value=>{map=value}},clusters:{get:()=>clusters,set:value=>{clusters=value}},routeLayer:{get:()=>routeLayer,set:value=>{routeLayer=value}},hotelLayer:{get:()=>hotelLayer,set:value=>{hotelLayer=value}},markers:{get:()=>markers}});
  const amap={};Object.defineProperties(amap,{instance:{get:()=>amapInstance,set:value=>{amapInstance=value}},markers:{get:()=>amapMarkers,set:value=>{amapMarkers=value}},overlays:{get:()=>amapOverlays,set:value=>{amapOverlays=value}},markerCluster:{get:()=>amapMarkerCluster,set:value=>{amapMarkerCluster=value}},clusterPointMap:{get:()=>amapClusterPointMap,set:value=>{amapClusterPointMap=value}},infoWindow:{get:()=>amapInfoWindow,set:value=>{amapInfoWindow=value}},serviceOverlays:{get:()=>amapServiceOverlays,set:value=>{amapServiceOverlays=value}},currentLocation:{get:()=>amapCurrentLocation,set:value=>{amapCurrentLocation=value}},currentLabel:{get:()=>amapCurrentLabel,set:value=>{amapCurrentLabel=value}},trafficVisible:{get:()=>amapTrafficVisible,set:value=>{amapTrafficVisible=value}}});
  window.TravelAppContext={state,leaflet,amap,config:Object.freeze({AMAP_JS_KEY,AMAP_SECURITY_CODE,AMAP_WEB_KEY,AMAP_CITY,AMAP_ADCODE,BASEMAP_KEY,PANEL_KEY,TRIP_YEAR,TRIP_WEATHER_CACHE_KEY,AMAP_TRAFFIC_PREF_KEY,LEGEND_STATE_KEY}),data:{points:()=>POINTS,schedules:()=>SCHEDULES,bookings:()=>BOOKINGS,pointById,routePoints},storage:{load:loadJSON,save:saveJSON},ui:{escapeHtml,showMapNotice}};
})();
