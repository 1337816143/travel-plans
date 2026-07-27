import fs from 'node:fs';
const reminder='src-v2/services/travel-reminders.js';
let text=fs.readFileSync(reminder,'utf8');
text=text.replace("function shiftDate(date,days){return new Date(Date.parse(`${date}T00:00:00+08:00`)+days*86400000).toISOString().slice(0,10)}","function shiftDate(date,days){return new Date(Date.parse(`${date}T00:00:00Z`)+days*86400000).toISOString().slice(0,10)}");
fs.writeFileSync(reminder,text);
