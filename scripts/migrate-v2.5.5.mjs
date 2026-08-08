import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const write=(file,text)=>fs.writeFileSync(file,text);
function patch(file,transform){const before=read(file),after=transform(before);if(after!==before){write(file,after);console.log(`patched ${file}`)}else console.log(`unchanged ${file}`)}
function addAfter(text,anchor,value){return text.includes(value.trim())?text:text.replace(anchor,anchor+value)}

patch('scripts/build-v2.mjs',text=>{
  text=text.replace("const VERSION='2.5.4';","const VERSION='2.5.5';")
    .replace("const PREVIOUS='2.5.3';","const PREVIOUS='2.5.4';")
    .replace("const DATE='2026-07-31';","const DATE='2026-08-08';")
    .replaceAll('BUNDLE_BUDGET_v2.5.4.json','BUNDLE_BUDGET_v2.5.5.json')
    .replaceAll('MIGRATION_V2.5.4.json','MIGRATION_V2.5.5.json')
    .replace('v${VERSION} 原版美食图标恢复版','v${VERSION} 雨天备用与浴场状态版')
    .replace('原版美食图标恢复版。','雨天备用、浴场状态与新增收藏版。');
  text=addAfter(text,"  read('src-v2','styles','v2.5.4.css')\n","  read('src-v2','styles','v2.5.5.css')\n");
  text=text.replace("  read('src-v2','styles','v2.5.4.css')\n  read('src-v2','styles','v2.5.5.css')","  read('src-v2','styles','v2.5.4.css'),\n  read('src-v2','styles','v2.5.5.css')");
  text=addAfter(text,"  read('src-v2','data','food-precision-v2.5.4.js'),\n","  read('src-v2','data','rain-guide-v2.5.5.js'),\n");
  text=addAfter(text,"  read('src-v2','ui','food-search-panel.js'),\n","  read('src-v2','ui','rain-guide-panel.js'),\n");
  text=text.replace("const migrationFiles=['src-v2/state/versioned-storage.js'","const migrationFiles=['src-v2/data/rain-guide-v2.5.5.js','src-v2/ui/rain-guide-panel.js','src-v2/styles/v2.5.5.css','src-v2/state/versioned-storage.js'");
  text=text.replace("features:['food-search-tab'","features:['rain-fallback-tab','official-2026-beach-hours','rain-safety-gates','new-user-places','food-search-tab'");
  text=text.replace('修复旅行工具顶部布局；新增美食检索标签页、点位检索同步和原版必吃/必买图案；小木家门店精确化，云南锅锅米线保持诚实待核。','新增雨天避坑/备用方案专栏、2026年9处海水浴场官方时段、天气安全门禁和新增收藏；保留既有美食检索与原版必吃/必买图案。');
  return text;
});

patch('src-v2/template.html',text=>{
  if(!text.includes('data-tab="rain"'))text=text.replace('<button class="tab-btn" data-tab="tools" role="tab" aria-selected="false">旅行工具</button>','<button class="tab-btn" data-tab="rain" role="tab" aria-selected="false">雨天备用</button><button class="tab-btn" data-tab="tools" role="tab" aria-selected="false">旅行工具</button>');
  if(!text.includes('data-panel="rain"'))text=text.replace('<section class="section tab-panel" data-panel="tools"><h2>旅行工具','<section class="section tab-panel" data-panel="rain"><div id="rainGuideRoot"><div class="section-note">正在加载雨天避坑、浴场状态和备用方案……</div></div></section>\n <section class="section tab-panel" data-panel="tools"><h2>旅行工具');
  text=text.replace('17个必去＋2个室内备选','17个必去＋雨天备用专栏');
  return text;
});

patch('src-v2/ui/app-bootstrap.js',text=>{
  if(!text.includes('TravelRainGuide?.render'))text=text.replace('renderRecommendations();runSelfCheck();','renderRecommendations();window.TravelRainGuide?.render?.();runSelfCheck();');
  return text;
});

patch('src-v2/data/generated/schedules.js',text=>text
  .replace('小麦岛入口—草坪—近岸，不环岛。','小麦岛入口—草坪—近岸，不环岛；天气合适时坐草坪看日落、吹海风，戴耳机听音乐。')
  .replace('海岸因强风或雷雨不宜游览时，下午改青岛海底世界等室内备选','海岸因强风或雷雨不宜游览时，直接打开“雨天备用”专栏，从A级室内备选中按距离选择；下午可改青岛海底世界等室内项目'));

