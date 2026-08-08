const fallbackForecast = [
  {date:'2026-08-08',label:'周六',summary:'晴朗炎热',max:35,min:26,pop:10,rain:0,gust:30},
  {date:'2026-08-09',label:'周日',summary:'上午局地雷雨，后转间晴',max:31,min:26,pop:55,rain:3,gust:32},
  {date:'2026-08-10',label:'周一',summary:'多云，下午短时阵雨',max:30,min:26,pop:45,rain:2,gust:30},
  {date:'2026-08-11',label:'周二',summary:'多云，有风',max:28,min:26,pop:20,rain:0,gust:46},
  {date:'2026-08-12',label:'周三',summary:'多云潮湿，有少量降雨',max:30,min:24,pop:50,rain:3,gust:34},
  {date:'2026-08-13',label:'周四',summary:'上午有几场强阵雨',max:29,min:24,pop:75,rain:10,gust:38},
  {date:'2026-08-14',label:'周五',summary:'间歇性降雨',max:27,min:21,pop:75,rain:10,gust:35},
  {date:'2026-08-15',label:'周六',summary:'多云，有少量降雨',max:28,min:23,pop:55,rain:4,gust:30},
];

const rainContent = {
  recommended: [
    {name:'中山公园',source:'抖音截图',text:'截图认为雨中氛围好。轻雨可走，强降雨/雷电则改室内。'},
    {name:'海之恋公园',source:'抖音截图',text:'阴雨有不同海岸氛围；只建议短停拍照，不在雷雨或大风中长时间暴露。'},
    {name:'极地海洋世界',source:'抖音截图',text:'室内主体较多，天气适应性强；旺季仍需预留排队时间。',safe:true},
    {name:'八大关',source:'抖音截图',text:'轻雨适合短距离散步和建筑拍摄；暴雨时转入室内。'},
    {name:'天主教堂',source:'抖音截图',text:'老城雨景适配；注意开放安排，外观拍摄与入内参观分开判断。'},
    {name:'湛山寺',source:'抖音截图',text:'小雨氛围好；院落仍有室外部分，强雨不作为纯室内点。'},
    {name:'德国总督楼旧址博物馆',source:'抖音截图 + 官方',text:'一级博物馆，雨天稳定性高，是老城片区首选室内锚点。',safe:true},
    {name:'青岛市博物馆',source:'2026官方补充',text:'周二至周日09:00–17:00（16:30停止入馆）；8月31日前有琉璃艺术特展。',safe:true},
    {name:'海信探索中心',source:'抖音截图',text:'互动科学体验，适合强雨日；票务与当天开放需临行核验。',safe:true},
    {name:'青岛科技馆',source:'抖音截图',text:'红岛方向较远，适合整块半日/一日室内备选；不要和市南短空档硬拼。',safe:true},
    {name:'第二海水浴场',source:'抖音截图 · 仅岸上',text:'截图推荐阴雨拍摄氛围，但官方旗色/雷电规则优先。雨天不把它列为“下海项目”。',risk:true},
    {name:'石老人海水浴场',source:'抖音截图 · 仅岸上',text:'阴天可拍海岸氛围；如红旗、雷电、大风、广播撤离，立即离开水边。',risk:true},
    {name:'北九水',source:'抖音截图 · 安全冲突',text:'截图称雨天“封神”，但强降雨或刚下完雨时山路湿滑、溪流水量变化，只有官方确认开放且无灾害风险时才考虑。',risk:true},
  ],
  avoid: [
    {name:'崂山风景区',source:'两组抖音截图',text:'大雾影响景观，雨后山路湿滑；强降雨/大风时直接避开。',risk:true},
    {name:'青岛啤酒博物馆',source:'抖音截图 · 客流因素',text:'不是因为室内不安全，而是截图反馈雨天游客集中、体验拥挤。可在预约客流可控时反向使用。'},
    {name:'小鱼山公园',source:'两组抖音截图',text:'雾天俯瞰价值明显下降，坡路湿滑。'},
    {name:'信号山公园',source:'两组抖音截图',text:'雾天看不清红瓦老城；雨后也要注意坡路。'},
    {name:'小麦岛',source:'两组抖音截图',text:'雨天海风大、暴露度高；保留给晴天或雨后低风日落窗口。',risk:true},
    {name:'栈桥',source:'抖音截图',text:'雨天拥挤、伞多、拍照体验差；雷电/大风时更不建议在开阔海边久留。',risk:true},
    {name:'五四广场',source:'抖音截图',text:'白天下雨观感一般；若雨停且夜间灯光正常，可作为短时补充。'},
    {name:'大鲍岛',source:'抖音截图',text:'截图反馈部分商铺雨天不开，容易跑空；去前看店铺实际营业。'},
    {name:'青山渔村',source:'抖音截图',text:'低云灰雾影响海湾视野；山海路段雨天也不适合为“出片”专程绕行。'},
    {name:'私人游艇 / 海上项目',source:'用户明确避坑 + 官方安全',text:'你已列为避坑；遇风浪、雷雨或气象预警时更应取消。',risk:true},
  ],
  indoor: [
    {name:'德国总督楼旧址博物馆',source:'官方 + 截图',text:'市南老城室内核心。适合与咖啡、商场组成短交通半日。',safe:true},
    {name:'青岛市博物馆',source:'2026官方',text:'免费预约型文博馆；2026年8月底前有琉璃艺术特展。',safe:true},
    {name:'海信探索中心',source:'截图线索',text:'互动性强，适合连续降雨时占据较完整时段。',safe:true},
    {name:'青岛科技馆',source:'截图线索',text:'在红岛，交通成本高，但强雨日可作为整日型备选。',safe:true},
    {name:'极地海洋世界',source:'截图线索',text:'主体室内；旺季客流与表演时间需提前核。',safe:true},
    {name:'青岛云上海天',source:'用户收藏',text:'物理空间室内，但低云会遮挡高空景观。强雨日只有在能见度尚可时才值得去。'},
  ],
};

