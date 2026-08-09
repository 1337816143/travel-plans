import fs from 'node:fs';

function patch(file,before,after,label){const source=fs.readFileSync(file,'utf8');if(!source.includes(before))throw new Error(`${label} not found in ${file}`);fs.writeFileSync(file,source.replace(before,after))}
function patchRegex(file,pattern,replacement,label){const source=fs.readFileSync(file,'utf8');if(!pattern.test(source))throw new Error(`${label} not found in ${file}`);fs.writeFileSync(file,source.replace(pattern,replacement))}

patch(
  'data/qingdao/checkin/checkin-guide.v1.json',
  '"id":"ohmo-cafe","name":"OHMO CAFE","day":"08-14","priority":true,"lat":35.87960,"lng":119.93080,"amapQuery":"OHMO CAFE 青岛 绿泽画院 张家楼"',
  '"id":"ohmo-cafe","name":"OHMO CAFE","day":"08-14","priority":true,"searchOnly":true,"amapQuery":"OHMO CAFE 青岛 绿泽画院 张家楼"',
  'OHMO coordinate hardening',
);
patch(
  'data/qingdao/checkin/checkin-guide.v1.json',
  '"precision":"公开地址已核验；坐标为绿泽画院片区参考，进门后按高德POI/现场定位"',
  '"precision":"公开地址已核验；公开检索未取得足够可靠的门店经纬度，进门后按高德POI/现场定位"',
  'OHMO precision note',
);

patch(
  'src-v2.5.7/checkin-food-seaview.js',
  "function locationCoord(location){const p=basePoint(location);if(Number.isFinite(Number(location.lat))&&Number.isFinite(Number(location.lng)))return[Number(location.lat),Number(location.lng)];if(p)return[Number(p.lat),Number(p.lng)];return null}",
  "function locationCoord(location){if(location.searchOnly)return null;const p=basePoint(location);if(Number.isFinite(Number(location.lat))&&Number.isFinite(Number(location.lng)))return[Number(location.lat),Number(location.lng)];if(p)return[Number(p.lat),Number(p.lng)];return null}",
  'search-only location coordinate guard',
);
patch(
  'src-v2.5.7/checkin-food-seaview.js',
  "function cameraCoord(location,camera,index){if(Number.isFinite(Number(camera.lat))&&Number.isFinite(Number(camera.lng)))return[Number(camera.lat),Number(camera.lng)];const base=locationCoord(location);if(!base)return null;const delta=index===0?0:index%2?0.00012:-0.00012;return[base[0]+delta,base[1]+delta/1.6]}",
  "function cameraCoord(location,camera){if(Number.isFinite(Number(camera.lat))&&Number.isFinite(Number(camera.lng)))return[Number(camera.lat),Number(camera.lng)];return locationCoord(location)}",
  'no fabricated camera offset',
);
patch(
  'src-v2.5.7/checkin-food-seaview.js',
  "${coord?`<code>机位参考 WGS84 ${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}</code>`:'<code>机位待现场确认，不生成假坐标</code>'}",
  "${coord?`<code>${Number.isFinite(Number(camera.lat))&&Number.isFinite(Number(camera.lng))?'机位参考':'地点锚点'} WGS84 ${coord[0].toFixed(6)}, ${coord[1].toFixed(6)}${Number.isFinite(Number(camera.lat))&&Number.isFinite(Number(camera.lng))?'':' · 具体站位现场微调'}</code>`:'<code>机位待现场/高德确认，不生成假坐标</code>'}",
  'camera precision label',
);
patch(
  'src-v2.5.7/checkin-food-seaview.js',
  "const priority=isPriority(location),coord=locationCoord(location),searchOnly=Boolean(location.searchOnly&&!coord);",
  "const priority=isPriority(location),coord=locationCoord(location),searchOnly=Boolean(!coord&&location.amapQuery);",
  'dynamic search-only button state',
);

