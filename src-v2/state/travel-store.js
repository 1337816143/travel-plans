/* v2.5 observable application store and compatibility bridge. */
(function(){
  'use strict';
  const listeners=new Set(),history=[];
  const initial={
    selectedDay:typeof selectedDay==='string'?selectedDay:null,
    routeVisible:typeof routeVisible==='boolean'?routeVisible:true,
    recommendationMode:Boolean(typeof recommendationMode!=='undefined'&&recommendationMode),
    selectedPresetId:typeof selectedPresetId==='string'?selectedPresetId:'',
    mapEngine:typeof mapEngine==='string'?mapEngine:'leaflet',
    activeBasemap:typeof activeBasemap==='string'?activeBasemap:'osm',
    activeTab:'booking',panelCollapsed:false,assistantOpen:false,routeDrawerState:'collapsed',toolsDay:null
  };
  const current={...initial};let bridging=false;
  const clone=()=>({...current});
  function syncLegacy(patch){bridging=true;try{
    if('selectedDay'in patch)selectedDay=patch.selectedDay;
    if('routeVisible'in patch)routeVisible=Boolean(patch.routeVisible);
    if('recommendationMode'in patch)recommendationMode=Boolean(patch.recommendationMode);
    if('selectedPresetId'in patch)selectedPresetId=patch.selectedPresetId||'';
    if('mapEngine'in patch)mapEngine=patch.mapEngine;
    if('activeBasemap'in patch)activeBasemap=patch.activeBasemap;
  }finally{bridging=false}}
  function emit(change){for(const listener of listeners){try{listener(change)}catch(error){console.error('TravelStore subscriber failed',error)}}document.dispatchEvent(new CustomEvent('travel:state-change',{detail:change}))}
  function set(patch,meta={}){if(!patch||typeof patch!=='object')return clone();const changed={};for(const [key,value] of Object.entries(patch)){if(current[key]!==value){changed[key]={previous:current[key],value};current[key]=value}}if(!Object.keys(changed).length)return clone();syncLegacy(patch);const entry={at:new Date().toISOString(),source:meta.source||'unknown',changed,state:clone()};history.push(entry);if(history.length>80)history.shift();emit(entry);return entry.state}
  function dispatch(type,payload,meta={}){switch(type){
    case'SELECT_DAY':return set({selectedDay:payload||null,toolsDay:payload||current.toolsDay,routeVisible:true,recommendationMode:false},{...meta,source:meta.source||type});
    case'SHOW_ALL':return set({selectedDay:null,routeVisible:true,recommendationMode:false},{...meta,source:meta.source||type});
    case'CLEAR_ROUTES':return set({routeVisible:false},{...meta,source:meta.source||type});
    case'SELECT_PRESET':return set({selectedPresetId:payload||''},{...meta,source:meta.source||type});
    case'SET_TAB':return set({activeTab:payload||'booking'},{...meta,source:meta.source||type});
    case'SET_ENGINE':return set({mapEngine:payload?.engine||payload,activeBasemap:payload?.basemap||current.activeBasemap},{...meta,source:meta.source||type});
    case'SET_PANEL':return set({panelCollapsed:Boolean(payload)},{...meta,source:meta.source||type});
    case'SET_ASSISTANT':return set({assistantOpen:Boolean(payload)},{...meta,source:meta.source||type});
    case'SET_DRAWER':return set({routeDrawerState:payload||'collapsed'},{...meta,source:meta.source||type});
    case'SET_TOOLS_DAY':return set({toolsDay:payload||null},{...meta,source:meta.source||type});
    default:throw new Error('Unknown travel action: '+type)
  }}
  function subscribe(listener,{immediate=false}={}){listeners.add(listener);if(immediate)listener({at:new Date().toISOString(),source:'subscribe',changed:{},state:clone()});return()=>listeners.delete(listener)}
  const state={};for(const key of Object.keys(initial))Object.defineProperty(state,key,{enumerable:true,get:()=>current[key],set:value=>set({[key]:value},{source:'state-property'})});
  function schedule(date=current.selectedDay){return(SCHEDULES||[]).find(item=>item.date===date)||null}
  function routeEntries(day=schedule()){if(!day)return[];const seen=new Map(),points=routePoints(day);return points.map((point,index)=>{const occurrence=seen.get(point.id)||0;seen.set(point.id,occurrence+1);return{point,index,occurrence,key:day.date+':'+occurrence+':'+point.id,segmentKey:index?day.date+':'+(index-1)+':'+points[index-1].id+':'+point.id:null}})}
  function segmentKey(day,index,a,b){return(day?.date||day||'unknown')+':'+Number(index)+':'+(a?.id||a||'from')+':'+(b?.id||b||'to')}
  const selectors=Object.freeze({schedule,routeEntries,segmentKey,nextEntry:(day,statusReader)=>routeEntries(day).find(entry=>!['completed','skipped'].includes(statusReader?.(day.date,entry.point.id,entry.occurrence)||'pending'))||null});
  function showRouteCardFallback(day){const item=schedule(day);if(!item||typeof setDayRouteCard!=='function')return;const card=document.getElementById('dayRouteCard');if(!card?.classList.contains('show')||card.dataset.day!==day)setDayRouteCard(item)}
  function wrapGlobals(){
    if(typeof filterDay==='function'&&!filterDay.__store){const original=filterDay;filterDay=Object.assign(function(day){const result=original(day);set({selectedDay:day,toolsDay:day,routeVisible:true,recommendationMode:false},{source:'filterDay'});showRouteCardFallback(day);return result},{__store:true})}
    if(typeof showAll==='function'&&!showAll.__store){const original=showAll;showAll=Object.assign(function(){const result=original();dispatch('SHOW_ALL',null,{source:'showAll'});if(typeof setDayRouteCard==='function')setDayRouteCard(null);return result},{__store:true})}
    if(typeof clearRoutes==='function'&&!clearRoutes.__store){const original=clearRoutes;clearRoutes=Object.assign(function(){const result=original();dispatch('CLEAR_ROUTES',null,{source:'clearRoutes'});if(typeof setDayRouteCard==='function')setDayRouteCard(null);return result},{__store:true})}
    if(typeof activateTab==='function'&&!activateTab.__store){const original=activateTab;activateTab=Object.assign(function(tab,...rest){const result=original(tab,...rest);dispatch('SET_TAB',tab,{source:'activateTab'});return result},{__store:true})}
    if(typeof selectPresetDestination==='function'&&!selectPresetDestination.__store){const original=selectPresetDestination;selectPresetDestination=Object.assign(function(id,...rest){const result=original(id,...rest);dispatch('SELECT_PRESET',id,{source:'selectPresetDestination'});return result},{__store:true})}
    if(typeof setPanelCollapsed==='function'&&!setPanelCollapsed.__store){const original=setPanelCollapsed;setPanelCollapsed=Object.assign(function(collapsed,...rest){const result=original(collapsed,...rest);dispatch('SET_PANEL',collapsed,{source:'setPanelCollapsed'});return result},{__store:true})}
    if(typeof toggleAmapServicePanel==='function'&&!toggleAmapServicePanel.__store){const original=toggleAmapServicePanel;toggleAmapServicePanel=Object.assign(function(force,...rest){const result=original(force,...rest),panel=document.getElementById('amapServicePanel');dispatch('SET_ASSISTANT',Boolean(panel&&!panel.hidden),{source:'toggleAmapServicePanel'});return result},{__store:true})}
  }
  const previousAfterBootstrap=window.TravelV2?.afterBootstrap;if(window.TravelV2)window.TravelV2.afterBootstrap=function(){previousAfterBootstrap?.();wrapGlobals();set({panelCollapsed:Boolean(document.getElementById('panel')?.classList.contains('collapsed')),assistantOpen:Boolean(document.getElementById('amapServicePanel')&&!document.getElementById('amapServicePanel').hidden)},{source:'bootstrap-sync'})};
  window.TravelStore=Object.freeze({state,set,dispatch,subscribe,snapshot:clone,history:()=>history.slice(),selectors,wrapGlobals,showRouteCardFallback,get bridging(){return bridging}});
  window.TravelActions=Object.freeze({selectDay:day=>typeof filterDay==='function'?filterDay(day):dispatch('SELECT_DAY',day),showAll:()=>typeof showAll==='function'?showAll():dispatch('SHOW_ALL'),clearRoutes:()=>typeof clearRoutes==='function'?clearRoutes():dispatch('CLEAR_ROUTES'),setTab:tab=>typeof activateTab==='function'?activateTab(tab,true):dispatch('SET_TAB',tab)});
  if(window.TravelAppContext){window.TravelAppContext.store=window.TravelStore;window.TravelAppContext.selectors=selectors}
})();
