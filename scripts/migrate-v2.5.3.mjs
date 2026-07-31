import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const write=(file,text)=>fs.writeFileSync(file,text);
function patch(file,transform){const before=read(file),after=transform(before);if(after!==before){write(file,after);console.log(`patched ${file}`)}else console.log(`unchanged ${file}`)}
function addAfter(text,anchor,value){return text.includes(value.trim())?text:text.replace(anchor,anchor+value)}

patch('scripts/build-v2.mjs',text=>{
  text=text.replace("const VERSION='2.5.2';","const VERSION='2.5.3';")
    .replace("const PREVIOUS='2.5.1';","const PREVIOUS='2.5.2';")
    .replace("const DATE='2026-07-29';","const DATE='2026-07-31';")
    .replaceAll('BUNDLE_BUDGET_v2.5.2.json','BUNDLE_BUDGET_v2.5.3.json')
    .replaceAll('MIGRATION_V2.5.2.json','MIGRATION_V2.5.3.json');
  text=addAfter(text,"  read('src-v2','styles','v2.5.2.css'),\n","  read('src-v2','styles','v2.5.3.css')\n");
  text=addAfter(text,"  read('src-v2','data','wishlist-map-points.js'),\n","  read('src-v2','data','food-precision-v2.5.3.js'),\n");
  text=addAfter(text,"  read('src-v2','ui','search-panel.js'),\n","  read('src-v2','ui','food-search-panel.js'),\n");
  if(!text.includes("'src-v2/data/food-precision-v2.5.3.js'"))text=text.replace("'src-v2/data/wishlist-map-points.js'","'src-v2/data/wishlist-map-points.js','src-v2/data/food-precision-v2.5.3.js'");
  if(!text.includes("'src-v2/ui/food-search-panel.js'"))text=text.replace("'src-v2/ui/wishlist-panel.js'","'src-v2/ui/wishlist-panel.js','src-v2/ui/food-search-panel.js'");
  if(!text.includes("'food-search-tab'"))text=text.replace("'organized-trip-tools'","'food-search-tab','point-search-food-sync','original-food-icons','xiaomujia-precision','yunnan-store-honesty','organized-trip-tools'");
  text=text.replace('v${VERSION} 旅行工具与美食地图版','v${VERSION} 美食检索与精确门店版')
    .replace('重构旅行工具为清晰的分组折叠布局；必吃必买关联真实门店或真实核验点，并在高德与 OSM 中使用统一的专属标识。','修复旅行工具顶部布局；新增美食检索标签页、点位检索同步和原版必吃／必买图案；小木家门店精确化，云南锅锅米线保持诚实待核。')
    .replace('旅行工具分组布局、必吃必买真实地图点与专属标识版。','美食检索、点位检索同步、原版必吃／必买图案与门店精确核验版。');
  return text;
});

patch('scripts/validate-data-schema.mjs',text=>{
  text=text.replace("VERSION='2.5.2',VALIDATED_FOR='2026-07-29-v2.5.2'","VERSION='2.5.3',VALIDATED_FOR='2026-07-31-v2.5.3'")
    .replaceAll('DATA_SCHEMA_REPORT_v2.5.2.json','DATA_SCHEMA_REPORT_v2.5.3.json');
  const oldBinding="function binding(name,file){const code=fs.readFileSync(path.join(DIR,file),'utf8'),sandbox={};vm.createContext(sandbox);vm.runInContext(`${code}\\nthis.__value=${name};`,sandbox,{filename:file});return structuredClone(sandbox.__value)}";
  const newBinding="function binding(name,file){const code=fs.readFileSync(path.join(DIR,file),'utf8'),sandbox={};sandbox.window=sandbox;vm.createContext(sandbox);const precision=name==='GIRLFRIEND_WISHLIST'?fs.readFileSync(path.join(ROOT,'src-v2/data/food-precision-v2.5.3.js'),'utf8'):'';vm.runInContext(`${code}\\n${precision}\\nthis.__value=${name};`,sandbox,{filename:file});return structuredClone(sandbox.__value)}";
  if(text.includes(oldBinding))text=text.replace(oldBinding,newBinding);
  if(!text.includes("const xiaomujia=food.find"))text=text.replace("if(mapPoints.length!==10)warnings.push(`愿望地图点共 ${mapPoints.length} 个，当前设计预期 10 个真实门店/核验点`);","if(mapPoints.length!==10)warnings.push(`愿望地图点共 ${mapPoints.length} 个，当前设计预期 10 个真实门店/核验点`);\nconst xiaomujia=food.find(item=>item.id==='food-xiaomujia'),yunnan=food.find(item=>item.id==='food-yunnan-rice-noodle');\nif(xiaomujia?.name!=='小木家韩式烤肉（漳州二路店）'||xiaomujia?.address!=='青岛市市南区漳州二路49号（燕儿岛路地铁站B口步行约300米）')errors.push('小木家必须固定为漳州二路店及49号地址');\nif(!xiaomujia?.target?.includes('参鸡汤'))errors.push('小木家必须保留朋友亲测参鸡汤目标');\nif(yunnan?.verification?.store!=='unverified'||!yunnan?.target?.includes('薄荷炸排骨'))errors.push('云南锅锅米线必须保留薄荷炸排骨并明确精确门店未核实');\nif(!food.every(item=>item.girlfriendMust===true))errors.push('12项女朋友必吃必买必须全部带 girlfriendMust 标记');");
  if(!text.includes('小木家漳州二路店和参鸡汤明确'))text=text.replace("'饮料版本与试喝要求保留'","'饮料版本与试喝要求保留','小木家漳州二路店和参鸡汤明确','云南锅锅米线不误配外地门店','12项女朋友必吃必买完整保留'");
  return text;
});

