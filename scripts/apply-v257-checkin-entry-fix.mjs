import fs from 'node:fs';

function patch(file,before,after,label){
  const source=fs.readFileSync(file,'utf8');
  if(!source.includes(before))throw new Error(`${label} not found in ${file}`);
  fs.writeFileSync(file,source.replace(before,after));
}

patch(
  'src-v2.5.7/checkin-food-seaview.js',
  "try{history.replaceState(null,'','#checkin')}catch{}",
  "try{history.replaceState(null,'',location.pathname+location.search+'#checkin')}catch{}",
  'check-in history preservation',
);
patch(
  'src-v2.5.7/checkin-food-seaview.js',
  "if(location.hash==='#checkin')setTimeout(openPanel,250)",
  "const dedicatedCheckinEntry=location.hash==='#checkin'||new URLSearchParams(location.search).get('checkin')==='1';if(dedicatedCheckinEntry){const ensureCheckin=()=>{if(panel&&!panel.classList.contains('active'))openPanel()};[180,650,1400,2600].forEach(delay=>setTimeout(ensureCheckin,delay));window.addEventListener('load',()=>setTimeout(ensureCheckin,60),{once:true})}",
  'persistent check-in autostart condition',
);
patch(
  'apps/web/checkin.html',
  '../index.html?embedded=v3#checkin',
  '../index.html?embedded=v3&checkin=1#checkin',
  'check-in iframe URL',
);
patch(
  'scripts/validate-v3-pages.mjs',
  '../index.html?embedded=v3#checkin',
  '../index.html?embedded=v3&checkin=1#checkin',
  'deployed check-in iframe validation',
);

console.log('Applied persistent v2.5.7/v3 check-in entry activation.');