const beaches = [
  ['第一海水浴场','6/1–10/31','09:00–21:00','0532-82963355'],
  ['第二海水浴场','7/1–9/25','09:00–17:30','0532-66577309'],
  ['第三海水浴场','7/1–9/25','09:00–17:30','0532-66577319'],
  ['栈桥海水浴场','7/1–9/25','09:00–21:00','0532-82884548'],
  ['石老人海水浴场','7/1–9/25','09:00–18:00','0532-88899636'],
  ['仰口海水浴场','7/1–9/25','09:00–18:00','0532-67788538'],
  ['金沙滩海水浴场','7/1–9/25','09:00–19:00','0532-86707399'],
  ['银沙滩海水浴场','7/1–9/25','09:00–19:00','0532-89602009'],
  ['灵山湾海水浴场','7/1–9/25','09:00–19:00','0532-83978302'],
];

const wmo = {
  0:['晴','☀️'],1:['大部晴','🌤️'],2:['局部多云','⛅'],3:['阴/多云','☁️'],
  45:['雾','🌫️'],48:['雾凇','🌫️'],51:['毛毛雨','🌦️'],53:['毛毛雨','🌦️'],55:['较强毛毛雨','🌧️'],
  61:['小雨','🌧️'],63:['中雨','🌧️'],65:['大雨','🌧️'],80:['阵雨','🌦️'],81:['较强阵雨','🌧️'],82:['强阵雨','⛈️'],
  95:['雷雨','⛈️'],96:['雷雨伴冰雹','⛈️'],99:['强雷雨伴冰雹','⛈️']
};

function riskFor(day){
  const thunder = [95,96,99].includes(Number(day.code));
  if (thunder || Number(day.rain) >= 15 || Number(day.pop) >= 85 || Number(day.gust) >= 60) return ['red','纯室内'];
  if (Number(day.rain) >= 4 || Number(day.pop) >= 55 || Number(day.gust) >= 45) return ['amber','机动切换'];
  return ['green','户外可留'];
}

