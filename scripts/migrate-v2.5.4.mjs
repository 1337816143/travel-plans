import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const write=(file,text)=>fs.writeFileSync(file,text);
function patch(file,transform){
  const before=read(file),after=transform(before);
  if(after!==before){write(file,after);console.log(`patched ${file}`)}else console.log(`unchanged ${file}`);
}
function addAfter(text,anchor,value){return text.includes(value.trim())?text:text.replace(anchor,anchor+value)}

patch('scripts/build-v2.mjs',text=>{
  text=text.replace("const VERSION='2.5.3';","const VERSION='2.5.4';")
    .replace("const PREVIOUS='2.5.2';","const PREVIOUS='2.5.3';")
    .replaceAll('BUNDLE_BUDGET_v2.5.3.json','BUNDLE_BUDGET_v2.5.4.json')
    .replaceAll('MIGRATION_V2.5.3.json','MIGRATION_V2.5.4.json')
    .replaceAll("read('src-v2','data','food-precision-v2.5.3.js')","read('src-v2','data','food-precision-v2.5.4.js')")
    .replaceAll("'src-v2/data/food-precision-v2.5.3.js'","'src-v2/data/food-precision-v2.5.4.js'")
    .replace("'girlfriend-seven-logo'","'original-wishlist-icons'")
    .replaceAll('数字7专属标识','原版必吃/必买图案')
    .replaceAll('数字7专属身份','原版必吃/必买图案')
    .replace('美食检索、点位检索同步、原版必吃/必买图案与门店精确核验版。','美食检索、点位检索同步、原版必吃/必买图案与门店精确核验版。')
    .replace('2026-07-29-v${PREVIOUS}.html','2026-07-31-v${PREVIOUS}.html')
    .replace('v${VERSION} 美食检索与精确门店版','v${VERSION} 原版美食图标恢复版');
  text=addAfter(text,"  read('src-v2','styles','v2.5.3.css')\n","  read('src-v2','styles','v2.5.4.css')\n");
  text=text.replace("  read('src-v2','styles','v2.5.3.css')\n  read('src-v2','styles','v2.5.4.css')","  read('src-v2','styles','v2.5.3.css'),\n  read('src-v2','styles','v2.5.4.css')");
  if(!text.includes("read('src-v2','styles','v2.5.4.css')"))text=text.replace("  read('src-v2','styles','v2.5.3.css')\n", "  read('src-v2','styles','v2.5.3.css'),\n  read('src-v2','styles','v2.5.4.css')\n");
  return text;
});

patch('scripts/validate-data-schema.mjs',text=>text
  .replace("VERSION='2.5.3',VALIDATED_FOR='2026-07-31-v2.5.3'","VERSION='2.5.4',VALIDATED_FOR='2026-07-31-v2.5.4'")
  .replaceAll('DATA_SCHEMA_REPORT_v2.5.3.json','DATA_SCHEMA_REPORT_v2.5.4.json')
  .replaceAll('food-precision-v2.5.3.js','food-precision-v2.5.4.js')
  .replace('12项女朋友项目使用数字7专属身份','12项必吃必买项目保留原版图案'));

const canonicalRequired=['styles/v2.5.css','styles/v2.5.1.css','styles/v2.5.2.css','styles/v2.5.3.css','styles/v2.5.4.css','core/app-state.js','state/versioned-storage.js','state/travel-store.js','state/preferences.js','data/selectors.js','data/wishlist-map-points.js','data/food-precision-v2.5.4.js','map/coordinate-service.js','map/basemap-controller.js','map/amap-loader.js','ui/amap-assistant-controller.js','ui/app-bootstrap.js','ui/accessibility-controller.js','ui/layout-coordinator.js','ui/trip-tools-loader.js','ui/wishlist-panel.js','ui/food-search-panel.js','ui/trip-tools-layout.js','map/render-model.js','map/marker-renderer.js','map/leaflet-adapter.js','map/amap-adapter.js','map/map-adapters.js','services/service-result.js','services/amap-client.js','services/service-facade.js','services/segment-overrides.js','services/track-store.js','services/operation-log.js','services/finance-store.js','services/risk-metrics-service.js','services/health-check.js','services/calendar-export.js','state/local-data-manager.js','ui/trip-operations.js'];
patch('scripts/validate-v2.mjs',text=>{
  text=text.replace("VERSION='2.5.3',PREVIOUS='2.5.2'","VERSION='2.5.4',PREVIOUS='2.5.3'")
    .replaceAll('v2.5.3','v2.5.4')
    .replaceAll('DATA_SCHEMA_REPORT_v2.5.3.json','DATA_SCHEMA_REPORT_v2.5.4.json')
    .replaceAll('MIGRATION_V2.5.3.json','MIGRATION_V2.5.4.json')
    .replaceAll('BUNDLE_BUDGET_v2.5.3.json','BUNDLE_BUDGET_v2.5.4.json')
    .replaceAll('food-precision-v2.5.3.js','food-precision-v2.5.4.js');
  text=text.replace("VERSION='2.5.4',PREVIOUS='2.5.4'","VERSION='2.5.4',PREVIOUS='2.5.3'");
  text=text.replace(/const required=\[[^\n]+\];/,`const required=${JSON.stringify(canonicalRequired)};`);
  return text;
});

patch('scripts/validate-v2.5-practical.mjs',text=>text
  .replace("const VERSION='2.5.3'","const VERSION='2.5.4'")
  .replaceAll('food-precision-v2.5.3.js','food-precision-v2.5.4.js')
  .replace("['漳州二路总店','参鸡汤（朋友亲测推荐）','精确门店待确认','girlfriend-seven-marker']","['小木家韩式烤肉（漳州二路店）','参鸡汤（朋友亲测推荐）','精确门店待确认',\"mapLabel:'小木家参鸡汤'\"]")
  .replace("read('src-v2','styles','v2.5.3.css')\"]","read('src-v2','styles','v2.5.3.css')\",\"read('src-v2','styles','v2.5.4.css')\"]"));

patch('scripts/inspect-v2.5.mjs',text=>text
  .replace("VERSION='2.5.3'","VERSION='2.5.4'")
  .replace("foodPrecision:['src-v2/data/food-precision-v2.5.3.js','TravelGirlfriendSevenLogo']","foodPrecision:['src-v2/data/food-precision-v2.5.4.js','girlfriendMust:true']"));

for(const file of ['tests/v2-integrity.spec.js','tests/v2-visual.spec.js','tests/v2-risk.spec.js','src-v2/ui/trip-tools-loader.js'])patch(file,text=>text.replaceAll('2.5.3','2.5.4'));

patch('tests/v2-food-search.spec.js',text=>text
  .replaceAll('2.5.3','2.5.4')
  .replace('.food-search-logo.special-seven','.food-search-logo.wishlist-original')
  .replace('optgroup[label="小七必吃必买"]','optgroup[label="必吃必买"]')
  .replace("expect(data.marker).toContain('girlfriend-seven-marker');","expect(data.marker).toContain('wishlist-map-marker');")
  .replace("expect(data.marker).toContain('girlfriend-seven-svg');","expect(data.marker).toContain('wishlist-map-logo');\n  expect(data.marker).not.toContain('girlfriend-seven');"));

patch('package.json',text=>{const pkg=JSON.parse(text);pkg.version='2.5.4';return JSON.stringify(pkg,null,2)+'\n'});
console.log('v2.5.4 migration complete');
