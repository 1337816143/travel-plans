/* v2.4 unified service result facade. */
(function(){
  const R=window.TravelServiceResult,raw={},installed={};
  function wrap(name,source,fn,meta={}){raw[name]=fn;return async function(...args){const started=new Date().toISOString();try{const data=await fn.apply(this,args);if(R.isResult(data))return data;return R.success(data,{source,cached:typeof meta.cached==='function'?meta.cached(args,data):Boolean(meta.cached),at:meta.reportedAt?.(data)||started})}catch(error){return R.failure(error,{source,cached:false,at:started})}}}
  function install(name,source,getter,setter,meta){const fn=getter();if(typeof fn!=='function')return null;const wrapped=wrap(name,source,fn,meta);setter(wrapped);installed[name]=wrapped;return wrapped}
  try{install('weather','高德天气',()=>amapWeatherAtCenter,fn=>amapWeatherAtCenter=fn,{reportedAt:()=>amapTripWeatherReportTime||new Date().toISOString()})}catch{}
  try{install('traffic','高德实时路况',()=>amapTrafficAtCenter,fn=>amapTrafficAtCenter=fn)}catch{}
  try{install('search','高德地点搜索',()=>amapSearchPlaces,fn=>amapSearchPlaces=fn)}catch{}
  try{install('nearby','高德周边搜索',()=>amapNearbySearch,fn=>amapNearbySearch=fn)}catch{}
  try{install('location','高德定位 / IP回退',()=>amapLocate,fn=>amapLocate=fn)}catch{}
  try{install('route','高德路线规划',()=>amapPlanRoute,fn=>amapPlanRoute=fn)}catch{}
  window.TravelServiceFacade={invoke:(name,...args)=>installed[name]?installed[name](...args):Promise.resolve(R.failure(new Error('服务未安装：'+name),{source:name})),raw:Object.freeze(raw),services:()=>Object.keys(installed),snapshot:()=>({services:Object.keys(installed),shape:['ok','data','error','source','cached','reportedAt']})};
})();
/* v2.4 wrapped controller bridge */
if(window.TravelAmapAssistantController&&installed.route)window.TravelAmapAssistantController=Object.freeze({...window.TravelAmapAssistantController,planRoute:installed.route});
