/* @insert amapAssistantHelpers */
function amapSetStatus(text,tone=''){const el=document.getElementById('amapAssistantStatus');if(!el)return;el.textContent=text;el.classList.toggle('amap-assistant-status-error',tone==='error');el.classList.toggle('amap-assistant-status-ok',tone==='ok')}
function amapShowPane(name){document.querySelectorAll('[data-amap-tab]').forEach(btn=>btn.classList.toggle('active',btn.dataset.amapTab===name));document.querySelectorAll('[data-amap-pane]').forEach(pane=>{const active=pane.dataset.amapPane===name;pane.classList.toggle('active',active);pane.hidden=!active})}
function amapButtonBusy(button,busy,busyText){if(!button)return;button.disabled=busy;if(busy){button.dataset.originalText=button.textContent;button.textContent=busyText||'处理中…'}else if(button.dataset.originalText){button.textContent=button.dataset.originalText;delete button.dataset.originalText}}
function amapPoiLocation(poi){const value=poi?.location??poi;if(Array.isArray(value))return value.map(Number);if(typeof value==='string')return amapNormalizeLocation(value);if(value&&typeof value.getLng==='function')return[value.getLng(),value.getLat()];if(value&&Number.isFinite(Number(value.lng))&&Number.isFinite(Number(value.lat)))return[Number(value.lng),Number(value.lat)];return null}
function amapLocationText(location){return location?location.map(v=>Number(v).toFixed(6)).join(','):''}
function amapSetInputLocation(id,label,location,poiId=''){const input=document.getElementById(id),loc=amapPoiLocation(location);if(!input||!loc)return;input.value=label||amapLocationText(loc);input.dataset.location=amapLocationText(loc);input.dataset.poiId=poiId||''}
function amapInputLocation(id){const input=document.getElementById(id);return amapNormalizeLocation(input?.dataset.location||'')}
function amapClearInputLocation(id){const input=document.getElementById(id);if(input){delete input.dataset.location;delete input.dataset.poiId}}
function amapEnsureServices(){return switchToAmap().then(()=>{if(amapAssistantReady)return;amapAutoComplete=new AMap.AutoComplete({city:AMAP_CITY,citylimit:true});amapPlaceSearch=new AMap.PlaceSearch({city:AMAP_CITY,citylimit:true,pageSize:12,pageIndex:1,extensions:'all'});amapGeocoder=new AMap.Geocoder({city:AMAP_CITY,radius:1200,extensions:'all'});amapWeatherService=new AMap.Weather();amapGeolocationService=new AMap.Geolocation({enableHighAccuracy:true,timeout:10000,maximumAge:60000,convert:true,showButton:false,showMarker:false,showCircle:false,panToLocation:false,zoomToAccuracy:false});amapAssistantReady=true;amapSetStatus('高德服务已就绪','ok')})}
function amapRenderSuggestions(tips){const box=document.getElementById('amapSuggestions');amapSuggestionPois=(tips||[]).filter(t=>t&&t.name).slice(0,8);if(!amapSuggestionPois.length){box.hidden=true;box.innerHTML='';return}box.innerHTML=amapSuggestionPois.map((tip,index)=>`<button type="button" class="amap-suggestion" data-amap-suggestion="${index}"><b>${escapeHtml(tip.name)}</b><small>${escapeHtml([tip.district,tip.address].filter(Boolean).join(' · ')||'青岛')}</small></button>`).join('');box.hidden=false}
function amapRenderSearchResults(pois,title='搜索结果'){const box=document.getElementById('amapSearchResults');amapSearchPois=(pois||[]).filter(p=>amapPoiLocation(p));if(!amapSearchPois.length){box.innerHTML='<div class="amap-empty">没有找到匹配地点，请换一个关键词或扩大搜索范围。</div>';return}box.innerHTML=`<div class="amap-result-meta"><b>${escapeHtml(title)}</b><span>${amapSearchPois.length} 个结果</span></div>`+amapSearchPois.map((poi,index)=>{const distance=poi.distance?amapFormatDistance(poi.distance):'',type=String(poi.type||'').split(';').slice(0,2).join(' · ');return `<article class="amap-result-card"><h4>${escapeHtml(poi.name||'未命名地点')}</h4><small>${escapeHtml([poi.address,poi.pname,poi.cityname,poi.adname].filter(Boolean).join(' · '))}</small><div class="amap-result-meta"><span>${escapeHtml(type)}</span>${distance?`<span>距中心 ${escapeHtml(distance)}</span>`:''}</div><div class="amap-result-actions"><button type="button" data-amap-result-action="view" data-amap-result-index="${index}">地图查看</button><button type="button" class="primary" data-amap-result-action="route" data-amap-result-index="${index}">去这里</button><button type="button" data-amap-result-action="nav" data-amap-result-index="${index}">高德导航</button></div></article>`}).join('')}
function amapSelectSearchPoi(index,action='view'){const poi=amapSearchPois[Number(index)],location=amapPoiLocation(poi);if(!poi||!location)return;amapSelectedPoi={name:poi.name||'选定地点',location,id:poi.id||''};if(action==='nav'){const uri='https://uri.amap.com/marker?position='+encodeURIComponent(location.join(','))+'&name='+encodeURIComponent(amapSelectedPoi.name)+'&src=travel-plans&coordinate=gaode&callnative=0';window.open(uri,'_blank','noopener');return}switchToAmap().then(()=>{amapMarkSelectedLocation(location,amapSelectedPoi.name);if(action==='route'){amapSetInputLocation('amapRouteTo',amapSelectedPoi.name,location,amapSelectedPoi.id);amapRouteEnd=location;amapShowPane('route');document.getElementById('amapRouteBtn').focus()}else amapSetStatus('已定位：'+amapSelectedPoi.name,'ok')}).catch(error=>amapSetStatus(error.message,'error'))}
function amapResolveInput(id,fallback){const cached=amapInputLocation(id);if(cached)return Promise.resolve(cached);const input=document.getElementById(id),text=input?.value.trim();if(!text&&fallback)return Promise.resolve(fallback);if(!text)return Promise.reject(new Error(id==='amapRouteFrom'?'请填写起点或使用当前位置':'请填写终点'));return amapEnsureServices().then(()=>new Promise((resolve,reject)=>amapGeocoder.getLocation(text,(status,result)=>{const geocode=result?.geocodes?.[0],location=amapPoiLocation(geocode);if(status==='complete'&&location){amapSetInputLocation(id,geocode.formattedAddress||text,location);resolve(location)}else reject(new Error('无法解析地点：'+text))}))) }
function amapClearRouteService(){if(amapRouteService&&typeof amapRouteService.clear==='function'){try{amapRouteService.clear()}catch(e){}}amapRouteService=null;const steps=document.getElementById('amapRouteSteps');if(steps)steps.innerHTML=''}
function amapRouteSummary(mode,result,origin,destination){let distance=0,duration=0,cost='';if(mode==='transit'){const plan=result?.plans?.[0];distance=plan?.walking_distance||result?.distance||0;duration=plan?.time||plan?.duration||0;cost=plan?.cost?` · 约¥${plan.cost}`:''}else{const route=result?.routes?.[0];distance=route?.distance||0;duration=route?.time||route?.duration||0}const modeName=mode==='driving'?'驾车':mode==='transit'?'公交地铁':'步行',uri=amapRouteUri(origin,destination,mode,document.getElementById('amapRouteTo').value||'终点');document.getElementById('amapRouteSummary').innerHTML=`<b>${escapeHtml(modeName)} · ${escapeHtml(amapFormatDistance(distance))} · ${escapeHtml(amapFormatDuration(duration))}${escapeHtml(cost)}</b><p>路线已绘制到高德地图，下方可查看逐步说明。</p><p><a href="${uri}" target="_blank" rel="noopener">在高德地图中继续导航</a></p>`}
function amapReverseLookup(location){const loc=amapPoiLocation(location);return amapEnsureServices().then(()=>new Promise((resolve,reject)=>amapGeocoder.getAddress(loc,(status,result)=>{if(status==='complete'&&result?.regeocode)resolve(result.regeocode);else reject(new Error('未查询到该位置的地址'))}))) }
function amapRenderContext(location,label,regeocode){amapContextLocation=amapPoiLocation(location);amapContextLabel=label||regeocode?.formattedAddress||'地图选点';const pois=regeocode?.pois||[];document.getElementById('amapContextOutput').innerHTML=`<b>${escapeHtml(amapContextLabel)}</b><div>${escapeHtml(amapLocationText(amapContextLocation))}</div>${pois.length?`<div>附近：${pois.slice(0,4).map(p=>escapeHtml(p.name)).join('、')}</div>`:''}<div class="amap-context-actions"><button type="button" data-amap-context="start">设为起点</button><button type="button" data-amap-context="end">设为终点</button><button type="button" data-amap-context="nearby">搜附近餐厅</button></div>`}
function amapHandleMapClick(event){const location=[event.lnglat.lng,event.lnglat.lat];amapMarkSelectedLocation(location,'地图选点');amapShowPane('travel');amapSetStatus('正在查询选点地址…');amapReverseLookup(location).then(regeo=>{amapRenderContext(location,regeo.formattedAddress,regeo);amapSetStatus('已获取地图选点地址','ok')}).catch(error=>{amapRenderContext(location,'地图选点');amapSetStatus(error.message,'error')})}
function amapUseContext(kind){if(!amapContextLocation)return;if(kind==='start'){amapSetInputLocation('amapRouteFrom',amapContextLabel,amapContextLocation);amapRouteStart=amapContextLocation;amapShowPane('route')}else if(kind==='end'){amapSetInputLocation('amapRouteTo',amapContextLabel,amapContextLocation);amapRouteEnd=amapContextLocation;amapShowPane('route')}else{amapShowPane('search');amapNearbySearch('餐厅',amapContextLocation)}}
function amapPopulateTripDestinations(){const select=document.getElementById('amapTripDestination');if(!select||select.options.length>1)return;const seen=new Set();SCHEDULES.slice(1).forEach(day=>{const group=document.createElement('optgroup');group.label=`8月${Number(day.date.slice(3))}日 · ${day.title}`;day.route.forEach(id=>{if(seen.has(id))return;const p=pointById(id);if(!p||['住宿区域','行程节点'].includes(p.category))return;seen.add(id);const option=document.createElement('option');option.value=id;option.textContent=`${pointIcon(id)} ${shortName(p.name)}`;group.appendChild(option)});if(group.children.length)select.appendChild(group)})}
function amapTripAction(action){const id=document.getElementById('amapTripDestination').value,p=pointById(id);if(!p){amapSetStatus('请先选择一个行程目的地','error');return}const location=amapPointPosition(p);if(action==='nav'){launchAmap(id);return}switchToAmap().then(()=>{amapMarkSelectedLocation(location,p.name);if(action==='route'){amapSetInputLocation('amapRouteTo',p.name,location);amapShowPane('route')}else amapSetStatus('已定位：'+p.name,'ok')})}
/* @end amapAssistantHelpers */

