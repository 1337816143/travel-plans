import fs from 'node:fs';

function update(file,transform){const source=fs.readFileSync(file,'utf8');const next=transform(source);if(next===source)throw new Error(`No v2.5.7 change applied to ${file}`);fs.writeFileSync(file,next)}
function promote(source){
  source=source.replaceAll('v2.5.6','v2.5.7').replaceAll('2.5.6','2.5.7');
  source=source.replaceAll("candidates=['2.5.7','2.5.5','2.5.4','1.0.15']","candidates=['2.5.7','2.5.6','2.5.5','2.5.4','1.0.15']");
  return source;
}

for(const file of ['apps/web/index.html','apps/web/rain.html','apps/web/src/rain-entry.ts','scripts/check-v3-v2-parity.mjs','tests-v3/phase2-web.spec.js','tests-v3/rain-contingency.spec.ts'])update(file,promote);

update('apps/web/src/view.ts',source=>{
  source=promote(source);
  const anchor='<button type="button" data-action="switch-workspace" data-workspace="planner" aria-pressed="${String(state.workspace === \'planner\')}" class="${state.workspace === \'planner\' ? \'is-active\' : \'\'}">自定义规划</button>';
  if(!source.includes(anchor))throw new Error('v3 header planner button anchor missing');
  return source.replace(anchor,`${anchor}\n      <a href="./checkin.html" class="workspace-link">打卡机位</a>`);
});

update('scripts/package-v3-pages.mjs',source=>{
  source=promote(source);
  const copyAnchor="fs.copyFileSync(path.join(repositoryRoot, 'apps/web/rain.html'), path.join(outputDirectory, 'rain.html'));";
  if(!source.includes(copyAnchor))throw new Error('v3 rain copy anchor missing');
  source=source.replace(copyAnchor,`${copyAnchor}\nfs.copyFileSync(path.join(repositoryRoot, 'apps/web/checkin.html'), path.join(outputDirectory, 'checkin.html'));`);
  const writeRain="fs.writeFileSync(\n  path.join(outputDirectory, 'rain-guide.json'),\n  `${JSON.stringify(rainGuide, null, 2)}\\n`,\n);";
  if(!source.includes(writeRain))throw new Error('v3 rain guide write anchor missing');
  source=source.replace(writeRain,`${writeRain}\n\nconst checkinGuide = JSON.parse(\n  fs.readFileSync(path.join(repositoryRoot, 'data/qingdao/checkin/checkin-guide.v1.json'), 'utf8'),\n);\nfs.writeFileSync(\n  path.join(outputDirectory, 'checkin-guide.json'),\n  \`${'${JSON.stringify(checkinGuide, null, 2)}'}\\n\`,\n);`);
  const workspace="workspaces: ['complete-v2.5.7-guide', 'rain-contingency', 'custom-planner'],";
  if(!source.includes(workspace))throw new Error('v3 workspace anchor missing');
  source=source.replace(workspace,"workspaces: ['complete-v2.5.7-guide', 'checkin-camera-spots', 'rain-contingency', 'custom-planner'],");
  const rainGuideBlock="rainGuide: {\n    page: 'rain.html',\n    data: 'rain-guide.json',\n    source: 'rain-guide.v1.json + current-ops-2026-08-08.json + current-status-2026-08-09.json',\n  },";
  if(!source.includes(rainGuideBlock))throw new Error('v3 manifest rain guide block missing');
  source=source.replace(rainGuideBlock,`${rainGuideBlock}\n  checkinGuide: {\n    page: 'checkin.html',\n    data: 'checkin-guide.json',\n    source: 'checkin-guide.v1.json + current root v2.5.7 runtime',\n  },`);
  source=source.replace('Packaged v3 complete guide + rain contingency + planner','Packaged v3 complete guide + check-in + rain contingency + planner');
  return source;
});

update('scripts/validate-v3-pages.mjs',source=>{
  source=promote(source);
  const rainCheck="if (manifest.rainGuide?.page !== 'rain.html' || manifest.rainGuide?.data !== 'rain-guide.json') {\n  throw new Error('The v3 release manifest does not bind the shared rain guide.');\n}";
  if(!source.includes(rainCheck))throw new Error('v3 rain manifest validation anchor missing');
  source=source.replace(rainCheck,`${rainCheck}\nif (manifest.checkinGuide?.page !== 'checkin.html' || manifest.checkinGuide?.data !== 'checkin-guide.json') {\n  throw new Error('The v3 release manifest does not bind the check-in camera guide.');\n}\nif (!manifest.workspaces?.includes('checkin-camera-spots')) {\n  throw new Error('The v3 release manifest has no check-in camera workspace.');\n}`);
  const deployedRain="if (!deployedSource.includes('rain.html')) {\n  throw new Error('The v3 package does not expose the rain contingency page.');\n}";
  if(!source.includes(deployedRain))throw new Error('v3 deployed rain validation anchor missing');
  source=source.replace(deployedRain,`${deployedRain}\nif (!deployedSource.includes('checkin.html')) {\n  throw new Error('The v3 package does not expose the check-in camera page.');\n}`);
  const beforeDeployed="const deployedSource = manifest.files";
  if(!source.includes(beforeDeployed))throw new Error('v3 deployed source anchor missing');
  const checkinValidation=`const checkinHtml = fs.readFileSync(path.join(outputDirectory, 'checkin.html'), 'utf8');\nconst checkinGuideText = fs.readFileSync(path.join(outputDirectory, 'checkin-guide.json'), 'utf8');\nconst checkinGuide = JSON.parse(checkinGuideText);\nfor (const token of ['打卡机位', '../index.html?embedded=v3#checkin']) {\n  if (!checkinHtml.includes(token)) throw new Error(\`v3/checkin.html is missing \${token}\`);\n}\nfor (const token of ['琴屿路', 'OHMO CAFE', '五仁杂货铺', '黄岛鱼鸣嘴', '龙口路 → 龙江路 → 黄县路', '福山支路 → 金口一路']) {\n  if (!checkinGuideText.includes(token)) throw new Error(\`v3/checkin-guide.json is missing \${token}\`);\n}\nconst huangdaoSign = checkinGuide.locations?.find((item) => item.id === 'huangdao-sign');\nif (!huangdaoSign?.searchOnly || 'lat' in huangdaoSign || 'lng' in huangdaoSign) {\n  throw new Error('v3 check-in guide fabricated a coordinate for the unverified Huangdao sign.');\n}\n\n`;
  source=source.replace(beforeDeployed,checkinValidation+beforeDeployed);
  return source;
});

console.log('Applied v2.5.7 → v3 check-in synchronization.');
