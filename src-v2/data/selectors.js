/* v2.5 pure data selectors without DOM or map dependencies. */
(function(){
  'use strict';
  const points=()=>Array.isArray(window.POINTS)?window.POINTS:(typeof POINTS!=='undefined'?POINTS:[]);
  const schedules=()=>Array.isArray(window.SCHEDULES)?window.SCHEDULES:(typeof SCHEDULES!=='undefined'?SCHEDULES:[]);
  function pointByIdPure(id){return points().find(point=>point.id===id)||null}
  function scheduleByDate(date){return schedules().find(day=>day.date===date)||null}
  function routePointsPure(day){const schedule=typeof day==='string'?scheduleByDate(day):day;return(schedule?.route||[]).map(pointByIdPure).filter(Boolean)}
  function visiblePointsPure(day=null,state=window.TravelStore?.state||{}){if(state.recommendationMode)return points().filter(point=>(typeof RECOMMENDED!=='undefined'?RECOMMENDED:[]).includes(point.id));if(day)return points().filter(point=>(point.days||[]).includes(day)||['酒店','住宿区域'].includes(point.category));return points().filter(point=>point.category!=='推荐')}
  function routeOrderMapPure(day){const schedule=typeof day==='string'?scheduleByDate(day):day,map=new Map();for(const [index,id] of (schedule?.route||[]).entries()){if(!map.has(id))map.set(id,[]);map.get(id).push(index+1)}return map}
  function routeEntriesPure(day){const schedule=typeof day==='string'?scheduleByDate(day):day,seen=new Map();return routePointsPure(schedule).map((point,index)=>{const occurrence=seen.get(point.id)||0;seen.set(point.id,occurrence+1);return{point,index,occurrence,key:schedule.date+':'+occurrence+':'+point.id}})}
  window.TravelSelectors=Object.freeze({points,schedules,pointById:pointByIdPure,scheduleByDate,routePoints:routePointsPure,visiblePoints:visiblePointsPure,routeOrderMap:routeOrderMapPure,routeEntries:routeEntriesPure});
})();
