import fs from 'node:fs';

const file = 'src-v2.5.7/checkin-food-seaview.js';
const source = fs.readFileSync(file, 'utf8');
const before = "  function install(){ensurePanel();renderPanel();decorateDays();decorateFood();decorateLeisure();bindEvents();const observer=new MutationObserver(()=>{decorateDays();decorateFood();decorateLeisure()});observer.observe(document.body,{childList:true,subtree:true});window.TravelCheckinSpots=Object.freeze({version:VERSION,data:DATA,open:openPanel,focus:focusLocation,route:focusRoute,photos:loadPhotos,clear:clearMapLayer});if(location.hash==='#checkin')setTimeout(openPanel,250)}";
const after = `  function honorCheckinDeepLink(){
    if(location.hash!=='#checkin')return;
    const root=ensurePanel();
    if(root&&!root.classList.contains('active'))openPanel();
  }
  function install(){ensurePanel();renderPanel();decorateDays();decorateFood();decorateLeisure();bindEvents();const observer=new MutationObserver(()=>{decorateDays();decorateFood();decorateLeisure()});observer.observe(document.body,{childList:true,subtree:true});window.TravelCheckinSpots=Object.freeze({version:VERSION,data:DATA,open:openPanel,focus:focusLocation,route:focusRoute,photos:loadPhotos,clear:clearMapLayer});if(location.hash==='#checkin'){[60,280,700,1500].forEach(delay=>setTimeout(honorCheckinDeepLink,delay));window.addEventListener('load',honorCheckinDeepLink,{once:true})}window.addEventListener('hashchange',honorCheckinDeepLink)}`;
if (!source.includes(before)) throw new Error('v2.5.7 install/deep-link anchor not found');
fs.writeFileSync(file, source.replace(before, after));
console.log('Hardened v2.5.7 #checkin deep-link activation across legacy bootstrap.');
