import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const legacy=read('src-v2/app/legacy-app.js');
const manifest=JSON.parse(read('assets/v2.4.0/manifest.json'));
const budget=JSON.parse(read('BUNDLE_BUDGET_v2.4.json'));
const required={
  appContext:['src-v2/core/app-state.js','TravelAppContext'],
  leafletFactory:['src-v2/map/leaflet-adapter.js','createLeafletTravelAdapter'],
  amapFactory:['src-v2/map/amap-adapter.js','createAmapTravelAdapter'],
  resultEnvelope:['src-v2/services/service-result.js','reportedAt'],
  serviceFacade:['src-v2/services/service-facade.js',"install('route'"],
  lazyLoader:['src-v2/ui/trip-tools-loader.js','lazy-tools.js'],
  riskMetrics:['src-v2/services/risk-metrics-service.js','segmentMode'],
  routeGeometry:['src-v2/services/risk-metrics-service.js','pathGeometry'],
  occurrenceState:['src-v2/ui/trip-operations.js','trip-stop-status-v2.4'],
  serviceData:['src-v2/services/search-service.js','return result'],
  inputFailure:['src-v2/services/search-service.js',"Promise.reject(new Error('请输入地点或关键词'))"]
};
const failures=[];
if(Buffer.byteLength(legacy)>1000)failures.push(`legacy-app.js=${Buffer.byteLength(legacy)} bytes`);
for(const [name,[file,token]] of Object.entries(required)){
  if(!fs.existsSync(path.join(ROOT,file)))failures.push(`${name}: missing ${file}`);
  else if(!read(file).includes(token))failures.push(`${name}: missing token ${token}`);
}
const facade=read('src-v2/services/service-facade.js');
if(facade.includes('&&installed.route)window.TravelAmapAssistantController'))failures.push('route controller bridge leaks private installed scope');
if(!facade.includes("TravelServiceFacade.invoke('route'"))failures.push('route controller does not use public service facade');
const operations=read('src-v2/ui/trip-operations.js');
if((operations.match(/段交通转场未计入步行/g)||[]).length!==1)failures.push('transfer reason must be emitted exactly once');
if(!operations.includes('/(\\d{1,2}):(\\d{2})\\s*[–—-]\\s*(\\d{1,2}):(\\d{2})/'))failures.push('activity-duration regex lost escapes');
const worker=read('src-v2/service-worker.js'),core=worker.match(/const CORE=\[([\s\S]*?)\];/)?.[1]||'';
if(core.includes('LAZY_TOOLS')||core.includes('lazy-tools.js'))failures.push('lazy tools are eagerly cached during service-worker install');
if(!worker.includes('const OFFLINE_CORE=[...CORE,LAZY_TOOLS]'))failures.push('offline preparation does not include lazy tools');
const initial=read('src','v2.4.0.html');
if(initial.includes('window.TravelTripOperations='))failures.push('trip operations leaked into initial HTML');
if(!budget.passed||budget.initialGzip>=budget.previousInitialGzip)failures.push('initial bundle was not reduced');
if(manifest.totalGzipBytes!==budget.totalGzip)failures.push('manifest and budget total differ');
const report={version:'2.4.0',legacyBytes:Buffer.byteLength(legacy),initialGzip:manifest.gzipBytes,lazyGzip:manifest.lazyGzipBytes,totalGzip:manifest.totalGzipBytes,initialSavings:manifest.initialSavingsBytes,explicitAdapters:true,serviceResultFields:['ok','data','error','source','cached','reportedAt'],lazyToolsEagerlyCached:false,failures};
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exitCode=1;
