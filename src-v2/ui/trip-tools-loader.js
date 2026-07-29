/* v2.5.2 lazy loader for organized travel operations, complete wishlist and data tools. First load must render and group populated controls before reporting readiness. */
(function(){
  'use strict';
  let promise=null,loaded=false;
  function assetUrl(){const root=location.pathname.includes('/versions/')?'../':'';return root+'assets/v2.5.2/lazy-tools.js?loader=2.5.2'}
  function initialize(){window.TravelTripOperations?.init?.();window.TravelTripOperations?.renderAll?.();window.TravelGirlfriendWishlist?.render?.();window.TravelTripToolsLayout?.apply?.();window.TravelCalendarExport?.mount?.();window.TravelLocalData?.render?.();window.TravelTripToolsLayout?.update?.();loaded=true;document.documentElement.dataset.tripToolsLoaded='true';document.dispatchEvent(new CustomEvent('travel:tools-loaded'));return true}
  function load(){if(loaded)return Promise.resolve(true);if(promise)return promise;const root=document.getElementById('tripToolsRoot');if(root)root.innerHTML='<div class="section-note">正在按类别加载当天执行、愿望清单、路线风险、预算提醒和本机数据……</div>';promise=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=assetUrl();script.async=true;script.onload=()=>{try{initialize();resolve(true)}catch(error){reject(error)}};script.onerror=()=>reject(new Error('旅行工具模块加载失败'));document.head.appendChild(script)}).catch(error=>{if(root)root.innerHTML='<div class="alert warn"><b>旅行工具加载失败：</b>'+String(error.message||error)+'</div>';promise=null;throw error});return promise}
  document.addEventListener('click',event=>{if(event.target.closest('[data-tab="tools"]'))load().catch(()=>{})});
  window.TravelLazyTools={load,initialize,get loaded(){return loaded},assetUrl};
})();
