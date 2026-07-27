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
  const start=migration.indexOf('function scanFunctions(source){'),end=migration.indexOf('\n\nconst explicit=',start);
  if(start>=0&&end>start){
    const scanner=String.raw`function scanFunctions(source){
  const out=[],declarations=/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;let match;
  while((match=declarations.exec(source))){
    const name=match[1],start=match.index,openParen=source.indexOf('(',match.index);let parens=0,paramQuote='',paramEscape=false,closeParen=-1;
    for(let i=openParen;i<source.length;i++){
      const ch=source[i];
      if(paramQuote){if(paramEscape){paramEscape=false;continue}if(ch==='\\'){paramEscape=true;continue}if(ch===paramQuote)paramQuote='';continue}
      if(ch==='"'||ch==="'"||ch.charCodeAt(0)===96){paramQuote=ch;continue}
      if(ch==='(')parens++;else if(ch===')'&&--parens===0){closeParen=i;break}
    }
    const brace=closeParen>=0?source.indexOf('{',closeParen+1):-1;if(brace<0)continue;
    let depth=0,quote='',escape=false,lineComment=false,blockComment=false,regex=false,regexClass=false,end=-1;
    for(let i=brace;i<source.length;i++){
      const ch=source[i],next=source[i+1];
      if(lineComment){if(ch==='\n')lineComment=false;continue}
      if(blockComment){if(ch==='*'&&next==='/'){blockComment=false;i++}continue}
      if(regex){if(escape){escape=false;continue}if(ch==='\\'){escape=true;continue}if(ch==='['){regexClass=true;continue}if(ch===']'){regexClass=false;continue}if(ch==='/'&&!regexClass){regex=false;while(/[a-z]/i.test(source[i+1]||''))i++}continue}
      if(quote){if(escape){escape=false;continue}if(ch==='\\'){escape=true;continue}if(ch===quote)quote='';continue}
      if(ch==='/'&&next==='/'){lineComment=true;i++;continue}
      if(ch==='/'&&next==='*'){blockComment=true;i++;continue}
      if(ch==='"'||ch==="'"||ch.charCodeAt(0)===96){quote=ch;continue}
      if(ch==='/'){
        const before=source.slice(Math.max(brace,i-24),i).trimEnd(),last=before.at(-1)||'';
        if(!last||'([=,:;!&|?{}<>+-*%^~'.includes(last)||/\b(?:return|case|throw|else|do|typeof|instanceof|in|of)$/.test(before)){regex=true;regexClass=false;continue}
      }
      if(ch==='{')depth++;else if(ch==='}'&&--depth===0){end=i+1;break}
    }
    if(end>start)out.push({name,start,end,text:source.slice(start,end)});
  }
  return out;
}`;
    migration=migration.slice(0,start)+scanner+migration.slice(end);
    fs.writeFileSync(migrationFile,migration);
  }
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
