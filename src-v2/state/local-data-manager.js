/* v2.5 local data inventory, export/import and reset controls. */
(function(){
  'use strict';
  let panel;
  const storage=window.TravelVersionedStorage;
  const groups={
    booking:{label:'预约进度',keys:['qingdao-v107-booking-progress']},
    weather:{label:'天气快照',prefixes:['travel-plans-weather']},
    reminders:{label:'出发提醒状态',keys:['travel-plans-reminders-v2.2']},
    preferences:{label:'界面与功能偏好',prefixes:['travel-plans-v2:']},
    map:{label:'底图与抽屉状态',keys:['qingdao-v107-basemap'],prefixes:['travel-plans-v2:basemap','travel-plans-v2:explicit-basemap','travel-plans-v2:route-drawer-state']},
    progress:{label:'站点、交通段与操作记录',keys:['trip-stop-status-v2.5','trip-segment-overrides-v2.5','trip-operation-log-v2.5','trip-risk-metrics-v2.5']},
    finance:{label:'预算与实际支出',keys:['trip-finance-v2.5','trip-taxi-budget-v2.3']}
  };
  function matching(group){return storage?.keys({exact:group.keys||[],prefixes:group.prefixes||[]})||[]}
  function bytes(keys){return keys.reduce((sum,key)=>sum+(localStorage.getItem(key)?.length||0),0)}
  function schemaInfo(keys){const versions=new Set();for(const key of keys){try{const value=JSON.parse(localStorage.getItem(key));if(storage?.isEnvelope(value))versions.add('v'+value.schemaVersion);else versions.add('legacy')}catch{versions.add('invalid')}}return[...versions].join(' / ')||'--'}
  async function cacheInfo(){if(!('caches'in window))return{keys:[],bytes:null};const keys=await caches.keys();return{keys:keys.filter(key=>key.startsWith('travel-plans')),bytes:null}}
  async function trackInfo(){try{const tracks=await TravelTrackStore.list();return{count:tracks.length,points:tracks.reduce((sum,item)=>sum+(item.points?.length||0),0)}}catch{return{count:0,points:0}}}
  async function render(){panel=document.getElementById('localDataPanel');if(!panel)return;const cache=await cacheInfo(),tracks=await trackInfo();panel.innerHTML=`<div class="trip-tool-head"><b>本机数据管理</b><span>数据不会上传</span></div><div class="local-data-list">${Object.entries(groups).map(([id,group])=>{const keys=matching(group);return`<div class="local-data-row"><div><b>${group.label}</b><small>${keys.length}项 · 约${bytes(keys)}字符 · ${schemaInfo(keys)}</small></div><button type="button" data-clear-local="${id}" ${keys.length?'':'disabled'}>清除</button></div>`}).join('')}<div class="local-data-row"><div><b>GPX轨迹</b><small>${tracks.count}天 · ${tracks.points}个轨迹点 · IndexedDB优先</small></div><button type="button" data-clear-local="tracks" ${tracks.count?'':'disabled'}>删除</button></div><div class="local-data-row"><div><b>离线缓存</b><small>${cache.keys.length}个缓存空间</small></div><button type="button" data-clear-local="cache" ${cache.keys.length?'':'disabled'}>删除</button></div></div><div class="local-transfer-actions"><button type="button" id="exportLocalData">导出本机状态</button><label>导入状态文件<input type="file" id="importLocalData" accept="application/json,.json"></label></div><div id="localTransferStatus"></div><button type="button" class="danger-local-reset" id="resetAllLocalData">全部恢复默认</button><p class="section-note">导出文件包含当前浏览器中的旅行状态和GPX轨迹，方便两台设备之间手动同步。导入前会验证格式；不会覆盖仓库或固定历史版本。</p>`;panel.querySelectorAll('[data-clear-local]').forEach(button=>button.onclick=()=>clearGroup(button.dataset.clearLocal));panel.querySelector('#resetAllLocalData').onclick=resetAll;panel.querySelector('#exportLocalData').onclick=exportAll;panel.querySelector('#importLocalData').onchange=event=>importAll(event.target.files?.[0])}
  function clearKeys(keys){for(const key of keys)localStorage.removeItem(key)}
  async function clearGroup(id){
    if(id==='cache'){if(!confirm('删除当前浏览器保存的离线页面缓存？'))return;for(const key of (await cacheInfo()).keys)await caches.delete(key);await render();return}
    if(id==='tracks'){if(!confirm('删除当前浏览器保存的全部GPX轨迹？'))return;await TravelTrackStore.clear();TravelRiskMetrics?.clear?.();await render();TravelTripOperations?.renderAll?.();return}
    const group=groups[id];if(!group||!confirm(`清除“${group.label}”？`))return;clearKeys(matching(group));
    if(id==='booking'){try{bookingProgress={};refreshLinkedViews()}catch{}}
    if(id==='weather'){try{amapTripWeatherByDate={};amapTripWeatherReportTime='';renderDays();renderLegend()}catch{}}
    if(id==='reminders')window.TravelReminders?.refresh?.();
    if(id==='map'){try{window.TravelRouteDrawer?.setState?.('collapsed')}catch{}}
    if(['progress','finance','preferences'].includes(id))window.TravelTripOperations?.renderAll?.();
    await render()
  }
  async function exportAll(){const status=panel.querySelector('#localTransferStatus');status.textContent='正在整理本机数据…';try{const payload=storage.exportEntries(),tracks=await TravelTrackStore.list();payload.tracks=tracks;payload.appVersion=APP_VERSION;payload.note='仅包含本机旅行状态，不包含任何账户或云端数据';TravelTripOperations.downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'}),'青岛旅行计划-本机状态-'+new Date().toISOString().slice(0,10)+'.json');status.textContent='已导出 '+Object.keys(payload.entries).length+' 项本机数据和 '+tracks.length+' 天轨迹'}catch(error){status.textContent='导出失败：'+error.message}}
  async function importAll(file){const status=panel.querySelector('#localTransferStatus');if(!file)return;status.textContent='正在验证导入文件…';try{const payload=storage.validateImport(JSON.parse(await file.text()));if(!confirm('导入将合并同名状态；导入后页面会重新加载。继续吗？')){status.textContent='已取消导入';return}const written=storage.importEntries(payload);for(const track of payload.tracks||[])if(track?.day&&track?.points?.length>=2)await TravelTrackStore.save(track.day,track.points,track);status.textContent='已导入 '+written.length+' 项状态和 '+(payload.tracks?.length||0)+' 天轨迹，正在重新加载…';setTimeout(()=>location.reload(),450)}catch(error){status.textContent='导入失败：'+error.message}}
  async function resetAll(){if(!confirm('将预约进度、天气快照、提醒、偏好、站点状态、交通校正、轨迹、费用和离线缓存全部恢复默认？'))return;const keep=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key)keep.push(key)}for(const key of keep)if(key.startsWith('travel-plans')||key.startsWith('qingdao-v107')||key.startsWith('trip-'))localStorage.removeItem(key);await TravelTrackStore.clear();if('caches'in window)for(const key of await caches.keys())if(key.startsWith('travel-plans'))await caches.delete(key);location.reload()}
  const previousAfterBootstrap=window.TravelV2?.afterBootstrap;if(window.TravelV2)window.TravelV2.afterBootstrap=function(){previousAfterBootstrap?.();render()};
  window.TravelLocalData={render,matching,clearGroup,resetAll,exportAll,importAll};
})();
