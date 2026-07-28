/* v2.5 bridge legacy loadJSON/saveJSON calls to schema-versioned envelopes. */
(function(){
  'use strict';
  const storage=window.TravelVersionedStorage,SCHEMA=1,originalLoad=loadJSON,originalSave=saveJSON;
  const eligible=key=>/^(qingdao-v107|travel-plans|trip-)/.test(String(key||''));
  function load(key,fallback){if(!storage||!eligible(key))return originalLoad(key,fallback);return storage.read(key,fallback,{schemaVersion:SCHEMA,migrate:value=>value===undefined||value===null?fallback:value}).data}
  function save(key,value){if(!storage||!eligible(key))return originalSave(key,value);return Boolean(storage.write(key,value,{schemaVersion:SCHEMA}))}
  function migrateExisting(){const migrated=[];for(let index=0;index<localStorage.length;index++){const key=localStorage.key(index);if(!eligible(key))continue;let value;try{value=JSON.parse(localStorage.getItem(key))}catch{continue}if(storage.isEnvelope(value))continue;storage.write(key,value,{schemaVersion:SCHEMA});migrated.push(key)}return migrated}
  const migrated=migrateExisting();
  loadJSON=load;saveJSON=save;
  bookingProgress=load(STORAGE_KEY,{});
  if(window.TravelAppContext?.storage){window.TravelAppContext.storage.load=load;window.TravelAppContext.storage.save=save}
  window.TravelLegacyStorageBridge=Object.freeze({schemaVersion:SCHEMA,eligible,load,save,migrated:()=>migrated.slice()});
})();
