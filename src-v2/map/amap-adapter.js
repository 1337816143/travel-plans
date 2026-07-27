(function(){
  'use strict';
  window.TravelAmapAdapterFactory=function({record,safeInvoke,normalizeView,core}){
    return{
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
  };
})();
