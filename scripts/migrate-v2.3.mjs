import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const LEGACY=path.join(ROOT,'src-v2/app/legacy-app.js');
const REPORT=path.join(ROOT,'MIGRATION_V2.3.json');
function write(file,content){const target=path.join(ROOT,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content)}

function scanFunctions(source){
  const out=[];let i=0,depth=0,quote='',escape=false,lineComment=false,blockComment=false;
  while(i<source.length){
    const ch=source[i],next=source[i+1];
    if(lineComment){if(ch==='\n')lineComment=false;i++;continue}
    if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i+=2}else i++;continue}
    if(quote){if(escape){escape=false;i++;continue}if(ch==='\\'){escape=true;i++;continue}if(ch===quote){quote='';i++;continue}i++;continue}
    if(ch==='/'&&next==='/'){lineComment=true;i+=2;continue}
    if(ch==='/'&&next==='*'){blockComment=true;i+=2;continue}
    if(ch==='"'||ch==="'"||ch==='`'){quote=ch;i++;continue}
    if(ch==='{'){depth++;i++;continue}
    if(ch==='}'){depth=Math.max(0,depth-1);i++;continue}
    if(depth===0&&source.startsWith('function',i)&&!/[$\w]/.test(source[i-1]||'')&&!/[$\w]/.test(source[i+8]||'')){
      let cursor=i+8;while(/\s/.test(source[cursor]||''))cursor++;
      const nameMatch=source.slice(cursor).match(/^([A-Za-z_$][\w$]*)/);if(!nameMatch){i+=8;continue}
      const name=nameMatch[1];cursor+=name.length;
      const brace=source.indexOf('{',cursor);if(brace<0)break;
      let j=brace,nesting=0,q='',esc=false,lc=false,bc=false;
      for(;j<source.length;j++){
        const c=source[j],n=source[j+1];
        if(lc){if(c==='\n')lc=false;continue}
        if(bc){if(c==='*'&&n==='/'){bc=false;j++}continue}
        if(q){if(esc){esc=false;continue}if(c==='\\'){esc=true;continue}if(c===q)q='';continue}
        if(c==='/'&&n==='/'){lc=true;j++;continue}
        if(c==='/'&&n==='*'){bc=true;j++;continue}
        if(c==='"'||c==="'"||c==='`'){q=c;continue}
        if(c==='{')nesting++;else if(c==='}'&&--nesting===0){j++;break}
      }
      out.push({name,start:i,end:j,text:source.slice(i,j)});i=j;continue;
    }
    i++;
  }
  return out;
}

const explicit={
  booking:new Set(['bookingById','bookingItemsForPoint','bookingItemsForDay','bookingLevelRank','activeBookingItems','pointBookingLevel','dayBookingLevel','progressValue','dateLabel','dotHtml','progressSelectHtml','channelButtonsHtml','bookingItemHtml','renderBookingChecklist','showGuide','platformUrl','openBookingChannel','setBookingProgress','dayBookingsHtml','pointBookingsSection']),
  itinerary:new Set(['setDayRouteCard','closePanelOnMobile','filterDay','showAll','clearRoutes','renderDays','renderLegend','presetPointIds','normalizePresetOrder','renderPresetDestinations','destinationNoticeHtml','renderPresetCards','selectPresetDestination','renderRecommendations','focusRecommendation','renderSources','refreshLinkedViews']),
  search:new Set(['renderSearchResults','searchPoints','focusPoint']),
  hotel:new Set(['renderHotels']),
  marker:new Set(['shortName','pointIcon','iconFor','amapLinks','launchAmap','popup','markerGroup','visiblePoints','routeOrderMap','routeMarkerIcon','bearingRotation','directionIcon']),
  leaflet:new Set(['rebuildMarkers','drawRoutes','fitPoints']),
  renderModel:new Set(['travelMarkerHtml','travelRouteMarkerHtml','travelDirectionHtml'])
};
const weather=/^(tripIsoDate|weatherValue|weatherIcon|tripWeatherCompact|tripWeatherDetailHtml|tripLegendWeatherHtml|applyTripWeather|loadTripWeather|amapWeatherAtCenter)$/;
const traffic=/^(amapTraffic|toggleAmapTraffic|amapDrivingTrafficBreakdown|amapScheduleTrafficSummary)/;
const amapRender=/^(clearAmapOverlays|amapPointPosition|renderAmapView|syncAmapView|amapMarkerPositionKey|amapRenderClusterBadge|amapRenderClusterPoint|amapOpenPoint|amapDistanceMeters|amapFitTravelPoints)$/;
const searchService=/^amap(?:RenderSuggestions|RenderSearchResults|SelectSearchPoi|ResolveInput|ReverseLookup|RenderContext|HandleMapClick|UseContext|PopulateTripDestinations|TripAction|SearchPlaces|InputTips|NearbySearch|ReverseAtLocation|StaticMap|IpLocate|Locate|NormalizeLocation|Center|SetOutput|ValidateResponse|Jsonp|WebRequest|FormatDistance|FormatDuration|PoiLocation|LocationText|SetInputLocation|InputLocation|ClearInputLocation|EnsureServices|ClearRouteService|RouteSummary|RouteUri|ResolveLocation|MarkSelectedLocation|ClearServiceOverlays)/;

