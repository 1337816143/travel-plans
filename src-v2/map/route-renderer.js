/* v2.3 shared route model helpers. */
(function(){
  'use strict';
  function points(schedule){return(schedule?.route||[]).map(pointById).filter(Boolean)}
  function order(schedule){const result=new Map();(schedule?.route||[]).forEach((id,index)=>{if(!result.has(id))result.set(id,[]);result.get(id).push(index+1)});return result}
  function segments(schedule){const list=points(schedule);return list.slice(0,-1).map((from,index)=>{const to=list[index+1];return{from,to,rotation:bearingRotation(from,to),distance:typeof map!=='undefined'&&map?.distance?map.distance([from.lat,from.lng],[to.lat,to.lng]):null}})}
  function model(schedule){return{schedule,points:points(schedule),order:order(schedule),segments:segments(schedule),render:window.TravelRenderModel?.route?.(schedule)}}
  window.TravelRouteRenderer={points,order,segments,model};
})();
