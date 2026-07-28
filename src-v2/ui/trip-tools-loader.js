/* v2.5 lazy loader for practical travel operations and data tools. */
(function(){
  'use strict';
  let promise=null,loaded=false;
  function assetUrl(){const root=location.pathname.includes('/versions/')?'../':'';return root+'assets/v2.5.0/lazy-tools.js?loader=2.5.0'}
  function initialize(){window.TravelTripOperations?.init?.();window.TravelCalendarExport?.mount?.();window.TravelLocalData?.render?.();loaded=true;document.documentElement.dataset.tripToolsLoaded='true';document.dispatchEvent(new CustomEvent('travel:tools-loaded'));return true}
  function load(){if(loaded)return Promise.resolve(true);if(promise)return promise;const root=document.getElementById('tripToolsRoot');if(root)root.innerHTML='<div class="section-note">正在按需加载下一站、轨迹、交通纠正、费用和健康检查……</div>';promise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=assetUrl();script.async=true;script.onload=()=>{try{initialize();resolve(true)}catch(error){reject(error)}};script.onerror=()=>reject(new Error('旅行工具模块加载失败'));document.head.appendChild(script)}).catch(error=>{if(root)root.innerHTML='<div class="alert warn"><b>旅行工具加载失败：</b>'+String(error.message||error)+'</div>';promise=null;throw error});return promise}
  document.addEventListener('click',event=>{if(event.target.closest('[data-tab="tools"]'))load().catch(()=>{})});
  window.TravelLazyTools={load,initialize,get loaded(){return loaded},assetUrl};
})();
