(function(){
  'use strict';
  function engine(){try{return mapEngine||'leaflet'}catch{return'leaflet'}}
  const leaflet={
    ready:()=>typeof map!=='undefined'&&Boolean(map),
    resize:()=>{try{map?.invalidateSize()}catch{}},
    view:()=>{try{const c=map.getCenter();return{center:[c.lng,c.lat],zoom:map.getZoom()}}catch{return null}},
    setView:view=>{try{if(view?.center)map.setView([view.center[1],view.center[0]],view.zoom,{animate:false})}catch{}}
  };
  const amap={
    ready:()=>typeof amapInstance!=='undefined'&&Boolean(amapInstance),
    resize:()=>{try{amapInstance?.resize()}catch{}},
    view:()=>{try{const c=amapInstance.getCenter();return{center:[c.lng,c.lat],zoom:amapInstance.getZoom()}}catch{return null}},
    setView:view=>{try{if(view?.center)amapInstance.setZoomAndCenter(view.zoom,view.center,true)}catch{}}
  };
  function current(){return engine()==='amap'?amap:leaflet}
  window.TravelMapAdapters={engine,current,leaflet,amap};
})();