import fs from 'node:fs';
import {parse} from 'acorn';

function patch(file,replacements){
  if(!fs.existsSync(file))return;
  let source=fs.readFileSync(file,'utf8');
  for(const [from,to] of replacements){
    if(source.includes(from))source=source.replaceAll(from,to);
  }
  fs.writeFileSync(file,source);
}
function patchFirst(file,from,to){
  if(!fs.existsSync(file))return;
  const source=fs.readFileSync(file,'utf8');
  if(source.includes(from))fs.writeFileSync(file,source.replace(from,to));
}
function appendUnique(file,marker,content){
  if(!fs.existsSync(file))return;
  const source=fs.readFileSync(file,'utf8');
  if(!source.includes(marker))fs.writeFileSync(file,source.replace(/\s*$/,'')+'\n'+content+'\n');
}
function deduplicateTopLevelFunctions(file){
  if(!fs.existsSync(file))return;
  let source=fs.readFileSync(file,'utf8');
  const ast=parse(source,{ecmaVersion:'latest',sourceType:'script',ranges:true});
  const declarations=ast.body.filter(node=>node.type==='FunctionDeclaration'&&node.id?.name),lastByName=new Map();
  declarations.forEach(node=>lastByName.set(node.id.name,node));
  const obsolete=declarations.filter(node=>lastByName.get(node.id.name)!==node).sort((a,b)=>b.start-a.start);
  for(const node of obsolete)source=source.slice(0,node.start)+source.slice(node.end);
  fs.writeFileSync(file,source.replace(/\n{3,}/g,'\n\n'));
}

patch('src-v2/services/search-service.js',[
  [".catch(error=>amapSetStatus('定位失败：'+error.message,'error');throw error}).finally", ".catch(error=>{amapSetStatus('定位失败：'+error.message,'error');throw error}).finally"],
  [".catch(error=>amapSetStatus(error.message,'error');throw error})", ".catch(error=>{amapSetStatus(error.message,'error');throw error})"],
  ["input.focus();return Promise.resolve()", "input.focus();return Promise.reject(new Error('请输入地点或关键词'))"],
  ["amapSetStatus('搜索完成','ok')}).catch", "amapSetStatus('搜索完成','ok');return result}).catch"],
  ["amapSetStatus('周边搜索完成','ok')}).catch", "amapSetStatus('周边搜索完成','ok');return result}).catch"]
]);
patch('src-v2/services/weather-service.js',[
  ["amapSetStatus('天气已更新','ok')}).catch", "amapSetStatus('天气已更新','ok');return{live,forecast,tripWeatherByDate:{...amapTripWeatherByDate},reportTime:amapTripWeatherReportTime}}).catch"]
]);
patch('src-v2/ui/amap-assistant-controller.js',[
  [".catch(error=>{document.getElementById('amapRouteSummary').innerHTML='<div class=\"amap-empty\">'+escapeHtml(error.message)+'</div>';amapSetStatus(error.message,'error');throw error}).finally", ".catch(error=>{document.getElementById('amapRouteSummary').innerHTML='<div class=\"amap-empty\">'+escapeHtml(error.message)+'</div>';amapSetStatus(error.message,'error');throw error}).finally"]
]);
patch('src-v2/ui/trip-operations.js',[
  ["].join('\n')", "].join('\\n')"],
  ["/(d{1,2}):(d{2})s*[–—-]s*(d{1,2}):(d{2})/", "/(\\d{1,2}):(\\d{2})\\s*[–—-]\\s*(\\d{1,2}):(\\d{2})/"],
  ["步行路线约 ", "可核验步行连接约 "],
  ["真实路线＋高程＋逐小时体感", "可核验步行连接＋高程＋逐小时体感"],
  ["。累计爬升为90m DEM近似值，现场体感优先。</small>'", "。累计爬升为90m DEM近似值，现场体感优先。 <a href=\"https://open-meteo.com/en/docs/elevation-api\" target=\"_blank\" rel=\"noopener\">Open-Meteo</a> · <a href=\"https://dataspace.copernicus.eu/\" target=\"_blank\" rel=\"noopener\">Copernicus DEM</a></small>'"]
]);
patchFirst('src-v2/ui/trip-operations.js',"if(Number.isFinite(ascent)","if(metrics?.walking?.transferSegments)reasons.push('另有 '+metrics.walking.transferSegments+' 段交通转场未计入步行');if(metrics?.walking?.unmappedSegments)reasons.push('有 '+metrics.walking.unmappedSegments+' 段交通方式未明确，未计入步行');if(Number.isFinite(ascent)");
patch('src-v2/data/generated/catalog.js',[["version:'2.3.0'","version:'2.4.0'"]]);
if(fs.existsSync('src-v2/services/risk-metrics-service.template.js'))fs.copyFileSync('src-v2/services/risk-metrics-service.template.js','src-v2/services/risk-metrics-service.js');
appendUnique('src-v2/services/service-facade.js','v2.4 wrapped controller bridge',"/* v2.4 wrapped controller bridge */\nif(window.TravelAmapAssistantController&&installed.route)window.TravelAmapAssistantController=Object.freeze({...window.TravelAmapAssistantController,planRoute:installed.route});");
deduplicateTopLevelFunctions('src-v2/core/app-state.js');
console.log('Patched v2.4 service data, validation failures, duration parsing, one-time transfer reasons, measured route risk and attribution');
