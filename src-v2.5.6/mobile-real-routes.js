/* v2.5.6 mobile-first actual route, rain alternative and hourly weather layer. */
(function(){
  'use strict';

  const VERSION='2.5.6';
  const ROUTE_DETAIL_KEY='travel-plans-v256:actual-route-details';
  const ROUTE_CACHE_KEY='travel-plans-v256:actual-route-cache';
  const ROUTE_CACHE_MS=6*60*60*1000;
  const HOURLY_CACHE_KEY='travel-plans-v256:hourly-weather';
  const HOURLY_CACHE_MS=30*60*1000;
  const STATUS=window.__QINGDAO_OPS_STATUS_V256__||{beaches:[],scenicAndIndoor:[]};
  const routeMemory=new Map();
  let routeProvider=null;
  let routeDetailsEnabled=false;
  let swipeStart=null;
  let lastTouchTap={at:0,target:null};
  let hourlyWeatherCache={};

  const RAIN_PLANS={
    '08-09':{
      title:'市南核心区室内落地日',
      note:'抵达日不跨区追景；把入住、补给和第二天准备放在第一优先级。',
      stops:[
        ['青岛云上海天','09:00–21:00，20:00停止入场；低云或海雾时只作为室内展览/休息，不承诺高空视野。','haitian-view'],
        ['万象城／住宿区室内休息','只在抵达早、体力允许时短停；不新增远距离打卡。',null]
      ]
    },
    '08-10':{
      title:'老城周一雨天方案',
      note:'8月10日为周一，避开周一闭馆的市博物馆、总督楼和市美术馆。',
      stops:[
        ['青岛海底世界','官网当前暑期时段07:30–21:00，20:00停止售票；从老城线路就近切换。','underwater'],
        ['青岛天后宫','暑期延时开放至18:30；周二闭馆，因此周一可作为老城室内/半室内备选。',null],
        ['上街里室内餐饮＋早返酒店','雷电、积水或强风持续时不为了“补点”继续步行。',null]
      ]
    },
    '08-11':{
      title:'东岸就近室内方案',
      note:'取消日出、小麦岛、海之恋和浴场近岸活动，优先东部室内场馆，减少横跨城区。',
      stops:[
        ['青岛市博物馆','暑期延时开放至19:00；8月11日为周二，可作为东岸核心雨天点。',null],
        ['海信探索中心／东部室内场馆','按当日票务和营业状态二选一，避免多个付费馆堆叠。',null],
        ['酒店长午休','保留原行程的补觉目标，不把雨天改成高强度室内暴走。','hotel-zone']
      ]
    },
    '08-12':{
      title:'老城博物馆组',
      note:'与原小鱼山—琴屿路路线同片区，尽量用短距离切换完成雨天替代。',
      stops:[
        ['青岛海底世界','莱阳路2号，当前官网暑期07:30–21:00。','underwater'],
        ['青岛中国海军博物馆','仅在已经实名预约的前提下使用；室外舰艇区是否开放以当天现场为准。','naval'],
        ['青岛德国总督楼旧址博物馆','暑期延时至18:30；8月12日周三正常工作日。',null]
      ]
    },
    '08-13':{
      title:'崂山天气不宜时不进山',
      note:'雷雨、大风、地质风险或官方临时关闭时直接放弃进山，不把其他山口当替代。',
      stops:[
        ['青岛市博物馆','东部室内主选，暑期延时至19:00。',null],
        ['沙子口休闲广场','仅小雨结束、无雷电且能见度恢复时作为短时岸上观景；持续降雨时不去。','shazikou-square'],
        ['住宿区室内晚餐＋休息','把体力留给天气恢复后的固定行程。','hotel-zone']
      ]
    },
    '08-14':{
      title:'黄岛就近雨天方案',
      note:'已经到西海岸时不再为了室内点跨海折返；若出发前已确定强降雨，则可直接留市区。',
      stops:[
        ['青岛西海岸博物馆','七墩山路157号；周二至周日09:00–17:00，16:00停止入馆。',null],
        ['Vya无涯coffee','用户新增黄岛休闲候选；精确门店仍需在高德搜索结果中当场确认，不创建虚假坐标。','search:Vya无涯coffee 青岛 黄岛'],
        ['正规酒店／商场长休息','不去金沙滩下水、鱼鸣嘴近岸和私人船。','dayroom']
      ]
    },
    '08-15':{
      title:'市中心室内＋高空观景候选',
      note:'保留已经验证营业制度的室内点；海上体验和燕儿岛在雨风条件不佳时取消。',
      stops:[
        ['青岛啤酒博物馆','7—8月07:30–19:30，18:30停止入场。','beer'],
        ['青岛云上海天','09:00–21:00，20:00停止入场；低云时不把“看远景”作为购买理由。','haitian-view'],
        ['万象城／五四广场地下商业','就近吃饭和休息；雷电未解除不在广场长时间停留。',null]
      ]
    },
    '08-16':{
      title:'返程日只补一个近距离室内点',
      note:'返程缓冲优先于补漏。按此前遗漏和交通方向只选一个。',
      stops:[
        ['青岛云上海天／青岛海底世界／总督楼旧址','三选一，不叠加；同时检查周几闭馆和返程方向。','haitian-view'],
        ['提前午餐＋取行李','至少保留前往车站或机场的延误缓冲。','hotel-zone']
      ]
    }
  };

  const ITEM_POINT_MAP={
    '08-09':{0:['hotel-zone',0],1:['hotel-zone',0],2:['hotel-zone',0],3:['hotel-zone',0]},
    '08-10':{0:['hotel-zone',0],2:['rent-zone',0],5:['hotel-zone',1],7:['signal',0],9:['zhanqiao',0]},
    '08-11':{1:['sculpture',0],2:['hotel-zone',1],3:['hotel-zone',1],6:['sea-love',0],7:['sea-love',0],9:['xiaomai',0],11:['shilaoren',0],12:['hotel-zone',2]},
    '08-12':{1:['xiaoyushan',0],3:['qinyu',0],4:['xiaoqingdao',0],7:['hotel-zone',1],9:['badaguan',0]},
    '08-13':{2:['dhedong',0],4:['taiqing',0],6:['taiqing',0],8:['dhedong',1],9:['hotel-zone',1]},
    '08-14':{1:['tianmushan',0],2:['golden',0],4:['dayroom',0],6:['yumingzui',0],7:['tianmushan',1],8:['hotel-zone',1]},
    '08-15':{1:['beer',0],4:['hotel-zone',1],6:['yanerdao',0],7:['aofan',0],9:['mayfourth',0]},
    '08-16':{0:['hotel-zone',0],1:['buffer',0],3:['buffer',0]}
  };

  const MODE_HINTS={
    'hotel-zone>rent-zone':'transit','rent-zone>signal':'transit','signal>zhanqiao':'driving','zhanqiao>hotel-zone':'transit',
    'hotel-zone>sculpture':'driving','sculpture>hotel-zone':'driving','hotel-zone>sea-love':'driving','sea-love>xiaomai':'driving','xiaomai>shilaoren':'driving','shilaoren>hotel-zone':'transit',
    'hotel-zone>xiaoyushan':'driving','xiaoyushan>qinyu':'walking','qinyu>xiaoqingdao':'walking','xiaoqingdao>hotel-zone':'transit','hotel-zone>badaguan':'driving','badaguan>hotel-zone':'driving',
    'hotel-zone>dhedong':'transit','dhedong>taiqing':'driving','taiqing>dhedong':'driving','dhedong>hotel-zone':'transit',
    'hotel-zone>tianmushan':'transit','tianmushan>golden':'driving','golden>dayroom':'driving','dayroom>yumingzui':'driving','yumingzui>tianmushan':'driving','tianmushan>hotel-zone':'transit',
    'hotel-zone>beer':'driving','beer>hotel-zone':'driving','hotel-zone>yanerdao':'driving','yanerdao>aofan':'driving','aofan>mayfourth':'walking','mayfourth>hotel-zone':'walking'
  };

  function esc(value){return typeof escapeHtml==='function'?escapeHtml(value):String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function mobile(){return matchMedia('(max-width:800px)').matches}
  function point(id){return typeof pointById==='function'?pointById(id):null}
  function schedule(date){return (typeof SCHEDULES!=='undefined'?SCHEDULES:[]).find(item=>item.date===date)||null}
  function modeLabel(mode){return mode==='walking'?'步行':mode==='transit'?'公交 / 地铁':'驾车 / 网约车'}
  function formatDistance(value){const n=Number(value)||0;return n>=1000?(n/1000).toFixed(n>=10000?0:1)+' km':Math.round(n)+' m'}
  function formatMinutes(value){const n=Math.max(1,Math.round(Number(value)||0));return n>=60?Math.floor(n/60)+'小时'+(n%60?n%60+'分钟':''):n+'分钟'}
  function safeRead(key,fallback){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback}catch{return fallback}}
  function safeWrite(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
  function drawerCover(){const drawer=document.getElementById('mobileRouteDrawer');if(!mobile()||!drawer||drawer.hidden||drawer.dataset.state==='hidden'||drawer.dataset.state==='collapsed')return 0;const rect=drawer.getBoundingClientRect();return Math.max(0,Math.min(innerHeight,innerHeight-Math.max(0,rect.top)))}
  function mapPadding(){const cover=drawerCover();return{top:86,right:24,bottom:cover?cover+24:82,left:24}}

  function addPoint(data,icon){if(typeof POINTS==='undefined'||POINTS.some(item=>item.id===data.id))return;POINTS.push(data);if(typeof POINT_ICONS!=='undefined')POINT_ICONS[data.id]=icon}
  function installAddedPlaces(){
    addPoint({id:'shazikou-square',name:'沙子口休闲广场',category:'备选',lat:36.11072,lng:120.53807,days:[],time:'晴天／雨后能见度好时短停',status:'公开位置已核验·天气动态',detail:'崂山区沙子口街道海岸休闲广场。用户新增为观景休闲候选；晴天能见度好时优先。',transport:'4号线沙子口站C口后步行；公开文旅信息约700米，按步速与过街预留10–20分钟。',tips:'雷电、大风、海雾、中大雨或岸线临时管控时不安排。',coord:'WGS84，公开位置与地图交叉核验',source:'青岛公开文旅信息＋高德地图位置核验',sourceUrl:'https://qd.bendibao.com/xiuxian/2026414/100973.shtm',mapUrl:'https://ditu.amap.com/search?query=%E6%B2%99%E5%AD%90%E5%8F%A3%E4%BC%91%E9%97%B2%E5%B9%BF%E5%9C%BA%20%E9%9D%92%E5%B2%9B'},'🌊');
    addPoint({id:'haitian-view',name:'青岛云上海天',category:'备选',lat:36.0547,lng:120.3636,days:[],time:'09:00–21:00；20:00停止入场',status:'官方开放时段已核验·视野受天气影响',detail:'香港西路48号海天中心T2，高空观景与艺术空间；可作为市南雨天/休闲候选。',transport:'市南核心区短程网约车；也可结合八大关、五四广场一带。',tips:'低云、海雾、持续强降雨时高空视野明显受限；购票前先看能见度。',coord:'WGS84，海天中心公开地址近似入口',source:'青岛国信文旅官方服务页',sourceUrl:'https://qdgxwl.com/service.html',mapUrl:'https://ditu.amap.com/search?query=%E9%9D%92%E5%B2%9B%E4%BA%91%E4%B8%8A%E6%B5%B7%E5%A4%A9'},'☁');
  }

  function amapSearchKeyword(keyword){
    try{
      if(typeof toggleAmapServicePanel==='function')toggleAmapServicePanel(true);
      if(typeof amapShowPane==='function')amapShowPane('search');
      const input=document.getElementById('amapSearchInput');if(input)input.value=keyword;
      if(typeof amapSearchPlaces==='function')return Promise.resolve(amapSearchPlaces());
    }catch(error){console.warn('AMap keyword search failed',error)}
    window.open('https://ditu.amap.com/search?query='+encodeURIComponent(keyword),'_blank','noopener');
    return Promise.resolve(null);
  }

  function installFoodAndLeisure(){
    const data=window.GIRLFRIEND_WISHLIST;
    if(data?.food&&!data.food.some(item=>item.id==='food-ben-geli-v256'))data.food.push({id:'food-ben-geli-v256',name:'笨蛤蜊地标小吃大排档',original:'笨蛤蜊地标小吃大排档',category:'必吃',target:'用户新增必吃候选；露台观景／夜景，手剥山竹榴莲为用户描述',status:'user-added-store-unverified',address:'精确门店地址尚未获得可复核公开证据',mapUrl:'https://ditu.amap.com/search?query=%E7%AC%A8%E8%9B%A4%E8%9C%8A%E5%9C%B0%E6%A0%87%E5%B0%8F%E5%90%83%E5%A4%A7%E6%8E%92%E6%A1%A3%20%E9%9D%92%E5%B2%9B',note:'已加入必吃。为了避免把同名/相似门店误标到地图，当前不创建虚假固定坐标；到店前用高德搜索结果确认店名、地址、明码标价和营业状态。',girlfriendMust:true});
  }

  function decorateFoodPanel(){
    const panel=document.querySelector('[data-panel="food"]');if(!panel||panel.querySelector('[data-v256-ben-geli]'))return;
    const target=panel.querySelector('.food-search-results')||panel;
    const card=document.createElement('article');card.className='food-search-card girlfriend-must v256-unverified-food';card.dataset.v256BenGeli='true';
    card.innerHTML='<div class="food-search-logo wishlist-original eat"><span>蛤</span><em>必吃</em></div><div class="food-search-main"><div class="food-search-title"><h3>笨蛤蜊地标小吃大排档</h3><span class="food-special-chip">新增必吃</span></div><p class="food-target"><b>用户记录：</b>露台观景／夜景；手剥山竹榴莲。</p><div class="food-meta"><span class="warn">精确门店待核验</span><span>不创建虚假地图坐标</span></div><p class="food-address">📍 到店前由高德搜索结果确认具体门店</p><div class="food-search-actions"><button type="button" data-v256-amap-search="笨蛤蜊地标小吃大排档 青岛">高德核店</button></div></div>';
    target.prepend(card);
  }

  function leisurePanelHtml(){return '<section class="v256-leisure-panel"><div class="v256-section-head"><div><span>BACKUP VIEW & REST</span><h3>备选观景・休闲</h3></div><small>不挤入固定日程，按天气和就近原则启用</small></div><div class="v256-leisure-grid">'+[
      ['沙子口休闲广场','晴天或雨后能见度好时短停；4号线沙子口站C口后步行约10–20分钟。','shazikou-square'],
      ['Vya无涯coffee','黄岛休闲候选；用户提供的人均/榜单为快照，精确门店地址仍需高德当场确认。','search:Vya无涯coffee 青岛 黄岛'],
      ['青岛云上海天','香港西路48号海天中心T2；09:00–21:00，20:00停止入场。低云时不以远眺为目的。','haitian-view']
    ].map(item=>'<article><b>'+esc(item[0])+'</b><p>'+esc(item[1])+'</p><button type="button" data-v256-leisure="'+esc(item[2])+'">'+(item[2].startsWith('search:')?'高德核店':'地图查看')+'</button></article>').join('')+'</div></section>'}

  function decorateLeisurePanel(){
    const panel=document.querySelector('[data-panel="recommend"]');if(!panel||panel.querySelector('.v256-leisure-panel'))return;
    panel.insertAdjacentHTML('beforeend',leisurePanelHtml());
  }

  function modeFor(a,b){return MODE_HINTS[a.id+'>'+b.id]||'driving'}
  function routeKey(date,index,a,b,mode){return [date,index,a.id,b.id,mode].join(':')}
  function positionGcj(p){const converted=typeof wgs84ToGcj02==='function'?wgs84ToGcj02(p.lat,p.lng):[p.lat,p.lng];return[converted[1],converted[0]]}
  function parsePolyline(value){if(!value)return[];if(Array.isArray(value))return value.flatMap(parsePolyline);if(typeof value==='string')return value.split(';').map(part=>part.split(',').map(Number)).filter(pair=>pair.length===2&&pair.every(Number.isFinite));if(typeof value==='object'){
      if(Number.isFinite(Number(value.lng))&&Number.isFinite(Number(value.lat)))return[[Number(value.lng),Number(value.lat)]];
      if(typeof value.getLng==='function'&&typeof value.getLat==='function')return[[Number(value.getLng()),Number(value.getLat())]];
    }return[]}
  function collectPolyline(node,out=[],seen=new Set()){
    if(!node||typeof node!=='object'||seen.has(node))return out;seen.add(node);
    if('polyline'in node)out.push(...parsePolyline(node.polyline));
    if('path'in node)out.push(...parsePolyline(node.path));
    if(Array.isArray(node)){for(const item of node)collectPolyline(item,out,seen);return out}
    for(const [key,value] of Object.entries(node)){if(key==='polyline'||key==='path')continue;if(value&&typeof value==='object')collectPolyline(value,out,seen)}return out
  }
  function normalizeRouteResponse(data,mode){
    const route=data?.route||data;
    const candidate=mode==='transit'?(route?.transits?.[0]||route?.plans?.[0]||data?.plans?.[0]):(route?.paths?.[0]||data?.routes?.[0]);
    if(!candidate)throw new Error('高德未返回可用路线');
    const distance=Number(candidate.distance??candidate.walking_distance??route?.distance??0);
    const seconds=Number(candidate.cost?.duration??candidate.duration??candidate.time??0);
    const polyline=collectPolyline(candidate).filter((pair,index,array)=>index===0||pair[0]!==array[index-1]?.[0]||pair[1]!==array[index-1]?.[1]);
    if(!Number.isFinite(distance)||distance<=0)throw new Error('高德路线缺少实际里程');
    if(!Number.isFinite(seconds)||seconds<=0)throw new Error('高德路线缺少实际耗时');
    return{distanceMeters:distance,durationMinutes:seconds/60,polyline,provider:'高德地图实际路线',queriedAt:new Date().toISOString(),estimated:false}
  }
  async function queryAmapRoute(input){
    if(typeof amapWebRequest!=='function')throw new Error('高德 Web 路线服务尚未加载');
    const origin=positionGcj(input.from).join(','),destination=positionGcj(input.to).join(',');
    let endpoint='/v5/direction/driving',params={origin,destination,show_fields:'cost,navi,polyline',strategy:'0'};
    if(input.mode==='walking'){endpoint='/v5/direction/walking';params={origin,destination,show_fields:'cost,navi,polyline'}}
    if(input.mode==='transit'){endpoint='/v5/direction/transit/integrated';params={origin,destination,city1:'370200',city2:'370200',show_fields:'cost,navi,polyline'}}
    const data=await amapWebRequest(endpoint,params);return normalizeRouteResponse(data,input.mode)
  }
  function loadRouteCache(){const cache=safeRead(ROUTE_CACHE_KEY,{});for(const [key,value] of Object.entries(cache||{})){if(value&&Date.now()-Date.parse(value.queriedAt||0)<ROUTE_CACHE_MS)routeMemory.set(key,value)}}
  function persistRouteCache(){const object={};for(const [key,value] of routeMemory.entries())if(value?.ok&&Date.now()-Date.parse(value.queriedAt||0)<ROUTE_CACHE_MS)object[key]=value;safeWrite(ROUTE_CACHE_KEY,object)}
  async function getSegment(date,index,a,b){
    const mode=modeFor(a,b),key=routeKey(date,index,a,b,mode),cached=routeMemory.get(key);if(cached&&Date.now()-Date.parse(cached.queriedAt||0)<ROUTE_CACHE_MS)return cached;
    const invoke=routeProvider||queryAmapRoute;
    try{const result=await invoke({date,index,from:a,to:b,mode});const value={ok:true,date,index,fromId:a.id,toId:b.id,mode,...result,queriedAt:result.queriedAt||new Date().toISOString()};routeMemory.set(key,value);persistRouteCache();return value}catch(error){const value={ok:false,date,index,fromId:a.id,toId:b.id,mode,error:error?.message||String(error),queriedAt:new Date().toISOString()};routeMemory.set(key,value);return value}
  }
  async function ensureDay(date){
    const day=schedule(date);if(!day)return[];const points=routePoints(day);const tasks=[];for(let index=0;index<points.length-1;index++){const a=points[index],b=points[index+1];if(!a||!b)continue;tasks.push(getSegment(date,index,a,b))}
    const segments=[];for(let i=0;i<tasks.length;i+=2){segments.push(...await Promise.all(tasks.slice(i,i+2)))}
    renderRouteDetails(date,segments);if(selectedDay===date)drawActualDay(date,segments);return segments
  }

  function routeDetailsHtml(date,segments){
    if(!segments.length)return'<div class="v256-route-empty">本日没有需要计算的点到点交通段。</div>';
    return'<div class="v256-route-source"><b>高德实际道路路线</b><span>里程／耗时由高德路线服务返回；默认隐藏，刷新后可能随路况和公交方案变化。</span></div><div class="v256-route-segments">'+segments.map(segment=>{
      const a=point(segment.fromId),b=point(segment.toId);if(!segment.ok)return'<article class="v256-route-segment is-error"><span>'+esc(modeLabel(segment.mode))+'</span><b>'+esc(shortName(a?.name||segment.fromId))+' → '+esc(shortName(b?.name||segment.toId))+'</b><small>真实路线未加载：'+esc(segment.error||'服务不可用')+'</small></article>';
      const special=segment.fromId==='dhedong'&&segment.toId==='taiqing'?'<small>此段只表示道路几何与行车耗时参考；景区观光车班次和调度仍以崂山现场为准。</small>':'';
      return'<article class="v256-route-segment"><span>'+esc(modeLabel(segment.mode))+'</span><b>'+esc(shortName(a?.name||segment.fromId))+' → '+esc(shortName(b?.name||segment.toId))+'</b><strong>'+esc(formatDistance(segment.distanceMeters))+' · '+esc(formatMinutes(segment.durationMinutes))+'</strong>'+special+'</article>'
    }).join('')+'</div>'
  }
  function renderRouteDetails(date,segments){const box=document.querySelector('[data-v256-route-details="'+CSS.escape(date)+'"]');if(!box)return;box.innerHTML=routeDetailsHtml(date,segments);box.hidden=!routeDetailsEnabled}

  function gcjToWgs(pair){let lng=Number(pair[0]),lat=Number(pair[1]),wLat=lat,wLng=lng;if(typeof wgs84ToGcj02!=='function')return[lat,lng];for(let i=0;i<4;i++){const converted=wgs84ToGcj02(wLat,wLng);wLat-=converted[0]-lat;wLng-=converted[1]-lng}return[wLat,wLng]}
  function actualGeometry(segments){return segments.filter(item=>item.ok&&item.polyline?.length>1).flatMap(item=>item.polyline)}
  function fitLeaflet(coords,maxZoom=15){if(!map||typeof L==='undefined'||!coords.length)return;const padding=mapPadding(),bounds=L.latLngBounds(coords.map(gcjToWgs));map.fitBounds(bounds.pad(.04),{maxZoom,paddingTopLeft:[padding.left,padding.top],paddingBottomRight:[padding.right,padding.bottom],animate:true})}
  function fitAmap(coords,maxZoom=15){if(!amapInstance||typeof AMap==='undefined'||!coords.length)return;let minLng=Infinity,minLat=Infinity,maxLng=-Infinity,maxLat=-Infinity;coords.forEach(([lng,lat])=>{minLng=Math.min(minLng,lng);minLat=Math.min(minLat,lat);maxLng=Math.max(maxLng,lng);maxLat=Math.max(maxLat,lat)});const padding=mapPadding(),bounds=new AMap.Bounds([minLng,minLat],[maxLng,maxLat]),avoid=[padding.top,padding.right,padding.bottom,padding.left];try{const fit=amapInstance.getFitZoomAndCenterByBounds(bounds,avoid,maxZoom);if(fit?.length===2)amapInstance.setZoomAndCenter(fit[0],fit[1]);else amapInstance.setBounds(bounds,false,avoid)}catch{amapInstance.setBounds(bounds,false,avoid)}}
  function drawActualDay(date,segments){
    const day=schedule(date);if(!day)return;const valid=segments.filter(item=>item.ok&&item.polyline?.length>1),coords=actualGeometry(valid);
    if(mapEngine==='amap'&&amapInstance&&typeof AMap!=='undefined'){
      try{if(amapOverlays?.length){amapInstance.remove(amapOverlays);amapOverlays=[]}const lines=valid.map(segment=>new AMap.Polyline({path:segment.polyline,strokeColor:day.color,strokeWeight:6,strokeOpacity:.92,lineJoin:'round',lineCap:'round',zIndex:60}));if(lines.length){amapInstance.add(lines);amapOverlays.push(...lines)}if(coords.length)fitAmap(coords,15);else fitVisibleDayPoints(date)}catch(error){console.warn('AMap actual route render failed',error)}
      return;
    }
    if(map&&routeLayer&&typeof L!=='undefined'){
      routeLayer.clearLayers();for(const segment of valid)L.polyline(segment.polyline.map(gcjToWgs),{color:day.color,weight:5,opacity:.94,lineCap:'round',lineJoin:'round'}).addTo(routeLayer);if(coords.length)fitLeaflet(coords,15);else fitVisibleDayPoints(date)
    }
  }
  function fitVisibleDayPoints(date){const day=schedule(date),points=day?routePoints(day):[];if(!points.length)return;const padding=mapPadding();if(mapEngine==='amap'&&amapInstance&&typeof AMap!=='undefined'){const coords=points.map(positionGcj);fitAmap(coords,15);return}if(map&&typeof L!=='undefined'){const bounds=L.latLngBounds(points.map(p=>[p.lat,p.lng]));map.fitBounds(bounds.pad(.08),{maxZoom:15,paddingTopLeft:[padding.left,padding.top],paddingBottomRight:[padding.right,padding.bottom]})}}

  function focusPointVisible(id,{openPopup=true,related=[]}={}){
    const p=point(id);if(!p)return;const relatedPoints=[...new Set([id,...related])].map(point).filter(Boolean);const padding=mapPadding();
    if(mapEngine==='amap'&&amapInstance&&typeof AMap!=='undefined'){
      const coords=relatedPoints.map(positionGcj);if(coords.length>1)fitAmap(coords,16);else{const pos=positionGcj(p);amapInstance.setZoomAndCenter(16,pos);const cover=drawerCover();if(cover)setTimeout(()=>amapInstance?.panBy?.(0,-Math.round(cover*.45)),80)}
      try{if(openPopup&&typeof amapOpenPoint==='function'){setTimeout(()=>{amapOpenPoint(id);const cover=drawerCover();if(cover)setTimeout(()=>amapInstance?.panBy?.(0,-Math.round(cover*.45)),80)},120)}}catch{}
      return;
    }
    if(!map||typeof L==='undefined')return;
    if(relatedPoints.length>1){const bounds=L.latLngBounds(relatedPoints.map(item=>[item.lat,item.lng]));map.fitBounds(bounds.pad(.1),{maxZoom:16,paddingTopLeft:[padding.left,padding.top],paddingBottomRight:[padding.right,padding.bottom]})}else{map.setView([p.lat,p.lng],16,{animate:true})}
    if(openPopup){const marker=markers?.get?.(id);if(marker)setTimeout(()=>{try{marker.openPopup();const cover=drawerCover();if(cover)map.panBy([0,Math.round(cover*.43)],{animate:true})}catch{}},140)}
  }

  function installFocusPatch(){
    if(typeof focusPoint==='function'&&!focusPoint.__v256){const previous=focusPoint;focusPoint=Object.assign(function(id){const result=previous(id);setTimeout(()=>focusPointVisible(id,{openPopup:true}),100);return result},{__v256:true})}
  }

  function rainSlide(date){const plan=RAIN_PLANS[date];if(!plan)return'<section class="v256-plan-slide v256-rain-slide" data-plan-slide="rain"><div class="v256-rain-empty">本日暂无额外雨天方案。</div></section>';
    return'<section class="v256-plan-slide v256-rain-slide" data-plan-slide="rain"><div class="v256-rain-plan-head"><span>RAIN PLAN · 就近替代</span><h4>'+esc(plan.title)+'</h4><p>'+esc(plan.note)+'</p></div><div class="v256-rain-stops">'+plan.stops.map((stop,index)=>'<article><span>'+String(index+1).padStart(2,'0')+'</span><div><b>'+esc(stop[0])+'</b><p>'+esc(stop[1])+'</p></div>'+(stop[2]?'<button type="button" data-v256-rain-focus="'+esc(stop[2])+'">'+(String(stop[2]).startsWith('search:')?'高德核验':'地图查看')+'</button>':'')+'</article>').join('')+'</div><div class="v256-rain-official-note">景区／浴场状态以本页官方状态快照＋当天官方临时公告为准；恶劣天气、红旗、广播或现场工作人员指令优先。</div></section>'
  }

  function pointForTimeline(date,index){const mapped=ITEM_POINT_MAP[date]?.[index];if(!mapped)return null;const day=schedule(date),id=mapped[0],occurrence=mapped[1]||0;let seen=0;const route=day?.route||[];for(let i=0;i<route.length;i++){if(route[i]!==id)continue;if(seen===occurrence)return{id,routeIndex:i};seen++}return{id,routeIndex:route.indexOf(id)}}
  function decorateTimeline(card,date){const timeline=card.querySelector('.timeline');if(!timeline)return;const children=[...timeline.children];for(let itemIndex=0;itemIndex<Math.floor(children.length/2);itemIndex++){const text=children[itemIndex*2+1],mapped=pointForTimeline(date,itemIndex);if(!text||!mapped)continue;text.classList.add('v256-time-focus');text.dataset.v256Point=mapped.id;text.dataset.v256RouteIndex=String(mapped.routeIndex);text.dataset.v256Date=date;text.tabIndex=0;text.title='双击／双击触屏：地图定位并查看前后实际路线'} }
  function planPager(card,date){const body=card.querySelector('.day-body');if(!body||body.querySelector('.v256-day-plan-pager'))return;const controls=document.createElement('div');controls.className='v256-plan-switch';controls.innerHTML='<button type="button" class="active" data-v256-plan-tab="normal">原行程</button><button type="button" data-v256-plan-tab="rain">雨天备选</button><span>左右滑动切换</span>';
    const pager=document.createElement('div');pager.className='v256-day-plan-pager';pager.dataset.v256Pager=date;const normal=document.createElement('section');normal.className='v256-plan-slide v256-normal-slide';normal.dataset.planSlide='normal';while(body.firstChild)normal.appendChild(body.firstChild);pager.appendChild(normal);pager.insertAdjacentHTML('beforeend',rainSlide(date));body.append(controls,pager);
    const routeBox=document.createElement('section');routeBox.className='v256-route-details';routeBox.dataset.v256RouteDetails=date;routeBox.hidden=!routeDetailsEnabled;routeBox.innerHTML='<div class="v256-route-loading">选择本日或开启“实际交通”后加载高德实际道路路线。</div>';const timeline=normal.querySelector('.timeline');(timeline?.parentNode||normal).insertBefore(routeBox,timeline?.nextSibling||null);
    decorateTimeline(card,date);
    const updateTab=()=>{const index=Math.round(pager.scrollLeft/Math.max(1,pager.clientWidth));controls.querySelectorAll('[data-v256-plan-tab]').forEach((button,i)=>button.classList.toggle('active',i===index))};pager.addEventListener('scroll',()=>requestAnimationFrame(updateTab),{passive:true});controls.querySelectorAll('[data-v256-plan-tab]').forEach((button,index)=>button.addEventListener('click',()=>pager.scrollTo({left:index*pager.clientWidth,behavior:'smooth'})))
  }
  function routeToggleHtml(){return'<div class="v256-route-toggle"><div><b>实际交通</b><small>高德实际路线、里程和耗时；默认隐藏</small></div><button type="button" data-v256-route-toggle aria-pressed="'+String(routeDetailsEnabled)+'">'+(routeDetailsEnabled?'已显示':'显示')+'</button></div>'}
  function decorateDays(){const root=document.getElementById('days');if(!root)return;if(!root.previousElementSibling?.classList?.contains('v256-route-toggle'))root.insertAdjacentHTML('beforebegin',routeToggleHtml());root.querySelectorAll('.day-card').forEach(card=>{const date=card.dataset.day;if(date)planPager(card,date)});syncRouteVisibility();}
  function syncRouteVisibility(){document.querySelectorAll('[data-v256-route-details]').forEach(box=>box.hidden=!routeDetailsEnabled);document.querySelectorAll('[data-v256-route-toggle]').forEach(button=>{button.setAttribute('aria-pressed',String(routeDetailsEnabled));button.textContent=routeDetailsEnabled?'已显示':'显示'})}
  function setRouteDetails(enabled){routeDetailsEnabled=Boolean(enabled);safeWrite(ROUTE_DETAIL_KEY,routeDetailsEnabled);syncRouteVisibility();if(routeDetailsEnabled){const open=[...document.querySelectorAll('.day-card[open]')].map(card=>card.dataset.day).filter(Boolean);const days=selectedDay?[selectedDay]:open.slice(0,1);days.forEach(date=>void ensureDay(date))}}

  async function focusContext(date,routeIndex){const day=schedule(date);if(!day)return;const ids=day.route||[],currentId=ids[routeIndex];if(!currentId)return;filterDay(date);const related=[ids[routeIndex-1],ids[routeIndex+1]].filter(Boolean);focusPointVisible(currentId,{openPopup:true,related});const segments=await ensureDay(date),before=segments.find(item=>item.index===routeIndex-1),after=segments.find(item=>item.index===routeIndex);showRouteContext(day,routeIndex,before,after);const contextSegments=[before,after].filter(Boolean);const coords=actualGeometry(contextSegments);if(coords.length){if(mapEngine==='amap')fitAmap(coords,16);else fitLeaflet(coords,16)}}
  function contextSegmentHtml(segment,label){if(!segment)return'<div class="v256-context-route muted">'+esc(label)+'：无相邻交通段</div>';const a=point(segment.fromId),b=point(segment.toId);return'<div class="v256-context-route '+(segment.ok?'':'is-error')+'"><span>'+esc(label)+'</span><b>'+esc(shortName(a?.name||segment.fromId))+' → '+esc(shortName(b?.name||segment.toId))+'</b><small>'+(segment.ok?esc(modeLabel(segment.mode)+' · '+formatDistance(segment.distanceMeters)+' · '+formatMinutes(segment.durationMinutes)):'高德实际路线未加载：'+esc(segment.error||'未知错误'))+'</small></div>'}
  function showRouteContext(day,index,before,after){const box=document.getElementById('dayRouteCard');if(!box)return;box.querySelector('.v256-route-context')?.remove();const ids=day.route||[],previous=point(ids[index-1]),current=point(ids[index]),next=point(ids[index+1]);const panel=document.createElement('section');panel.className='v256-route-context';panel.innerHTML='<div class="v256-context-points">'+[previous,current,next].map((p,i)=>p?'<button type="button" data-v256-context-point="'+esc(p.id)+'" class="'+(i===1?'active':'')+'"><span>'+['前','当前','后'][i]+'</span><b>'+esc(shortName(p.name))+'</b></button>':'<div class="v256-context-placeholder"></div>').join('')+'</div>'+contextSegmentHtml(before,'到达')+contextSegmentHtml(after,'离开');const head=box.querySelector('.day-route-head');head?.insertAdjacentElement('afterend',panel);if(mobile()){const drawer=document.getElementById('mobileRouteDrawer');if(drawer&&drawer.dataset.state==='collapsed')drawer.querySelector('[data-drawer-state="half"]')?.click()}}

  function nextDate(direction){const list=(typeof SCHEDULES!=='undefined'?SCHEDULES:[]).map(item=>item.date),current=selectedDay||document.getElementById('dayRouteCard')?.dataset.day||list[0],index=Math.max(0,list.indexOf(current)),next=Math.max(0,Math.min(list.length-1,index+direction));return list[next]}
  function switchDayBySwipe(direction){const date=nextDate(direction);if(!date||date===selectedDay)return;const drawer=document.getElementById('mobileRouteDrawer'),state=drawer?.dataset.state||'half';filterDay(date);setTimeout(()=>{if(drawer&&state!=='hidden'&&drawer.dataset.state!==state)drawer.querySelector('[data-drawer-state="'+state+'"]')?.click();fitVisibleDayPoints(date);void ensureDay(date)},120);showMapNotice('已切换到8月'+Number(date.slice(3))+'日 · 左右滑动可继续换日')}
  function installDrawerSwipe(){document.addEventListener('pointerdown',event=>{const target=event.target instanceof Element?event.target:null;if(!mobile()||!target?.closest('#mobileRouteDrawer')||target.closest('button,input,select,a,.mobile-drawer-grip'))return;swipeStart={x:event.clientX,y:event.clientY,id:event.pointerId,at:Date.now()}},{passive:true});document.addEventListener('pointerup',event=>{if(!swipeStart||event.pointerId!==swipeStart.id)return;const dx=event.clientX-swipeStart.x,dy=event.clientY-swipeStart.y,duration=Date.now()-swipeStart.at;swipeStart=null;if(duration>700||Math.abs(dx)<56||Math.abs(dx)<Math.abs(dy)*1.25)return;switchDayBySwipe(dx<0?1:-1)},{passive:true})}

  function weatherCodeLabel(code){const c=Number(code);if(c===0)return'晴';if([1,2].includes(c))return'晴间多云';if(c===3)return'阴';if([45,48].includes(c))return'雾';if(c>=51&&c<=57)return'毛毛雨';if(c>=61&&c<=67)return'雨';if(c>=71&&c<=77)return'雪';if(c>=80&&c<=82)return'阵雨';if(c>=95)return'雷暴';return'天气变化'}
  function selectedWeatherDate(){const date=selectedDay||SCHEDULES?.[1]?.date||SCHEDULES?.[0]?.date;return'2026-'+date}
  async function loadHourlyWeather(force=false){const targetDate=selectedWeatherDate(),cached=hourlyWeatherCache[targetDate];if(!force&&cached&&Date.now()-Date.parse(cached.fetchedAt)<HOURLY_CACHE_MS)return cached;const url=new URL('https://api.open-meteo.com/v1/forecast');url.searchParams.set('latitude','36.067');url.searchParams.set('longitude','120.382');url.searchParams.set('timezone','Asia/Shanghai');url.searchParams.set('forecast_days','16');url.searchParams.set('hourly','temperature_2m,apparent_temperature,precipitation_probability,rain,weather_code,wind_speed_10m,visibility');const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error('逐小时天气 HTTP '+response.status);const data=await response.json(),hourly=data.hourly||{},rows=[];(hourly.time||[]).forEach((time,index)=>{if(String(time).slice(0,10)!==targetDate)return;rows.push({time:String(time).slice(11,16),temperature:hourly.temperature_2m?.[index],apparent:hourly.apparent_temperature?.[index],precipitationProbability:hourly.precipitation_probability?.[index],rain:hourly.rain?.[index],code:hourly.weather_code?.[index],wind:hourly.wind_speed_10m?.[index],visibility:hourly.visibility?.[index]})});const result={date:targetDate,rows,fetchedAt:new Date().toISOString(),source:'Open-Meteo逐小时预报'};hourlyWeatherCache[targetDate]=result;safeWrite(HOURLY_CACHE_KEY,hourlyWeatherCache);return result}
  function hourlyWeatherHtml(result){if(!result.rows.length)return'<div class="v256-hourly-empty">选定日期暂不在逐小时预报范围内。</div>';return'<div class="v256-hourly-meta"><b>'+esc(result.date)+'</b><span>逐小时预报 · 降雨概率不是实时雨量</span></div><div class="v256-hourly-scroll">'+result.rows.map(row=>'<article><time>'+esc(row.time)+'</time><b>'+esc(weatherCodeLabel(row.code))+'</b><strong>'+esc(Math.round(Number(row.temperature)||0))+'°</strong><span>降雨 '+esc(Number.isFinite(Number(row.precipitationProbability))?Math.round(Number(row.precipitationProbability)):'—')+'%</span><small>体感 '+esc(Math.round(Number(row.apparent)||0))+'° · 风 '+esc(Math.round(Number(row.wind)||0))+' km/h</small></article>').join('')+'</div>'}
  async function renderHourlyWeather(force=false){const box=document.getElementById('v256HourlyWeather');if(!box)return;box.innerHTML='<div class="v256-route-loading">正在加载选定日逐小时天气与降雨概率…</div>';try{const result=await loadHourlyWeather(force);box.innerHTML=hourlyWeatherHtml(result)}catch(error){box.innerHTML='<div class="v256-hourly-error">逐小时天气加载失败：'+esc(error?.message||error)+'。高德当前天气仍可正常使用。</div>'}}
  function installHourlyWeather(){const card=document.getElementById('amapWeatherCard');if(!card||document.getElementById('v256HourlyWeather'))return;const section=document.createElement('section');section.className='v256-hourly-weather';section.innerHTML='<div class="v256-hourly-head"><div><b>选定日逐小时天气</b><small>全天各时段＋降雨概率</small></div><button type="button" data-v256-hourly-refresh>刷新</button></div><div id="v256HourlyWeather"><div class="v256-route-loading">打开地图助手后加载。</div></div>';card.insertAdjacentElement('afterend',section);void renderHourlyWeather(false)}

  function statusPanelHtml(){const beaches=STATUS.beaches||[],scenic=STATUS.scenicAndIndoor||[];return'<section class="v256-status-panel"><div class="v256-section-head"><div><span>OFFICIAL STATUS · '+esc(STATUS.checkedAt||'')+'</span><h3>浴场／景区官方状态</h3></div><small>官方营业制度 ≠ 现场绿旗；临时公告优先</small></div><details><summary>9处海水浴场</summary><div class="v256-status-list">'+beaches.map(item=>'<article><b>'+esc(item.name)+'</b><span class="is-open">官方开放季／服务时段已公布</span><p>'+esc(item.tripWindowHours||'')+'</p><small>现场旗语：需当天核实 · '+esc(item.phone||'')+'</small></article>').join('')+'</div></details><details><summary>主要景区与室内场馆</summary><div class="v256-status-list">'+scenic.map(item=>'<article><b>'+esc(item.name)+'</b><span class="is-open">'+esc(item.officialPublishedState||'官方状态已核验')+'</span><p>'+esc(item.hours||'')+'</p><small>'+esc(item.note||item.address||'临时调整以官方当天公告为准')+'</small></article>').join('')+'</div></details></section>'}
  function decorateStatus(){const rain=document.querySelector('[data-panel="rain"]');if(!rain||rain.querySelector('.v256-status-panel'))return;rain.insertAdjacentHTML('afterbegin',statusPanelHtml())}

  function patchRenderDays(){if(typeof renderDays!=='function'||renderDays.__v256)return;const original=renderDays;renderDays=Object.assign(function(...args){const result=original(...args);decorateDays();return result},{__v256:true})}
  function patchDaySelection(){if(typeof filterDay!=='function'||filterDay.__v256Actual)return;const original=filterDay;filterDay=Object.assign(function(date,...rest){const result=original(date,...rest);setTimeout(()=>{fitVisibleDayPoints(date);void ensureDay(date);void renderHourlyWeather(false)},120);return result},{__v256Actual:true})}
  function installObservers(){const observer=new MutationObserver(()=>{decorateFoodPanel();decorateLeisurePanel();decorateStatus();installHourlyWeather()});observer.observe(document.body,{childList:true,subtree:true});}
  function bindEvents(){
    document.addEventListener('click',event=>{const target=event.target instanceof Element?event.target:null;if(!target)return;const toggle=target.closest('[data-v256-route-toggle]');if(toggle){setRouteDetails(!routeDetailsEnabled);return}const search=target.closest('[data-v256-amap-search]');if(search){void amapSearchKeyword(search.dataset.v256AmapSearch);return}const leisure=target.closest('[data-v256-leisure]');if(leisure){const value=leisure.dataset.v256Leisure;if(value.startsWith('search:'))void amapSearchKeyword(value.slice(7));else focusPointVisible(value,{openPopup:true});return}const rain=target.closest('[data-v256-rain-focus]');if(rain){const value=rain.dataset.v256RainFocus;if(value.startsWith('search:'))void amapSearchKeyword(value.slice(7));else focusPointVisible(value,{openPopup:true});return}const context=target.closest('[data-v256-context-point]');if(context){focusPointVisible(context.dataset.v256ContextPoint,{openPopup:true});return}if(target.closest('[data-v256-hourly-refresh]')){void renderHourlyWeather(true);return}});
    document.addEventListener('dblclick',event=>{const target=event.target instanceof Element?event.target.closest('.v256-time-focus'):null;if(!target)return;event.preventDefault();void focusContext(target.dataset.v256Date,Number(target.dataset.v256RouteIndex))});
    document.addEventListener('pointerup',event=>{if(event.pointerType!=='touch')return;const target=event.target instanceof Element?event.target.closest('.v256-time-focus'):null;if(!target)return;const now=Date.now();if(lastTouchTap.target===target&&now-lastTouchTap.at<360){event.preventDefault();lastTouchTap={at:0,target:null};void focusContext(target.dataset.v256Date,Number(target.dataset.v256RouteIndex));return}lastTouchTap={at:now,target}}, {passive:false});
    document.addEventListener('toggle',event=>{const card=event.target instanceof Element?event.target.closest('.day-card'):null;if(card?.open&&routeDetailsEnabled&&card.dataset.day)void ensureDay(card.dataset.day)},true);
    document.addEventListener('travel:state-change',event=>{const date=event.detail?.state?.selectedDay;if(date){setTimeout(()=>{void ensureDay(date);void renderHourlyWeather(false)},80)}});
  }

  function install(){
    routeDetailsEnabled=Boolean(safeRead(ROUTE_DETAIL_KEY,false));
    hourlyWeatherCache=safeRead(HOURLY_CACHE_KEY,{})||{};
    loadRouteCache();installAddedPlaces();installFoodAndLeisure();patchRenderDays();patchDaySelection();installFocusPatch();installDrawerSwipe();bindEvents();installObservers();
    decorateDays();decorateFoodPanel();decorateLeisurePanel();decorateStatus();installHourlyWeather();
    window.TravelActualRoutes=Object.freeze({version:VERSION,ensureDay,focusContext,fitDay:fitVisibleDayPoints,setDetails:setRouteDetails,detailsEnabled:()=>routeDetailsEnabled,setProvider(provider){routeProvider=typeof provider==='function'?provider:null;routeMemory.clear()},clearProvider(){routeProvider=null;routeMemory.clear()},cache:()=>new Map(routeMemory)});
    window.TravelMobileDaySwipe=Object.freeze({next:()=>switchDayBySwipe(1),previous:()=>switchDayBySwipe(-1),drawerCover});
    window.TravelHourlyWeather=Object.freeze({load:loadHourlyWeather,render:renderHourlyWeather,selectedDate:selectedWeatherDate});
    window.TravelOfficialStatus=Object.freeze({data:STATUS,checkedAt:STATUS.checkedAt||null});
    window.TravelLeisureBackups=Object.freeze({search:amapSearchKeyword,focus:focusPointVisible});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0),{once:true});else setTimeout(install,0);
})();
