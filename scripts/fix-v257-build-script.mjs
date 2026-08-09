import fs from 'node:fs';

const file='scripts/build-v2.5.7-current.mjs';
let source=fs.readFileSync(file,'utf8');
const before=source;
source=source
  .replaceAll(String.raw`\\bsrc`,String.raw`\bsrc`)
  .replaceAll(String.raw`[\\s\\S]`,String.raw`[\s\S]`)
  .replaceAll(String.raw`<\\/script>`,String.raw`<\/script>`)
  .replaceAll(String.raw`<\\/h1>`,String.raw`<\/h1>`);
source=source
  .split('\n')
  .map(line=>line.includes("'release metadata'")?'html=html.replace(/name="travel-map-release" content="[^"]+"/,`name="travel-map-release" content="${DATE}-v${VERSION}.html"`);':line)
  .join('\n');
if(source===before)throw new Error('No v2.5.7 build repair was applied');
fs.writeFileSync(file,source);
console.log('Repaired v2.5.7 build-script escapes and idempotent release metadata.');
