/* v2.3 behavior-equivalent extraction: traffic layer and traffic summaries. Generated once, then maintained as canonical source. */
function amapTrafficPreference(){const saved=loadJSON(AMAP_TRAFFIC_PREF_KEY,{enabled:true});return saved.enabled!==false}
function amapTrafficClass(status=''){const value=String(status).toLowerCase();if(/畅通|smooth/.test(value))return'traffic-smooth';if(/缓行|slow/.test(value))return'traffic-slow';if(/拥堵|congested|严重/.test(value))return'traffic-congested';return'traffic-unknown'}
function amapScheduleTrafficSummary(){clearTimeout(amapTrafficDetailTimer);const panel=document.getElementById('amapServicePanel');if(!amapTrafficVisible||!panel||panel.hidden)return;amapTrafficDetailTimer=setTimeout(()=>amapTrafficAtCenter().catch(()=>{}),1100)}
function amapDrivingTrafficBreakdown(result){const route=result?.routes?.[0],totals={smooth:0,slow:0,congested:0,unknown:0};(route?.steps||[]).forEach(step=>(step.tmcs||[]).forEach(tmc=>{const status=String(tmc.status||'unknown').toLowerCase(),distance=Number(tmc.distance)||0;if(/smooth|畅通/.test(status))totals.smooth+=distance;else if(/slow|缓行/.test(status))totals.slow+=distance;else if(/congested|拥堵|严重/.test(status))totals.congested+=distance;else totals.unknown+=distance}));const parts=[];if(totals.smooth)parts.push(`<span class="traffic-smooth">畅通 ${amapFormatDistance(totals.smooth)}</span>`);if(totals.slow)parts.push(`<span class="traffic-slow">缓行 ${amapFormatDistance(totals.slow)}</span>`);if(totals.congested)parts.push(`<span class="traffic-congested">拥堵 ${amapFormatDistance(totals.congested)}</span>`);if(totals.unknown)parts.push(`<span class="traffic-unknown">未知 ${amapFormatDistance(totals.unknown)}</span>`);return parts.length?`<div class="route-traffic-breakdown">${parts.join('')}</div>`:''}
function amapTrafficAtCenter(){const center=amapCurrentLocation||amapCenter(),radius=Number(document.getElementById('amapTrafficRadius')?.value||3000),level=Number(document.getElementById('amapTrafficLevel')?.value||5),box=document.getElementById('amapTrafficDetail');if(box)box.innerHTML='<div class="amap-empty">正在查询周边道路态势…</div>';return amapWebRequest('/v3/traffic/status/circle',{location:center.join(','),radius,level,extensions:'all'}).then(data=>{const traffic=data.trafficinfo||{},roads=[...(traffic.roads||[])],rank=status=>/严重|拥堵/.test(status)?0:/缓行/.test(status)?1:/畅通/.test(status)?2:3;roads.sort((a,b)=>rank(String(a.status))-rank(String(b.status)));const content=`<p><b>${escapeHtml(traffic.description||'未返回总体描述')}</b></p><p>中心：${escapeHtml(amapCurrentLocation?amapCurrentLabel:'地图中心')} · 半径 ${radius/1000} km · 道路等级 ${level} · ${new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</p>${roads.slice(0,12).map(r=>`<div class="traffic-summary-line"><span>${escapeHtml(r.name||'道路')}</span><span class="traffic-status ${amapTrafficClass(r.status)}">${escapeHtml(r.status||'未知')}${r.speed?` · ${escapeHtml(r.speed)} km/h`:''}</span></div>`).join('')||'<div class="amap-empty">该范围内未返回道路明细。</div>'}`;if(box)box.innerHTML=content;amapSetStatus('路况分析已更新','ok');return data}).catch(error=>{if(box)box.innerHTML=`<div class="amap-empty">路况查询失败：${escapeHtml(error.message)}</div>`;amapSetStatus('路况查询失败','error');throw error})}
function toggleAmapTraffic(){
  const desired=mapEngine!=='amap'||!amapTrafficVisible;
  const alreadyActive=mapEngine==='amap'&&amapInstance;
  const snapshot=alreadyActive?{center:amapInstance.getCenter(),zoom:amapInstance.getZoom()}:null;
  const ready=alreadyActive?Promise.resolve(amapInstance):switchToAmap();
  return ready.then(()=>{
    amapSetTrafficVisible(desired,{announce:true});
    if(snapshot){
      const center=snapshot.center;
      requestAnimationFrame(()=>{
        if(mapEngine==='amap'&&amapInstance)amapInstance.setZoomAndCenter(snapshot.zoom,[center.lng,center.lat],true)
      })
    }
    if(desired)amapTrafficAtCenter().catch(()=>{})
  }).catch(error=>amapSetStatus(error.message,'error'))
}
