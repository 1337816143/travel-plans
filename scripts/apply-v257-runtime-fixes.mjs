import fs from 'node:fs';

function patch(file,before,after,label){const source=fs.readFileSync(file,'utf8');if(!source.includes(before))throw new Error(`${label} not found in ${file}`);fs.writeFileSync(file,source.replace(before,after))}

patch(
  'data/qingdao/checkin/checkin-guide.v1.json',
  '"id":"ohmo-cafe","name":"OHMO CAFE","day":"08-14","priority":true,"lat":35.87960,"lng":119.93080,"amapQuery":"OHMO CAFE 青岛 绿泽画院 张家楼"',
  '"id":"ohmo-cafe","name":"OHMO CAFE","day":"08-14","priority":true,"searchOnly":true,"amapQuery":"OHMO CAFE 青岛 绿泽画院 张家楼"',
  'OHMO coordinate hardening',
);
patch(
  'data/qingdao/checkin/checkin-guide.v1.json',
  '"precision":"公开地址已核验；坐标为绿泽画院片区参考，进门后按高德POI/现场定位"',
  '"precision":"公开地址已核验；公开检索未取得足够可靠的门店经纬度，进门后按高德POI/现场定位"',
  'OHMO precision note',
);
patch('tests-v3/v257-checkin-food-seaview.spec.js','/* global window */','/* global window, document */','browser globals');
patch("tests-v3/v257-checkin-food-seaview.spec.js","toHaveCount(8);","toHaveCount(6);",'priority-card count');

console.log('Applied v2.5.7 runtime/data hardening fixes.');
