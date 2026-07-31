import fs from 'node:fs';

function read(file){return fs.readFileSync(file,'utf8')}
function write(file,text){fs.writeFileSync(file,text)}
function replaceRequired(text,from,to,label=from){if(!text.includes(from))throw new Error(`v2.5.3 migration token missing: ${label}`);return text.replace(from,to)}
function patchFile(file,patch){const before=read(file),after=patch(before);if(after!==before){write(file,after);console.log(`patched ${file}`)}else console.log(`unchanged ${file}`)}

patchFile('scripts/build-v2.mjs',text=>{
  if(text.includes("const VERSION='2.5.3'"))return text;
  text=replaceRequired(text,"const VERSION='2.5.2';","const VERSION='2.5.3';");
  text=replaceRequired(text,"const PREVIOUS='2.5.1';","const PREVIOUS='2.5.2';");
  text=replaceRequired(text,"const DATE='2026-07-29';","const DATE='2026-07-31';");
  text=replaceRequired(text,"  read('src-v2','styles','v2.5.2.css')\n","  read('src-v2','styles','v2.5.2.css'),\n  read('src-v2','styles','v2.5.3.css')\n",'v2.5.2 css list');
  text=replaceRequired(text,"  read('src-v2','data','wishlist-map-points.js'),\n","  read('src-v2','data','wishlist-map-points.js'),\n  read('src-v2','data','food-precision-v2.5.3.js'),\n",'wishlist map data inclusion');
  text=replaceRequired(text,"  read('src-v2','ui','search-panel.js'),\n","  read('src-v2','ui','search-panel.js'),\n  read('src-v2','ui','food-search-panel.js'),\n",'food search inclusion');
  text=replaceRequired(text,"write('BUNDLE_BUDGET_v2.5.2.json'","write('BUNDLE_BUDGET_v2.5.3.json'",'bundle budget output');
  text=replaceRequired(text,"'src-v2/data/wishlist-map-points.js'","'src-v2/data/wishlist-map-points.js','src-v2/data/food-precision-v2.5.3.js'",'migration data files');
  text=replaceRequired(text,"'src-v2/ui/wishlist-panel.js'","'src-v2/ui/wishlist-panel.js','src-v2/ui/food-search-panel.js'",'migration UI files');
  text=replaceRequired(text,"write('MIGRATION_V2.5.2.json'","write('MIGRATION_V2.5.3.json'",'migration report output');
  text=replaceRequired(text,"'organized-trip-tools'","'food-search-tab','point-search-food-sync','girlfriend-seven-logo','xiaomujia-precision','yunnan-store-honesty','organized-trip-tools'",'feature list');
  text=text.replace('v${VERSION} 旅行工具与美食地图版','v${VERSION} 美食检索与精确门店版');
  text=text.replace('重构旅行工具为清晰的分组折叠布局；必吃必买关联真实门店或真实核验点，并在高德与 OSM 中使用统一的专属标识。','修复旅行工具顶部布局；新增美食检索标签页、点位检索同步和数字7专属标识；小木家门店精确化，云南锅锅米线保持诚实待核。');
  text=text.replace('旅行工具分组布局、必吃必买真实地图点与专属标识版。','美食检索、点位检索同步、数字7专属标识与门店精确核验版。');
  return text;
});

