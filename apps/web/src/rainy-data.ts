export type EvidenceLevel = 'official' | 'user' | 'social-reference' | 'mixed';
export type RainSuitability = 'recommended' | 'conditional' | 'avoid';

export interface RainSource {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly evidence: EvidenceLevel;
  readonly note: string;
}

export interface RainPlace {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly suitability: RainSuitability;
  readonly weatherGate: string;
  readonly recommendation: string;
  readonly verification: string;
  readonly sourceIds: readonly string[];
  readonly mapQuery?: string;
}

export interface BeachStatus {
  readonly id: string;
  readonly name: string;
  readonly season: string;
  readonly serviceHours: string;
  readonly phone: string;
  readonly liveStatus: string;
  readonly rule: string;
}

export const RAIN_CHECKED_AT = '2026-08-08 16:00（中国标准时间）';

export const RAIN_SOURCES: readonly RainSource[] = [
  {
    id: 'official-beaches-2026',
    label: '青岛政务网：2026年9处海水浴场开放时间与咨询电话',
    url: 'https://www.qingdao.gov.cn/zwgk/xxgk/csgl/ywfl/hygl/202607/t20260702_10650276.shtml',
    evidence: 'official',
    note: '用于季节开放期、服务时段、咨询电话和特殊天气服从关闭/撤离指令。',
  },
  {
    id: 'official-weather-emergency',
    label: '青岛市气象灾害应急预案',
    url: 'https://www.qingdao.gov.cn/zwgk/xxgk/bgt/gkml/gwfg/202112/t20211210_3978460.shtml',
    evidence: 'official',
    note: '暴雨、大风、雷电预警优先级高于任何社交平台攻略；达到预警条件时取消滨海、登山与水上项目。',
  },
  {
    id: 'official-clouds',
    label: '青岛国信文旅：青岛云上海天',
    url: 'https://qdgxwl.com/service.html',
    evidence: 'official',
    note: '城市观光厅/艺术中心常规09:00–21:00，20:00停止入馆；当天调整以游客中心为准。',
  },
  {
    id: 'official-science',
    label: '青岛科技馆官网',
    url: 'https://www.qdkjg.com.cn/',
    evidence: 'official',
    note: '常规09:00–17:00，16:30停止入馆；适合中到大雨的纯室内备选。',
  },
  {
    id: 'official-museum',
    label: '青岛市博物馆官网',
    url: 'https://www.qingdaomuseum.cn/',
    evidence: 'official',
    note: '5–10月常规09:00–17:00，16:30停止入场，周一闭馆（法定节假日除外）；临时延时以最新公告为准。',
  },
  {
    id: 'official-underwater',
    label: '青岛海底世界官网',
    url: 'https://www.qdhdworld.com/',
    evidence: 'official',
    note: '暑期营业与演出时刻属于动态信息，以官网当日公示为准。',
  },
  {
    id: 'official-polar',
    label: '青岛海昌极地海洋公园游客服务',
    url: 'https://www.haichangoceanpark.com/qingdao/service-center',
    evidence: 'official',
    note: '主体场馆适合雨天；暴雨、雷电和大风仍可能造成表演暂停或区域调整。',
  },
  {
    id: 'official-beer',
    label: '青岛啤酒博物馆官网',
    url: 'https://www.tsingtaomuseum.com/',
    evidence: 'official',
    note: '常规08:30–17:30，16:30停止入场；雨天可能拥挤，推荐错峰而不是直接排除。',
  },
  {
    id: 'user-xiaomai',
    label: '用户新增体验：小麦岛草坪日落',
    url: '',
    evidence: 'user',
    note: '坐草坪看日落、吹海风、戴耳机听音乐；仅在无雷雨、风力舒适且草地条件允许时执行。',
  },
  {
    id: 'user-ben-clam',
    label: '用户提供：笨蛤蜊地标小吃大排档',
    url: 'http://xhslink.cn/o/5B98BBpcgPA',
    evidence: 'user',
    note: '用户记录露台可观景、夜景好看，并点名“手剥山竹榴莲”；短链未能稳定读取，门店与菜品需地图/现场二次核验。',
  },
  {
    id: 'user-food-avoid',
    label: '用户提供：青岛餐饮避坑',
    url: 'http://xhslink.cn/o/4ra0tjwCCYA',
    evidence: 'user',
    note: '私人游艇列为避坑；“青岛大虾”不按通用必吃推荐，仅保留用户认可的168元/只“十八斩”线索；白花蛇草水只买一瓶试喝。',
  },
  {
    id: 'user-shazikou',
    label: '用户提供：沙子口广场晴天线索',
    url: 'http://xhslink.cn/o/9m3kVTik6i5',
    evidence: 'user',
    note: '晴天景观候选；用户记录地铁4号线沙子口站C口步行约20分钟。',
  },
  {
    id: 'user-rain-douyin-1',
    label: '用户上传截图：青岛嘉熠文旅雨天攻略',
    url: 'https://v.douyin.com/OZY8vHdJLNU/',
    evidence: 'social-reference',
    note: '内容来自用户上传截图，只作为体验线索；安全与开放状态由官方信息覆盖。',
  },
  {
    id: 'user-rain-douyin-2',
    label: '用户上传截图：小鱼呆呆脑雨天攻略',
    url: 'https://v.douyin.com/2978Mhu2GkY/',
    evidence: 'social-reference',
    note: '内容来自用户上传截图，只作为体验线索；对北九水、浴场等户外地必须加天气安全门槛。',
  },
  {
    id: 'user-vya',
    label: '用户提供：Vya无涯coffee',
    url: 'https://v.douyin.com/oNG67C7qJas/',
    evidence: 'user',
    note: '用户记录黄岛咖啡厅、人均约37元、收藏榜第8；精确POI尚未获得可靠公开交叉证据，不编造地址。',
  },
  {
    id: 'user-cloud-video',
    label: '用户提供：青岛云上海天视频',
    url: 'https://v.douyin.com/7S_lhmf3NI8/',
    evidence: 'mixed',
    note: '体验线索来自用户；营业信息使用官方运营方页面复核。',
  },
] as const;