patchRegex(
  'src-v2.5.7/checkin-food-seaview.js',
  /  function renderMapLayer\(\)\{[\s\S]*?\n  function focusLocation/,
  `  function routeAnchorMarkersLeaflet(){if(!leafletLayer||typeof L==='undefined')return;(DATA.routes||[]).forEach(route=>(route.anchors||[]).forEach((anchor,index)=>{if(!Number.isFinite(Number(anchor.lat))||!Number.isFinite(Number(anchor.lng)))return;const icon=L.divIcon({className:'',html:\`<div class="v257-photo-route-label">\${index+1} · \${esc(anchor.name)}</div>\`,iconAnchor:[8,14]});L.marker([anchor.lat,anchor.lng],{icon,title:route.name+' · '+anchor.name,interactive:true}).addTo(leafletLayer)}))}\n  function routeAnchorMarkersAmap(){if(typeof AMap==='undefined'||!amapInstance)return;(DATA.routes||[]).forEach(route=>(route.anchors||[]).forEach((anchor,index)=>{if(!Number.isFinite(Number(anchor.lat))||!Number.isFinite(Number(anchor.lng)))return;const marker=new AMap.Marker({position:toGcj([anchor.lat,anchor.lng]),title:route.name+' · '+anchor.name,content:\`<div class="v257-photo-route-label">\${index+1} · \${esc(anchor.name)}</div>\`,offset:new AMap.Pixel(-8,-14)});amapOverlays.push(marker)}))}\n  function renderMapLayer(){clearMapLayer();const locations=activeLocations();if(typeof mapEngine!=='undefined'&&mapEngine==='amap'&&typeof amapInstance!=='undefined'&&amapInstance&&typeof AMap!=='undefined'){locations.forEach(location=>(location.cameras||[]).forEach((camera,index)=>{const coord=cameraCoord(location,camera,index);if(!coord)return;const marker=new AMap.Marker({position:toGcj(coord),title:location.name+' · '+camera.name,content:\`<div class="v257-map-pin \${isPriority(location)?'priority':''}">📷</div>\`,offset:new AMap.Pixel(-14,-14)});marker.on('click',()=>{amapInstance.setZoomAndCenter(17,toGcj(coord))});amapOverlays.push(marker)}));routeAnchorMarkersAmap();if(amapOverlays.length)amapInstance.add(amapOverlays);return}if(typeof L==='undefined'||typeof map==='undefined')return;leafletLayer=L.layerGroup().addTo(map);locations.forEach(location=>(location.cameras||[]).forEach((camera,index)=>{const coord=cameraCoord(location,camera,index);if(!coord)return;const icon=L.divIcon({className:'',html:\`<div class="v257-map-pin \${isPriority(location)?'priority':''}">📷</div>\`,iconSize:[28,28],iconAnchor:[14,14]});L.marker(coord,{icon,title:location.name+' · '+camera.name}).bindPopup(markerPopup(location,camera,index)).addTo(leafletLayer)}));routeAnchorMarkersLeaflet()}\n  function focusLocation`,
  'route map must not draw schematic straight lines',
);

patchRegex(
  'src-v2.5.7/checkin-food-seaview.js',
  /  function focusRoute\(id\)\{[^\n]*\}\n  function searchAmap/,
  `  function collectRoutePolyline(node,out=[]){if(node==null)return out;if(typeof node==='string'){for(const token of node.split(';')){const [lng,lat]=token.split(',').map(Number);if(Number.isFinite(lat)&&Number.isFinite(lng))out.push([lng,lat])}return out}if(Array.isArray(node)){for(const item of node)collectRoutePolyline(item,out);return out}if(typeof node==='object'){if(node.polyline)collectRoutePolyline(node.polyline,out);for(const [key,value] of Object.entries(node)){if(key==='polyline')continue;if(value&&typeof value==='object')collectRoutePolyline(value,out)}}return out}\n  async function queryWalkingLeg(a,b){if(typeof amapWebRequest!=='function')throw new Error('高德Web路线服务尚未加载');const origin=toGcj([a.lat,a.lng]),destination=toGcj([b.lat,b.lng]);const data=await amapWebRequest('/v5/direction/walking',{origin:origin.join(','),destination:destination.join(','),show_fields:'cost,navi,polyline'});const path=data?.route?.paths?.[0];if(!path)throw new Error('高德未返回步行路线');const points=collectRoutePolyline(path,[]);if(points.length<2)throw new Error('高德步行路线缺少道路折线');return points}\n  function gcjPathToWgs(points){return points.map(([lng,lat])=>{if(window.TravelCoordinates?.gcj02ToWgs84){const value=window.TravelCoordinates.gcj02ToWgs84(lat,lng);return[value[0],value[1]]}return[lat,lng]})}\n  async function focusRoute(id){const route=(DATA.routes||[]).find(item=>item.id===id);if(!route)return;const anchors=(route.anchors||[]).filter(item=>Number.isFinite(Number(item.lat))&&Number.isFinite(Number(item.lng)));renderMapLayer();if(isMobile()){const side=document.getElementById('panel');if(side?.classList.contains('open'))document.getElementById('menuBtn')?.click()}try{let gcjPath=[];for(let index=1;index<anchors.length;index+=1){const leg=await queryWalkingLeg(anchors[index-1],anchors[index]);if(gcjPath.length&&leg.length)leg.shift();gcjPath.push(...leg)}if(gcjPath.length<2)throw new Error('高德未返回完整路线');if(typeof mapEngine!=='undefined'&&mapEngine==='amap'&&typeof amapInstance!=='undefined'&&amapInstance&&typeof AMap!=='undefined'){const line=new AMap.Polyline({path:gcjPath,strokeColor:'#e18a20',strokeWeight:6,strokeOpacity:.9,showDir:true});amapOverlays.push(line);amapInstance.add(line);amapInstance.setFitView([...amapOverlays,line],false,[80,30,50,30],17)}else if(typeof map!=='undefined'&&leafletLayer&&typeof L!=='undefined'){const wgs=gcjPathToWgs(gcjPath);L.polyline(wgs,{weight:6,opacity:.9,color:'#d97818'}).addTo(leafletLayer);map.fitBounds(wgs,{padding:[34,34],maxZoom:17})}if(typeof showMapNotice==='function')showMapNotice('已加载高德实际步行道路路线；不是直线示意。')}catch(error){if(typeof showMapNotice==='function')showMapNotice('高德实际步行路线暂不可用；仅显示打卡顺序点，不绘制直线路线。');if(typeof mapEngine!=='undefined'&&mapEngine==='amap'&&amapInstance&&amapOverlays.length)amapInstance.setFitView(amapOverlays,false,[80,30,50,30],16);else if(typeof map!=='undefined'&&anchors.length)map.fitBounds(anchors.map(a=>[a.lat,a.lng]),{padding:[30,30],maxZoom:16})}}\n  function searchAmap`,
  'actual AMap walking photo route',
);

patch('tests-v3/v257-checkin-food-seaview.spec.js','/* global window */','/* global window, document */','browser globals');
patch('tests-v3/v257-checkin-food-seaview.spec.js','toHaveCount(8);','toHaveCount(6);','priority-card count');

const stylesFile='apps/web/src/styles.css';
let styles=fs.readFileSync(stylesFile,'utf8');
if(styles.includes('.workspace-link'))throw new Error('workspace-link style already present unexpectedly');
styles+=`\n.workspace-link {\n  padding: 8px 12px;\n  color: #b8d5d4;\n  font-size: 12px;\n  font-weight: 700;\n  text-decoration: none;\n  border: 1px solid rgba(184, 213, 212, 0.25);\n  border-radius: 999px;\n}\n.workspace-link:hover {\n  color: white;\n  background: rgba(20, 169, 163, 0.24);\n  border-color: rgba(109, 224, 215, 0.62);\n}\n`;
fs.writeFileSync(stylesFile,styles);

console.log('Applied v2.5.7 runtime/data hardening fixes.');