function groupFor(name){
  for(const [group,names] of Object.entries(explicit))if(names.has(name))return group;
  if(weather.test(name))return'weather';
  if(traffic.test(name))return'traffic';
  if(amapRender.test(name))return'amap';
  if(searchService.test(name))return'searchService';
  return null;
}
function banner(title){return `/* v2.3 behavior-equivalent extraction: ${title}. Generated once, then maintained as canonical source. */\n`}
function replaceFunctionName(text,from,to){return text.replace(new RegExp(`^function\\s+${from}\\b`),`function ${to}`)}

let source=fs.readFileSync(LEGACY,'utf8');
const functions=scanFunctions(source),grouped={};
for(const fn of functions){const group=groupFor(fn.name);if(group)(grouped[group]??=[]).push(fn)}
const moved=[...Object.values(grouped).flat()];
if(moved.length){
  for(const fn of [...moved].sort((a,b)=>b.start-a.start))source=source.slice(0,fn.start)+source.slice(fn.end);
  fs.writeFileSync(LEGACY,source.replace(/\n{4,}/g,'\n\n'));
}
function writeGroup(group,file,title,append=''){
  const entries=grouped[group]||[];
  if(!entries.length){if(!fs.existsSync(path.join(ROOT,file)))throw new Error(`Missing canonical module ${file}`);return}
  write(file,banner(title)+entries.sort((a,b)=>a.start-b.start).map(x=>x.text).join('\n')+'\n'+append);
}
writeGroup('booking','src-v2/ui/booking-panel.js','booking panel');
writeGroup('itinerary','src-v2/ui/itinerary-panel.js','itinerary, legend and recommendations');
writeGroup('search','src-v2/ui/search-panel.js','local point search');
writeGroup('hotel','src-v2/ui/hotel-panel.js','hotel analysis table');
writeGroup('marker','src-v2/map/marker-renderer.js','shared marker and popup helpers');
writeGroup('weather','src-v2/services/weather-service.js','weather data and rendering');
writeGroup('traffic','src-v2/services/traffic-service.js','traffic layer and traffic summaries');
writeGroup('searchService','src-v2/services/search-service.js','AMap search, geocoding and routing services');