patch('scripts/validate-data-schema.mjs',text=>text
  .replace("VERSION='2.5.4',VALIDATED_FOR='2026-07-31-v2.5.4'","VERSION='2.5.5',VALIDATED_FOR='2026-08-08-v2.5.5'")
  .replaceAll('DATA_SCHEMA_REPORT_v2.5.4.json','DATA_SCHEMA_REPORT_v2.5.5.json'));

patch('scripts/validate-v2.mjs',text=>{
  text=text.replace("VERSION='2.5.4',PREVIOUS='2.5.3',FALLBACK='1.0.15',DATE='2026-07-31'","VERSION='2.5.5',PREVIOUS='2.5.4',FALLBACK='1.0.15',DATE='2026-08-08'")
    .replaceAll('DATA_SCHEMA_REPORT_v2.5.4.json','DATA_SCHEMA_REPORT_v2.5.5.json')
    .replaceAll('MIGRATION_V2.5.4.json','MIGRATION_V2.5.5.json')
    .replaceAll('BUNDLE_BUDGET_v2.5.4.json','BUNDLE_BUDGET_v2.5.5.json')
    .replaceAll('Historical v2.5.4 loader','Historical v2.5.5 loader')
    .replaceAll('Missing v2.5.4 initial feature','Missing v2.5.5 initial feature')
    .replaceAll('Deprecated number-7 artwork remains in v2.5.4','Deprecated number-7 artwork remains in v2.5.5')
    .replaceAll('Canonical v2.5.4 module missing','Canonical v2.5.5 module missing');
  text=text.replace("'window.TravelLazyTools'];","'window.TravelLazyTools','window.TravelRainGuideData','window.TravelRainGuide'];");
  text=text.replace('"styles/v2.5.4.css","core/app-state.js"','"styles/v2.5.4.css","styles/v2.5.5.css","core/app-state.js"');
  text=text.replace('"data/food-precision-v2.5.4.js","map/coordinate-service.js"','"data/food-precision-v2.5.4.js","data/rain-guide-v2.5.5.js","map/coordinate-service.js"');
  text=text.replace('"ui/food-search-panel.js","ui/trip-tools-layout.js"','"ui/food-search-panel.js","ui/rain-guide-panel.js","ui/trip-tools-layout.js"');
  return text;
});

for(const file of ['scripts/validate-v2.5-practical.mjs','scripts/inspect-v2.5.mjs','tests/v2-integrity.spec.js','tests/v2-visual.spec.js','tests/v2-risk.spec.js','tests/v2-food-search.spec.js','src-v2/ui/trip-tools-loader.js'])patch(file,text=>text.replaceAll('2.5.4','2.5.5').replaceAll('food-precision-v2.5.5.js','food-precision-v2.5.4.js').replaceAll('2026-07-31-v2.5.5','2026-08-08-v2.5.5'));

patch('scripts/validate-v2.5-practical.mjs',text=>{
  if(!text.includes("rain-guide-v2.5.5.js"))text=text.replace("const precision=read('src-v2/data/food-precision-v2.5.4.js');","const precision=read('src-v2/data/food-precision-v2.5.4.js');\nconst rainGuide=read('src-v2/data/rain-guide-v2.5.5.js');\nconst rainUi=read('src-v2/ui/rain-guide-panel.js');");
  if(!text.includes('rain guide missing'))text=text.replace('if(schema.counts.wishlistAttractions!==17',"for(const token of ['小麦岛草坪日落','笨蛤蜊·地标小吃大排档','沙子口广场','Vya无涯coffee','青岛云上海天','第一海水浴场','灵山湾海水浴场','私人游艇'])if(!rainGuide.includes(token))failures.push(`rain guide missing ${token}`);\nfor(const token of ['雨天避坑 / 备用方案','BEACH STATUS','rainWeatherRefresh'])if(!rainUi.includes(token))failures.push(`rain UI missing ${token}`);\nif(schema.counts.wishlistAttractions!==17");
  return text;
});

patch('scripts/inspect-v2.5.mjs',text=>{
  if(!text.includes('rainGuideData:'))text=text.replace("foodSearch:['src-v2/ui/food-search-panel.js','window.TravelFoodSearch'],","foodSearch:['src-v2/ui/food-search-panel.js','window.TravelFoodSearch'],\n  rainGuideData:['src-v2/data/rain-guide-v2.5.5.js','TravelRainGuideData'],\n  rainGuideUi:['src-v2/ui/rain-guide-panel.js','window.TravelRainGuide'],");
  return text;
});

patch('package.json',text=>{const pkg=JSON.parse(text);pkg.version='2.5.5';pkg.scripts['validate:rain']='node scripts/validate-rain-guide-v2.5.5.mjs';return JSON.stringify(pkg,null,2)+'\n'});
console.log('v2.5.5 rain migration complete');
