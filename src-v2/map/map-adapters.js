(function(){
  'use strict';
  const core=window.TravelCore;
  const operations=[];
  function engine(){try{return mapEngine==='amap'?'amap':'leaflet'}catch{return'leaflet'}}
  function record(type,adapter,meta={}){operations.push({type,adapter,at:Date.now(),...meta});if(operations.length>80)operations.splice(0,operations.length-80)}
  function safeInvoke(invoke){try{return typeof invoke==='function'?invoke():undefined}catch(error){record('error',engine(),{message:error.message});throw error}}
  function normalizeView(view){if(!view?.center||view.center.length<2)return null;return{center:[Number(view.center[0]),Number(view.center[1])],zoom:Number.isFinite(Number(view.zoom))?Number(view.zoom):13}}

  const leaflet={
    id:'leaflet',
    ready:()=>typeof map!=='undefined'&&Boolean(map),
    resize:()=>{try{map?.invalidateSize()}catch{}},
    view:()=>{try{const c=map.getCenter();return{center:[c.lng,c.lat],zoom:map.getZoom()}}catch{return null}},
    setView:view=>{const v=normalizeView(view);try{if(v&&map)map.setView([v.center[1],v.center[0]],v.zoom,{animate:false});record('setView','leaflet',{zoom:v?.zoom})}catch{}},
    fitPoints:({points,maxZoom,invoke})=>{record('fitPoints','leaflet',{count:points?.length||0,maxZoom});return safeInvoke(invoke)},
    renderMarkers:({day,invoke})=>{record('renderMarkers','leaflet',{day:day||null});return safeInvoke(invoke)},
    renderRoute:({day,invoke})=>{record('renderRoute','leaflet',{day:day||null});return safeInvoke(invoke)},
    clearLayer:(name,invoke)=>{const result=safeInvoke(invoke);try{if(name==='tripRoutes')routeLayer?.clearLayers?.();else if(name==='hotels')hotelLayer?.clearLayers?.()}catch{}record('clearLayer','leaflet',{name});return result}
  };
  const amap={
    id:'amap',
    ready:()=>typeof amapInstance!=='undefined'&&Boolean(amapInstance),
    resize:()=>{try{amapInstance?.resize()}catch{}},
    view:()=>{try{const c=amapInstance.getCenter();return{center:[c.lng,c.lat],zoom:amapInstance.getZoom()}}catch{return null}},
    setView:view=>{const v=normalizeView(view);try{if(v&&amapInstance)amapInstance.setZoomAndCenter(v.zoom,v.center,true);record('setView','amap',{zoom:v?.zoom})}catch{}},
    fitPoints:({points,maxZoom,invoke})=>{record('fitPoints','amap',{count:points?.length||0,maxZoom});return safeInvoke(invoke)},
    renderMarkers:({day,invoke})=>{record('renderMarkers','amap',{day:day||null});return safeInvoke(invoke)},
    renderRoute:({day,invoke})=>{record('renderRoute','amap',{day:day||null});return safeInvoke(invoke)},
    clearLayer:(name,invoke)=>{const result=safeInvoke(invoke);try{if(name==='serviceSelection')core?.overlays?.clear?.('serviceSelection',amapInstance);if(name==='plannedRoute'&&typeof amapClearRouteService==='function')amapClearRouteService()}catch{}record('clearLayer','amap',{name});return result}
  };
  function current(){return engine()==='amap'?amap:leaflet}
  function setView(view,target=engine()){return(target==='amap'?amap:leaflet).setView(view)}
  function snapshot(){return{engine:engine(),view:current().view(),operations:[...operations]}}
  function install(){
    if(window.__travelMapAdaptersInstalled)return;window.__travelMapAdaptersInstalled=true;
    if(typeof rebuildMarkers==='function'){const original=rebuildMarkers;rebuildMarkers=function(day){return current().renderMarkers({day,invoke:()=>original(day)})}}
    if(typeof drawRoutes==='function'){const original=drawRoutes;drawRoutes=function(day){return current().renderRoute({day,invoke:()=>original(day)})}}
    if(typeof fitPoints==='function'){const original=fitPoints;fitPoints=function(points,maxZoom){return current().fitPoints({points,maxZoom,invoke:()=>original(points,maxZoom)})}}
    if(typeof clearRoutes==='function'){const original=clearRoutes;clearRoutes=function(){return current().clearLayer('tripRoutes',()=>original())}}
  }
  install();
  window.TravelMapAdapters={engine,current,leaflet,amap,setView,snapshot,install,renderTrip(day){rebuildMarkers?.(day||null);drawRoutes?.(day||null)},clearLayer(name){return current().clearLayer(name)}};
})();
