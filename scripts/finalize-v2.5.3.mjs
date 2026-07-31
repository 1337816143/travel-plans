import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const write=(file,text)=>fs.writeFileSync(file,text);
function patch(file,transform){const before=read(file),after=transform(before);if(after!==before){write(file,after);console.log(`finalized ${file}`)}else console.log(`unchanged ${file}`)}

patch('scripts/validate-data-schema.mjs',text=>text
  .replace("if(!xiaomujia?.name==='小木家韩式烤肉（漳州二路店）'","if(xiaomujia?.name!=='小木家韩式烤肉（漳州二路店）'")
  .replace("xiaomujia?.name?.includes('漳州二路总店')","xiaomujia?.name==='小木家韩式烤肉（漳州二路店）'")
  .replace('小木家必须固定为漳州二路总店及49号地址','小木家必须固定为漳州二路店及49号地址')
  .replace('小木家漳州二路总店和参鸡汤明确','小木家漳州二路店和参鸡汤明确')
  .replace('12项女朋友必吃必买必须全部带 girlfriendMust 标记','12项女朋友必吃必买必须全部保留推荐标记')
  .replace('12项女朋友项目使用数字7专属身份','12项女朋友必吃必买完整保留'));

patch('scripts/migrate-v2.5.3.mjs',text=>text
  .replace("if(!xiaomujia?.name==='小木家韩式烤肉（漳州二路店）'","if(xiaomujia?.name!=='小木家韩式烤肉（漳州二路店）'")
  .replace("xiaomujia?.name?.includes('漳州二路总店')","xiaomujia?.name==='小木家韩式烤肉（漳州二路店）'")
  .replace('小木家必须固定为漳州二路总店及49号地址','小木家必须固定为漳州二路店及49号地址')
  .replace('小木家漳州二路总店和参鸡汤明确','小木家漳州二路店和参鸡汤明确')
  .replaceAll('girlfriend-seven-logo','original-food-icons')
  .replaceAll('数字7专属标识','原版必吃／必买图案')
  .replaceAll('12项女朋友项目使用数字7专属身份','12项女朋友必吃必买完整保留')
  .replace("['漳州二路总店','参鸡汤（朋友亲测推荐）','精确门店待确认','girlfriend-seven-marker']","['小木家韩式烤肉（漳州二路店）','参鸡汤（朋友亲测推荐）','精确门店待确认',\"mapLabel:'小木家参鸡汤'\"]")
  .replaceAll('TravelGirlfriendSevenLogo','trusted-personal-recommendation-store-unverified'));

patch('scripts/build-v2.mjs',text=>text
  .replaceAll('girlfriend-seven-logo','original-food-icons')
  .replaceAll('数字7专属标识','原版必吃／必买图案')
  .replace('美食检索、点位检索同步、数字7专属标识与门店精确核验版。','美食检索、点位检索同步、原版必吃／必买图案与门店精确核验版。'));

const canonicalRequired=['styles/v2.5.css','styles/v2.5.1.css','styles/v2.5.2.css','styles/v2.5.3.css','core/app-state.js','state/versioned-storage.js','state/travel-store.js','state/preferences.js','data/selectors.js','data/wishlist-map-points.js','data/food-precision-v2.5.3.js','map/coordinate-service.js','map/basemap-controller.js','map/amap-loader.js','ui/amap-assistant-controller.js','ui/app-bootstrap.js','ui/accessibility-controller.js','ui/layout-coordinator.js','ui/trip-tools-loader.js','ui/wishlist-panel.js','ui/food-search-panel.js','ui/trip-tools-layout.js','map/render-model.js','map/marker-renderer.js','map/leaflet-adapter.js','map/amap-adapter.js','map/map-adapters.js','services/service-result.js','services/amap-client.js','services/service-facade.js','services/segment-overrides.js','services/track-store.js','services/operation-log.js','services/finance-store.js','services/risk-metrics-service.js','services/health-check.js','services/calendar-export.js','state/local-data-manager.js','ui/trip-operations.js'];
patch('scripts/validate-v2.mjs',text=>text
  .replace("PREVIOUS='2.5.3'","PREVIOUS='2.5.2'")
  .replace(/const required=\[[^\n]+\];/,`const required=${JSON.stringify(canonicalRequired)};`));

patch('scripts/validate-v2.5-practical.mjs',text=>text
  .replace("['漳州二路总店','参鸡汤（朋友亲测推荐）','精确门店待确认','girlfriend-seven-marker']","['小木家韩式烤肉（漳州二路店）','参鸡汤（朋友亲测推荐）','精确门店待确认',\"mapLabel:'小木家参鸡汤'\"]")
  .replace("for(const token of ['TravelFoodSearch','美食检索','data-food-focus','presetPointIds','focusFood'])","for(const token of ['TravelFoodSearch','美食检索','data-food-focus','presetPointIds','focusFood'])"));

patch('scripts/inspect-v2.5.mjs',text=>text.replace('TravelGirlfriendSevenLogo','trusted-personal-recommendation-store-unverified'));

patch('tests/v2-food-search.spec.js',text=>text
  .replace("await expect(page.locator('.food-search-logo.special-seven').first()).toBeVisible();","await expect(page.locator('.food-search-logo').first()).toBeVisible();\n  await expect(page.locator('.food-search-logo.special-seven')).toHaveCount(0);")
  .replace("expect(data.marker).toContain('girlfriend-seven-marker');","expect(data.marker).toContain('wishlist-map-logo');\n  expect(data.marker).not.toContain('girlfriend-seven-marker');")
  .replace("expect(data.marker).toContain('girlfriend-seven-svg');","expect(data.marker).not.toContain('girlfriend-seven-svg');")
  .replaceAll('小木家·韩式烤肉·韩国料理（漳州二路总店）','小木家韩式烤肉（漳州二路店）')
  .replace("expect(data.runtimeXiaomujia.name).toContain('漳州二路总店');","expect(data.runtimeXiaomujia.name).toBe('小木家韩式烤肉（漳州二路店）');"));

patch('src-v2/ui/food-search-panel.js',text=>text.replace("'\"':'&quot'","'\"':'&quot;'"));

for(const file of ['src-v2/data/food-precision-v2.5.3.js','src-v2/ui/food-search-panel.js','src-v2/styles/v2.5.3.css']){
  const text=read(file);
  for(const removed of ['girlfriend-seven-marker','girlfriend-seven-svg','special-seven','数字7专属'])if(text.includes(removed))throw new Error(`${file} still contains removed number-seven identity: ${removed}`);
}
console.log('v2.5.3 precision finalization complete');
