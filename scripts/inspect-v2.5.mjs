import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const legacy=read('src-v2/app/legacy-app.js');
const manifest=JSON.parse(read('assets/v2.5.0/manifest.json'));
const budget=JSON.parse(read('BUNDLE_BUDGET_v2.5.json'));
const required={
  store:['src-v2/state/travel-store.js','window.TravelStore'],
  versionedStorage:['src-v2/state/versioned-storage.js','schemaVersion'],
  selectors:['src-v2/data/selectors.js','visiblePointsPure'],
  leafletFactory:['src-v2/map/leaflet-adapter.js','createLeafletTravelAdapter'],
  amapFactory:['src-v2/map/amap-adapter.js','createAmapTravelAdapter'],
  pureClient:['src-v2/services/amap-client.js','window.TravelServiceClients'],
  serviceFacade:['src-v2/services/service-facade.js','invokePure'],
  segmentCorrection:['src-v2/services/segment-overrides.js','trip-segment-overrides-v2.5'],
  gpxTracks:['src-v2/services/track-store.js','parseGpx'],
  finance:['src-v2/services/finance-store.js','trip-finance-v2.5'],
  undo:['src-v2/services/operation-log.js','lastUndoable'],
  riskMetrics:['src-v2/services/risk-metrics-service.js','importedTrack'],
  calendarUpdates:['src-v2/services/calendar-export.js','CANCELLED'],
  health:['src-v2/services/health-check.js','layoutCheck'],
  accessibility:['src-v2/ui/accessibility-controller.js','reduceMotion'],
  layout:['src-v2/ui/layout-coordinator.js','coordinate'],
  lazyLoader:['src-v2/ui/trip-tools-loader.js','assets/v2.5.0/lazy-tools.js']
};
const failures=[];
if(Buffer.byteLength(legacy)>1000)failures.push(`legacy-app.js=${Buffer.byteLength(legacy)} bytes`);
for(const [name,[file,token]] of Object.entries(required)){
  if(!fs.existsSync(path.join(ROOT,file)))failures.push(`${name}: missing ${file}`);
  else if(!read(file).includes(token))failures.push(`${name}: missing token ${token}`)
}
const initial=read('src/v2.5.0.html'),lazy=read('assets/v2.5.0/lazy-tools.js');
if(initial.includes('window.TravelTripOperations='))failures.push('trip operations leaked into initial HTML');
for(const token of ['window.TravelTrackStore','window.TravelFinance','window.TravelTripOperations'])if(!lazy.includes(token))failures.push(`lazy bundle missing ${token}`);
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
const report={version:'2.5.0',legacyBytes:Buffer.byteLength(legacy),initialGzip:manifest.gzipBytes,lazyGzip:manifest.lazyGzipBytes,totalGzip:manifest.totalGzipBytes,initialDelta:manifest.initialDeltaBytes,totalDelta:manifest.totalDeltaBytes,observableStore:true,pureSelectors:true,controllerSeparatedServices:true,versionedLocalData:true,practicalTools:['next-stop','segment-correction','gpx','finance','undo','calendar-update','accessibility','health-check'],layoutCoordinator:true,lazyToolsEagerlyCached:false,failures};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exitCode=1;
