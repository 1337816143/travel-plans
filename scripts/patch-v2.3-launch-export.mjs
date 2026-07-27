import fs from 'node:fs';
const file='scripts/migrate-v2.3.mjs';
let source=fs.readFileSync(file,'utf8');
const writeLegacy="fs.writeFileSync(LEGACY,source.replace(/\\n{4,}/g,'\\n\\n'));";
if(source.includes(writeLegacy))source=source.replace(writeLegacy,"source=source.replace('window.launchAmap=launchAmap;','');\n  fs.writeFileSync(LEGACY,source.replace(/\\n{4,}/g,'\\n\\n'));");
const markerLine="writeGroup('marker','src-v2/map/marker-renderer.js','shared marker and popup helpers');";
if(source.includes(markerLine))source=source.replace(markerLine,"writeGroup('marker','src-v2/map/marker-renderer.js','shared marker and popup helpers','\\nwindow.launchAmap=launchAmap;\\n');");
fs.writeFileSync(file,source);
