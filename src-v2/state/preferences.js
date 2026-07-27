(function(){
  'use strict';
  const PREFIX='travel-plans-v2:';
  function key(name){return PREFIX+name}
  function get(name,fallback=null){
    try{
      const raw=localStorage.getItem(key(name));
      return raw===null?fallback:JSON.parse(raw);
    }catch{return fallback}
  }
  function set(name,value){
    try{localStorage.setItem(key(name),JSON.stringify(value));return true}catch{return false}
  }
  function remove(name){try{localStorage.removeItem(key(name))}catch{}}
  window.TravelPreferences={get,set,remove,key};
})();