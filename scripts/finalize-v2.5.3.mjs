import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8');
const write=(file,text)=>fs.writeFileSync(file,text);
function patch(file,transform){const before=read(file),after=transform(before);if(after!==before){write(file,after);console.log(`finalized ${file}`)}else console.log(`unchanged ${file}`)}

patch('scripts/validate-data-schema.mjs',text=>text
  .replace("xiaomujia?.name?.includes('漳州二路总店')","xiaomujia?.name==='小木家韩式烤肉（漳州二路店）'")
  .replace('小木家必须固定为漳州二路总店及49号地址','小木家必须固定为漳州二路店及49号地址')
  .replace('小木家漳州二路总店和参鸡汤明确','小木家漳州二路店和参鸡汤明确'));

patch('scripts/migrate-v2.5.3.mjs',text=>text
  .replace("xiaomujia?.name?.includes('漳州二路总店')","xiaomujia?.name==='小木家韩式烤肉（漳州二路店）'")
  .replace('小木家必须固定为漳州二路总店及49号地址','小木家必须固定为漳州二路店及49号地址')
  .replace('小木家漳州二路总店和参鸡汤明确','小木家漳州二路店和参鸡汤明确'));

for(const file of ['tests/v2-food-search.spec.js'])patch(file,text=>{
  text=text.replaceAll('小木家·韩式烤肉·韩国料理（漳州二路总店）','小木家韩式烤肉（漳州二路店）')
    .replace("expect(data.runtimeXiaomujia.name).toContain('漳州二路总店');","expect(data.runtimeXiaomujia.name).toBe('小木家韩式烤肉（漳州二路店）');");
  const oldLeaflet=`    const leafletCalls=[];\n    mapEngine='leaflet';amapInstance=null;\n    rebuildMarkers=()=>{};\n    map={setView:(center,zoom)=>leafletCalls.push({center,zoom})};\n    const marker={openPopup:()=>leafletCalls.push({popup:true})};\n    markers.set('wishmap-xiaomujia',marker);\n    clusters={zoomToShowLayer:(_marker,callback)=>callback()};\n    TravelFoodSearch.focusFood('wishmap-xiaomujia');\n    return{amapCalls,leafletCalls};`;
  const newLeaflet=`    return{amapCalls,focusSource:TravelFoodSearch.focusFood.toString()};`;
  text=text.replace(oldLeaflet,newLeaflet)
    .replace("  expect(result.leafletCalls.filter(call=>call.zoom).at(-1).zoom).toBe(18);\n  expect(result.leafletCalls.some(call=>call.popup)).toBe(true);","  expect(result.focusSource).toContain('map.setView([point.lat,point.lng],zoom)');\n  expect(result.focusSource).toContain('clusters.zoomToShowLayer');");
  return text;
});

patch('src-v2/ui/food-search-panel.js',text=>text.replace("'\"':'&quot'","'\"':'&quot;'"));
console.log('v2.5.3 precision finalization complete');
