/* v2.5 versioned local persistence with transparent legacy migration. */
(function(){
  'use strict';
  const DEFAULT_SCHEMA=1;
  const now=()=>new Date().toISOString();
  function envelope(data,schemaVersion=DEFAULT_SCHEMA,meta={}){return{schemaVersion,updatedAt:meta.updatedAt||now(),data}}
  function isEnvelope(value){return Boolean(value&&typeof value==='object'&&Number.isFinite(Number(value.schemaVersion))&&Object.prototype.hasOwnProperty.call(value,'data'))}
  function parse(raw,fallback){if(raw===null||raw===undefined)return fallback;try{return JSON.parse(raw)}catch{return fallback}}
  function read(key,fallback=null,{schemaVersion=DEFAULT_SCHEMA,migrate}={}){
    let value=parse(localStorage.getItem(key),fallback),changed=false;
    if(!isEnvelope(value)){value=envelope(typeof migrate==='function'?migrate(value):value,schemaVersion);changed=true}
    if(Number(value.schemaVersion)!==Number(schemaVersion)&&typeof migrate==='function'){
      value=envelope(migrate(value.data,Number(value.schemaVersion)),schemaVersion);changed=true
    }
    if(changed)writeEnvelope(key,value);
    return value
  }
  function writeEnvelope(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
  function write(key,data,{schemaVersion=DEFAULT_SCHEMA,updatedAt}={}){const value=envelope(data,schemaVersion,{updatedAt});writeEnvelope(key,value);return value}
  function remove(key){try{localStorage.removeItem(key)}catch{}}
  function keys({prefixes=[],exact=[]}={}){const found=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key&&(exact.includes(key)||prefixes.some(prefix=>key.startsWith(prefix))))found.push(key)}return found.sort()}
  function exportEntries(filter={prefixes:['travel-plans','qingdao-v107','trip-']}){const output={format:'travel-plans-local-data',schemaVersion:1,exportedAt:now(),entries:{}};for(const key of keys(filter))output.entries[key]=parse(localStorage.getItem(key),null);return output}
  function validateImport(payload){if(!payload||payload.format!=='travel-plans-local-data'||typeof payload.entries!=='object'||Array.isArray(payload.entries))throw new Error('不是有效的旅行计划数据文件');return payload}
  function importEntries(payload,{replace=false}={}){const value=validateImport(payload),written=[];if(replace){for(const key of keys({prefixes:['travel-plans','qingdao-v107','trip-']}))remove(key)}for(const [key,data] of Object.entries(value.entries)){if(!/^(travel-plans|qingdao-v107|trip-)/.test(key))continue;try{localStorage.setItem(key,JSON.stringify(data));written.push(key)}catch{}}return written}
  function migrateLegacyKey(oldKey,newKey,{schemaVersion=DEFAULT_SCHEMA,migrate=value=>value,removeOld=false}={}){if(localStorage.getItem(newKey)!==null)return read(newKey,null,{schemaVersion,migrate});const raw=localStorage.getItem(oldKey);if(raw===null)return null;const value=parse(raw,null),result=write(newKey,migrate(isEnvelope(value)?value.data:value),{schemaVersion});if(removeOld)remove(oldKey);return result}
  window.TravelVersionedStorage=Object.freeze({DEFAULT_SCHEMA,envelope,isEnvelope,read,write,remove,keys,exportEntries,validateImport,importEntries,migrateLegacyKey});
})();
