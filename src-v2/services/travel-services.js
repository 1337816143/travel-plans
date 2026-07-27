(function(){
  'use strict';
  function call(name,args=[]){
    try{
      const fn=globalThis[name];
      if(typeof fn!=='function')return Promise.reject(new Error(name+' service unavailable'));
      return Promise.resolve(fn(...args));
    }catch(error){return Promise.reject(error)}
  }
  window.TravelServices={
    weather:force=>call('loadTripWeather',[Boolean(force)]),
    traffic:()=>call('amapTrafficAtCenter'),
    search:()=>call('amapSearchPlaces'),
    route:()=>call('amapPlanRoute'),
    locate:()=>call('amapLocate')
  };
})();