import fs from 'node:fs';
const file='.github/workflows/validate-pages-payload.yml';
let text=fs.readFileSync(file,'utf8');
text=text.replaceAll('agent/v2.1.0-unified-overlay','agent/v2.2.0-data-adapters-reminders');
if(!text.includes("- 'assets/v2.2.0/**'"))text=text.replace("      - 'assets/v2.1.0/**'","      - 'assets/v2.1.0/**'\n      - 'assets/v2.2.0/**'");
text=text.replaceAll('NEWEST_VALID_VERSION=v2.1.0','NEWEST_VALID_VERSION=v2.2.0');
text=text.replaceAll("['2.1.0','1.0.15']","['2.2.0','1.0.15']");
fs.writeFileSync(file,text);
console.log('Patched Pages validation workflow for v2.2.0');
