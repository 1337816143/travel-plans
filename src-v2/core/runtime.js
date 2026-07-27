(function(){
  'use strict';

  class RequestCoordinator{
    constructor(){this.entries=new Map()}
    begin(key){
      const old=this.entries.get(key);
      if(old?.controller)old.controller.abort();
      const id=(old?.id||0)+1;
      const controller=typeof AbortController==='function'?new AbortController():null;
      const ticket={key,id,controller,signal:controller?.signal||null};
      this.entries.set(key,ticket);
      return ticket;
    }
    current(ticket){return this.entries.get(ticket.key)?.id===ticket.id&&!ticket.signal?.aborted}
    finish(ticket){if(this.current(ticket))this.entries.delete(ticket.key)}
    cancel(key){const entry=this.entries.get(key);entry?.controller?.abort();this.entries.delete(key)}
    cancelAll(){for(const key of this.entries.keys())this.cancel(key)}
  }

  class TimedCache{
    constructor(){this.values=new Map()}
    get(key,maxAgeMs){const entry=this.values.get(key);if(!entry)return null;if(Date.now()-entry.time>maxAgeMs){this.values.delete(key);return null}return entry.value}
    set(key,value){this.values.set(key,{value,time:Date.now()});return value}
    delete(key){this.values.delete(key)}
    clear(){this.values.clear()}
  }

  class MapViewState{
    constructor(storageKey){this.storageKey=storageKey;this.state=this.load()}
    load(){try{return JSON.parse(localStorage.getItem(this.storageKey))||{}}catch{return{}}}
    save(next={}){this.state={...this.state,...next,updatedAt:Date.now()};try{localStorage.setItem(this.storageKey,JSON.stringify(this.state))}catch{}return this.state}
    captureLeaflet(map,extra={}){if(!map)return this.state;const c=map.getCenter();return this.save({engine:'leaflet',center:[Number(c.lng),Number(c.lat)],zoom:Number(map.getZoom()),...extra})}
    captureAmap(map,extra={}){if(!map)return this.state;const c=map.getCenter();return this.save({engine:'amap',center:[Number(c.lng),Number(c.lat)],zoom:Number(map.getZoom()),...extra})}
    snapshot(){return structuredClone?structuredClone(this.state):JSON.parse(JSON.stringify(this.state))}
  }

  class OverlayManager{
    constructor(){this.groups=new Map()}
    items(name){return this.groups.get(name)||[]}
    replace(name,items,map,remove){this.clear(name,map,remove);const list=(items||[]).filter(Boolean);this.groups.set(name,list);return list}
    add(name,item){if(!item)return;const list=this.items(name);list.push(item);this.groups.set(name,list)}
    clear(name,map,remove){const list=this.items(name);for(const item of list){try{if(remove)remove(item,map);else if(map?.remove)map.remove(item);else item?.remove?.()}catch{}}this.groups.delete(name)}
    clearAll(map,remove){for(const name of [...this.groups.keys()])this.clear(name,map,remove)}
  }

  class VisibilityRefresher{
    constructor(){this.jobs=new Map();document.addEventListener('visibilitychange',()=>this.sync())}
    register(name,fn,intervalMs,enabled=()=>true){this.stop(name);this.jobs.set(name,{fn,intervalMs,enabled,timer:null});this.start(name)}
    start(name){const job=this.jobs.get(name);if(!job||job.timer||document.visibilityState!=='visible'||!job.enabled())return;job.timer=setInterval(()=>{if(document.visibilityState==='visible'&&job.enabled())Promise.resolve(job.fn()).catch(()=>{})},job.intervalMs)}
    stop(name){const job=this.jobs.get(name);if(job?.timer)clearInterval(job.timer);if(job)job.timer=null}
    sync(){for(const name of this.jobs.keys()){if(document.visibilityState==='visible')this.start(name);else this.stop(name)}}
  }

  const viewport={
    raf:0,
    sync(){
      cancelAnimationFrame(viewport.raf);
      viewport.raf=requestAnimationFrame(()=>{
        const h=window.visualViewport?.height||window.innerHeight;
        document.documentElement.style.setProperty('--app-height',Math.max(320,Math.round(h))+'px');
      });
    },
    start(){
      viewport.sync();
      window.addEventListener('resize',viewport.sync,{passive:true});
      window.visualViewport?.addEventListener('resize',viewport.sync,{passive:true});
      window.visualViewport?.addEventListener('scroll',viewport.sync,{passive:true});
    }
  };

  function announce(text,tone='polite'){
    let node=document.getElementById('globalLiveRegion');
    if(!node){node=document.createElement('div');node.id='globalLiveRegion';node.className='sr-only';node.setAttribute('aria-live',tone);node.setAttribute('aria-atomic','true');document.body.appendChild(node)}
    node.setAttribute('aria-live',tone);node.textContent='';requestAnimationFrame(()=>{node.textContent=String(text||'')});
  }

  window.TravelCore={
    version:'2.0.0',
    requests:new RequestCoordinator(),
    cache:new TimedCache(),
    mapView:new MapViewState('travel-plans-map-view-v2'),
    overlays:new OverlayManager(),
    refreshers:new VisibilityRefresher(),
    viewport,
    announce
  };
})();
