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
  [".catch(error=>amapSetStatus(error.message,'error');throw error})", ".catch(error=>{amapSetStatus(error.message,'error');throw error})"]
]);
patch('src-v2/ui/amap-assistant-controller.js',[
  [".catch(error=>{document.getElementById('amapRouteSummary').innerHTML='<div class=\"amap-empty\">'+escapeHtml(error.message)+'</div>';amapSetStatus(error.message,'error');throw error}).finally", ".catch(error=>{document.getElementById('amapRouteSummary').innerHTML='<div class=\"amap-empty\">'+escapeHtml(error.message)+'</div>';amapSetStatus(error.message,'error');throw error}).finally"]
]);
patch('src-v2/ui/trip-operations.js',[
  ["].join('\n')", "].join('\\n')"],
  ["。累计爬升为90m DEM近似值，现场体感优先。</small>'", "。累计爬升为90m DEM近似值，现场体感优先。 <a href=\"https://open-meteo.com/en/docs/elevation-api\" target=\"_blank\" rel=\"noopener\">Open-Meteo</a> · <a href=\"https://dataspace.copernicus.eu/\" target=\"_blank\" rel=\"noopener\">Copernicus DEM</a></small>'"]
]);
patch('src-v2/data/generated/catalog.js',[["version:'2.3.0'","version:'2.4.0'"]]);
if(fs.existsSync('src-v2/services/risk-metrics-service.template.js'))fs.copyFileSync('src-v2/services/risk-metrics-service.template.js','src-v2/services/risk-metrics-service.js');
deduplicateTopLevelFunctions('src-v2/core/app-state.js');
console.log('Patched v2.4 service syntax, measured route risk, attribution, catalog identity and duplicate compatibility functions');
