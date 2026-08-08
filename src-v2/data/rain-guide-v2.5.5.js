/* v2.5.5 rainy-day fallback guide. Dynamic values are timestamped snapshots; official same-day notices always override this file. */
(function(){
  'use strict';
  const OFFICIAL_BEACH_SOURCE='https://www.qingdao.gov.cn/zwgk/xxgk/csgl/ywfl/hygl/202607/t20260702_10650276.shtml';
  const GOV_SUMMER_CULTURE='https://www.qingdao.gov.cn/ywdt/bmdt/202607/t20260720_10681373.shtml';
  const data={
    version:'2.5.5',
    checkedAt:'2026-08-08T16:06:00+08:00',
    tripDates:'2026-08-09—2026-08-16',
    dynamicRule:'浴场开关、景区临时闭园、雷电/暴雨/大风/台风预警和海上停航都属于动态信息；当天官方公告、现场广播和工作人员指令优先于本页任何静态文字。',
    weatherSnapshot:{
      checkedAt:'2026-08-08T16:06:00+08:00',
      sourceLabel:'临行前多源天气快照；页面内高德天气用于当天刷新',
      summary:'8月9—15日存在雷雨、阵雨、风和阶段性较强降水窗口，但本次核验没有找到“未来一周青岛全程受台风影响”的官方公告。按雨天行程准备，同时逐日看短临预警。',
      days:[
        ['08-09','上午局地雷雨，之后可能转为部分晴','黄'],
        ['08-10','多云，下午可能有短时阵雨','黄'],
        ['08-11','多云且有风','黄'],
        ['08-12','多云闷热，有少量降雨','黄'],
        ['08-13','上午有较强阵雨窗口','橙'],
        ['08-14','间歇性降雨','橙'],
        ['08-15','多云，有少量降雨','黄']
      ]
    },
    newNotes:[
      {id:'xiaomai-sunset',title:'小麦岛草坪日落',kind:'体验补充',pointId:'xiaomai',weather:'仅晴天/无强风时',detail:'坐在小麦岛草坪上看日落、吹海风、戴耳机听音乐。把它作为8月11日小麦岛段的“天气奖励项”，不是雨天刚需。强风、雷雨、海雾重或现场管控时直接取消。',sourceType:'user',sourceLabel:'用户明确新增'},
      {id:'beng-hali',title:'笨蛤蜊·地标小吃大排档',kind:'晚餐候选',query:'笨蛤蜊 地标小吃大排档 青岛奥帆中心店',weather:'雨势不大且露台开放时看夜景；大雨改室内座',detail:'用户收藏：露台可观景、夜景好看；“手剥山竹榴莲”看起来很想吃。公开检索能确认奥帆中心店相关内容，但本页不把社交平台套餐、价格、露台开放或菜品供应写成固定事实，到店前再次核验。',sourceType:'ugc',sourceLabel:'用户小红书收藏＋公开索引',sourceUrl:'http://xhslink.cn/o/5B98BBpcgPA'},
      {id:'shazikou-square',title:'沙子口广场',kind:'晴天补充',query:'青岛崂山区沙子口广场',weather:'晴天优先',detail:'用户收藏的崂山海岸补充点。4号线沙子口站C口后步行前往；不同地图给出的步行距离/时间存在差异，出站后以实时导航为准。大雨、大风、海雾时不专程去。',sourceType:'user',sourceLabel:'用户小红书收藏',sourceUrl:'http://xhslink.cn/o/9m3kVTik6i5'},
      {id:'vya-coffee',title:'Vya无涯coffee',kind:'黄岛雨天休息候选',query:'Vya无涯coffee 青岛黄岛',weather:'雨天可作为咖啡休息点',detail:'用户抖音收藏信息写有“人均约¥37、黄岛区咖啡厅收藏榜第8名”。目前公开检索未稳定核实精确POI，因此不虚构门牌、营业时间或实时人均；到黄岛当天用抖音/高德再次确认。',sourceType:'ugc',sourceLabel:'用户抖音收藏',sourceUrl:'https://v.douyin.com/oNG67C7qJas/'},
      {id:'haitian-view',title:'青岛云上海天',kind:'强雨优先室内备选',query:'青岛云上海天 香港西路48号',weather:'雨天可去；云雾可能降低观景价值',detail:'城市观光厅与艺术中心官方常规营业时间为09:00—21:00，20:00停止入馆；官方同时提示营业资料可能在游览当天变更。大雨时室内属性好，但低云/海雾可能让高空景观打折。',sourceType:'official',sourceLabel:'青岛国信文旅官方',sourceUrl:'https://qdgxwl.com/service.html'}
    ],
    rainRecommended:[
      {title:'青岛市博物馆',tier:'A',mode:'强雨可用',detail:'纯室内主力。2026暑期7月17日至8月31日延时开放至19:00；周一闭馆（法定节假日除外）。',sourceLabel:'青岛政务网',sourceUrl:GOV_SUMMER_CULTURE},
      {title:'青岛德国总督楼旧址博物馆',tier:'A',mode:'强雨可用',detail:'室内主力，老城线路替代性强。2026暑期延时开放至18:30；周一闭馆（法定节假日除外）。',sourceLabel:'青岛政务网',sourceUrl:GOV_SUMMER_CULTURE},
      {title:'青岛市美术馆',tier:'A',mode:'强雨可用',detail:'室内主力，2026暑期延时开放至18:00；周一闭馆（法定节假日除外）。',sourceLabel:'青岛政务网',sourceUrl:GOV_SUMMER_CULTURE},
      {title:'青岛科技馆（红岛）',tier:'A',mode:'强雨可用·路程较远',detail:'室内互动型备选，官方页面显示09:00—17:00、16:30停止入馆；在城阳红岛，适合整块替代半天，不适合作为市南临时插空。',sourceLabel:'青岛科技馆官网',sourceUrl:'https://www.qdkjg.com.cn/'},
      {title:'青岛海底世界',tier:'A',mode:'强雨可用',detail:'室内海洋馆主力，适合替代小鱼山/琴屿路/小青岛等雨中观景段；营业与演出时刻以当天官网为准。',sourceLabel:'青岛海底世界官网',sourceUrl:'https://www.qdhdworld.com/'},
      {title:'青岛云上海天',tier:'A-',mode:'强雨可用',detail:'室内观光＋艺术中心，交通方便；若低云/海雾很重，观景价值降低，但仍比暴雨中跑海岸稳妥。',sourceLabel:'青岛国信文旅官方',sourceUrl:'https://qdgxwl.com/service.html'},
      {title:'青岛极地海洋公园',tier:'A-',mode:'强雨可用',detail:'主体室内，截图中也列为雨天可去。具体开放时间、表演和室外区域以当日园区公告为准。',sourceLabel:'用户截图＋地图核验'},
      {title:'海信探索中心',tier:'B+',mode:'强雨可用',detail:'室内互动体验候选，适合连续降雨时替代海岸。当前公开索引可确认场馆存在，但本页不写未经官方复核的实时营业时间。',sourceLabel:'用户截图＋公开索引'},
      {title:'青岛市图书馆（延吉路主馆）',tier:'B+',mode:'极端天气兜底',detail:'不是传统旅游点，但持续暴雨时非常稳：2026暑期主馆延时至19:00，自习室至21:00；周一闭馆（法定节假日除外）。',sourceLabel:'青岛政务网',sourceUrl:GOV_SUMMER_CULTURE}
    ],
    rainConditional:[
      {title:'八大关',condition:'小雨/阵雨间歇、无雷电大风',detail:'湿润红瓦绿树氛围很好，但石阶、坡道和树下风雨风险增加；缩短为建筑街区精选段。'},
      {title:'中山公园／植物园',condition:'小雨、无雷电大风',detail:'截图推荐雨中氛围；仅作为轻雨散步，不把强降雨当作“氛围加成”。'},
      {title:'浙江路天主教堂',condition:'小雨可用',detail:'建筑本体适合老城雨天组合；户外拍照缩短，开放与宗教活动安排以现场为准。'},
      {title:'湛山寺',condition:'小雨可用',detail:'有室内空间但仍需走户外台阶；鞋底防滑，雷雨时减少户外停留。'},
      {title:'海之恋公园',condition:'雨小、无强风雷电',pointId:'sea-love',detail:'截图列为雨天可去，但它仍是暴露海岸空间。强风浪、雷电时不去。'},
      {title:'北九水',condition:'仅小雨且景区开放、无暴雨/雷电/山洪/地质风险预警',detail:'截图称“雨天必须北九水”，本页不照搬。山区溪谷在强降水下风险上升，任何预警或景区管控都直接取消。'},
      {title:'第二/第三/石老人等海水浴场岸线',condition:'浴场明确开放＋无雷电/大风/大浪＋现场允许',detail:'截图里的“雨天海边氛围”不能覆盖官方安全指令。雨天最多做岸上短停；浴场关闭时绝不下海。'}
    ],
    rainAvoid:[
      {title:'小麦岛',reason:'大风/雷雨/强降水时暴露度高；改为天气转好后的日落奖励项。',pointId:'xiaomai'},
      {title:'崂山开放式山路（含仰口/太清长步行）',reason:'雨滑、雷电、地质和落石风险；强降雨或官方关闭时不进山。',pointId:'taiqing'},
      {title:'青山渔村',reason:'雨雾容易遮挡海景，且海岸/山路暴露；恶劣天气不专程前往。'},
      {title:'小鱼山／信号山观景',reason:'低云海雾时核心景观价值大幅下降，台阶湿滑；可把时间换给室内。',pointId:'xiaoyushan'},
      {title:'太平角缆车/开放观景项目',reason:'风雨时不把高空项目作为雨天方案；以运营方当日公告为准。'},
      {title:'五四广场白天长时间暴露',reason:'持续雨中停留收益低；若晚上雨势明显减弱且无大风雷电，可短看灯光。',pointId:'mayfourth'},
      {title:'私人游艇／非正规海上拉客',reason:'雨、风浪或能见度差时风险更高；海上体验只走正规客运航线和正规码头。'}
    ],
    beaches:[
      {name:'第一海水浴场',season:'06-01—10-31',tripHours:'08-09—08-15 09:00—21:00；08-16 09:00—18:00',phone:'0532-82963355'},
      {name:'第二海水浴场',season:'07-01—09-25',tripHours:'09:00—17:30',phone:'0532-66577309'},
      {name:'第三海水浴场',season:'07-01—09-25',tripHours:'09:00—17:30',phone:'0532-66577319'},
      {name:'栈桥海水浴场',season:'07-01—09-25',tripHours:'08-09—08-15 09:00—21:00；08-16 09:00—18:00',phone:'0532-82884548'},
      {name:'石老人海水浴场',season:'07-01—09-25',tripHours:'09:00—18:00',phone:'0532-88899636'},
      {name:'仰口海水浴场',season:'07-01—09-25',tripHours:'09:00—18:00',phone:'0532-67788538'},
      {name:'金沙滩海水浴场',season:'07-01—09-25',tripHours:'08-09—08-15 09:00—19:00；08-16 09:00—18:00',phone:'0532-86707399'},
      {name:'银沙滩海水浴场',season:'07-01—09-25',tripHours:'08-09—08-15 09:00—19:00；08-16 09:00—18:00',phone:'0532-89602009'},
      {name:'灵山湾海水浴场',season:'07-01—09-25',tripHours:'08-09—08-15 09:00—19:00；08-16 09:00—18:00',phone:'0532-83978302'}
    ].map(item=>({...item,status:'未检索到2026-08-08当天封闭公告；这不等于确认明日开放',checkedAt:'2026-08-08 16:06',sourceLabel:'青岛市城市管理局2026官方开放表',sourceUrl:OFFICIAL_BEACH_SOURCE})),
    consumerPitfalls:[
      {title:'私人游艇',level:'避开',detail:'用户明确要求避坑。只使用正规码头、正规海上客运/旅游航线和可核验票务；任何街头拉客、来源不明“私人船”不作为行程替代。'},
      {title:'“青岛大虾”高价单品',level:'谨慎',detail:'用户体验：仅“168元/只的十八斩”觉得味道尚可，其余体验像白灼、性价比差。本页把这句话保留为个人经验，不把168元或“十八斩”当作官方价格/客观推荐。点海鲜前确认品种、计价单位、称重、加工费和总价，并保留菜单/小票。'},
      {title:'崂山白花蛇草水',level:'只试1瓶',detail:'用户口味评价“很难喝”，延续原计划：仅买1瓶共同尝鲜，不整箱购买。'},
      {title:'雨天网红观景点',level:'先看能见度',detail:'小鱼山、信号山、云上海天等核心价值依赖视野；低云海雾严重时不要因为“已经预约/已经到了”硬耗时间。'}
    ],
    screenshotNotes:{
      source:'用户上传的11张抖音截图，2026-08-08读取',
      notRecommended:['青岛啤酒博物馆（雨天拥挤体验差的UGC观点）','小鱼山公园','太平角公园高空/缆车项目','海军博物馆室外舰艇区','崂山风景区','青山渔村','大鲍岛','崂山仰口','栈桥','五四广场白天','信号山公园','小麦岛'],
      recommended:['中山公园','海之恋公园','极地海洋世界','八大关','浙江路天主教堂','第二海水浴场（仅在官方允许时）','植物园','北九水（本页已增加山洪/雷电门禁）','湛山寺','青岛科技馆（截图原文疑似写作“科技园”，以官方场馆名校正）','海信探索中心','德国总督楼旧址博物馆','石老人海水浴场（仅在官方允许时）','城市阳台','海军公园']
    }
  };
  window.TravelRainGuideData=Object.freeze(data);
})();