patchFile('scripts/validate-data-schema.mjs',text=>{
  const oldBinding="function binding(name,file){const code=fs.readFileSync(path.join(DIR,file),'utf8'),sandbox={};vm.createContext(sandbox);vm.runInContext(`${code}\\nthis.__value=${name};`,sandbox,{filename:file});return structuredClone(sandbox.__value)}";
  if(!text.includes('food-precision-v2.5.3.js')){
    const newBinding="function binding(name,file){const code=fs.readFileSync(path.join(DIR,file),'utf8'),sandbox={};sandbox.window=sandbox;vm.createContext(sandbox);const precision=name==='GIRLFRIEND_WISHLIST'?fs.readFileSync(path.join(ROOT,'src-v2/data/food-precision-v2.5.3.js'),'utf8'):'';vm.runInContext(`${code}\\n${precision}\\nthis.__value=${name};`,sandbox,{filename:file});return structuredClone(sandbox.__value)}";
    text=replaceRequired(text,oldBinding,newBinding,'schema data binding');
  }
  if(!text.includes("VERSION='2.5.3'")){
    text=replaceRequired(text,"VERSION='2.5.2',VALIDATED_FOR='2026-07-29-v2.5.2'","VERSION='2.5.3',VALIDATED_FOR='2026-07-31-v2.5.3'");
    text=text.replace("if(mapPoints.length!==10)warnings.push(`愿望地图点共 ${mapPoints.length} 个，当前设计预期 10 个真实门店/核验点`);","if(mapPoints.length!==10)warnings.push(`愿望地图点共 ${mapPoints.length} 个，当前设计预期 10 个真实门店/核验点`);\nconst xiaomujia=food.find(item=>item.id==='food-xiaomujia'),yunnan=food.find(item=>item.id==='food-yunnan-rice-noodle');\nif(!xiaomujia?.name?.includes('漳州二路总店')||xiaomujia?.address!=='青岛市市南区漳州二路49号（燕儿岛路地铁站B口步行约300米）')errors.push('小木家必须固定为漳州二路总店及49号地址');\nif(!xiaomujia?.target?.includes('参鸡汤'))errors.push('小木家必须保留朋友亲测参鸡汤目标');\nif(yunnan?.verification?.store!=='unverified'||!yunnan?.target?.includes('薄荷炸排骨'))errors.push('云南锅锅米线必须保留薄荷炸排骨并明确精确门店未核实');\nif(!food.every(item=>item.girlfriendMust===true))errors.push('12项女朋友必吃必买必须全部带 girlfriendMust 标记');");
    text=text.replace("'饮料版本与试喝要求保留'","'饮料版本与试喝要求保留','小木家漳州二路总店和参鸡汤明确','云南锅锅米线不误配外地门店','12项女朋友项目使用数字7专属身份'");
  }
  text=text.replaceAll('DATA_SCHEMA_REPORT_v2.5.2.json','DATA_SCHEMA_REPORT_v2.5.3.json');
  return text;
});

const simpleVersionFiles=['scripts/validate-v2.mjs','scripts/validate-v2.5-practical.mjs','scripts/inspect-v2.5.mjs','tests/v2-integrity.spec.js','tests/v2-visual.spec.js','tests/v2-risk.spec.js','src-v2/ui/trip-tools-loader.js'];
for(const file of simpleVersionFiles)patchFile(file,text=>text.replaceAll('2.5.2','2.5.3').replaceAll('2026-07-29-v2.5.3','2026-07-31-v2.5.3'));

patchFile('scripts/validate-v2.mjs',text=>{
  text=text.replace("PREVIOUS='2.5.1'","PREVIOUS='2.5.2'").replace("DATE='2026-07-29'","DATE='2026-07-31'");
  if(!text.includes("food-precision-v2.5.3.js"))text=text.replace("'data/wishlist-map-points.js'","'data/wishlist-map-points.js','data/food-precision-v2.5.3.js'").replace("'ui/wishlist-panel.js'","'ui/wishlist-panel.js','ui/food-search-panel.js'");
  return text;
});

patchFile('scripts/validate-v2.5-practical.mjs',text=>{
  if(!text.includes('food-search-panel.js'))text=text.replace("const wishlist=read('src-v2/ui/wishlist-panel.js');","const wishlist=read('src-v2/ui/wishlist-panel.js');\nconst foodSearch=read('src-v2/ui/food-search-panel.js');\nconst precision=read('src-v2/data/food-precision-v2.5.3.js');").replace("if(schema.counts.wishlistAttractions!==17","for(const token of ['TravelFoodSearch','美食检索','data-food-focus','presetPointIds','focusFood'])if(!foodSearch.includes(token))failures.push(`food search missing ${token}`);\nfor(const token of ['漳州二路总店','参鸡汤（朋友亲测推荐）','精确门店待确认','girlfriend-seven-marker'])if(!precision.includes(token))failures.push(`food precision missing ${token}`);\nif(schema.counts.wishlistAttractions!==17");
  return text;
});

patchFile('scripts/inspect-v2.5.mjs',text=>{
  if(!text.includes('foodSearch:'))text=text.replace("wishlistUi:['src-v2/ui/wishlist-panel.js','window.TravelGirlfriendWishlist'],","wishlistUi:['src-v2/ui/wishlist-panel.js','window.TravelGirlfriendWishlist'],\n  foodPrecision:['src-v2/data/food-precision-v2.5.3.js','TravelGirlfriendSevenLogo'],\n  foodSearch:['src-v2/ui/food-search-panel.js','window.TravelFoodSearch'],");
  return text;
});

patchFile('package.json',text=>{const pkg=JSON.parse(text);pkg.version='2.5.3';return JSON.stringify(pkg,null,2)+'\n'});
console.log('v2.5.3 migration complete');
