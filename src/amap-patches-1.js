/* @replace autoSwitchBasemap */
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
}
/* @end autoSwitchBasemap */

/* @replace promptAmapConfig */
function promptAmapConfig(){toggleAmapServicePanel(true);showMapNotice('高德JS API与Web API凭证已内置，无需手动配置。');return true}
/* @end promptAmapConfig */

/* @replace loadAmapApi */
function loadAmapApi(){
  if(window.AMap)return Promise.resolve(window.AMap);
  if(amapApiPromise)return amapApiPromise;
  window._AMapSecurityConfig={securityJsCode:AMAP_SECURITY_CODE};
  amapApiPromise=new Promise((resolve,reject)=>{
    const done=()=>window.AMapLoader.load({key:AMAP_JS_KEY,version:'2.0',plugins:['AMap.Scale','AMap.ToolBar','AMap.Geolocation']}).then(resolve).catch(reject);
    if(window.AMapLoader){done();return}
    const script=document.createElement('script');script.src='https://webapi.amap.com/loader.js';script.onload=done;script.onerror=()=>reject(new Error('高德加载器下载失败'));document.head.appendChild(script)
  }).catch(error=>{amapApiPromise=null;throw error});
  return amapApiPromise
}
/* @end loadAmapApi */

/* @replace switchToAmap */
function switchToAmap({fallbackToLeaflet=true}={}){
  setBasemapState('正在加载高德地图…');
  return loadAmapApi().then(()=>{
    mapEngine='amap';document.getElementById('map').classList.add('leaflet-map-hidden');
    const c=document.getElementById('amapMap');c.hidden=false;c.classList.add('active');
    if(!amapInstance){
      amapInstance=new AMap.Map('amapMap',{zoom:12,center:[120.38,36.066],viewMode:'2D',resizeEnable:true});
      try{amapInstance.addControl(new AMap.Scale())}catch(e){}
      try{amapInstance.addControl(new AMap.ToolBar({position:{right:'16px',bottom:'88px'}}))}catch(e){}
      amapInstance.on('click',e=>{amapLastLngLat=[e.lnglat.lng,e.lnglat.lat];amapMarkSelectedLocation(amapLastLngLat,'地图选点');if(!document.getElementById('amapServicePanel').hidden)amapSetOutput('地图选点','<p>'+amapLastLngLat.map(v=>v.toFixed(6)).join(', ')+'</p><p>点击“查地址”可获取详细地址和周边POI。</p>')})
    }
    renderAmapView();document.getElementById('basemapSelect').value='amap';saveJSON(BASEMAP_KEY,{id:'amap'});setBasemapState('高德地图 · 正常');return amapInstance
  }).catch(err=>{
    showMapNotice('高德地图加载失败：'+err.message);document.getElementById('basemapSelect').value=activeBasemap;
    if(fallbackToLeaflet)switchLeafletBasemap(activeBasemap&&BASEMAPS[activeBasemap]?activeBasemap:'carto-light');
    throw err
  })
}
/* @end switchToAmap */