/* @replace loadAmapApi */
function loadAmapApi(){
  if(window.AMap)return Promise.resolve(window.AMap);
  if(amapApiPromise)return amapApiPromise;
  window._AMapSecurityConfig={securityJsCode:AMAP_SECURITY_CODE};
  const plugins=['AMap.Scale','AMap.ToolBar','AMap.Geolocation','AMap.AutoComplete','AMap.PlaceSearch','AMap.Geocoder','AMap.Weather','AMap.Driving','AMap.Walking','AMap.Transfer'];
  amapApiPromise=new Promise((resolve,reject)=>{
    const done=()=>window.AMapLoader.load({key:AMAP_JS_KEY,version:'2.0',plugins}).then(resolve).catch(reject);
    if(window.AMapLoader){done();return}
    const script=document.createElement('script');script.src='https://webapi.amap.com/loader.js';script.onload=done;script.onerror=()=>reject(new Error('高德地图加载器下载失败'));document.head.appendChild(script)
  }).catch(error=>{amapApiPromise=null;throw error});
  return amapApiPromise
}
/* @end loadAmapApi */

/* @replace switchToAmap */
function switchToAmap({fallbackToLeaflet=true}={}){
  setBasemapState('正在加载高德地图…');
  return loadAmapApi().then(()=>{
    mapEngine='amap';document.getElementById('map').classList.add('leaflet-map-hidden');
    const container=document.getElementById('amapMap');container.hidden=false;container.classList.add('active');
    if(!amapInstance){
      amapInstance=new AMap.Map('amapMap',{zoom:12,center:[120.38,36.066],viewMode:'2D',resizeEnable:true});
      try{amapInstance.addControl(new AMap.Scale())}catch(e){}
      try{amapInstance.addControl(new AMap.ToolBar({position:{right:'16px',bottom:'88px'}}))}catch(e){}
      amapInstance.on('click',amapHandleMapClick)
    }
    renderAmapView();document.getElementById('basemapSelect').value='amap';saveJSON(BASEMAP_KEY,{id:'amap'});setBasemapState('高德地图 · 正常');return amapInstance
  }).catch(error=>{
    showMapNotice('高德地图加载失败：'+error.message);document.getElementById('basemapSelect').value=activeBasemap;
    if(fallbackToLeaflet)switchLeafletBasemap(activeBasemap&&BASEMAPS[activeBasemap]?activeBasemap:'carto-light');
    throw error
  })
}
/* @end switchToAmap */

