/* v1.0.15：高德服务幂等激活与路况开关视野锁定 */

/* @replace switchToAmap */
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
/* @end switchToAmap */

/* @replace amapEnsureServices */
function amapEnsureServices(){
  const ready=mapEngine==='amap'&&amapInstance?Promise.resolve(amapInstance):switchToAmap();
  return ready.then(()=>{
    if(amapAssistantReady)return amapInstance;
    amapAutoComplete=new AMap.AutoComplete({city:AMAP_CITY,citylimit:true});
    amapPlaceSearch=new AMap.PlaceSearch({city:AMAP_CITY,citylimit:true,pageSize:12,pageIndex:1,extensions:'all'});
    amapGeocoder=new AMap.Geocoder({city:AMAP_CITY,radius:1200,extensions:'all'});
    amapWeatherService=new AMap.Weather();
    amapGeolocationService=new AMap.Geolocation({enableHighAccuracy:true,timeout:10000,maximumAge:60000,convert:true,showButton:false,showMarker:false,showCircle:false,panToLocation:false,zoomToAccuracy:false});
    amapAssistantReady=true;
    amapSetStatus('高德服务已就绪','ok');
    return amapInstance
  })
}
/* @end amapEnsureServices */

/* @replace toggleAmapTraffic */
function toggleAmapTraffic(){
  const desired=mapEngine!=='amap'||!amapTrafficVisible;
  const alreadyActive=mapEngine==='amap'&&amapInstance;
  const snapshot=alreadyActive?{center:amapInstance.getCenter(),zoom:amapInstance.getZoom()}:null;
  const ready=alreadyActive?Promise.resolve(amapInstance):switchToAmap();
  return ready.then(()=>{
    amapSetTrafficVisible(desired,{announce:true});
    if(snapshot){
      const center=snapshot.center;
      requestAnimationFrame(()=>{
        if(mapEngine==='amap'&&amapInstance)amapInstance.setZoomAndCenter(snapshot.zoom,[center.lng,center.lat],true)
      })
    }
    if(desired)amapTrafficAtCenter().catch(()=>{})
  }).catch(error=>amapSetStatus(error.message,'error'))
}
/* @end toggleAmapTraffic */
