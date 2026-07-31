/* v2.5.3 precision patch for girlfriend-recommended food. Keeps uncertain businesses honest while preserving the original must-eat / must-buy marker identity. */
(function(){
  'use strict';
  const data=typeof GIRLFRIEND_WISHLIST!=='undefined'?GIRLFRIEND_WISHLIST:(window.GIRLFRIEND_WISHLIST||globalThis.GIRLFRIEND_WISHLIST);
  if(!data)return;
  window.GIRLFRIEND_WISHLIST=data;
  data.version='2.5.3';
  const foodById=id=>(data.food||[]).find(item=>item.id===id);
  const mapById=id=>(data.mapPoints||[]).find(item=>item.id===id);

  const xiaomujia=foodById('food-xiaomujia');
  if(xiaomujia){
    Object.assign(xiaomujia,{
      name:'小木家韩式烤肉（漳州二路店）',
      original:'小木家和参鸡汤（在漳州二路那块）',
      aliases:['小木家·韩式烤肉·韩国料理（漳州二路总店）','小木家韩国料理（漳州二路店）'],
      target:'参鸡汤（朋友亲测推荐）',
      status:'verified-store-user-recommended-dish',
      address:'青岛市市南区漳州二路49号（燕儿岛路地铁站B口步行约300米）',
      mapUrl:'https://ditu.amap.com/search?query=%E5%B0%8F%E6%9C%A8%E5%AE%B6%E9%9F%A9%E5%BC%8F%E7%83%A4%E8%82%89%20%E6%BC%B3%E5%B7%9E%E4%BA%8C%E8%B7%AF49%E5%8F%B7',
      sourceUrl:'https://ranks.amap.com/recommend/korean_restaurant-Qingdao-family',
      note:'门店名称按用户确认统一为“小木家韩式烤肉（漳州二路店）”，漳州二路49号地址已由高德、携程及大众点评交叉核对。参鸡汤来自女朋友朋友的亲测推荐；公开菜单检索未稳定把参鸡汤列为招牌菜，因此到店前仍要确认当天是否供应。',
      verification:{store:'verified',address:'verified',dish:'trusted-personal-recommendation',checkedAt:'2026-07-31'},
      girlfriendMust:true
    });
  }
  const xiaomujiaPoint=mapById('wishmap-xiaomujia');
  if(xiaomujiaPoint){
    Object.assign(xiaomujiaPoint,{
      name:'小木家韩式烤肉（漳州二路店）',
      mapLabel:'小木家参鸡汤',
      status:'固定门店与地址已核验·参鸡汤需确认供应',
      precision:'address',
      detail:'漳州二路49号的韩式烤肉店。女朋友朋友亲测推荐参鸡汤；公开评价更常提到烤肉、小菜、大酱汤、冷面等，因此不把参鸡汤伪装成平台认证招牌。',
      transport:'住宿核心区东侧，靠近燕儿岛路地铁站；抵达较早或住宿区晚餐时可采用。',
      tips:'到店前电话或地图平台确认参鸡汤是否供应；不要误入“朴氏小木屋”或其他相似店名。',
      source:'高德韩国料理榜＋携程餐厅页＋大众点评门店页＋亲友亲测推荐',
      sourceUrl:'https://ranks.amap.com/recommend/korean_restaurant-Qingdao-family',
      mapUrl:'https://ditu.amap.com/search?query=%E5%B0%8F%E6%9C%A8%E5%AE%B6%E9%9F%A9%E5%BC%8F%E7%83%A4%E8%82%89%20%E6%BC%B3%E5%B7%9E%E4%BA%8C%E8%B7%AF49%E5%8F%B7',
      girlfriendMust:true
    });
  }

  const yunnan=foodById('food-yunnan-rice-noodle');
  if(yunnan){
    Object.assign(yunnan,{
      name:'云南锅锅米线（漳州二路附近，精确门店待确认）',
      original:'那个附近还有个云南锅锅米线，那个薄荷炸排骨也好吃',
      aliases:['云南锅锅米线','锅锅米线'],
      target:'薄荷炸排骨',
      status:'trusted-personal-recommendation-store-unverified',
      address:'漳州二路、小木家周边步行范围；精确门头和门牌尚未获得可靠公开证据',
      mapUrl:'https://ditu.amap.com/search?query=%E4%BA%91%E5%8D%97%E9%94%85%E9%94%85%E7%B1%B3%E7%BA%BF%20%E8%96%84%E8%8D%B7%E7%82%B8%E6%8E%92%E9%AA%A8%20%E9%9D%92%E5%B2%9B',
      note:'已经完整收录，不是遗漏。多轮公开检索没有找到能够同时证明“青岛漳州二路附近＋锅锅米线＋薄荷炸排骨”的稳定门店页面；搜索结果中的外地“野碗·云贵川·铜锅米线”等不得误配。页面保留亲友推荐，并把地图点明确标为现场核店范围。',
      verification:{store:'unverified',area:'verified-near-zhangzhou-erlu',dish:'trusted-personal-recommendation',checkedAt:'2026-07-31'},
      girlfriendMust:true
    });
  }
  const yunnanPoint=mapById('wishmap-yunnan-noodle');
  if(yunnanPoint){
    Object.assign(yunnanPoint,{
      name:'云南锅锅米线（漳州二路附近核店范围）',
      mapLabel:'锅锅米线核店',
      status:'亲友推荐·精确门店尚未核实',
      precision:'anchor',
      detail:'目标菜为薄荷炸排骨。此点只表示小木家与漳州二路附近的现场核店范围，不代表已确认某一门店，更不能匹配到外地同名连锁。',
      transport:'吃完小木家或在住宿区活动时步行搜索；若地图、门头和菜单不能同时匹配，直接记录为未找到。',
      tips:'必须同时核对店名、青岛地址和薄荷炸排骨菜单；任何一项不符都不要当作原推荐店。',
      source:'女朋友朋友亲测推荐＋公开地图与餐饮平台反向核查（暂未形成可靠精确匹配）',
      mapUrl:'https://ditu.amap.com/search?query=%E4%BA%91%E5%8D%97%E9%94%85%E9%94%85%E7%B1%B3%E7%BA%BF%20%E8%96%84%E8%8D%B7%E7%82%B8%E6%8E%92%E9%AA%A8%20%E9%9D%92%E5%B2%9B',
      girlfriendMust:true
    });
  }

  for(const item of data.food||[])item.girlfriendMust=true;
  for(const point of data.mapPoints||[])point.girlfriendMust=true;

  const runtimePointList=typeof POINTS!=='undefined'?POINTS:[];
  for(const source of data.mapPoints||[]){
    const runtime=runtimePointList.find(point=>point.id===source.id);
    if(runtime)Object.assign(runtime,source,{wishlistPoint:true});
  }

  const base=window.TravelWishlistMap;
  if(!base)return;
  for(const source of data.mapPoints||[]){
    const runtime=base.points?.find(point=>point.id===source.id);
    if(runtime)Object.assign(runtime,source,{wishlistPoint:true});
  }
})();
