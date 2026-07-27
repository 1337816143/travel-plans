(function(){
  'use strict';
  const state=new Map();
  const listeners=new Set();
  const mobile=()=>matchMedia('(max-width:800px), (pointer:coarse) and (max-height:600px)').matches;
  const conflicts={panel:['assistant','drawer'],assistant:['panel','drawer'],drawer:['panel','assistant']};
  function className(name){return'floating-'+name+'-open'}
  function emit(name,open,meta){listeners.forEach(fn=>{try{fn({name,open,state:snapshot(),meta})}catch{}})}
  function set(name,open,meta={}){
    const value=Boolean(open);
    state.set(name,value);
    document.querySelector('.app')?.classList.toggle(className(name),value);
    document.querySelector('.map-wrap')?.classList.toggle(className(name),value);
    if(value&&mobile())for(const other of conflicts[name]||[]){state.set(other,false);document.querySelector('.app')?.classList.remove(className(other));document.querySelector('.map-wrap')?.classList.remove(className(other))}
    emit(name,value,meta);
    return value;
  }
  function isOpen(name){return Boolean(state.get(name))}
  function snapshot(){return Object.fromEntries(state.entries())}
  function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn)}
  function sync(){
    set('panel',mobile()&&Boolean(document.getElementById('panel')?.classList.contains('open')),{sync:true});
    set('assistant',Boolean(document.getElementById('amapServicePanel')&&!document.getElementById('amapServicePanel').hidden),{sync:true});
    set('notice',Boolean(document.getElementById('mapNotice')?.classList.contains('show')),{sync:true});
  }
  window.TravelFloatingLayers={set,isOpen,snapshot,subscribe,sync,mobile};
})();