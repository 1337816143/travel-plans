/* v2.5.5 additive rain contingency layer. Built on top of frozen v2.5.4. */
(function(){
  'use strict';
  const data=window.__QINGDAO_RAIN_GUIDE_DATA__;
  if(!data)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const attr=value=>esc(value).replace(/`/g,'&#96;');
  const formatChecked=value=>String(value||'').replace('T',' ').replace('+08:00','');
  const weatherTags=item=>[...(item.weatherFit||[]).map(text=>`<span class="rain-pill good">${esc(text)}</span>`),...(item.avoidWhen||[]).map(text=>`<span class="rain-pill bad">避：${esc(text)}</span>`)].join('');
  const sourceButton=item=>item.sourceUrl?`<a href="${attr(item.sourceUrl)}" target="_blank" rel="noopener">原始参考</a>`:'';
  const mapButton=item=>item.mapUrl?`<a href="${attr(item.mapUrl)}" target="_blank" rel="noopener">地图检索</a>`:'';
  function additionCard(item){
    const verification=item.verification||'';
    const confidence=verification.includes('unverified')?'信息待核':'已核验/已有点位';
    return `<article class="rain-card" data-rain-card data-rain-kind="${attr(item.kind||'addition')}" data-rain-filter="addition">
      <h4>${esc(item.name)}</h4>
      <div class="rain-meta"><span class="rain-pill ${verification.includes('unverified')?'warn':'good'}">${confidence}</span>${weatherTags(item)}</div>
      ${item.address?`<p><b>位置：</b>${esc(item.address)}</p>`:''}
      ${item.transport?`<p><b>交通：</b>${esc(item.transport)}</p>`:''}
      ${item.hours?`<p><b>时间：</b>${esc(item.hours)}</p>`:''}
      <p><b>怎么放进计划：</b>${esc(item.planUse||'作为备用项保留。')}</p>
      <p>${esc(item.note||'')}</p>
      <div class="rain-card-actions">${item.placeId?`<button type="button" data-rain-focus="${attr(item.placeId)}">定位已有点位</button>`:''}${mapButton(item)}${sourceButton(item)}</div>
    </article>`;
  }
  function screenshotCard(item,kind){
    const isIndoor=item.tier==='indoor';
    const filter=kind==='avoid'?'avoid':isIndoor?'indoor':'light-rain';
    return `<article class="rain-card" data-rain-card data-rain-kind="${kind}" data-rain-tier="${attr(item.tier||item.safety||'')}" data-rain-filter="${filter}">
      <h4>${esc(item.name)}</h4>
      <div class="rain-meta"><span class="rain-pill ${kind==='avoid'?'bad':isIndoor?'good':'warn'}">${kind==='avoid'?'雨天低优先/避坑':isIndoor?'室内优先':'有条件可去'}</span></div>
      <p>${esc(item.reason||item.condition||'')}</p>
    </article>`;
  }
  function indoorCard(item){
    return `<article class="rain-card" data-rain-card data-rain-kind="recommend" data-rain-tier="indoor" data-rain-filter="indoor"><h4>${esc(item.name)}</h4><div class="rain-meta"><span class="rain-pill good">纯室内备选</span><span class="rain-pill good">${esc(item.verification)}</span></div><p>${esc(item.why)}</p>${item.hours?`<p><b>开放：</b>${esc(item.hours)}</p>`:''}<div class="rain-card-actions">${sourceButton(item)}</div></article>`;
  }
  function beachRows(){return (data.beachStatus?.beaches||[]).map(item=>`<tr><td><b>${esc(item.name)}</b><br><small>${esc(item.season)}</small></td><td>${esc(item.hoursAug09to15)}</td><td>${esc(item.hoursAug16)}</td><td><span class="beach-state">${esc(item.liveState)}</span><br><small>${esc(item.liveMethod)}</small></td><td><a class="beach-phone" href="tel:${attr(item.phone)}">${esc(item.phone)}</a></td></tr>`).join('')}
  function sourceRows(){return (data.sourceNotes||[]).map(source=>`<li>${source.url?`<a href="${attr(source.url)}" target="_blank" rel="noopener">${esc(source.label)}</a>`:esc(source.label)} <small>· ${esc(source.tier)}</small></li>`).join('')}
  function renderPanel(){
    const screenshots=data.uploadedScreenshotGuide||{};
    const avoid=(screenshots.avoidOrLowValue||[]).map(item=>screenshotCard(item,'avoid')).join('');
    const recommend=(screenshots.recommendedWithConditions||[]).map(item=>screenshotCard(item,'recommend')).join('');
    const additions=(data.tripAdditions||[]).map(additionCard).join('');
    const indoors=(data.additionalIndoorBackups||[]).map(indoorCard).join('');
    const levels=(data.rainLevels||[]).map(item=>`<div class="rain-level" data-level="${attr(item.level)}"><strong>${esc(item.label)}</strong><p>${esc(item.strategy)}</p></div>`).join('');
    const examples=(data.beachStatus?.examplesWhyLiveCheckMatters||[]).map(text=>`<li>${esc(text)}</li>`).join('');
    return `<section class="section tab-panel rain-guide-panel" data-panel="rain" aria-label="雨天避坑和推荐">
      <h2>雨天避坑和推荐 <span class="section-note">截图已逐图读取 · 安全规则覆盖社交平台观点</span></h2>
      <div class="rain-guide-hero"><span class="rain-kicker">RAIN PLAN · ${esc(data.version)}</span><h3>固定行程不重排，给每一天准备能立刻切换的 B 方案</h3><p>${esc(data.principle)}</p>
        <div class="rain-live-banner"><div><strong>当前天气策略快照</strong><small>${esc(data.forecastSnapshot?.summary||'')}</small><small>${esc(data.forecastSnapshot?.typhoonNote||'')}</small></div><button class="btn primary" type="button" data-rain-live-weather>打开实时天气</button></div>
      </div>
      <div class="rain-filter-row" role="group" aria-label="雨天攻略筛选"><button class="active" type="button" data-rain-filter-button="all">全部</button><button type="button" data-rain-filter-button="addition">新增收藏</button><button type="button" data-rain-filter-button="indoor">纯室内</button><button type="button" data-rain-filter-button="light-rain">小雨可去</button><button type="button" data-rain-filter-button="avoid">雨天避坑</button><button type="button" data-rain-filter-button="beach">浴场封海</button></div>
      <section class="rain-section" data-rain-section="addition"><div class="rain-section-head"><h3>新增到计划的地点与体验</h3><span>明确区分：已核验地点 / 用户推荐但门店待核</span></div><div class="rain-card-grid">${additions}</div></section>
      <section class="rain-section" data-rain-section="strategy"><div class="rain-section-head"><h3>按雨势决定，不按“下雨/不下雨”二分</h3><span>雷电、大风、海雾、官方关闭可直接提升风险等级</span></div><div class="rain-levels">${levels}</div></section>
      <section class="rain-section" data-rain-section="screenshot"><div class="rain-section-head"><h3>你上传的两组雨天攻略</h3><span>原帖观点已保留，但对山地和海岸重新加了安全门槛</span></div><div class="rain-screenshot-note">${esc(screenshots.source||'')}</div><div class="rain-card-grid">${avoid}${recommend}${indoors}</div></section>
      <section class="rain-section" data-rain-section="beach" data-rain-filter="beach"><div class="rain-section-head"><h3>9处海水浴场：正常服务时段 + 实时封海核验</h3><span>核验时间 ${esc(formatChecked(data.beachStatus?.checkedAt))}</span></div>
        <div class="rain-live-banner"><div><strong>公开网页检索结果不能冒充实时开关</strong><small>${esc(data.beachStatus?.publicWebFinding||'')}</small></div><button class="btn" type="button" data-copy-live-rule>复制实时查询步骤</button></div>
        <div class="beach-table-wrap"><table class="beach-table"><thead><tr><th>浴场</th><th>8/9–8/15 正常时段</th><th>8/16 正常时段</th><th>当日封海状态</th><th>咨询电话</th></tr></thead><tbody>${beachRows()}</tbody></table></div>
        <div class="beach-live-rule"><b>实时查询：</b>${esc(data.beachStatus?.liveCheckRule||'')}<br><b>重要：</b>天气风险提示 ≠ 官方封海状态。浴场关闭时禁止下海；沙滩开放也不代表游泳区开放。<ul>${examples}</ul><a href="${attr(data.beachStatus?.officialScheduleSource||'#')}" target="_blank" rel="noopener">查看青岛市2026官方开放时间</a></div>
      </section>
      <section class="rain-section" data-rain-section="sources"><div class="rain-section-head"><h3>来源与信息边界</h3><span>短链读不到的门店绝不补写假地址</span></div><ul class="rain-source-list">${sourceRows()}</ul></section>
    </section>`;
  }
  function installTab(){
    const tabs=document.getElementById('mainTabs');
    if(!tabs||tabs.querySelector('[data-tab="rain"]'))return;
    const button=document.createElement('button');button.className='tab-btn';button.type='button';button.dataset.tab='rain';button.setAttribute('role','tab');button.setAttribute('aria-selected','false');button.textContent='雨天攻略';
    const tools=tabs.querySelector('[data-tab="tools"]');tabs.insertBefore(button,tools||null);
    const sources=document.querySelector('[data-panel="sources"]');if(sources)sources.insertAdjacentHTML('beforebegin',renderPanel());else document.querySelector('#panel')?.insertAdjacentHTML('beforeend',renderPanel());
    button.addEventListener('click',()=>{
      document.querySelectorAll('.tab-btn').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-selected',String(item===button))});
      document.querySelectorAll('.tab-panel').forEach(panel=>panel.classList.toggle('active',panel.getAttribute('data-panel')==='rain'));
      document.querySelector('[data-panel="rain"]')?.scrollIntoView({block:'start',behavior:'smooth'});
    });
  }
  function setFilter(filter){
    document.querySelectorAll('[data-rain-filter-button]').forEach(button=>button.classList.toggle('active',button.getAttribute('data-rain-filter-button')===filter));
    document.querySelectorAll('[data-rain-card]').forEach(card=>{const tag=card.getAttribute('data-rain-filter');card.hidden=filter!=='all'&&tag!==filter});
    const beach=document.querySelector('[data-rain-section="beach"]');if(beach)beach.hidden=filter!=='all'&&filter!=='beach';
    const strategy=document.querySelector('[data-rain-section="strategy"]');if(strategy)strategy.hidden=filter!=='all';
    const sources=document.querySelector('[data-rain-section="sources"]');if(sources)sources.hidden=filter!=='all';
    const addition=document.querySelector('[data-rain-section="addition"]');if(addition)addition.hidden=filter!=='all'&&filter!=='addition';
    const screenshot=document.querySelector('[data-rain-section="screenshot"]');if(screenshot)screenshot.hidden=filter==='beach'||filter==='addition';
  }
  function focusExisting(id){
    try{
      const point=typeof pointById==='function'?pointById(id):null;if(!point)return;
      if(typeof mapEngine!=='undefined'&&mapEngine==='amap'&&typeof amapInstance!=='undefined'&&amapInstance){const center=typeof wgs84ToGcj02==='function'?wgs84ToGcj02(point.lng,point.lat):[point.lng,point.lat];amapInstance.setZoomAndCenter?.(17,center);return}
      if(typeof map!=='undefined'&&map?.setView)map.setView([point.lat,point.lng],17);
    }catch(error){console.warn('rain focus failed',error)}
  }
  async function copyText(text){try{await navigator.clipboard.writeText(text);return true}catch{return false}}
  function bindPanel(){
    const root=document.querySelector('[data-panel="rain"]');if(!root)return;
    root.addEventListener('click',async event=>{
      const target=event.target;if(!(target instanceof Element))return;
      const filterButton=target.closest('[data-rain-filter-button]');if(filterButton){setFilter(filterButton.getAttribute('data-rain-filter-button')||'all');return}
      const focus=target.closest('[data-rain-focus]');if(focus){focusExisting(focus.getAttribute('data-rain-focus'));return}
      if(target.closest('[data-rain-live-weather]')){document.getElementById('amapConfigBtn')?.click();setTimeout(()=>{document.querySelector('[data-amap-tab="travel"]')?.click();document.getElementById('amapWeatherBtn')?.click()},50);return}
      if(target.closest('[data-copy-live-rule]')){const text=data.beachStatus?.liveCheckRule||'';const ok=await copyText(text);target.closest('button').textContent=ok?'已复制':'请手动复制';setTimeout(()=>{const button=root.querySelector('[data-copy-live-rule]');if(button)button.textContent='复制实时查询步骤'},1500)}
    });
  }
  function expose(){window.TravelRainGuide=Object.freeze({data,setFilter,focusExisting,checkedAt:data.updatedAt})}
  function init(){installTab();bindPanel();expose()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
