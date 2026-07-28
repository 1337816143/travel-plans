/* v2.4 basemap controller. */
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
}
function switchLeafletBasemap(id){if(!map||!BASEMAPS[id])return;const config=BASEMAPS[id],layerMax=Number.isFinite(config.maxZoom)?config.maxZoom:19;map.setMaxZoom(layerMax);if(map.getZoom()>layerMax)map.setZoom(layerMax);if(activeTileLayer)map.removeLayer(activeTileLayer);activeBasemap=id;activeTileLayer=createTileLayer(id);activeTileLayer.addTo(map);mapEngine='leaflet';document.getElementById('map').classList.remove('leaflet-map-hidden');document.getElementById('amapMap').classList.remove('active');document.getElementById('amapMap').hidden=true;saveJSON(BASEMAP_KEY,{id});document.getElementById('basemapSelect').value=id;setTimeout(()=>map.invalidateSize(),80)}
function switchBasemap(id,{manual=true}={}){if(id==='amap'){switchToAmap();return}switchLeafletBasemap(id);if(manual)showMapNotice(`已切换到${BASEMAPS[id].name}`)}
window.TravelBasemapController=Object.freeze({sources:BASEMAPS,fallbackOrder:FALLBACK_ORDER,switch:switchBasemap,switchLeaflet:switchLeafletBasemap,autoFailover:autoSwitchBasemap});
