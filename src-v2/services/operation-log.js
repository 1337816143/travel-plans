/* v2.5 local operation history with bounded undo metadata. */
(function(){
  'use strict';
  const KEY='trip-operation-log-v2.5',SCHEMA=1,MAX=120,storage=window.TravelVersionedStorage;
  function entries(){return storage?storage.read(KEY,[],{schemaVersion:SCHEMA,migrate:value=>Array.isArray(value)?value:[]}).data:[]}
  function save(items){const value=items.slice(-MAX);if(storage)storage.write(KEY,value,{schemaVersion:SCHEMA});else try{localStorage.setItem(KEY,JSON.stringify(value))}catch{}return value}
  function record(type,payload={},undo=null,label=''){const item={id:'op-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),type,label:label||type,payload,undo,at:new Date().toISOString(),undoneAt:null};save([...entries(),item]);document.dispatchEvent(new CustomEvent('travel:operation',{detail:item}));return item}
  function list(limit=30){return entries().slice(-limit).reverse()}
  function lastUndoable(){return[...entries()].reverse().find(item=>item.undo&&!item.undoneAt)||null}
  function markUndone(id){const items=entries(),item=items.find(value=>value.id===id);if(item)item.undoneAt=new Date().toISOString();save(items);return item}
  function clear(){storage?.remove(KEY);try{localStorage.removeItem(KEY)}catch{}document.dispatchEvent(new CustomEvent('travel:operation',{detail:{clear:true}}))}
  window.TravelOperationLog=Object.freeze({KEY,SCHEMA,record,list,lastUndoable,markUndone,clear});
})();
