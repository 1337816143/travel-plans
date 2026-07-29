/* v2.5.2 shared must-eat / must-buy map points and marker identity. Coordinates are WGS84; provider adapters handle GCJ-02 conversion. */
(function(){
  'use strict';
  const data=typeof GIRLFRIEND_WISHLIST!=='undefined'?GIRLFRIEND_WISHLIST:null;
  if(!data||!Array.isArray(data.mapPoints))return;
  const MODE_KEY='trip-wishlist-map-mode-v2.5.2';
  const idSet=new Set(data.mapPoints.map(item=>item.id));
  const foodById=new Map((data.food||[]).map(item=>[item.id,item]));
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const points=data.mapPoints.map(item=>({
    ...item,
    days:[...(item.days||[])],
    wishlistIds:[...(item.wishlistIds||[])],
    source:item.source||'女朋友愿望清单位置核验',
    time:item.time||'按当天行程',
    status:item.status||'位置已收录',
    detail:item.detail||'',
    transport:item.transport||'点击地图标记查看并打开高德导航。',
    tips:item.tips||'营业、库存和供应以到店前再次核验为准。',
    coord:item.coord||'WGS84规划点',
    wishlistPoint:true
  }));
  for(const point of points)if(!POINTS.some(existing=>existing.id===point.id))POINTS.push(point);
  for(const item of data.food||[]){if(item.mapPointId&&idSet.has(item.mapPointId))item.pointId=item.mapPointId}
  function isPoint(value){const id=typeof value==='string'?value:value?.id;return idSet.has(id)}
  function linked(pointOrId){const point=typeof pointOrId==='string'?points.find(item=>item.id===pointOrId):pointOrId;return(point?.wishlistIds||[]).map(id=>foodById.get(id)).filter(Boolean)}
  function readMode(){try{const value=localStorage.getItem(MODE_KEY);return['day','all','off'].includes(value)?value:'day'}catch{return'day'}}
  function refresh(){try{if(typeof rebuildMarkers==='function')rebuildMarkers(typeof selectedDay==='string'?selectedDay:null);if(typeof drawRoutes==='function'&&selectedDay)drawRoutes(selectedDay);if(typeof syncAmapView==='function'&&typeof mapEngine!=='undefined'&&mapEngine==='amap')syncAmapView()}catch{}}
  function setMode(value,{silent=false}={}){const next=['day','all','off'].includes(value)?value:'day';try{localStorage.setItem(MODE_KEY,next)}catch{}if(!silent)refresh();document.dispatchEvent(new CustomEvent('travel:wishlist-map-mode',{detail:{mode:next}}));return next}
  function visible(point,day=null){if(!isPoint(point))return true;const current=readMode();if(current==='off')return false;if(current==='all')return true;if(!day)return true;return(point.days||[]).includes(day)}
  function ensureVisible(id){const point=points.find(item=>item.id===id);if(!point)return false;const day=typeof selectedDay==='string'?selectedDay:null;if(!visible(point,day))setMode('all');else refresh();return true}
  function eatSvg(){return '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 15h18c0 6-3.7 10-9 10S7 21 7 15Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M10 15c.3-3 2.1-4.8 5.8-5.4 4.2-.7 6.3-2.8 6.7-5.4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M13.2 9.2c-1.5-2.1-4.7-1.1-4.7 1.4 0 2.1 2.7 3.7 4.7 5.2 2-1.5 4.7-3.1 4.7-5.2 0-2.5-3.2-3.5-4.7-1.4Z" fill="currentColor"/></svg>'}
  function buySvg(){return '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7.5 11.5h17l-1.2 14h-14.6l-1.2-14Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M12 12V9.5a4 4 0 0 1 8 0V12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M16 17.1c-1.4-2-4.3-1-4.3 1.3 0 2 2.5 3.4 4.3 4.8 1.8-1.4 4.3-2.8 4.3-4.8 0-2.3-2.9-3.3-4.3-1.3Z" fill="currentColor"/></svg>'}
  function markerHtml(point){const eat=point.category==='必吃',check=point.precision!=='exact'&&point.precision!=='address',label=point.mapLabel||point.name;return `<div class="wishlist-map-marker ${eat?'eat':'buy'} ${check?'needs-check':'verified'}" role="button" tabindex="0" aria-label="${esc(point.category)}：${esc(point.name)}"><div class="wishlist-map-logo">${eat?eatSvg():buySvg()}${check?'<span class="wishlist-check-dot">核</span>':''}</div><div class="wishlist-map-label"><b>${esc(label)}</b><small>${check?'到店前核验':'位置已核验'}</small></div></div>`}
  function summary(pointOrId){const items=linked(pointOrId);return items.map(item=>`${item.name}${item.target?' · '+item.target:''}`).join('；')}
  window.WISHLIST_MAP_POINTS=points;
  window.TravelWishlistMap=Object.freeze({points,isPoint,linked,summary,visible,mode:readMode,setMode,ensureVisible,markerHtml,key:MODE_KEY});
})();