/* @replace amapSetOutput */
function amapSetOutput(title,body){const el=document.getElementById('amapContextOutput')||document.getElementById('amapServiceOutput');if(el)el.innerHTML='<h3>'+escapeHtml(title)+'</h3>'+body;amapShowPane('travel')}
/* @end amapSetOutput */

/* @replace toggleAmapServicePanel */
function toggleAmapServicePanel(force){const panel=document.getElementById('amapServicePanel'),button=document.getElementById('amapConfigBtn'),open=typeof force==='boolean'?force:panel.hidden;panel.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open){amapPopulateTripDestinations();amapSetStatus('正在连接高德服务…');amapEnsureServices().then(()=>{if(!amapServiceLoaded){amapServiceLoaded=true;amapWeatherAtCenter().catch(()=>{})}}).catch(error=>amapSetStatus(error.message,'error'))}}
/* @end toggleAmapServicePanel */

/* @replace amapSearchPlaces */
function amapSearchPlaces(){const input=document.getElementById('amapSearchInput'),keywords=input.value.trim(),button=document.getElementById('amapSearchBtn');if(!keywords){amapSetStatus('请输入地点或关键词','error');input.focus();return Promise.resolve()}document.getElementById('amapSuggestions').hidden=true;amapButtonBusy(button,true,'搜索中…');amapSetStatus('正在搜索“'+keywords+'”…');return amapEnsureServices().then(()=>new Promise((resolve,reject)=>amapPlaceSearch.search(keywords,(status,result)=>status==='complete'?resolve(result):reject(new Error('没有找到匹配地点'))))).then(result=>{amapRenderSearchResults(result?.poiList?.pois||[],'“'+keywords+'”');amapSetStatus('搜索完成','ok')}).catch(error=>{amapRenderSearchResults([]);amapSetStatus(error.message,'error')}).finally(()=>amapButtonBusy(button,false))}
/* @end amapSearchPlaces */