const renderModel=`/* v2.3 shared render model. Visual HTML intentionally matches v2.2.0. */\nfunction travelMarkerHtml(p){const c=CATEGORY[p.category]||CATEGORY['景点'];return \`<div class="marker-wrap" role="button" tabindex="0" aria-label="\${escapeHtml(p.name)}"><div class="marker-head" style="background:\${c.color}"><span class="marker-symbol">\${pointIcon(p.id)}</span></div><div class="marker-label">\${escapeHtml(shortName(p.name))}</div></div>\`}\nfunction travelRouteMarkerHtml(color,label,p){return \`<div class="marker-wrap" role="button" tabindex="0" aria-label="路线第\${escapeHtml(label)}站：\${escapeHtml(p.name)}"><div class="route-marker-head" style="background:\${color}">\${label}<span class="route-point-symbol">\${pointIcon(p.id)}</span></div><div class="marker-label">\${escapeHtml(shortName(p.name))}</div></div>\`}\nfunction travelDirectionHtml(color,rotation){return \`<div class="route-direction" style="background:\${color};transform:rotate(\${rotation}deg)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M13 6l6 6-6 6" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>\`}\n(function(){const layerNames=Object.freeze({tripMarkers:'tripMarkers',tripRoutes:'tripRoutes',hotels:'hotels',plannedRoute:'plannedRoute',serviceSelection:'serviceSelection',location:'location',traffic:'traffic'});function point(p){const c=CATEGORY[p.category]||CATEGORY['景点'];return{id:p.id,name:p.name,label:shortName(p.name),icon:pointIcon(p.id),color:c.color,position:[p.lng,p.lat],html:travelMarkerHtml(p),popup:typeof popup==='function'?popup(p):''}}function route(schedule){const points=routePoints(schedule);return{date:schedule.date,title:schedule.title,color:schedule.color,points:points.map((p,index)=>({...point(p),sequence:index+1,routeHtml:travelRouteMarkerHtml(schedule.color,index+1,p)})),directions:points.slice(0,-1).map((p,index)=>({from:p.id,to:points[index+1].id,rotation:bearingRotation(p,points[index+1]),html:travelDirectionHtml(schedule.color,bearingRotation(p,points[index+1]))}))}}window.TravelRenderModel={layerNames,point,route,markerHtml:travelMarkerHtml,routeMarkerHtml:travelRouteMarkerHtml,directionHtml:travelDirectionHtml}})();\n`;
if((grouped.renderModel||[]).length||!fs.existsSync(path.join(ROOT,'src-v2/map/render-model.js')))write('src-v2/map/render-model.js',renderModel);

const leafletEntries=(grouped.leaflet||[]).sort((a,b)=>a.start-b.start).map(fn=>{
  const names={rebuildMarkers:'leafletRenderMarkers',drawRoutes:'leafletRenderRoute',fitPoints:'leafletFitPoints'};
  return replaceFunctionName(fn.text,fn.name,names[fn.name]);
});
if(leafletEntries.length){
  write('src-v2/map/leaflet-adapter.js',banner('Leaflet real marker and route renderer')+leafletEntries.join('\n')+`\n(function(){const adapter={id:'leaflet',ready:()=>typeof map!=='undefined'&&Boolean(map),resize:()=>{try{map?.invalidateSize()}catch{}},view:()=>{try{const c=map.getCenter();return{center:[c.lng,c.lat],zoom:map.getZoom()}}catch{return null}},setView:view=>{try{if(view?.center)map.setView([view.center[1],view.center[0]],view.zoom,{animate:false})}catch{}},renderMarkers:day=>leafletRenderMarkers(day),renderRoute:day=>leafletRenderRoute(day),fitPoints:(points,maxZoom)=>leafletFitPoints(points,maxZoom),clearLayer:name=>{if(name==='tripRoutes')routeLayer?.clearLayers?.();if(name==='hotels')hotelLayer?.clearLayers?.()}};window.TravelLeafletAdapter=adapter})();\n`);
}
const amapEntries=(grouped.amap||[]).sort((a,b)=>a.start-b.start).map(fn=>{
  const names={renderAmapView:'amapRenderTravelView',syncAmapView:'amapSyncTravelView'};
  return names[fn.name]?replaceFunctionName(fn.text,fn.name,names[fn.name]):fn.text;
});
if(amapEntries.length){
  write('src-v2/map/amap-adapter.js',banner('AMap real marker and route renderer')+amapEntries.join('\n')+`\n(function(){const adapter={id:'amap',ready:()=>typeof amapInstance!=='undefined'&&Boolean(amapInstance),resize:()=>{try{amapInstance?.resize()}catch{}},view:()=>{try{const c=amapInstance.getCenter();return{center:[c.lng,c.lat],zoom:amapInstance.getZoom()}}catch{return null}},setView:view=>{try{if(view?.center)amapInstance.setZoomAndCenter(view.zoom,view.center,true)}catch{}},renderMarkers:()=>amapRenderTravelView(),renderRoute:()=>amapRenderTravelView(),renderAll:()=>amapRenderTravelView(),fitPoints:(points,maxZoom)=>amapFitTravelPoints(points,maxZoom),clearLayer:name=>{if(name==='tripRoutes'||name==='tripMarkers')clearAmapOverlays();if(name==='serviceSelection'&&window.TravelCore)window.TravelCore.overlays.clear('serviceSelection',amapInstance)}};window.TravelAmapAdapter=adapter})();\n`);
}