patch('scripts/validate-v2.mjs',text=>{
  text=text.replaceAll('2.5.2','2.5.3').replaceAll('2026-07-29','2026-07-31');
  text=text.replace("PREVIOUS='2.5.3'","PREVIOUS='2.5.2'").replace("PREVIOUS='2.5.1'","PREVIOUS='2.5.2'");
  text=text.replace("['styles/v2.5.css','styles/v2.5.1.css','styles/v2.5.3.css'","['styles/v2.5.css','styles/v2.5.1.css','styles/v2.5.2.css','styles/v2.5.3.css'");
  if(!text.includes("data/food-precision-v2.5.3.js"))text=text.replace("'data/wishlist-map-points.js'","'data/wishlist-map-points.js','data/food-precision-v2.5.3.js'");
  if(!text.includes("ui/food-search-panel.js"))text=text.replace("'ui/wishlist-panel.js'","'ui/wishlist-panel.js','ui/food-search-panel.js'");
  return text;
});

for(const file of ['scripts/validate-v2.5-practical.mjs','scripts/inspect-v2.5.mjs','tests/v2-integrity.spec.js','tests/v2-visual.spec.js','tests/v2-risk.spec.js','src-v2/ui/trip-tools-loader.js'])patch(file,text=>text.replaceAll('2.5.2','2.5.3').replaceAll('2026-07-29-v2.5.3','2026-07-31-v2.5.3'));

patch('scripts/validate-v2.5-practical.mjs',text=>{
  if(!text.includes("const foodSearch=read"))text=text.replace("const wishlist=read('src-v2/ui/wishlist-panel.js');","const wishlist=read('src-v2/ui/wishlist-panel.js');\nconst foodSearch=read('src-v2/ui/food-search-panel.js');\nconst precision=read('src-v2/data/food-precision-v2.5.3.js');");
  if(!text.includes('food search missing'))text=text.replace("if(schema.counts.wishlistAttractions!==17","for(const token of ['TravelFoodSearch','美食检索','data-food-focus','presetPointIds','focusFood'])if(!foodSearch.includes(token))failures.push(`food search missing ${token}`);\nfor(const token of ['小木家韩式烤肉（漳州二路店）','参鸡汤（朋友亲测推荐）','精确门店待确认',"mapLabel:'小木家参鸡汤'"])if(!precision.includes(token))failures.push(`food precision missing ${token}`);\nif(schema.counts.wishlistAttractions!==17");
  return text;
});

patch('scripts/inspect-v2.5.mjs',text=>{
  if(!text.includes('foodSearch:'))text=text.replace("wishlistUi:['src-v2/ui/wishlist-panel.js','window.TravelGirlfriendWishlist'],","wishlistUi:['src-v2/ui/wishlist-panel.js','window.TravelGirlfriendWishlist'],\n  foodPrecision:['src-v2/data/food-precision-v2.5.3.js','trusted-personal-recommendation-store-unverified'],\n  foodSearch:['src-v2/ui/food-search-panel.js','window.TravelFoodSearch'],");
  return text;
});

patch('package.json',text=>{const pkg=JSON.parse(text);pkg.version='2.5.3';return JSON.stringify(pkg,null,2)+'\n'});
console.log('v2.5.3 migration complete');
