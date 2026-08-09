import fs from 'node:fs';

function update(file, transform){const source=fs.readFileSync(file,'utf8');const next=transform(source);if(next===source)throw new Error(`No v2.5.7 change applied to ${file}`);fs.writeFileSync(file,next)}
function replaceVersion(source){return source.replaceAll('v2.5.6','v2.5.7').replaceAll('2.5.6','2.5.7')}

for(const file of ['apps/web/index.html','apps/web/rain.html','apps/web/src/rain-entry.ts','scripts/check-v3-v2-parity.mjs','scripts/validate-v3-pages.mjs','tests-v3/phase2-web.spec.js','tests-v3/rain-contingency.spec.ts'])update(file,replaceVersion);

update('apps/web/src/view.ts',source=>{
  source=replaceVersion(source);
  const anchor='<button type="button" data-action="switch-workspace" data-workspace="planner" aria-pressed="${String(state.workspace === \'planner\')}" class="${state.workspace === \'planner\' ? \'is-active\' : \'\'}">自定义规划</button>';
  if(!source.includes(anchor))throw new Error('v3 header planner button anchor missing');
  return source.replace(anchor,`${anchor}\n      <a href="./checkin.html" class="workspace-link">打卡机位</a>`);
});

update('scripts/package-v3-pages.mjs',source=>{
  source=replaceVersion(source);
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

console.log('Applied v2.5.7 → v3 check-in synchronization.');