export const NEW_TRIP_ITEMS = [
  {
    id: 'xiaomai-lawn-sunset',
    name: '小麦岛草坪 · 日落耳机时刻',
    status: '加入原小麦岛模块',
    detail: '日落前约60–90分钟到草坪，坐着吹海风、看日落、戴耳机听音乐。雷雨、大风、草地积水时取消，不为了“打卡”硬撑。',
    sourceIds: ['user-xiaomai'],
  },
  {
    id: 'ben-clam-terrace',
    name: '笨蛤蜊地标小吃大排档 · 露台夜景',
    status: '候选餐饮 · 精确门店待核',
    detail: '保留用户点名的露台夜景体验与“手剥山竹榴莲”线索；短链目前不足以可靠确认门店地址和菜单，页面明确显示待核。',
    sourceIds: ['user-ben-clam'],
  },
  {
    id: 'shazikou-square',
    name: '崂山区沙子口广场',
    status: '晴天/雨停后候选',
    detail: '优先晴天或雨后能见度好的时段。用户记录：地铁4号线沙子口站C口出，步行约20分钟。大雨、大风时不作为备选。',
    sourceIds: ['user-shazikou'],
  },
  {
    id: 'vya-coffee',
    name: 'Vya无涯coffee',
    status: '黄岛咖啡候选 · POI待核',
    detail: '用户记录人均约37元、黄岛咖啡厅收藏榜第8。适合作为黄岛雨天/等雨缓冲点，但暂不伪造精确地址。',
    sourceIds: ['user-vya'],
  },
  {
    id: 'clouds-qingdao',
    name: '青岛云上海天',
    status: '雨天A级备选',
    detail: '高空室内观景，阴雨天也可用；如果低云/大雾导致能见度很差，则把“观景”价值下调，转为建筑与室内体验。官方常规09:00–21:00，20:00停止入馆。',
    sourceIds: ['official-clouds', 'user-cloud-video'],
  },
] as const;

