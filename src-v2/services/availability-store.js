/* v2.5 time-limited venue availability confirmations. */
(function(){
  'use strict';
  const KEY='trip-availability-v2.5',SCHEMA=1,TTL=12*60*60*1000,storage=window.TravelVersionedStorage;
  const STATUSES=Object.freeze({unknown:'待复核',open:'已确认开放',closed:'临时关闭/停运',full:'预约已满',limited:'限流或部分开放'});
  function data(){return storage?storage.read(KEY,{}, {schemaVersion:SCHEMA,migrate:value=>value&&typeof value==='object'?value:{}}).data:{}}
  function write(value){if(storage)storage.write(KEY,value,{schemaVersion:SCHEMA});else try{localStorage.setItem(KEY,JSON.stringify(value))}catch{}return value}
  function get(pointId,{allowExpired=false}={}){const item=data()[pointId];if(!item)return null;const expired=Date.now()>Number(item.expiresAt||0);return expired&&!allowExpired?null:{...item,expired}}
  function set(pointId,status,{note='',sourceUrl='',ttl=TTL}={}){if(!Object.prototype.hasOwnProperty.call(STATUSES,status))throw new Error('未知开放状态：'+status);const value=data();if(status==='unknown'){delete value[pointId];write(value);document.dispatchEvent(new CustomEvent('travel:availability-change',{detail:{pointId,status}}));return null}const checkedAt=new Date().toISOString(),item={pointId,status,note:String(note||'').trim(),sourceUrl:String(sourceUrl||''),checkedAt,expiresAt:Date.now()+Math.max(30*60*1000,Number(ttl)||TTL)};value[pointId]=item;write(value);document.dispatchEvent(new CustomEvent('travel:availability-change',{detail:item}));return item}
  function list({includeExpired=false}={}){return Object.keys(data()).map(id=>get(id,{allowExpired:true})).filter(item=>includeExpired||!item.expired).sort((a,b)=>String(b.checkedAt).localeCompare(String(a.checkedAt)))}
  function clear(pointId=null){if(!pointId){storage?.remove(KEY);try{localStorage.removeItem(KEY)}catch{}}else{const value=data();delete value[pointId];write(value)}document.dispatchEvent(new CustomEvent('travel:availability-change',{detail:{pointId,clear:true}}))}
  function label(pointId){const item=get(pointId);return item?STATUSES[item.status]:'待复核'}
  window.TravelAvailability=Object.freeze({KEY,SCHEMA,TTL,STATUSES,get,set,list,clear,label});
})();
