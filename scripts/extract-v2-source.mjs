import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const SOURCE=path.join(ROOT,'src','v1.0.15.html');
const OUT=path.join(ROOT,'src-v2');
const VERSION='2.0.0';

function ensureDir(file){fs.mkdirSync(path.dirname(file),{recursive:true})}
function write(file,content){ensureDir(file);fs.writeFileSync(file,content)}
function matchOne(text,re,label){const m=text.match(re);if(!m)throw new Error(`Missing ${label}`);return m[1]}

const html=fs.readFileSync(SOURCE,'utf8');
const css=matchOne(html,/<style>([\s\S]*?)<\/style>/i,'style block').trim();
const body=matchOne(html,/<body>([\s\S]*?)<\/body>/i,'body');
const inline=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1].trim());
const external=[...html.matchAll(/<script[^>]*\bsrc=["'][^"']+["'][^>]*><\/script>/gi)].map(x=>x[0]);
if(inline.length<2)throw new Error(`Expected at least two inline scripts, got ${inline.length}`);

let shell=body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').trim();
shell=shell.replaceAll('v1.0.15',`v${VERSION}`).replaceAll('travel-plans-v1.0.15',`travel-plans-v${VERSION}`);
let app=inline.at(-1).replace("const APP_VERSION='1.0.15';",`const APP_VERSION='${VERSION}';`);
app=app.split('\n').filter(line=>!line.includes("syncViewportHeight();window.addEventListener('resize',syncViewportHeight)")).join('\n').trim();

const template=`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="2026年8月9日至16日青岛舒适旅行计划与可交互地图">
<meta name="theme-color" content="#eff6ff">
<meta name="travel-map-version" content="${VERSION}">
<title>青岛旅行计划</title>
<style>/*__APP_CSS__*/</style>
</head>
<body>
${shell}
<script>/*__STARTUP__*/</script>
${external.join('\n')}
<script>/*__RUNTIME__*/</script>
<script>/*__LEGACY_APP__*/</script>
<script>/*__OPTIMIZATION__*/</script>
<script>/*__BOOT__*/</script>
</body>
</html>`;

write(path.join(OUT,'template.html'),template);
write(path.join(OUT,'styles','legacy.css'),css+'\n');
write(path.join(OUT,'startup.js'),inline[0]+'\n');
write(path.join(OUT,'app','legacy-app.js'),app+'\n');
write(path.join(OUT,'README.md'),`# v2 canonical source\n\nThis directory is the editable source for the optimized branch. It was copied once from the immutable v1.0.15 snapshot. Future releases must build from these files rather than decoding a previous compressed payload.\n\n- template.html: page shell\n- styles/: editable styles\n- startup.js: global error boundary\n- core/: state, request, viewport and overlay infrastructure\n- app/legacy-app.js: copied v1.0.15 application logic during migration\n- optimization.js: v2 integrations and compatibility layer\n- boot.js: explicit startup entry point\n`);
console.log('Extracted canonical v2 source from immutable v1.0.15');
