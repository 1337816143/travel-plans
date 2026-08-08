/* v2.5.5 rain fallback UI. */
(function(){
  'use strict';
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const data=()=>window.TravelRainGuideData;
  function sourceLink(item){return item?.sourceUrl?`<a class="rain-source" href="${esc(item.sourceUrl)}" target="_blank" rel="noopener">${esc(item.sourceLabel||'查看来源')}</a>`:(item?.sourceLabel?`<span class="rain-source muted">${esc(item.sourceLabel)}</span>`:'')}
  function mapAction(item){
    if(item.pointId)return `<button type="button" class="btn rain-focus" data-rain-point="${esc(item.pointId)}">地图定位</button>`;
    if(item.query)return `<button type="button" class="btn rain-query" data-rain-query="${esc(item.query)}">高德搜索</button>`;
    return '';
  }
  function renderNotes(items){return items.map(item=>`<article class="rain-card rain-note"><div class="rain-card-head"><div><span class="rain-kicker">${esc(item.kind)}</span><h3>${esc(item.title)}</h3></div><span class="rain-weather">${esc(item.weather)}</span></div><p>${esc(item.detail)}</p><div class="rain-actions">${mapAction(item)}${sourceLink(item)}</div></article>`).join('')}
  function renderTier(items){return items.map(item=>`<article class="rain-card rain-tier"><div class="rain-card-head"><div><span class="rain-tier-badge">${esc(item.tier)}</span><h3>${esc(item.title)}</h3></div><span class="rain-mode">${esc(item.mode)}</span></div><p>${esc(item.detail)}</p><div class="rain-actions">${sourceLink(item)}</div></article>`).join('')}
  function renderConditional(items){return items.map(item=>`<article class="rain-compact"><h3>${esc(item.title)}</h3><b>${esc(item.condition)}</b><p>${esc(item.detail)}</p>${item.pointId?`<button type="button" class="link-btn rain-focus" data-rain-point="${esc(item.pointId)}">地图定位</button>`:''}</article>`).join('')}
  function renderAvoid(items){return items.map(item=>`<article class="rain-compact avoid"><h3>${esc(item.title)}</h3><p>${esc(item.reason)}</p>${item.pointId?`<button type="button" class="link-btn rain-focus" data-rain-point="${esc(item.pointId)}">查看原行程点</button>`:''}</article>`).join('')}
  function renderBeaches(items){return `<div class="beach-table-wrap"><table class="beach-status-table"><thead><tr><th>浴场</th><th>旅行期服务时段</th><th>本次核验状态</th><th>咨询</th></tr></thead><tbody>${items.map(item=>`<tr><td><b>${esc(item.name)}</b><small>开放季 ${esc(item.season)}</small></td><td>${esc(item.tripHours)}</td><td><span class="beach-status unknown">待当天确认</span><small>${esc(item.status)}<br>核验：${esc(item.checkedAt)}</small></td><td><a href="tel:${esc(item.phone)}">${esc(item.phone)}</a><br>${sourceLink(item)}</td></tr>`).join('')}</tbody></table></div>`}
  function renderPitfalls(items){return items.map(item=>`<article class="pitfall-card"><span>${esc(item.level)}</span><div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div></article>`).join('')}
  function renderForecast(snapshot){return `<div class="rain-forecast"><div class="rain-forecast-head"><div><span class="rain-kicker">临行天气快照 · ${esc(snapshot.checkedAt.replace('T',' ').replace('+08:00',''))}</span><h3>不是“整周台风”，但必须按多雨行程准备</h3></div><button type="button" class="btn" id="rainWeatherRefresh">打开实时天气</button></div><p>${esc(snapshot.summary)}</p><div class="rain-day-strip">${snapshot.days.map(([date,text,level])=>`<span class="rain-day level-${level==='橙'?'orange':'yellow'}"><b>${esc(date)}</b><small>${esc(text)}</small></span>`).join('')}</div></div>`}
  function render(){
    const root=document.getElementById('rainGuideRoot'),d=data();if(!root||!d)return;
    root.innerHTML=`
      <div class="rain-hero"><div><span class="rain-kicker">RAIN PLAN · v${esc(d.version)}</span><h2>雨天避坑 / 备用方案</h2><p>网友经验只做线索；官方关闭、预警、现场广播拥有一票否决权。你的固定8日行程不改，这里负责把每个暴露型行程替换成可执行备选。</p></div><div class="rain-rule"><b>动态信息边界</b><p>${esc(d.dynamicRule)}</p></div></div>
      ${renderForecast(d.weatherSnapshot)}
      <section class="rain-block"><div class="rain-block-title"><div><span>NEW NOTES</span><h2>这次新增到计划</h2></div><small>小麦岛日落、笨蛤蜊、沙子口、Vya、云上海天</small></div><div class="rain-grid">${renderNotes(d.newNotes)}</div></section>
      <section class="rain-block"><div class="rain-block-title"><div><span>PRIORITY A</span><h2>强雨优先室内</h2></div><small>先保安全、再保体验</small></div><div class="rain-grid">${renderTier(d.rainRecommended)}</div></section>
      <section class="rain-block"><div class="rain-block-title"><div><span>CONDITIONAL</span><h2>小雨可去，但有硬条件</h2></div><small>截图推荐已叠加安全门禁</small></div><div class="rain-compact-grid">${renderConditional(d.rainConditional)}</div></section>
      <section class="rain-block"><div class="rain-block-title danger"><div><span>AVOID</span><h2>雨大 / 风大直接避开</h2></div><small>不为了打卡硬扛</small></div><div class="rain-compact-grid">${renderAvoid(d.rainAvoid)}</div></section>
      <section class="rain-block"><div class="rain-block-title"><div><span>BEACH STATUS</span><h2>9处海水浴场 · 2026官方时段</h2></div><small>服务时段 ≠ 恶劣天气必然开放</small></div><div class="alert warn rain-beach-warning"><b>截至 2026-08-08 16:06 的公开检索：</b>未找到当天发布的9处浴场临时封闭公告，但这不能推导出你到场时一定开放。出发当天以官方临时公告、浴场电话、现场旗语/广播为准；关闭时绝不下海。</div>${renderBeaches(d.beaches)}</section>
      <section class="rain-block"><div class="rain-block-title danger"><div><span>CONSUMER SAFETY</span><h2>消费避坑</h2></div><small>用户经验与官方监管原则分开写</small></div><div class="pitfall-list">${renderPitfalls(d.consumerPitfalls)}</div></section>
      <section class="rain-block screenshot-source"><div class="rain-block-title"><div><span>SCREENSHOT SOURCE</span><h2>你发来的抖音雨天攻略已读取</h2></div><small>11张截图，不瞎猜视频正文</small></div><p>截图中的“可去/避坑”已全部作为UGC线索纳入：${esc(d.screenshotNotes.recommended.join('、'))}。其中海水浴场和北九水等涉及安全的条目，已被官方状态门禁覆盖。</p></section>`;
    bind();
  }
  function focusPoint(id){
    try{
      if(typeof selectPresetDestination==='function'){selectPresetDestination(id,{promote:false,from:'rain-guide'});return}
      const p=typeof pointById==='function'?pointById(id):null;if(!p)return;
      if(window.mapEngine==='amap'&&window.amapInstance&&typeof window.amapOpenPoint==='function')window.amapOpenPoint(id);else if(window.map)window.map.setView([p.lat,p.lng],17);
    }catch(error){console.warn('Rain guide focus failed',error)}
  }
  function searchAmap(query){
    try{
      if(typeof toggleAmapServicePanel==='function')toggleAmapServicePanel(true);
      const input=document.getElementById('amapSearchInput');if(input){input.value=query;if(typeof amapSearchPlace==='function')amapSearchPlace(query);else document.getElementById('amapSearchBtn')?.click()}
    }catch(error){console.warn('Rain guide AMap search failed',error)}
  }
  function openWeather(){
    try{if(typeof toggleAmapServicePanel==='function')toggleAmapServicePanel(true);document.querySelector('[data-amap-tab="travel"]')?.click();setTimeout(()=>document.getElementById('amapWeatherBtn')?.click(),80)}catch(error){console.warn('Rain guide weather refresh failed',error)}
  }
  function bind(){
    document.querySelectorAll('[data-rain-point]').forEach(button=>button.onclick=()=>focusPoint(button.dataset.rainPoint));
    document.querySelectorAll('[data-rain-query]').forEach(button=>button.onclick=()=>searchAmap(button.dataset.rainQuery));
    const weather=document.getElementById('rainWeatherRefresh');if(weather)weather.onclick=openWeather;
  }
  window.TravelRainGuide=Object.freeze({render,focusPoint,searchAmap});
})();
