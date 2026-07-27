(function(){
  'use strict';
  window.TravelLeafletAdapterFactory=function({record,safeInvoke,normalizeView,core}){
    return{
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
  };
})();
