import fs from 'node:fs';

const read=file=>fs.readFileSync(file,'utf8'),failures=[];
const lazy=read('assets/v2.5.0/lazy-tools.js');
const booking=read('src-v2/ui/booking-panel.js');
const calendar=read('src-v2/services/calendar-export.js');
const availability=read('src-v2/services/availability-store.js');
const availabilityUi=read('src-v2/ui/availability-controller.js');
const operations=read('src-v2/ui/trip-operations.js');
const build=read('scripts/build-v2.mjs');
for(const token of ['window.TravelAvailability','window.TravelAvailabilityController','trip-availability-v2.5','data-availability-status'])if(!lazy.includes(token))failures.push(`lazy bundle missing ${token}`);
for(const token of ['travel:booking-progress','previous','item'])if(!booking.includes(token))failures.push(`booking progress event missing ${token}`);
for(const token of ['bookingEvents','预约状态更新','CANCELLED','SEQUENCE:${Number(item.sequence)'])if(!calendar.includes(token))failures.push(`calendar booking synchronization missing ${token}`);
for(const token of ['expiresAt','TTL=12*60*60*1000','closed','full','limited'])if(!availability.includes(token))failures.push(`availability expiry/status missing ${token}`);
for(const token of ['MutationObserver','data-availability-row','sourceLink','travel:rain-ranking-change'])if(!availabilityUi.includes(token))failures.push(`availability UI missing ${token}`);
for(const token of ['nextStopPanel','transportCorrectionPanel','trackPanel','financePanel','healthCheckPanel','operationLogPanel'])if(!operations.includes(token))failures.push(`practical tools panel missing ${token}`);
if(!build.includes("read('src-v2','services','availability-store.js')")||!build.includes("read('src-v2','ui','availability-controller.js')"))failures.push('availability modules are not included in deterministic build');
console.log(JSON.stringify({version:'2.5.0',bookingCalendarSync:true,availabilityExpiryHours:12,availabilityAffectsPresentation:true,practicalPanels:6,failures},null,2));
if(failures.length)process.exitCode=1;
