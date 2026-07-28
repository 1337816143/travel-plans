/* v2.5 budget and actual expense ledger. */
(function(){
  'use strict';
  const KEY='trip-finance-v2.5',OLD='trip-taxi-budget-v2.3',SCHEMA=1,storage=window.TravelVersionedStorage;
  const CATEGORIES=['交通','住宿','门票','餐饮','租衣妆造','购物','其他'];
  function migrate(value){if(Array.isArray(value))return value.map(item=>({id:item.id||'legacy-'+Math.random().toString(36).slice(2),kind:'budget',category:'交通',amount:Number(item.amount)||0,label:item.label||'交通预算',date:item.date||null,payment:'待定',split:2,createdAt:item.createdAt||new Date().toISOString(),source:'v2.3迁移'}));return[]}
  function ensure(){if(storage&&localStorage.getItem(KEY)===null&&localStorage.getItem(OLD)!==null)storage.migrateLegacyKey(OLD,KEY,{schemaVersion:SCHEMA,migrate});return storage?storage.read(KEY,[],{schemaVersion:SCHEMA,migrate}).data:migrate([])}
  function save(entries){if(storage)storage.write(KEY,entries,{schemaVersion:SCHEMA});else try{localStorage.setItem(KEY,JSON.stringify(entries))}catch{}document.dispatchEvent(new CustomEvent('travel:finance-change',{detail:{entries}}));return entries}
  function list({day=null,kind=null}={}){return ensure().filter(item=>(!day||item.date===day)&&(!kind||item.kind===kind)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))}
  function add(entry){const amount=Number(entry.amount);if(!Number.isFinite(amount)||amount<=0)throw new Error('金额必须大于0');const item={id:entry.id||'money-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),kind:entry.kind==='actual'?'actual':'budget',category:CATEGORIES.includes(entry.category)?entry.category:'其他',amount:Math.round(amount*100)/100,label:String(entry.label||entry.category||'未命名支出').trim(),date:entry.date||null,payment:entry.payment||'待定',split:Math.max(1,Number(entry.split)||2),createdAt:entry.createdAt||new Date().toISOString(),source:entry.source||'手动记录'};save([...ensure(),item]);return item}
  function update(id,patch){const items=ensure(),index=items.findIndex(item=>item.id===id);if(index<0)return null;items[index]={...items[index],...patch,amount:patch.amount===undefined?items[index].amount:Math.round(Number(patch.amount)*100)/100,updatedAt:new Date().toISOString()};save(items);return items[index]}
  function remove(id){const items=ensure(),next=items.filter(item=>item.id!==id);save(next);return next.length!==items.length}
  function summary(day=null){const items=list({day}),sum=kind=>items.filter(item=>item.kind===kind).reduce((total,item)=>total+Number(item.amount||0),0),budget=sum('budget'),actual=sum('actual');return{budget,actual,remaining:budget-actual,perPersonActual:actual/2,count:items.length,items}}
  function clear(){storage?.remove(KEY);try{localStorage.removeItem(KEY)}catch{}document.dispatchEvent(new CustomEvent('travel:finance-change',{detail:{clear:true}}))}
  window.TravelFinance=Object.freeze({KEY,OLD,SCHEMA,CATEGORIES,list,add,update,remove,summary,clear});
})();
