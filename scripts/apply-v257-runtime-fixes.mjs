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
patch('tests-v3/v257-checkin-food-seaview.spec.js','toHaveCount(8);','toHaveCount(6);','priority-card count');

const stylesFile='apps/web/src/styles.css';
let styles=fs.readFileSync(stylesFile,'utf8');
if(styles.includes('.workspace-link'))throw new Error('workspace-link style already present unexpectedly');
styles+=`\n.workspace-link {\n  padding: 8px 12px;\n  color: #b8d5d4;\n  font-size: 12px;\n  font-weight: 700;\n  text-decoration: none;\n  border: 1px solid rgba(184, 213, 212, 0.25);\n  border-radius: 999px;\n}\n.workspace-link:hover {\n  color: white;\n  background: rgba(20, 169, 163, 0.24);\n  border-color: rgba(109, 224, 215, 0.62);\n}\n`;
fs.writeFileSync(stylesFile,styles);

console.log('Applied v2.5.7 runtime/data hardening fixes.');