export const RAIN_RECOMMENDATIONS: readonly RainPlace[] = [
  {
    id: 'rain-science-museum',
    name: '青岛科技馆',
    category: '室内科学',
    suitability: 'recommended',
    weatherGate: '中雨/大雨优先；极端天气仍服从官方停运与交通安排。',
    recommendation: '纯室内、体力负担低，适合把连续降雨日完整接住；缺点是位置偏城阳，往返时间要单独留足。',
    verification: '官网可核验',
    sourceIds: ['official-science'],
  },
  {
    id: 'rain-qingdao-museum',
    name: '青岛市博物馆',
    category: '室内博物馆',
    suitability: 'recommended',
    weatherGate: '雨天稳定；周一与临时公告需核验。',
    recommendation: '崂山区室内Plan B，可和东部城区行程拼接，免费开放但最新活动/预约以官网为准。',
    verification: '官网可核验',
    sourceIds: ['official-museum'],
  },
  {
    id: 'rain-underwater',
    name: '青岛海底世界',
    category: '室内海洋',
    suitability: 'recommended',
    weatherGate: '中雨可去；台风/极端天气仍先看官方交通和景区公告。',
    recommendation: '老城一带雨天核心替代，能与小鱼山/琴屿路等户外项目互换。暑期可能拥挤，尽量早到或夜场错峰。',
    verification: '官网可核验',
    sourceIds: ['official-underwater'],
  },
  {
    id: 'rain-polar',
    name: '青岛海昌极地海洋公园',
    category: '室内为主海洋',
    suitability: 'recommended',
    weatherGate: '主体场馆可用；暴雨、雷电、大风可能影响表演与局部区域。',
    recommendation: '用户截图也列为雨天可去。比纯户外海岸稳定，但不要把“雨天可去”理解成极端天气照常。',
    verification: '官网＋用户截图',
    sourceIds: ['official-polar', 'user-rain-douyin-2'],
  },
  {
    id: 'rain-clouds',
    name: '青岛云上海天',
    category: '高空室内观景',
    suitability: 'conditional',
    weatherGate: '小到中雨可去；低云、大雾时观景价值显著下降。',
    recommendation: '作为市南区高质量室内备选。先看实时能见度，再决定是否买观景票。',
    verification: '官方运营页可核验',
    sourceIds: ['official-clouds', 'user-cloud-video'],
  },
  {
    id: 'rain-governor-house',
    name: '青岛德国总督楼旧址博物馆',
    category: '建筑＋室内博物馆',
    suitability: 'recommended',
    weatherGate: '雨天适配；开放与预约临行核验。',
    recommendation: '用户截图列为雨天推荐。室内本身有内容，且能和老城雨天路线组合。',
    verification: '政府博物馆目录＋用户截图',
    sourceIds: ['user-rain-douyin-2'],
  },
  {
    id: 'rain-beer',
    name: '青岛啤酒博物馆',
    category: '工业遗产室内',
    suitability: 'conditional',
    weatherGate: '雨天可去，但暑期下雨时容易成为集中避雨点。',
    recommendation: '不按截图的“绝对避坑”处理：它本身是合格室内点，但雨天高峰拥挤会明显降低体验，建议开馆早段/临近闭馆前错峰。',
    verification: '官网＋用户截图冲突，按条件推荐处理',
    sourceIds: ['official-beer', 'user-rain-douyin-1'],
  },
  {
    id: 'rain-zhanshan-temple',
    name: '湛山寺',
    category: '半室内/庭院',
    suitability: 'conditional',
    weatherGate: '阴天、小雨可；暴雨、雷电和强风不去。',
    recommendation: '截图中的“阴雨氛围”可以保留，但必须加安全门槛，不能作为大雨Plan B。',
    verification: '用户截图体验线索',
    sourceIds: ['user-rain-douyin-2'],
  },
  {
    id: 'rain-badaguan',
    name: '八大关',
    category: '户外街区',
    suitability: 'conditional',
    weatherGate: '小雨/雨停可；暴雨、大风、雷电不去。',
    recommendation: '截图认为雨天林荫街道有氛围；适合小雨而不是“全天暴雨备选”。防滑鞋优先，避开积水和折枝风险。',
    verification: '用户截图体验线索',
    sourceIds: ['user-rain-douyin-2'],
  },
  {
    id: 'rain-cathedral',
    name: '圣弥厄尔教堂/天主教堂片区',
    category: '建筑/老城',
    suitability: 'conditional',
    weatherGate: '小雨可；内部开放与宗教活动秩序优先。',
    recommendation: '可与总督楼、海底世界等组成老城短距离雨天组合，避免在大雨里长距离步行。',
    verification: '用户截图体验线索',
    sourceIds: ['user-rain-douyin-2'],
  },
  {
    id: 'rain-zhongshan-park',
    name: '中山公园',
    category: '户外公园',
    suitability: 'conditional',
    weatherGate: '仅阴天/小雨/雨停后；雷雨、大风禁用。',
    recommendation: '用户截图认为雨天有电影感。作为“雨小了以后”的补位，不是暴雨避难点。',
    verification: '用户截图体验线索',
    sourceIds: ['user-rain-douyin-2'],
  },
] as const;

