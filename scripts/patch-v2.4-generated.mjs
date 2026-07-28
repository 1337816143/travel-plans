import fs from 'node:fs';

function patch(file,replacements){
  if(!fs.existsSync(file))return;
  let source=fs.readFileSync(file,'utf8');
  for(const [from,to] of replacements){
    if(source.includes(from))source=source.replaceAll(from,to);
  }
  fs.writeFileSync(file,source);
}

patch('src-v2/services/search-service.js',[
  [".catch(error=>amapSetStatus('定位失败：'+error.message,'error');throw error}).finally", ".catch(error=>{amapSetStatus('定位失败：'+error.message,'error');throw error}).finally"],
  [".catch(error=>amapSetStatus(error.message,'error');throw error})", ".catch(error=>{amapSetStatus(error.message,'error');throw error})"]
]);
patch('src-v2/ui/amap-assistant-controller.js',[
  [".catch(error=>{document.getElementById('amapRouteSummary').innerHTML='<div class=\"amap-empty\">'+escapeHtml(error.message)+'</div>';amapSetStatus(error.message,'error');throw error}).finally", ".catch(error=>{document.getElementById('amapRouteSummary').innerHTML='<div class=\"amap-empty\">'+escapeHtml(error.message)+'</div>';amapSetStatus(error.message,'error');throw error}).finally"]
]);
patch('src-v2/ui/trip-operations.js',[["].join('\n')", "].join('\\n')"]]);
patch('src-v2/data/generated/catalog.js',[["version:'2.3.0'","version:'2.4.0'"]]);
if(fs.existsSync('src-v2/services/risk-metrics-service.template.js'))fs.copyFileSync('src-v2/services/risk-metrics-service.template.js','src-v2/services/risk-metrics-service.js');
console.log('Patched v2.4 service syntax, lazy newline, catalog identity and measured route-risk implementation');
