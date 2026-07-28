/* v2.4 AMap loader and engine switch. */
function promptAmapConfig(){toggleAmapServicePanel(true);showMapNotice('高德JS API与Web API凭证已内置，无需手动配置。');return true}
function loadAmapApi(){if(window.AMap)return Promise.resolve(window.AMap);if(amapApiPromise)return amapApiPromise;window._AMapSecurityConfig={securityJsCode:AMAP_SECURITY_CODE};const plugins=['AMap.Scale','AMap.ToolBar','AMap.Geolocation','AMap.AutoComplete','AMap.PlaceSearch','AMap.Geocoder','AMap.Weather','AMap.Driving','AMap.Walking','AMap.Transfer','AMap.MarkerCluster'];amapApiPromise=new Promise((resolve,reject)=>{const done=()=>window.AMapLoader.load({key:AMAP_JS_KEY,version:'2.0',plugins}).then(resolve).catch(reject);if(window.AMapLoader){done();return}const script=document.createElement('script');script.src='https://webapi.amap.com/loader.js';script.onload=done;script.onerror=()=>reject(new Error('高德地图加载器下载失败'));document.head.appendChild(script)}).catch(error=>{amapApiPromise=null;throw error});return amapApiPromise}
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
}
window.TravelAmapLoader=Object.freeze({load:loadAmapApi,switchTo:switchToAmap,prompt:promptAmapConfig});
