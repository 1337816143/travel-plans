(function(){
  'use strict';
  let panel;
  const groups={
    booking:{label:'预约进度',keys:['qingdao-v107-booking-progress']},
    weather:{label:'天气快照',prefixes:['travel-plans-weather','travel-plans-reminders-v2.2']},
    basemap:{label:'底图偏好',keys:['qingdao-v107-basemap'],prefixes:['travel-plans-v2:basemap','travel-plans-v2:explicit-basemap']},
    drawer:{label:'抽屉状态',prefixes:['travel-plans-v2:route-drawer-state']},
    trip:{label:'站点状态与预算',keys:['trip-stop-status-v2.3','trip-taxi-budget-v2.3']}
  };
  function matching(group){const keys=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(group.keys?.includes(key)||group.prefixes?.some(prefix=>key.startsWith(prefix)))keys.push(key)}return keys}
  function bytes(keys){return keys.reduce((sum,key)=>sum+(localStorage.getItem(key)?.length||0),0)}
  async function cacheInfo(){if(!('caches'in window))return{keys:[],bytes:null};const keys=await caches.keys();return{keys:keys.filter(key=>key.startsWith('travel-plans')),bytes:null}}
  async function render(){panel=document.getElementById('localDataPanel');if(!panel)return;const cache=await cacheInfo();panel.innerHTML=`<div class="trip-tool-head"><b>本机数据管理</b><span>数据不会上传</span></div><div class="local-data-list">${Object.entries(groups).map(([id,group])=>{const keys=matching(group);return`<div class="local-data-row"><div><b>${group.label}</b><small>${keys.length} 项 · 约 ${bytes(keys)} 字符</small></div><button type="button" data-clear-local="${id}" ${keys.length?'':'disabled'}>清除</button></div>`}).join('')}<div class="local-data-row"><div><b>离线缓存</b><small>${cache.keys.length} 个缓存空间</small></div><button type="button" data-clear-local="cache" ${cache.keys.length?'':'disabled'}>删除</button></div></div><button type="button" class="danger-local-reset" id="resetAllLocalData">全部恢复默认</button><p class="section-note">清除操作只影响当前浏览器。v1.0.15 固定历史版本和仓库文件不会被删除。</p>`;panel.querySelectorAll('[data-clear-local]').forEach(button=>button.onclick=()=>clearGroup(button.dataset.clearLocal));panel.querySelector('#resetAllLocalData').onclick=resetAll}
  function clearKeys(keys){for(const key of keys)localStorage.removeItem(key)}
  async function clearGroup(id){
    if(id==='cache'){if(!confirm('删除当前浏览器保存的离线页面缓存？'))return;for(const key of (await cacheInfo()).keys)await caches.delete(key);await render();return}
    const group=groups[id];if(!group||!confirm(`清除“${group.label}”？`))return;clearKeys(matching(group));
    if(id==='booking'){try{bookingProgress={};refreshLinkedViews()}catch{}}
    if(id==='weather'){try{amapTripWeatherByDate={};amapTripWeatherReportTime='';renderDays();renderLegend()}catch{}}
    if(id==='drawer'){try{window.TravelRouteDrawer?.setState?.('collapsed')}catch{}}
    if(id==='trip')window.TravelTripOperations?.renderAll?.();
    await render();
  }
  async function resetAll(){if(!confirm('将预约进度、天气快照、底图偏好、路线抽屉、站点状态、交通预算和离线缓存全部恢复默认？'))return;const keep=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key)keep.push(key)}for(const key of keep)if(key.startsWith('travel-plans')||key.startsWith('qingdao-v107')||key.startsWith('trip-'))localStorage.removeItem(key);if('caches'in window)for(const key of await caches.keys())if(key.startsWith('travel-plans'))await caches.delete(key);location.reload()}
  const previousAfterBootstrap=window.TravelV2?.afterBootstrap;if(window.TravelV2)window.TravelV2.afterBootstrap=function(){previousAfterBootstrap?.();render()};
  window.TravelLocalData={render,matching,clearGroup,resetAll};
})();