export const RAIN_AVOIDS: readonly RainPlace[] = [
  {
    id: 'avoid-laoshan',
    name: '崂山登山（含仰口、北九水等山地线路）',
    category: '山地',
    suitability: 'avoid',
    weatherGate: '强降雨、雷电、大风、官方暂停开放时直接取消。雨刚停也要看地质/溪流水位和官方公告。',
    recommendation: '截图里既有“雨天避坑崂山/仰口”，也有“北九水雨天好看”的冲突。安全优先：只有官方开放＋无强降雨/雷电风险时才考虑轻雨景观。',
    verification: '社交线索冲突，官方安全门槛覆盖',
    sourceIds: ['official-weather-emergency', 'user-rain-douyin-1', 'user-rain-douyin-2'],
  },
  {
    id: 'avoid-xiaomai-rain',
    name: '小麦岛雨天草坪/海岸',
    category: '滨海户外',
    suitability: 'avoid',
    weatherGate: '雨＋大风/雷电时取消。',
    recommendation: '你的“草坪日落耳机时刻”非常适合晴天，但截图明确指出风雨会直接破坏体验；保留行程，按天气择机执行。',
    verification: '用户体验＋上传截图',
    sourceIds: ['user-xiaomai', 'user-rain-douyin-1'],
  },
  {
    id: 'avoid-signal-xiaoyu',
    name: '信号山 / 小鱼山登高观景',
    category: '登高观景',
    suitability: 'avoid',
    weatherGate: '雾大、持续雨、雷电时不去。',
    recommendation: '核心价值是红瓦海景和视野，低云雾会把观景收益压到很低；改到能见度好的窗口。',
    verification: '用户上传截图',
    sourceIds: ['user-rain-douyin-1'],
  },
  {
    id: 'avoid-yacht',
    name: '私人游艇 / 临时拉客海上项目',
    category: '水上项目',
    suitability: 'avoid',
    weatherGate: '任何大风、雷雨、能见度差时直接不参加；正常天气也优先正规官方运营项目。',
    recommendation: '按你的明确要求列入避坑。不要现场被拉客改变计划，海上活动只用正规票务/官方码头并核验当天停航。',
    verification: '用户明确避坑＋气象安全规则',
    sourceIds: ['user-food-avoid', 'official-weather-emergency'],
  },
  {
    id: 'avoid-beach-swimming',
    name: '雨天/封海状态下下海游泳',
    category: '海水浴场',
    suitability: 'avoid',
    weatherGate: '浴场关闭、天气突变、收到撤离指令时立即离水。',
    recommendation: '阴雨天“看海/拍照”与“下水”分开判断。任何社交攻略说“雨天浴场有氛围”都不等于可以游泳。',
    verification: '官方规则',
    sourceIds: ['official-beaches-2026', 'official-weather-emergency'],
  },
  {
    id: 'avoid-qingdao-shrimp',
    name: '“青岛大虾”泛化消费',
    category: '餐饮消费',
    suitability: 'avoid',
    weatherGate: '与天气无关。',
    recommendation: '按你的体验，不把“青岛大虾”作为必吃标签。仅保留你认可的“168元/只十八斩”作为个人经验线索；购买前必须确认明码标价、单位和做法。',
    verification: '用户明确体验',
    sourceIds: ['user-food-avoid'],
  },
] as const;

