/* v2.5 occurrence-aware transport segment overrides. */
(function(){
  'use strict';
  const KEY='trip-segment-overrides-v2.5',SCHEMA=1,storage=window.TravelVersionedStorage;
  const MODES=Object.freeze({auto:'自动判断',walking:'步行',transit:'公交地铁',taxi:'打车/驾车',ferry:'轮渡',shuttle:'接驳/观光车',unmapped:'暂不统计'});
  function state(){const fallback={};return storage?storage.read(KEY,fallback,{schemaVersion:SCHEMA,migrate:value=>value&&typeof value==='object'?value:{}}).data:fallback}
  function write(data){if(storage)storage.write(KEY,data,{schemaVersion:SCHEMA});else try{localStorage.setItem(KEY,JSON.stringify(data))}catch{}return data}
  function key(day,index,a,b){return(window.TravelStore?.selectors?.segmentKey?.(day,index,a,b))||((day?.date||day)+':'+Number(index)+':'+(a?.id||a)+':'+(b?.id||b))}
  function get(day,index,a,b){return state()[key(day,index,a,b)]||'auto'}
  function set(day,index,a,b,mode){if(!Object.prototype.hasOwnProperty.call(MODES,mode))throw new Error('未知交通方式：'+mode);const data=state(),id=key(day,index,a,b);if(mode==='auto')delete data[id];else data[id]={mode,updatedAt:new Date().toISOString(),from:a?.id||a,to:b?.id||b,day:day?.date||day,index:Number(index)};write(data);document.dispatchEvent(new CustomEvent('travel:segment-change',{detail:{id,mode,day:day?.date||day,index}}));return mode}
  function mode(day,index,a,b){const value=get(day,index,a,b);return typeof value==='string'?value:value?.mode||'auto'}
  function list(day=null){const data=state(),prefix=day?(day?.date||day)+':':'';return Object.entries(data).filter(([id])=>!prefix||id.startsWith(prefix)).map(([id,value])=>({id,...(typeof value==='string'?{mode:value}:value)}))}
  function clearDay(day){const data=state(),prefix=(day?.date||day)+':';for(const id of Object.keys(data))if(id.startsWith(prefix))delete data[id];write(data);document.dispatchEvent(new CustomEvent('travel:segment-change',{detail:{day:day?.date||day,clear:true}}))}
  window.TravelSegmentOverrides=Object.freeze({KEY,SCHEMA,MODES,key,get,mode,set,list,clearDay});
})();
