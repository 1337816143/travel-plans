(function(){
  'use strict';
  const core=window.TravelCore,operations=[];
  function engine(){try{return mapEngine==='amap'?'amap':'leaflet'}catch{return'leaflet'}}
  function record(type,adapter,meta={}){operations.push({type,adapter,at:Date.now(),...meta});if(operations.length>80)operations.splice(0,operations.length-80)}
  function safeInvoke(invoke){try{return typeof invoke==='function'?invoke():undefined}catch(error){record('error',engine(),{message:error.message});throw error}}
  function normalizeView(view){if(!view?.center||view.center.length<2)return null;return{center:[Number(view.center[0]),Number(view.center[1])],zoom:Number.isFinite(Number(view.zoom))?Number(view.zoom):13}}
  const context={record,safeInvoke,normalizeView,core};
  const leaflet=window.TravelLeafletAdapterFactory?.(context);const amap=window.TravelAmapAdapterFactory?.(context);
  if(!leaflet||!amap)throw new Error('Map adapter implementation is missing');
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
