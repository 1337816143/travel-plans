(function(){
  'use strict';

  const core=window.TravelCore;
  const BASEMAP_PREFERENCE_KEY='travel-plans-basemap-preference-v2';
  const VALID_BASEMAPS=new Set(['amap','osm','carto-light','carto-voyager','carto-dark','opentopo','hot']);

  function readPreferredBasemap(){
    try{
      const stored=localStorage.getItem(BASEMAP_PREFERENCE_KEY);
      return VALID_BASEMAPS.has(stored)?stored:null;
    }catch{return null}
  }
  function writePreferredBasemap(id){
    if(!VALID_BASEMAPS.has(id))return;
    try{localStorage.setItem(BASEMAP_PREFERENCE_KEY,id)}catch{}
  }

  // v2.0.1 migration: older mobile sessions inherited the former OSM default.
  // A fresh v2 preference therefore starts from AMap; later manual choices remain respected.
  const preferredAtStartup=readPreferredBasemap()||'amap';
  try{saveJSON(BASEMAP_KEY,{id:preferredAtStartup})}catch{}

  const originalSwitchBasemap=switchBasemap;
  switchBasemap=function(id,options={}){
    const manual=options?.manual!==false;
    if(manual)writePreferredBasemap(id);
    return originalSwitchBasemap(id,options);
  };

  let layoutRaf=0;
  function rect(node){return node?.getBoundingClientRect?.()||null}
  function scheduleFloatingLayout(){
    cancelAnimationFrame(layoutRaf);
    layoutRaf=requestAnimationFrame(layoutFloatingUi);
  }
  function layoutFloatingUi(){
    const wrap=document.querySelector('.map-wrap');
    const card=document.getElementById('dayRouteCard');
    if(!wrap||!card)return;
    const wrapRect=rect(wrap),controlsRect=rect(document.querySelector('.basemap-control')),menuRect=rect(document.getElementById('menuBtn'));
    const mobile=innerWidth<=800;
    if(mobile){
      const controlBottom=Math.max(controlsRect?.bottom||0,menuRect?.bottom||0);
      const top=Math.max(88,Math.round(controlBottom-wrapRect.top+10));
      card.style.setProperty('--day-route-top',top+'px');
      card.style.removeProperty('--day-route-right');
      card.style.removeProperty('--day-route-left');
    }else{
      const reservedRight=controlsRect?Math.max(16,Math.round(wrapRect.right-controlsRect.left+12)):16;
      card.style.setProperty('--day-route-left','16px');
      card.style.setProperty('--day-route-right',reservedRight+'px');
      card.style.setProperty('--day-route-top','14px');
    }
  }

  const originalSetDayRouteCard=setDayRouteCard;
  setDayRouteCard=function(day){
    const result=originalSetDayRouteCard(day);
    const card=document.getElementById('dayRouteCard');
    document.querySelector('.map-wrap')?.classList.toggle('route-card-open',Boolean(day));
    if(day&&innerWidth<=800){
      const legend=document.getElementById('legend');
      if(legend&&!legend.classList.contains('collapsed')){
        try{saveJSON(LEGEND_STATE_KEY,{collapsed:true});renderLegend(day.date)}catch{}
      }
    }
    if(card){
      card.scrollLeft=0;
      card.scrollTop=0;
    }
    scheduleFloatingLayout();
    return result;
  };

  const originalRenderLegend=renderLegend;
  renderLegend=function(date){
    const result=originalRenderLegend(date);
    scheduleFloatingLayout();
    return result;
  };

  const originalToggleAmapServicePanel=toggleAmapServicePanel;
  toggleAmapServicePanel=function(force){
    const result=originalToggleAmapServicePanel(force);
    scheduleFloatingLayout();
    return result;
  };

  const originalSetPanelCollapsed=setPanelCollapsed;
  setPanelCollapsed=function(collapsed){
    const result=originalSetPanelCollapsed(collapsed);
    const open=innerWidth<=800&&!collapsed;
    document.querySelector('.app')?.classList.toggle('mobile-panel-open',open);
    scheduleFloatingLayout();
    return result;
  };

  const priorAfterBootstrap=window.TravelV2?.afterBootstrap;
  if(window.TravelV2){
    window.TravelV2.afterBootstrap=function(){
      priorAfterBootstrap?.();
      scheduleFloatingLayout();
      window.addEventListener('resize',scheduleFloatingLayout,{passive:true});
      window.visualViewport?.addEventListener('resize',scheduleFloatingLayout,{passive:true});
      window.visualViewport?.addEventListener('scroll',scheduleFloatingLayout,{passive:true});
      if(typeof ResizeObserver==='function'){
        const observer=new ResizeObserver(scheduleFloatingLayout);
        ['.basemap-control','#menuBtn','#dayRouteCard','#legend'].forEach(selector=>{const node=document.querySelector(selector);if(node)observer.observe(node)});
      }
      const selector=document.getElementById('basemapSelect');
      if(selector)selector.value=preferredAtStartup;
      core?.announce?.('默认使用高德地图并显示实时路况');
    };
  }

  window.TravelLayoutV201={layoutFloatingUi,scheduleFloatingLayout,preferredAtStartup};
})();