function renderForecast(days, sourceLabel){
  const grid = document.querySelector('#forecast-grid');
  const state = document.querySelector('#weather-state');
  grid.innerHTML = days.map((day)=>{
    const [risk,label]=riskFor(day);
    const info=wmo[Number(day.code)] || [day.summary || '天气变化','🌦️'];
    const date=new Date(`${day.date}T12:00:00+08:00`);
    const weekday=day.label || new Intl.DateTimeFormat('zh-CN',{weekday:'short'}).format(date);
    return `<article class="forecast-day">
      <header><span>${day.date.slice(5)}</span><b>${weekday}</b></header>
      <div class="weather-icon">${info[1]}</div>
      <h3>${day.summary || info[0]}</h3>
      <div class="temps">${Math.round(day.max)}° / ${Math.round(day.min)}°</div>
      <p>降水概率 ${Math.round(day.pop || 0)}%</p>
      <p>预计降水 ${Number(day.rain || 0).toFixed(1)} mm</p>
      <p>最大阵风 ${Math.round(day.gust || 0)} km/h</p>
      <span class="risk-chip risk-${risk}">${label}</span>
    </article>`;
  }).join('');
  state.textContent=`${sourceLabel} · 更新时间：${new Date().toLocaleString('zh-CN',{hour12:false,timeZone:'Asia/Shanghai'})}`;
  state.classList.toggle('warning',sourceLabel.includes('备用'));
}

async function loadWeather(){
  const state=document.querySelector('#weather-state');
  state.textContent='正在读取青岛未来 8 天预报…';
  try{
    const endpoint='https://api.open-meteo.com/v1/forecast?latitude=36.0671&longitude=120.3826&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_gusts_10m_max&timezone=Asia%2FShanghai&forecast_days=8';
    const response=await fetch(endpoint,{cache:'no-store'});
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    const data=await response.json();
    const days=data.daily.time.map((date,i)=>({
      date,code:data.daily.weather_code[i],max:data.daily.temperature_2m_max[i],min:data.daily.temperature_2m_min[i],
      pop:data.daily.precipitation_probability_max[i],rain:data.daily.precipitation_sum[i],gust:data.daily.wind_gusts_10m_max[i]
    }));
    renderForecast(days,'实时源：Open-Meteo（青岛市中心坐标）');
  }catch(error){
    console.warn('Weather fallback:',error);
    renderForecast(fallbackForecast,'备用基线：2026-08-08 已核验预报');
  }
}

function renderRainCards(key){
  const root=document.querySelector('#rain-cards');
  root.innerHTML=rainContent[key].map(item=>`<article class="rain-card${item.risk?' high-risk':''}${item.safe?' indoor-safe':''}">
    <span class="source-chip">${item.source}</span><h3>${item.name}</h3><p>${item.text}</p>
    ${item.risk?'<span class="safety-note">⚠ 安全规则优先；强降雨、雷电、大风时不执行“氛围感”玩法。</span>':''}
  </article>`).join('');
}

function renderBeaches(){
  document.querySelector('#beach-table').innerHTML=beaches.map(([name,season,hours,phone])=>`<tr>
    <td><span class="beach-name">${name}</span></td><td>${season}</td><td>${hours}</td>
    <td><span class="status-unknown">计划开放季 · 旗色未知</span></td>
    <td><a class="phone-link" href="tel:${phone.replaceAll('-','')}">${phone}</a></td>
  </tr>`).join('');
}

document.querySelectorAll('.tab').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(node=>node.classList.toggle('is-active',node===button));
  renderRainCards(button.dataset.tab);
}));
document.querySelector('#refresh-weather').addEventListener('click',loadWeather);
renderRainCards('recommended');
renderBeaches();
loadWeather();
