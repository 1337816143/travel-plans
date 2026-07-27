(function(){
  'use strict';
  let registration=null,reloading=false,banner=null;
  function ensureBanner(){
    if(banner)return banner;
    banner=document.createElement('aside');banner.id='versionUpdateBanner';banner.className='version-update-banner';banner.hidden=true;banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
    banner.innerHTML='<div><b>检测到新版本</b><small>刷新后即可使用最新功能，当前操作不会上传。</small></div><button type="button" id="versionUpdateRefresh">点击刷新</button><button type="button" id="versionUpdateDismiss" aria-label="暂时关闭更新提示">×</button>';
    document.body.appendChild(banner);
    banner.querySelector('#versionUpdateRefresh').onclick=activate;
    banner.querySelector('#versionUpdateDismiss').onclick=()=>{banner.hidden=true};
    return banner;
  }
  function show(){ensureBanner().hidden=false;window.TravelFloatingLayers?.set('update',true)}
  function hide(){if(banner)banner.hidden=true;window.TravelFloatingLayers?.set('update',false)}
  function activate(){
    const worker=registration?.waiting||registration?.installing;
    if(worker)worker.postMessage({type:'SKIP_WAITING'});else location.reload();
    setTimeout(()=>{if(!reloading)location.reload()},1800);
  }
  async function init(){
    ensureBanner();
    if(!('serviceWorker'in navigator)||location.protocol!=='https:')return;
    try{
      registration=await navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'});
      if(registration.waiting&&navigator.serviceWorker.controller)show();
      registration.addEventListener('updatefound',()=>{
        const worker=registration.installing;if(!worker)return;
        worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)show()});
      });
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;hide();location.reload()});
      registration.update().catch(()=>{});
    }catch(error){console.warn('Service Worker registration failed',error)}
  }
  const previousAfterBootstrap=window.TravelV2?.afterBootstrap;
  if(window.TravelV2)window.TravelV2.afterBootstrap=function(){previousAfterBootstrap?.();init()};
  window.TravelVersionUpdate={init,show,hide,activate,get registration(){return registration}};
})();