export const FOOD_GUARDRAILS = [
  '白花蛇草水：只买1瓶两人尝味，不整箱、不当“必须喝完”的任务。',
  '“青岛大虾”：不因旅游标签下单；先看单价单位、重量/只数、加工费和结算方式。',
  '私人游艇：默认避坑；海上项目只选正规运营方，并在当天核验天气、停航和保险/救生条件。',
  '笨蛤蜊：保留“露台夜景＋手剥山竹榴莲”体验线索，但短链未完成精确门店核验，现场搜索要核对门头和菜单。',
] as const;

export const BEACH_STATUS: readonly BeachStatus[] = [
  { id: 'beach-1', name: '第一海水浴场', season: '6月1日–10月31日', serviceHours: '8/9–8/15：09:00–21:00；8/16：09:00–18:00', phone: '0532-82963355', liveStatus: '本次检索未发现8/8临时封海官方公告；不等于确认开放', rule: '当天以现场旗语、广播、官方新媒体/电话为准' },
  { id: 'beach-2', name: '第二海水浴场', season: '7月1日–9月25日', serviceHours: '09:00–17:30', phone: '0532-66577309', liveStatus: '本次检索未发现8/8临时封海官方公告；不等于确认开放', rule: '雨天可看海不代表可下水' },
  { id: 'beach-3', name: '第三海水浴场', season: '7月1日–9月25日', serviceHours: '09:00–17:30', phone: '0532-66577319', liveStatus: '本次检索未发现8/8临时封海官方公告；不等于确认开放', rule: '天气突变/撤离指令立即上岸' },
  { id: 'beach-zhanqiao', name: '栈桥海水浴场', season: '7月1日–9月25日', serviceHours: '8/9–8/15：09:00–21:00；8/16：09:00–18:00', phone: '0532-82884548', liveStatus: '本次检索未发现8/8临时封海官方公告；不等于确认开放', rule: '强风浪/雷电时不下海' },
  { id: 'beach-shilaoren', name: '石老人海水浴场', season: '7月1日–9月25日', serviceHours: '09:00–18:00', phone: '0532-88899636', liveStatus: '本次检索未发现8/8临时封海官方公告；不等于确认开放', rule: '你的行程重点浴场，出发前电话/官方信息再确认一次' },
  { id: 'beach-yangkou', name: '仰口海水浴场', season: '7月1日–9月25日', serviceHours: '09:00–18:00', phone: '0532-67788538', liveStatus: '本次检索未发现8/8临时封海官方公告；不等于确认开放', rule: '同时受崂山分区天气/开放影响' },
  { id: 'beach-golden', name: '金沙滩海水浴场', season: '7月1日–9月25日', serviceHours: '8/9–8/15：09:00–19:00；8/16：09:00–18:00', phone: '0532-86707399', liveStatus: '本次检索未发现8/8临时封海官方公告；不等于确认开放', rule: '黄岛日程出发前必须核验风浪和浴场状态' },
  { id: 'beach-silver', name: '银沙滩海水浴场', season: '7月1日–9月25日', serviceHours: '8/9–8/15：09:00–19:00；8/16：09:00–18:00', phone: '0532-89602009', liveStatus: '本次检索未发现8/8临时封海官方公告；不等于确认开放', rule: '作为金沙滩附近备选也必须独立核验' },
  { id: 'beach-lingshanwan', name: '灵山湾海水浴场', season: '7月1日–9月25日', serviceHours: '8/9–8/15：09:00–19:00；8/16：09:00–18:00', phone: '0532-83978302', liveStatus: '本次检索未发现8/8临时封海官方公告；不等于确认开放', rule: '官方关闭/撤离指令优先' },
] as const;

export const RAIN_DECISION_RULES = [
  { level: '绿', condition: '阴天 / 无雷电 / 小雨且风不大', action: '可启用户外氛围型项目：八大关、教堂片区、中山公园；小麦岛仅等雨停且风舒适后再去。' },
  { level: '黄', condition: '持续中雨 / 能见度差 / 阵风明显', action: '切换纯室内：科技馆、市博物馆、海底世界、极地、云上海天（先看能见度）、啤酒博物馆错峰。' },
  { level: '红', condition: '雷电、暴雨预警、大风预警、台风影响或官方关闭', action: '取消崂山、海岸草坪、浴场下水、游艇/海上项目和登高；以交通安全和就近室内为唯一原则。' },
] as const;