/* @replace amapInputTips */
function amapInputTips(){const input=document.getElementById('amapSearchInput'),keywords=input.value.trim();clearTimeout(amapSuggestionTimer);if(keywords.length<2){amapRenderSuggestions([]);return}amapSuggestionTimer=setTimeout(()=>amapEnsureServices().then(()=>amapAutoComplete.search(keywords,(status,result)=>{if(status==='complete')amapRenderSuggestions(result?.tips||[]);else amapRenderSuggestions([])})).catch(()=>{}),220)}
/* @end amapInputTips */

/* @replace amapNearbySearch */
function amapNearbySearch(keyword,center){const target=amapPoiLocation(center)||amapCurrentLocation||amapCenter();amapShowPane('search');amapSetStatus('正在搜索附近'+keyword+'…');return amapEnsureServices().then(()=>new Promise((resolve,reject)=>amapPlaceSearch.searchNearBy(keyword,target,3000,(status,result)=>status==='complete'?resolve(result):reject(new Error('附近没有找到'+keyword))))).then(result=>{amapRenderSearchResults(result?.poiList?.pois||[],'附近'+keyword);amapSetStatus('周边搜索完成','ok')}).catch(error=>{amapRenderSearchResults([]);amapSetStatus(error.message,'error')})}
/* @end amapNearbySearch */

