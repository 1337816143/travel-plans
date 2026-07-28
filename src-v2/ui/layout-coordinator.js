/* v2.5 layout coordinator for panel, assistant, route drawer and notices. */
(function(){
  'use strict';
  const layers=window.TravelFloatingLayers,store=window.TravelStore;let guard=false,lastAssistantTrigger=null;
  const mobile=()=>layers?.mobile?.()??matchMedia('(max-width:800px), (pointer:coarse) and (max-height:600px)').matches;
  function closePanel(){if(document.getElementById('panel')?.classList.contains('open'))setPanelCollapsed(true)}
  function closeAssistant(){const panel=document.getElementById('amapServicePanel');if(panel&&!panel.hidden)toggleAmapServicePanel(false)}
  function collapseDrawer(){if(window.TravelRouteDrawer&&['half','full'].includes(TravelRouteDrawer.state))TravelRouteDrawer.setState('collapsed')}
  function coordinate(event){if(guard||!mobile()||!event?.open)return;guard=true;try{
    if(event.name==='panel'){closeAssistant();collapseDrawer()}
    if(event.name==='assistant'){closePanel();collapseDrawer()}
    if(event.name==='drawer'){closePanel();closeAssistant()}
  }finally{queueMicrotask(()=>{guard=false})}}
  function measure(){const root=document.documentElement,panel=document.getElementById('panel'),assistant=document.getElementById('amapServicePanel'),base=document.querySelector('.basemap-control'),notice=document.getElementById('mapNotice');const desktop=!mobile(),panelRect=panel?.getBoundingClientRect(),assistantRect=assistant?.getBoundingClientRect();root.style.setProperty('--v25-panel-width',desktop&&panelRect&&panelRect.right>0?panelRect.width+'px':'0px');root.style.setProperty('--v25-assistant-width',desktop&&assistant&&!assistant.hidden&&assistantRect?assistantRect.width+'px':'0px');root.style.setProperty('--v25-control-height',base?.getBoundingClientRect().height?base.getBoundingClientRect().height+'px':'48px');root.style.setProperty('--v25-notice-height',notice?.classList.contains('show')?notice.getBoundingClientRect().height+'px':'0px');root.classList.toggle('v25-assistant-visible',Boolean(assistant&&!assistant.hidden));root.classList.toggle('v25-panel-visible',Boolean(panelRect&&panelRect.right>0));window.TravelMapAdapters?.resize?.()}
  function scheduleMeasure(){cancelAnimationFrame(scheduleMeasure.frame);scheduleMeasure.frame=requestAnimationFrame(measure)}
  function bind(){
    layers?.subscribe?.(event=>{coordinate(event);scheduleMeasure()});
    store?.subscribe?.(change=>{if(change.changed.panelCollapsed||change.changed.assistantOpen||change.changed.routeDrawerState)scheduleMeasure()});
    const assistantButton=document.getElementById('amapConfigBtn');assistantButton?.addEventListener('click',()=>{lastAssistantTrigger=assistantButton});
    document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const assistant=document.getElementById('amapServicePanel'),panel=document.getElementById('panel');if(assistant&&!assistant.hidden){toggleAmapServicePanel(false);lastAssistantTrigger?.focus?.();event.preventDefault();return}if(mobile()&&panel?.classList.contains('open')){setPanelCollapsed(true);document.getElementById('menuBtn')?.focus();event.preventDefault();return}if(mobile()&&window.TravelRouteDrawer&&TravelRouteDrawer.state!=='hidden'){TravelRouteDrawer.setState('hidden');event.preventDefault()}});
    const observer=new MutationObserver(scheduleMeasure);for(const target of [document.getElementById('panel'),document.getElementById('amapServicePanel'),document.getElementById('mapNotice'),document.getElementById('dayRouteCard'),document.getElementById('legend')])if(target)observer.observe(target,{attributes:true,childList:true,subtree:false,attributeFilter:['class','hidden','style']});
    window.addEventListener('resize',scheduleMeasure,{passive:true});window.visualViewport?.addEventListener('resize',scheduleMeasure,{passive:true});scheduleMeasure()
  }
  const previousAfterBootstrap=window.TravelV2?.afterBootstrap;if(window.TravelV2)window.TravelV2.afterBootstrap=function(){previousAfterBootstrap?.();bind()};
  window.TravelLayoutCoordinator=Object.freeze({measure,scheduleMeasure,coordinate,mobile,closePanel,closeAssistant,collapseDrawer});
})();
