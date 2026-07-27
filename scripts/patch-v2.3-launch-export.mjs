import fs from 'node:fs';

const migrationFile='scripts/migrate-v2.3.mjs';
let source=fs.readFileSync(migrationFile,'utf8');
const writeLegacy="fs.writeFileSync(LEGACY,source.replace(/\\n{4,}/g,'\\n\\n'));";
if(source.includes(writeLegacy))source=source.replace(writeLegacy,"source=source.replace('window.launchAmap=launchAmap;','');\n  fs.writeFileSync(LEGACY,source.replace(/\\n{4,}/g,'\\n\\n'));");
const markerLine="writeGroup('marker','src-v2/map/marker-renderer.js','shared marker and popup helpers');";
if(source.includes(markerLine))source=source.replace(markerLine,"writeGroup('marker','src-v2/map/marker-renderer.js','shared marker and popup helpers','\\nwindow.launchAmap=launchAmap;\\n');");
fs.writeFileSync(migrationFile,source);

const legacyFile='src-v2/app/legacy-app.js';
if(fs.existsSync(legacyFile)){
  let legacy=fs.readFileSync(legacyFile,'utf8');
  legacy=legacy.replace(/\s*window\.launchAmap=launchAmap;\s*/,'\n');
  fs.writeFileSync(legacyFile,legacy.replace(/\n{4,}/g,'\n\n'));
}

const markerFile='src-v2/map/marker-renderer.js';
if(fs.existsSync(markerFile)){
  let marker=fs.readFileSync(markerFile,'utf8');
  if(!marker.includes('window.launchAmap=launchAmap;'))marker+='\nwindow.launchAmap=launchAmap;\n';
  fs.writeFileSync(markerFile,marker);
}