/* @replace amapReverseAtLocation */
function amapReverseAtLocation(location=amapContextLocation||amapLastLngLat||amapCenter()){const target=amapPoiLocation(location);amapSetStatus('正在查询地址…');return amapReverseLookup(target).then(regeo=>{amapRenderContext(target,regeo.formattedAddress,regeo);amapSetStatus('地址查询完成','ok')}).catch(error=>amapSetStatus(error.message,'error'))}
/* @end amapReverseAtLocation */

/* @replace amapWeatherAtCenter */
function amapWeatherAtCenter(){const center=amapCurrentLocation||amapCenter(),box=document.getElementById('amapWeatherCard');box.textContent='正在查询天气…';return amapEnsureServices().then(()=>amapReverseLookup(center)).then(regeo=>{const component=regeo.addressComponent||{},city=component.adcode||component.city||AMAP_CITY;return Promise.all([new Promise((resolve,reject)=>amapWeatherService.getLive(city,(error,data)=>error?reject(error):resolve(data))),new Promise((resolve,reject)=>amapWeatherService.getForecast(city,(error,data)=>error?reject(error):resolve(data)))])}).then(([live,forecast])=>{const casts=forecast?.forecasts||[];box.innerHTML=`<b>${escapeHtml(live?.city||AMAP_CITY)} · ${escapeHtml(live?.weather||'--')} ${escapeHtml(live?.temperature||'--')}℃</b><div>湿度 ${escapeHtml(live?.humidity||'--')}% · ${escapeHtml(live?.windDirection||live?.winddirection||'--')}风 ${escapeHtml(live?.windPower||live?.windpower||'--')}级</div><div>${casts.slice(0,3).map(c=>`${escapeHtml(c.date||c.day)}：${escapeHtml(c.dayWeather||c.dayweather||'--')} ${escapeHtml(c.nightTemp||c.nighttemp||'--')}–${escapeHtml(c.dayTemp||c.daytemp||'--')}℃`).join('<br>')}</div>`;amapSetStatus('天气已更新','ok')}).catch(error=>{box.textContent='天气查询失败：'+(error.message||error);amapSetStatus('天气查询失败','error');throw error})}
/* @end amapWeatherAtCenter */

/* @replace amapIpLocate */
function amapIpLocate(){return amapWebRequest('/v3/ip').then(data=>{const values=String(data.rectangle||'').split(/[;,]/).map(Number);if(values.length!==4||!values.every(Number.isFinite))throw new Error('IP定位未返回有效范围');const location=[(values[0]+values[2])/2,(values[1]+values[3])/2],label=(data.province||'')+(data.city||'')+'（IP定位）';amapCurrentLocation=location;amapCurrentLabel=label;amapSetInputLocation('amapRouteFrom',label,location);document.getElementById('amapLocationText').textContent=label;return switchToAmap().then(()=>{amapMarkSelectedLocation(location,label);amapSetStatus('已使用IP定位，精度较低','ok');return location})})}
/* @end amapIpLocate */