const adapters=`/* v2.3 map adapter registry and legacy-compatible dispatchers. */\nfunction rebuildMarkers(day=null){return window.TravelLeafletAdapter?.renderMarkers(day)}\nfunction drawRoutes(day=null){return window.TravelLeafletAdapter?.renderRoute(day)}\nfunction fitPoints(points,maxZoom=13){return window.TravelLeafletAdapter?.fitPoints(points,maxZoom)}\nfunction renderAmapView(){return window.TravelAmapAdapter?.renderAll()}\nfunction syncAmapView(){if(mapEngine==='amap'&&amapInstance)return window.TravelAmapAdapter?.renderAll()}\n(function(){const registry=new Map();function register(adapter){if(!adapter?.id)throw new Error('Map adapter id is required');registry.set(adapter.id,adapter);return adapter}register(window.TravelLeafletAdapter);register(window.TravelAmapAdapter);function engine(){try{return mapEngine==='amap'?'amap':'leaflet'}catch{return'leaflet'}}function get(id=engine()){return registry.get(id)}function current(){return get()}function invoke(method,...args){const adapter=current();if(!adapter||typeof adapter[method]!=='function')return;return adapter[method](...args)}function snapshot(){const adapter=current();return{engine:engine(),view:adapter?.view?.()||null,adapters:[...registry.keys()]}}window.TravelMapAdapters={register,get,current,engine,invoke,snapshot,renderMarkers:(day,id=engine())=>get(id)?.renderMarkers?.(day),renderRoute:(day,id=engine())=>get(id)?.renderRoute?.(day),setView:(view,id=engine())=>get(id)?.setView?.(view),fitPoints:(points,maxZoom,id=engine())=>get(id)?.fitPoints?.(points,maxZoom),clearLayer:(name,id=engine())=>get(id)?.clearLayer?.(name),resize:(id=engine())=>get(id)?.resize?.()}})();\n`;
if(moved.length||!fs.existsSync(path.join(ROOT,'src-v2/map/map-adapters.js')))write('src-v2/map/map-adapters.js',adapters);

let template=fs.readFileSync(path.join(ROOT,'src-v2/template.html'),'utf8');
if(!template.includes('data-tab="tools"'))template=template.replace('<button class="tab-btn" data-tab="sources"','<button class="tab-btn" data-tab="tools" role="tab" aria-selected="false">旅行工具</button><button class="tab-btn" data-tab="sources"');
if(!template.includes('data-panel="tools"'))template=template.replace('<section class="section tab-panel" data-panel="sources">',`<section class="section tab-panel" data-panel="tools"><h2>旅行工具 <span class="section-note">本机状态、日历、当天模式与风险提示</span></h2><div id="tripToolsRoot" class="trip-tools-root"><div class="section-note">正在初始化旅行工具……</div></div></section>\n  <section class="section tab-panel" data-panel="sources">`);
fs.writeFileSync(path.join(ROOT,'src-v2/template.html'),template);

let optimization=fs.readFileSync(path.join(ROOT,'src-v2/optimization.js'),'utf8');
optimization=optimization.replace(/\n  travelMarkerHtml=function\(p\)\{[\s\S]*?\n  \};\n  travelRouteMarkerHtml=function\(color,label,p\)\{[\s\S]*?\n  \};/,'\n  travelMarkerHtml=window.TravelRenderModel.markerHtml;\n  travelRouteMarkerHtml=window.TravelRenderModel.routeMarkerHtml;\n  travelDirectionHtml=window.TravelRenderModel.directionHtml;');
fs.writeFileSync(path.join(ROOT,'src-v2/optimization.js'),optimization);

const report={version:'2.3.0',legacyBytes:Buffer.byteLength(source),moved:moved.map(fn=>({name:fn.name,group:groupFor(fn.name),bytes:Buffer.byteLength(fn.text)})),modules:Object.fromEntries(Object.entries(grouped).map(([key,value])=>[key,value.map(item=>item.name)]))};
fs.writeFileSync(REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
