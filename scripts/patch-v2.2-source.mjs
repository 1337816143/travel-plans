import fs from 'node:fs';
import path from 'node:path';
const reminder='src-v2/services/travel-reminders.js';
let text=fs.readFileSync(reminder,'utf8');
text=text.replace("function shiftDate(date,days){return new Date(Date.parse(`${date}T00:00:00+08:00`)+days*86400000).toISOString().slice(0,10)}","function shiftDate(date,days){return new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10)}");
fs.writeFileSync(reminder,text);

const catalog='src-v2/data/generated/catalog.js';
if(fs.existsSync(catalog)){
  const source=fs.readFileSync(catalog,'utf8').replace(/version:'[^']+'/,"version:'2.3.0'");
  fs.writeFileSync(catalog,source);
}

const migrationFile='scripts/migrate-v2.3.mjs';
if(fs.existsSync(migrationFile)){
  let migration=fs.readFileSync(migrationFile,'utf8');
  if(!migration.includes("from 'acorn'"))migration=migration.replace("import path from 'node:path';","import path from 'node:path';\nimport {parse} from 'acorn';");
  const start=migration.indexOf('function scanFunctions(source){'),end=migration.indexOf('\n\nconst explicit=',start);
  if(start>=0&&end>start){
    const scanner="function scanFunctions(source){\n  const ast=parse(source,{ecmaVersion:'latest',sourceType:'script',ranges:true,allowHashBang:true});\n  return ast.body.filter(node=>node.type==='FunctionDeclaration'&&node.id?.name).map(node=>({name:node.id.name,start:node.start,end:node.end,text:source.slice(node.start,node.end)}));\n}";
    migration=migration.slice(0,start)+scanner+migration.slice(end);
  }
  fs.writeFileSync(migrationFile,migration);
}

const reportFile='MIGRATION_V2.2.json',dir='src-v2/data/generated';
if(fs.existsSync(reportFile)){
  const report=JSON.parse(fs.readFileSync(reportFile,'utf8'));
  if(!Array.isArray(report.extracted)||report.extracted.length===0){
    const groups={points:'points',schedules:'schedules',hotels:'hotels',bookings:'bookings',sources:'sources',recommendations:'recommendations'},extracted=[];
    for(const [file,group] of Object.entries(groups)){
      const target=path.join(dir,`${file}.js`);if(!fs.existsSync(target))continue;const source=fs.readFileSync(target,'utf8');
      for(const match of source.matchAll(/(?:^|\n)const\s+([A-Za-z_$][\w$]*)\s*=/g))extracted.push({name:match[1],group,bytes:Buffer.byteLength(source)});
    }
    report.extracted=extracted;fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
  }
}