/* @replace amapLocate */
function amapLocate(){const button=document.getElementById('amapLocateBtn');amapButtonBusy(button,true,'定位中…');amapSetStatus('正在获取当前位置…');return amapEnsureServices().then(()=>new Promise((resolve,reject)=>amapGeolocationService.getCurrentPosition((status,result)=>status==='complete'&&result?.position?resolve(result):reject(new Error(result?.message||'浏览器定位失败'))))).then(result=>{const location=amapPoiLocation(result.position);amapCurrentLocation=location;return amapReverseLookup(location).catch(()=>null).then(regeo=>{const label=regeo?.formattedAddress||'当前位置';amapCurrentLabel=label;amapSetInputLocation('amapRouteFrom',label,location);document.getElementById('amapLocationText').textContent=label;amapMarkSelectedLocation(location,'当前位置');amapSetStatus('定位成功','ok');return location})}).catch(()=>amapIpLocate()).catch(error=>amapSetStatus('定位失败：'+error.message,'error')).finally(()=>amapButtonBusy(button,false))}
/* @end amapLocate */

/* @replace resolveAmapLocation */
function resolveAmapLocation(text,fallback){const direct=amapNormalizeLocation(String(text||'').trim());if(direct)return Promise.resolve(direct);if(!String(text||'').trim())return fallback?Promise.resolve(fallback):Promise.reject(new Error('地点不能为空'));return amapEnsureServices().then(()=>new Promise((resolve,reject)=>amapGeocoder.getLocation(String(text).trim(),(status,result)=>{const location=amapPoiLocation(result?.geocodes?.[0]);status==='complete'&&location?resolve(location):reject(new Error('无法解析地点：'+text))}))) }
/* @end resolveAmapLocation */

/* @replace amapPlanRoute */
function amapPlanRoute(){const button=document.getElementById('amapRouteBtn');amapButtonBusy(button,true,'规划中…');amapSetStatus('正在规划路线…');const fallback=amapCurrentLocation||amapCenter();return Promise.all([amapResolveInput('amapRouteFrom',fallback),amapResolveInput('amapRouteTo')]).then(([origin,destination])=>amapEnsureServices().then(()=>({origin,destination}))).then(({origin,destination})=>new Promise((resolve,reject)=>{amapClearRouteService();const options={map:amapInstance,panel:'amapRouteSteps',hideMarkers:false,autoFitView:true};if(amapRouteMode==='driving')amapRouteService=new AMap.Driving({...options,policy:0,showTraffic:true});else if(amapRouteMode==='transit')amapRouteService=new AMap.Transfer({...options,city:AMAP_CITY,policy:0});else amapRouteService=new AMap.Walking(options);amapRouteService.search(origin,destination,(status,result)=>{if(status==='complete'){amapRouteStart=origin;amapRouteEnd=destination;amapRouteSummary(amapRouteMode,result,origin,destination);resolve(result)}else reject(new Error(result?.info||'未找到可用路线'))})})).then(result=>{amapSetStatus('路线规划完成','ok');return result}).catch(error=>{document.getElementById('amapRouteSummary').innerHTML='<div class="amap-empty">'+escapeHtml(error.message)+'</div>';amapSetStatus(error.message,'error')}).finally(()=>amapButtonBusy(button,false))}
/* @end amapPlanRoute */

/* @replace toggleAmapTraffic */
function toggleAmapTraffic(){const button=document.getElementById('trafficToggleBtn');return switchToAmap().then(()=>{if(!amapTrafficLayer)amapTrafficLayer=new AMap.TileLayer.Traffic({zIndex:10,autoRefresh:true,interval:180});amapTrafficVisible=!amapTrafficVisible;if(amapTrafficVisible)amapInstance.add(amapTrafficLayer);else amapInstance.remove(amapTrafficLayer);button.classList.toggle('traffic-active',amapTrafficVisible);button.textContent=amapTrafficVisible?'关闭路况':'实时路况';amapSetStatus(amapTrafficVisible?'实时路况已开启':'实时路况已关闭','ok');showMapNotice(amapTrafficVisible?'已开启高德实时路况图层':'已关闭高德实时路况图层')}).catch(error=>amapSetStatus(error.message,'error'))}
/* @end toggleAmapTraffic */

