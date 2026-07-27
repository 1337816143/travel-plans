(function(){
  'use strict';
  function points(){try{return typeof POINTS!=='undefined'?POINTS:[]}catch{return[]}}
  function schedules(){try{return typeof SCHEDULES!=='undefined'?SCHEDULES:[]}catch{return[]}}
  function point(id){try{return typeof pointById==='function'?pointById(id):points().find(item=>item.id===id)}catch{return null}}
  function day(date){return schedules().find(item=>item.date===date)||null}
  function snapshot(){return{points:points(),schedules:schedules(),selectedDay:typeof selectedDay!=='undefined'?selectedDay:null}}
  window.TravelData={points,schedules,point,day,snapshot};
})();