(function(){
  'use strict';
  let mask,timer=0;
  function ensureMask(){
    if(mask)return mask;
    const wrap=document.querySelector('.map-wrap');if(!wrap)return null;
    mask=document.createElement('div');mask.id='mapLoadingMask';mask.className='map-loading-mask';mask.innerHTML='<div class="map-loading-card"><span class="map-loading-spinner" aria-hidden="true"></span><div><b>正在加载高德地图与实时路况…</b><small>加载失败时将自动显示备用底图</small></div></div>';
    wrap.appendChild(mask);return mask;
  }
  function show(message='正在加载高德地图与实时路况…'){
    const node=ensureMask();if(!node)return;node.hidden=false;node.classList.remove('failed');const text=node.querySelector('b');if(text)text.textContent=message;clearTimeout(timer);
  }
  function hide(){if(!mask)return;mask.classList.add('leaving');setTimeout(()=>{if(mask){mask.hidden=true;mask.classList.remove('leaving')}},180)}
  function fallback(error){const node=ensureMask();if(!node)return;node.classList.add('failed');const text=node.querySelector('b'),small=node.querySelector('small');if(text)text.textContent='高德地图暂时不可用，已显示备用底图';if(small)small.textContent=error?.message||'可以稍后通过底图菜单再次切换';timer=setTimeout(hide,1600)}

  ensureMask();show();
  const originalSwitchToAmap=switchToAmap;
  switchToAmap=function(options={}){
    show();
    return Promise.resolve(originalSwitchToAmap(options)).then(instance=>{hide();return instance}).catch(error=>{fallback(error);throw error});
  };
  const originalSwitchLeafletBasemap=switchLeafletBasemap;
  switchLeafletBasemap=function(id){const result=originalSwitchLeafletBasemap(id);const preferred=window.TravelLayoutV201?.preferredAtStartup||'amap';if(preferred!=='amap'||mapEngine==='leaflet'&&id!=='osm')hide();return result};

  const previousAfterBootstrap=window.TravelV2?.afterBootstrap;
  if(window.TravelV2)window.TravelV2.afterBootstrap=function(){
    previousAfterBootstrap?.();
    const preferred=window.TravelLayoutV201?.preferredAtStartup||'amap';
    if(preferred!=='amap'){hide();return}
    show();let attempts=0;
    const poll=setInterval(()=>{attempts++;if(typeof mapEngine!=='undefined'&&mapEngine==='amap'&&typeof amapInstance!=='undefined'&&amapInstance){clearInterval(poll);hide()}else if(attempts>40){clearInterval(poll);fallback(new Error('高德地图加载超时'))}},250);
  };
  window.TravelAmapStartup={show,hide,fallback};
})();