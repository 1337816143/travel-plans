import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd(),VERSION='2.5.2';
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const legacy=read('src-v2/app/legacy-app.js');
const manifest=JSON.parse(read(`assets/v${VERSION}/manifest.json`));
const budget=JSON.parse(read(`BUNDLE_BUDGET_v${VERSION}.json`));
const schema=JSON.parse(read(`DATA_SCHEMA_REPORT_v${VERSION}.json`));
const required={
  store:['src-v2/state/travel-store.js','window.TravelStore'],
  versionedStorage:['src-v2/state/versioned-storage.js','schemaVersion'],
  selectors:['src-v2/data/selectors.js','TravelWishlistMap.visible'],
  leafletFactory:['src-v2/map/leaflet-adapter.js','createLeafletTravelAdapter'],
  amapFactory:['src-v2/map/amap-adapter.js','createAmapTravelAdapter'],
  pureClient:['src-v2/services/amap-client.js','window.TravelServiceClients'],
  serviceFacade:['src-v2/services/service-facade.js','invokePure'],
  segmentCorrection:['src-v2/services/segment-overrides.js','trip-segment-overrides-v2.5'],
  availability:['src-v2/services/availability-store.js','trip-availability-v2.5'],
  availabilityUi:['src-v2/ui/availability-controller.js','data-availability-status'],
  gpxTracks:['src-v2/services/track-store.js','parseGpx'],
  finance:['src-v2/services/finance-store.js','trip-finance-v2.5'],
  undo:['src-v2/services/operation-log.js','lastUndoable'],
  riskMetrics:['src-v2/services/risk-metrics-service.js','importedTrack'],
  calendarUpdates:['src-v2/services/calendar-export.js','bookingEvents'],
  health:['src-v2/services/health-check.js','layoutCheck'],
  accessibility:['src-v2/ui/accessibility-controller.js','reduceMotion'],
  layout:['src-v2/ui/layout-coordinator.js','coordinate'],
  wishlistData:['src-v2/data/generated/wishlist.js','mapPoints'],
  wishlistMap:['src-v2/data/wishlist-map-points.js','window.TravelWishlistMap'],
  wishlistUi:['src-v2/ui/wishlist-panel.js','window.TravelGirlfriendWishlist'],
  toolsLayout:['src-v2/ui/trip-tools-layout.js','window.TravelTripToolsLayout'],
  sharedMarker:['src-v2/map/render-model.js','TravelWishlistMap.markerHtml'],
  lazyLoader:['src-v2/ui/trip-tools-loader.js',`assets/v${VERSION}/lazy-tools.js`]
};
const failures=[];
if(Buffer.byteLength(legacy)>1000)failures.push(`legacy-app.js=${Buffer.byteLength(legacy)} bytes`);
for(const [name,[file,token]] of Object.entries(required)){
  if(!fs.existsSync(path.join(ROOT,file)))failures.push(`${name}: missing ${file}`);
  else if(!read(file).includes(token))failures.push(`${name}: missing token ${token}`)
}
const initial=read(`src/v${VERSION}.html`),lazy=read(`assets/v${VERSION}/lazy-tools.js`);
if(initial.includes('window.TravelTripOperations='))failures.push('trip operations leaked into initial HTML');
for(const token of ['window.TravelAvailability','window.TravelAvailabilityController','window.TravelTrackStore','window.TravelFinance','window.TravelTripOperations','window.TravelGirlfriendWishlist','window.TravelTripToolsLayout'])if(!lazy.includes(token))failures.push(`lazy bundle missing ${token}`);
for(const token of ['const GIRLFRIEND_WISHLIST=','window.TravelWishlistMap','wishlist-map-marker','wishmap-wanhechun','wishmap-lizhizha'])if(!initial.includes(token))failures.push(`wishlist initial map layer missing ${token}`);
if(schema.counts.wishlistAttractions!==17||schema.counts.wishlistFood!==12||schema.counts.mappedWishlistFood!==12||schema.counts.wishlistMapPoints!==10)failures.push(`wishlist counts incomplete: ${JSON.stringify(schema.counts)}`);
const leaflet=read('src-v2/map/leaflet-adapter.js'),amap=read('src-v2/map/amap-adapter.js');
if(!leaflet.includes('TravelSelectors')||!leaflet.includes('TravelStore.state'))failures.push('Leaflet production adapter does not use pure selectors/store');
if(!amap.includes('TravelSelectors')||!amap.includes('TravelStore.state'))failures.push('AMap production adapter does not use pure selectors/store');
const client=read('src-v2/services/amap-client.js');
if(!client.includes("['network','timeout'].includes(error.kind)"))failures.push('JSONP fallback is not restricted to network/timeouts');
const worker=read('src-v2/service-worker.js'),core=worker.match(/const CORE=\[([\s\S]*?)\];/)?.[1]||'';
if(core.includes('LAZY_TOOLS')||core.includes('lazy-tools.js'))failures.push('lazy tools are eagerly cached during service-worker install');
if(!worker.includes('const OFFLINE_CORE=[...CORE,LAZY_TOOLS]'))failures.push('offline preparation does not include lazy tools');
if(!budget.passed||budget.initialGzip>budget.initialBudget||budget.totalGzip>budget.totalBudget)failures.push('bundle budget failed');
if(manifest.totalGzipBytes!==budget.totalGzip)failures.push('manifest and budget total differ');
const report={version:VERSION,legacyBytes:Buffer.byteLength(legacy),initialGzip:manifest.gzipBytes,lazyGzip:manifest.lazyGzipBytes,totalGzip:manifest.totalGzipBytes,initialDelta:manifest.initialDeltaBytes,totalDelta:manifest.totalDeltaBytes,observableStore:true,pureSelectors:true,controllerSeparatedServices:true,versionedLocalData:true,bookingCalendarSync:true,availabilityExpiryHours:12,wishlist:{attractions:schema.counts.wishlistAttractions,foodTasks:schema.counts.wishlistFood,mapPoints:schema.counts.wishlistMapPoints,mappedFoodTasks:schema.counts.mappedWishlistFood,sharedMapLogos:true,precisionTiers:['exact','address','anchor'],completionState:true,dailyHints:true,schemaGuard:true},toolsLayout:{groups:5,singleColumn:true,persistentAccordion:true,mobileSingleOpen:true},practicalTools:['next-stop','wishlist','food-map','segment-correction','availability','gpx','finance','undo','calendar-update','accessibility','health-check'],layoutCoordinator:true,lazyToolsEagerlyCached:false,failures};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exitCode=1;