/* @replace bindAmapServiceUI */
function bindAmapServiceUI(){
  document.getElementById('amapConfigBtn').onclick=()=>toggleAmapServicePanel();document.getElementById('amapServiceClose').onclick=()=>toggleAmapServicePanel(false);document.getElementById('trafficToggleBtn').onclick=toggleAmapTraffic;
  document.querySelectorAll('[data-amap-tab]').forEach(button=>button.onclick=()=>amapShowPane(button.dataset.amapTab));
  document.getElementById('amapSearchBtn').onclick=amapSearchPlaces;document.getElementById('amapSearchInput').oninput=amapInputTips;document.getElementById('amapSearchInput').onkeydown=event=>{if(event.key==='Enter')amapSearchPlaces()};
  document.getElementById('amapSuggestions').onclick=event=>{const button=event.target.closest('[data-amap-suggestion]');if(!button)return;const tip=amapSuggestionPois[Number(button.dataset.amapSuggestion)];document.getElementById('amapSuggestions').hidden=true;document.getElementById('amapSearchInput').value=tip.name;if(amapPoiLocation(tip)){amapSearchPois=[tip];amapSelectSearchPoi(0,'route')}else amapSearchPlaces()};
  document.getElementById('amapSearchResults').onclick=event=>{const button=event.target.closest('[data-amap-result-action]');if(button)amapSelectSearchPoi(button.dataset.amapResultIndex,button.dataset.amapResultAction)};
  document.querySelectorAll('[data-amap-nearby]').forEach(button=>button.onclick=()=>amapNearbySearch(button.dataset.amapNearby));
  document.getElementById('amapLocateBtn').onclick=amapLocate;document.getElementById('amapUseLocationBtn').onclick=()=>amapCurrentLocation?amapSetInputLocation('amapRouteFrom',amapCurrentLabel,amapCurrentLocation):amapLocate();
  document.getElementById('amapReturnHotelBtn').onclick=()=>{const p=pointById('hotel-zone'),location=amapPointPosition(p);amapSetInputLocation('amapRouteTo','住宿区：五四广场—浮山所',location);amapShowPane('route')};
  ['amapRouteFrom','amapRouteTo'].forEach(id=>document.getElementById(id).addEventListener('input',()=>amapClearInputLocation(id)));
  document.getElementById('amapSwapRouteBtn').onclick=()=>{const from=document.getElementById('amapRouteFrom'),to=document.getElementById('amapRouteTo'),value=from.value,location=from.dataset.location||'',poi=from.dataset.poiId||'';from.value=to.value;from.dataset.location=to.dataset.location||'';from.dataset.poiId=to.dataset.poiId||'';to.value=value;to.dataset.location=location;to.dataset.poiId=poi};
  document.querySelectorAll('[data-amap-route-mode]').forEach(button=>button.onclick=()=>{amapRouteMode=button.dataset.amapRouteMode;document.querySelectorAll('[data-amap-route-mode]').forEach(item=>item.classList.toggle('active',item===button))});
  document.getElementById('amapPickMapBtn').onclick=()=>{toggleAmapServicePanel(false);showMapNotice('请点击高德地图上的位置，然后选择“设为终点”')};document.getElementById('amapRouteBtn').onclick=amapPlanRoute;
  document.getElementById('amapWeatherBtn').onclick=amapWeatherAtCenter;document.getElementById('amapReverseBtn').onclick=()=>amapReverseAtLocation();document.getElementById('amapTrafficStatusBtn').onclick=amapTrafficAtCenter;document.getElementById('amapStaticMapBtn').onclick=amapStaticMap;
  document.getElementById('amapContextOutput').onclick=event=>{const button=event.target.closest('[data-amap-context]');if(button)amapUseContext(button.dataset.amapContext)};
  document.getElementById('amapTripViewBtn').onclick=()=>amapTripAction('view');document.getElementById('amapTripRouteBtn').onclick=()=>amapTripAction('route');document.getElementById('amapTripNavigateBtn').onclick=()=>amapTripAction('nav');
}
/* @end bindAmapServiceUI */
