(function(){
  'use strict';
  const START='2026-08-09',END='2026-08-16',STORE='travel-plans-reminders-v2.2',WEATHER_STORE='travel-plans-weather-snapshot-v2.2';
  let root,list,countNode,lastWeather={};
  function chinaDate(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const value=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${value.year}-${value.month}-${value.day}`}
  function dayDiff(a,b){return Math.round((Date.parse(`${b}T00:00:00+08:00`)-Date.parse(`${a}T00:00:00+08:00`))/86400000)}
  function shiftDate(date,days){return new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10)}
  function read(key,fallback={}){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value))}catch{}}
  function weatherText(cast){if(!cast)return'';return[cast.dayweather||cast.dayWeather,cast.nightweather||cast.nightWeather,cast.daytemp||cast.dayTemp,cast.nighttemp||cast.nightTemp].filter(Boolean).join('|')}
  function weatherMap(){try{return typeof amapTripWeatherByDate==='object'&&amapTripWeatherByDate?amapTripWeatherByDate:{}}catch{return{}}}
  function bookingItems(){const bindings=window.TravelDataCatalog?.bindings||{},items=[];for(const [name,value] of Object.entries(bindings))if(/BOOK|RESERV/i.test(name)&&Array.isArray(value))items.push(...value);return items}
  function unresolvedBookingCount(){const nodes=[...document.querySelectorAll('[data-booking-progress]')];return nodes.filter(node=>{const v=String(node.value||node.dataset.value||'').toLowerCase();return!/(done|booked|complete|skip|abandon|已完成|已预约|已购|放弃)/.test(v)}).length}
  function bookingRule(item){
    const explicit=item.deadline||item.cutoff||item.bookingDeadline;if(/^\d{4}-\d{2}-\d{2}$/.test(explicit||''))return{date:explicit,type:'deadline',source:'页面记录的明确截止日期'};
    const note=String(item.note||''),match=note.match(/(?:提前|参观前)\s*(\d+)\s*日(?:内)?/);if(!match||!item.dates?.length)return null;
    const tripDate=`2026-${String(item.dates[0]).padStart(5,'0')}`;return{date:shiftDate(tripDate,-Number(match[1])),type:'open',days:Number(match[1]),source:`页面记录的“提前${match[1]}日”官方规则`};
  }
  function deadlineReminders(today){
    const out=[];
    for(const item of bookingItems()){
      const rule=bookingRule(item);if(!rule)continue;const left=dayDiff(today,rule.date),tripDate=item.dates?.[0]?`2026-${item.dates[0]}`:null;if(left>14||tripDate&&dayDiff(today,tripDate)<0)continue;
      if(rule.type==='deadline'&&left>=0)out.push({id:`deadline-${item.id||item.name}`,tone:left<=2?'urgent':'warn',icon:'⏰',title:`${item.name}${left===0?'今天截止':`剩余 ${left} 天`}`,detail:`${rule.source}为 ${rule.date}，请以官方预约页最终规则为准。`});
      if(rule.type==='open'&&left>=-7)out.push({id:`booking-open-${item.id||item.name}-${rule.date}`,tone:left<=0?'urgent':'warn',icon:'🎟️',title:left>0?`${item.name}将在 ${left} 天后开放预约`:`${item.name}预约窗口已开放`,detail:`按${rule.source}推算，检查日为 ${rule.date}；这是开放窗口提醒，不把限量售罄时间伪造成固定截止时间。`});
    }
    return out;
  }
  function build(){
    const today=chinaDate(),left=dayDiff(today,START),during=left<=0&&dayDiff(today,END)>=0,out=[];
    if(left>30)out.push({id:'early-plan',tone:'info',icon:'🗓️',title:`距出发还有 ${left} 天`,detail:'当前以完善行程和可取消预订为主；实时天气尚不具备参考价值。'});
    if(left<=30&&left>14)out.push({id:'hotel-rent',tone:'warn',icon:'🏨',title:'检查酒店与租衣妆造订单',detail:'这是行程建议检查窗口，不代表平台官方截止时间；确认免费取消、地址、押金、妆造时长和归还规则。'});
    if(left<=14&&left>7){const unresolved=unresolvedBookingCount();out.push({id:'booking-check',tone:'warn',icon:'🎫',title:`逐项复核预约与购票${unresolved?`（${unresolved} 项未标记完成）`:''}`,detail:'核对官方预约入口、实名信息、开放日期和退款规则；没有明确官方截止时间的项目不伪造截止日期。'})}
    if(left<=7&&left>4)out.push({id:'transport-check',tone:'warn',icon:'🚇',title:'复核交通、酒店地址与行李方案',detail:'确认到达时间、地铁末班、酒店入住联系人，并重新核对租衣门店订单地址。'});
    if(left<=4&&left>=0)out.push({id:'forecast-window',tone:'warn',icon:'🌦️',title:'已进入高德短期天气预报窗口',detail:'页面将比较上次与本次预报；出现降雨、天气类型变化或明显温差时自动提示。'});
    if(left<=2&&left>=0)out.push({id:'final-check',tone:'urgent',icon:'✅',title:'执行出发前最终核对',detail:'下载离线页面，截存酒店和预约订单，准备雨具、防晒、补水和常用药。'});
    if(during)out.push({id:'during-trip',tone:'info',icon:'📍',title:'旅行进行中',detail:'优先查看当天路线、天气和实时路况；雷雨、大风或浴场警示时及时缩短或取消海边活动。'});
    out.push(...deadlineReminders(today));
    const current=weatherMap(),previous=read(WEATHER_STORE,{}),rain=/雨|雷|雪|冰雹/;
    for(const [date,cast] of Object.entries(current)){if(date<START||date>END)continue;const text=weatherText(cast),old=previous[date]||'';if(rain.test(text))out.push({id:`rain-${date}-${text}`,tone:'urgent',icon:'☔',title:`${date.slice(5).replace('-','月')}日存在降水天气`,detail:`高德预报：${text.replaceAll('|',' / ')}。公开天气不提供逐小时降雨概率，请临近当天继续刷新。`});else if(old&&old!==text)out.push({id:`weather-change-${date}-${text}`,tone:'warn',icon:'🔄',title:`${date.slice(5).replace('-','月')}日天气预报发生变化`,detail:`上次：${old.replaceAll('|',' / ')}；本次：${text.replaceAll('|',' / ')}。`})}
    if(Object.keys(current).length){const snapshot={};for(const [date,cast] of Object.entries(current))snapshot[date]=weatherText(cast);write(WEATHER_STORE,snapshot);lastWeather=snapshot}
    return out;
  }
  function dismissed(){const state=read(STORE,{date:'',ids:[]}),today=chinaDate();return state.date===today?new Set(state.ids||[]):new Set()}
  function dismiss(id){const ids=dismissed();ids.add(id);write(STORE,{date:chinaDate(),ids:[...ids]});refresh()}
  function escape(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
  function mount(){if(root)return root;const audit=document.getElementById('auditBox');if(!audit)return null;root=document.createElement('section');root.className='trip-reminder-center';root.id='tripReminderCenter';root.innerHTML='<div class="trip-reminder-head"><strong>出发提醒</strong><span class="trip-reminder-count" id="tripReminderCount">0</span></div><div class="trip-reminder-list" id="tripReminderList"></div><div class="trip-reminder-tools"><button type="button" id="prepareOfflineTrip">准备离线访问</button><button type="button" id="refreshTripReminders">刷新提醒</button></div>';audit.insertAdjacentElement('afterend',root);list=root.querySelector('#tripReminderList');countNode=root.querySelector('#tripReminderCount');root.querySelector('#refreshTripReminders').onclick=refresh;root.querySelector('#prepareOfflineTrip').onclick=prepareOffline;root.addEventListener('click',event=>{const button=event.target.closest('[data-reminder-dismiss]');if(button)dismiss(button.dataset.reminderDismiss)});return root}
  function refresh(){mount();if(!list)return;const hidden=dismissed(),items=build().filter(item=>!hidden.has(item.id));countNode.textContent=String(items.length);list.innerHTML=items.length?items.map(item=>`<article class="trip-reminder-item" data-tone="${escape(item.tone||'info')}"><span class="trip-reminder-icon">${escape(item.icon)}</span><div><b>${escape(item.title)}</b><p>${escape(item.detail)}</p></div><button type="button" data-reminder-dismiss="${escape(item.id)}">今天不再提示</button></article>`).join(''):'<div class="trip-reminder-empty">当前没有需要立即处理的提醒。</div>';return items}
  async function prepareOffline(){const button=root?.querySelector('#prepareOfflineTrip');if(button){button.disabled=true;button.textContent='正在准备…'}try{if(!('caches'in window))throw new Error('当前浏览器不支持离线缓存');navigator.serviceWorker?.controller?.postMessage?.({type:'CACHE_OFFLINE_CORE'});const version=document.querySelector('meta[name="travel-map-version"]')?.content||'2.2.0',cache=await caches.open(`travel-plans-manual-${version}`),base=new URL('./',location.href),urls=['./','./index.html',`./versions/2026-07-27-v${version}.html`,'./versions/2026-07-27-v1.0.15.html',...Array.from({length:4},(_,i)=>`./assets/v${version}/payload-${i}.b64`)];await cache.addAll(urls.map(url=>new URL(url,base).href));if(button)button.textContent='离线页面已准备'}catch(error){if(button)button.textContent='离线准备失败';console.warn(error)}finally{setTimeout(()=>{if(button){button.disabled=false;button.textContent='准备离线访问'}},2200)}}
  const previousAfterBootstrap=window.TravelV2?.afterBootstrap;if(window.TravelV2)window.TravelV2.afterBootstrap=function(){previousAfterBootstrap?.();mount();refresh();setInterval(refresh,30*60*1000)};
  try{if(typeof applyTripWeather==='function'){const original=applyTripWeather;applyTripWeather=function(data){const result=original(data);queueMicrotask(refresh);return result}}}catch{}
  window.TravelReminders={refresh,build,bookingRule,prepareOffline,get lastWeather(){return lastWeather}};
})();
