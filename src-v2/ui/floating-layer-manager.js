(function(){
  'use strict';
  const state=new Map();
  const listeners=new Set();
  const mobile=()=>matchMedia('(max-width:800px), (pointer:coarse) and (max-height:600px)').matches;
  const blockers={drawer:['panel','assistant'],notice:['panel','assistant']};
  function className(name){return'floating-'+name+'-open'}
  function effective(name){return Boolean(state.get(name))&&(!mobile()||!(blockers[name]||[]).some(other=>state.get(other)))}
  function apply(){
    const names=new Set([...state.keys(),...Object.keys(blockers)]);
    for(const name of names){const visible=effective(name);document.querySelector('.app')?.classList.toggle(className(name),visible);document.querySelector('.map-wrap')?.classList.toggle(className(name),visible)}
  }
  function emit(name,open,meta){listeners.forEach(fn=>{try{fn({name,open,effective:effective(name),state:snapshot(),meta})}catch{}})}
  function set(name,open,meta={}){const value=Boolean(open);state.set(name,value);apply();emit(name,value,meta);return value}
  function isOpen(name){return Boolean(state.get(name))}
  function isVisible(name){return effective(name)}
  function snapshot(){return Object.fromEntries([...state.entries()].map(([name,open])=>[name,{open,effective:effective(name)}]))}
  function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}
  function sync(){
    set('panel',mobile()&&Boolean(document.getElementById('panel')?.classList.contains('open')),{sync:true});
    set('assistant',Boolean(document.getElementById('amapServicePanel')&&!document.getElementById('amapServicePanel').hidden),{sync:true});
    set('notice',Boolean(document.getElementById('mapNotice')?.classList.contains('show')),{sync:true});
  }
  window.TravelFloatingLayers={set,isOpen,isVisible,snapshot,subscribe,sync,mobile,apply};
})();