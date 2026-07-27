(function(){
  'use strict';
  const metrics={calls:0,success:0,errors:0,last:'尚未调用',operations:{}};
  let body;
  function finish(name,ok,error){metrics.calls++;metrics[ok?'success':'errors']++;metrics.last=`${new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})} · ${name}${ok?'成功':`失败：${error?.message||error||'未知错误'}`}`;const op=metrics.operations[name]||(metrics.operations[name]={calls:0,success:0,errors:0});op.calls++;op[ok?'success':'errors']++;render()}
  function wrap(name,fn,setter){if(typeof fn!=='function')return;setter(function(...args){let result;try{result=fn.apply(this,args)}catch(error){finish(name,false,error);throw error}if(result&&typeof result.then==='function')return result.then(value=>{finish(name,true);return value},error=>{finish(name,false,error);throw error});finish(name,true);return result})}
  function render(){if(!body)return;body.innerHTML=`<div class="service-diagnostic-stat"><b>${metrics.calls}</b><small>调用</small></div><div class="service-diagnostic-stat"><b>${metrics.success}</b><small>成功</small></div><div class="service-diagnostic-stat"><b>${metrics.errors}</b><small>失败</small></div><div class="service-diagnostic-last">${String(metrics.last).replace(/[&<>]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch]))}</div>`}
  function mount(){
    const routePane=document.querySelector('[data-amap-pane="route"]');if(routePane&&!document.getElementById('amapAutoFitRoute')){const label=document.createElement('label');label.className='amap-route-preference';label.innerHTML='<input type="checkbox" id="amapAutoFitRoute" checked> 规划路线后自动调整地图视野';routePane.querySelector('#amapRouteBtn')?.insertAdjacentElement('beforebegin',label)}
    const travelPane=document.querySelector('[data-amap-pane="travel"]');if(travelPane&&!document.getElementById('serviceDiagnostics')){const details=document.createElement('details');details.id='serviceDiagnostics';details.className='service-diagnostics';details.innerHTML='<summary>高德服务运行状态</summary><div class="service-diagnostics-body"></div>';travelPane.appendChild(details);body=details.querySelector('.service-diagnostics-body');render()}
  }
  try{wrap('地点搜索',amapSearchPlaces,fn=>amapSearchPlaces=fn)}catch{}
  try{wrap('周边搜索',amapNearbySearch,fn=>amapNearbySearch=fn)}catch{}
  try{wrap('天气',amapWeatherAtCenter,fn=>amapWeatherAtCenter=fn)}catch{}
  try{wrap('路况',amapTrafficAtCenter,fn=>amapTrafficAtCenter=fn)}catch{}
  try{wrap('路线规划',amapPlanRoute,fn=>amapPlanRoute=fn)}catch{}
  try{wrap('定位',amapLocate,fn=>amapLocate=fn)}catch{}
  const previousAfterBootstrap=window.TravelV2?.afterBootstrap;
  if(window.TravelV2)window.TravelV2.afterBootstrap=function(){previousAfterBootstrap?.();mount()};
  window.TravelServiceDiagnostics={metrics,render,mount};
})();
