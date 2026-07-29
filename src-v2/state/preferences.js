/* v2.5 schema-versioned preferences with legacy compatibility. */
(function(){
  'use strict';
  const PREFIX='travel-plans-v2:',SCHEMA=1;
  function key(name){return PREFIX+name}
  function legacyParse(raw,fallback){try{return raw===null?fallback:JSON.parse(raw)}catch{return fallback}}
  function get(name,fallback=null){
    const storage=window.TravelVersionedStorage,storageKey=key(name),raw=localStorage.getItem(storageKey);
    if(!storage)return legacyParse(raw,fallback);
    if(raw===null)return fallback;
    const value=legacyParse(raw,fallback);
    if(storage.isEnvelope(value))return value.data;
    return storage.read(storageKey,fallback,{schemaVersion:SCHEMA,migrate:legacy=>legacy}).data
  }
  function set(name,value){const storage=window.TravelVersionedStorage;if(storage)return Boolean(storage.write(key(name),value,{schemaVersion:SCHEMA}));try{localStorage.setItem(key(name),JSON.stringify(value));return true}catch{return false}}
  function remove(name){try{localStorage.removeItem(key(name))}catch{}}
  function inspect(name){const raw=legacyParse(localStorage.getItem(key(name)),null);return window.TravelVersionedStorage?.isEnvelope(raw)?raw:{schemaVersion:0,updatedAt:null,data:raw}}
  window.TravelPreferences={get,set,remove,key,inspect,schemaVersion:SCHEMA};
})();
