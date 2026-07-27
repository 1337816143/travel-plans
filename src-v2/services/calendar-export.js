(function(){
  'use strict';
  const START='2026-08-09';let panel,events=[];
  function shift(date,days){return new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10)}
  function compact(date){return date.replaceAll('-','')}
  function escapeIcs(value){return String(value??'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}
  function bookingOpen(item){const note=String(item.note||''),match=note.match(/(?:提前|参观前)\s*(\d+)\s*日(?:内)?/);if(!match||!item.dates?.length)return[];const days=Number(match[1]);return item.dates.map(mmdd=>({id:`booking-${item.id}-${mmdd}`,date:shift(`2026-${mmdd}`,-days),title:`检查预约开放：${item.name}`,description:`页面资料记录“${match[0]}”。这是预约开放检查日，不是保证有票的截止日。${item.optional?'该项目属于备选行程。':''}`,category:'预约购票',sourceId:item.id}))}
  function build(){
    const base=[
      {id:'hotel-review',date:shift(START,-14),title:'复核青岛酒店订单',description:'核对准确地址、入住联系人、早餐、安静房、免费取消和含税总价。',category:'住宿'},
      {id:'rent-review',date:shift(START,-14),title:'复核租衣妆造订单',description:'确认门店地址、到店时段、妆造时长、押金、归还和雨天取消规则。',category:'订单'},
      {id:'trip-7',date:shift(START,-7),title:'青岛旅行出发前7天检查',description:'逐项核对预约购票、实名信息、酒店地址和交通方案。',category:'出发准备'},
      {id:'trip-4',date:shift(START,-4),title:'青岛旅行出发前4天天气检查',description:'刷新天气、降雨和风力；根据提示准备雨天替代方案。',category:'出发准备'},
      {id:'trip-2',date:shift(START,-2),title:'青岛旅行出发前2天最终检查',description:'下载离线页面，保存订单截图，准备雨具、防晒、补水和常用药。',category:'出发准备'}
    ];
    const bookings=[];for(const item of BOOKINGS||[])bookings.push(...bookingOpen(item));
    const unique=new Map([...base,...bookings].map(item=>[item.id,item]));return[...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title));
  }
  function eventIcs(item){const day=compact(item.date),uid=`${item.id}-${day}@travel-plans.local`,stamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');return['BEGIN:VEVENT',`UID:${escapeIcs(uid)}`,`DTSTAMP:${stamp}`,`DTSTART;TZID=Asia/Shanghai:${day}T090000`,`DTEND;TZID=Asia/Shanghai:${day}T093000`,`SUMMARY:${escapeIcs(item.title)}`,`DESCRIPTION:${escapeIcs(item.description)}`,`CATEGORIES:${escapeIcs(item.category||'青岛旅行')}`,'BEGIN:VALARM','TRIGGER:-PT10M','ACTION:DISPLAY',`DESCRIPTION:${escapeIcs(item.title)}`,'END:VALARM','END:VEVENT'].join('\r\n')}
  function calendarIcs(items,name='青岛旅行提醒'){return['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Travel Plans//Qingdao 2026//ZH-CN','CALSCALE:GREGORIAN','METHOD:PUBLISH',`X-WR-CALNAME:${escapeIcs(name)}`,...items.map(eventIcs),'END:VCALENDAR',''].join('\r\n')}
  function download(items,name){const blob=new Blob(['\ufeff',calendarIcs(items,name)],{type:'text/calendar;charset=utf-8'});if(window.TravelTripOperations?.downloadBlob)window.TravelTripOperations.downloadBlob(blob,`${name}.ics`);else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${name}.ics`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}
  function mount(){panel=document.getElementById('calendarExportPanel');if(!panel)return;events=build();panel.innerHTML=`<div class="trip-tool-head"><b>系统日历提醒</b><button type="button" id="exportAllCalendar">一键生成全部提醒</button></div><p>网页会下载标准 .ics 文件；在手机中打开后，可选择系统日历导入。纯静态网页无法绕过系统确认直接写入日历。</p><div class="calendar-event-list">${events.map((item,index)=>`<div class="calendar-event-row"><div><b>${item.date} · ${item.title}</b><small>${item.description}</small></div><button type="button" data-calendar-index="${index}">单独设置</button></div>`).join('')}</div>`;panel.querySelector('#exportAllCalendar').onclick=()=>download(events,'青岛旅行提醒-全部');panel.addEventListener('click',event=>{const button=event.target.closest('[data-calendar-index]');if(!button)return;const item=events[Number(button.dataset.calendarIndex)];if(item)download([item],`青岛旅行提醒-${item.title.replace(/[\\/:*?"<>|]/g,'-')}`)})}
  const previousAfterBootstrap=window.TravelV2?.afterBootstrap;if(window.TravelV2)window.TravelV2.afterBootstrap=function(){previousAfterBootstrap?.();mount()};
  window.TravelCalendarExport={build,calendarIcs,download,mount};
})();
