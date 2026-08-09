import fs from 'node:fs';

const file = 'scripts/build-v2.5.7-current.mjs';
const source = fs.readFileSync(file, 'utf8');
const lines = source.split('\n');

const inlineIndex = lines.findIndex((line) => line.includes('[...html.matchAll('));
if (inlineIndex < 0) throw new Error('v2.5.7 inline-script matcher line not found');
lines.splice(
  inlineIndex,
  1,
  "const inlineScriptPattern=new RegExp('<script(?![^>]*\\\\bsrc=)[^>]*>([\\\\s\\\\S]*?)<\\\\/script>','gi');",
  "[...html.matchAll(inlineScriptPattern)].forEach((match,index)=>new vm.Script(match[1],{filename:`v257-inline-${index}.js`}));",
);

const releaseIndex = lines.findIndex((line) => line.includes("build token missing: ${label}") ? false : line.includes("'release metadata'"));
if (releaseIndex < 0) throw new Error('v2.5.7 release metadata line not found');
lines[releaseIndex] =
  "if(!html.includes(`name=\"travel-map-release\" content=\"${DATE}-v${VERSION}.html\"`))throw new Error('v2.5.7 release metadata missing');";

const dataIndex = lines.findIndex((line) => line.startsWith('const dataScript='));
const addonIndex = lines.findIndex((line) => line.startsWith('const addonScript='));
if (dataIndex < 0 || addonIndex < 0) throw new Error('v2.5.7 injected script lines not found');
lines[dataIndex] =
  "const dataScript=`<script id=\"checkin-guide-data-v257\">window.__QINGDAO_CHECKIN_V257__=${JSON.stringify(checkin).replace(/</g,'\\u003c')};</script>`;";
lines[addonIndex] =
  "const addonScript=`<script id=\"checkin-food-seaview-app-v257\">${addonJs}</script>`;";

const historyIndex = lines.findIndex((line) => line.includes('versionIndex=versionIndex.replace(/(<body><h1>'));
if (historyIndex < 0) throw new Error('v2.5.7 history insertion regex line not found');
lines[historyIndex] =
  "versionIndex=versionIndex.replace('<body><h1>青岛旅行地图历史版本</h1>','<body><h1>青岛旅行地图历史版本</h1>'+card);write('versions/index.html',versionIndex);";

const loaderIndex = lines.findIndex((line) => line.startsWith('function loader('));
if (loaderIndex < 0) throw new Error('v2.5.7 loader line not found');
lines[loaderIndex] = lines[loaderIndex].replace(/<\\+\/script>/g, '</script>');

fs.writeFileSync(file, lines.join('\n'));
console.log('Repaired v2.5.7 build parser, metadata, script injection and history insertion.');
