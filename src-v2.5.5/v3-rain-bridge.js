/* Bridge the additive v2.5.5 rain tab into the v3 complete-guide iframe. */
(function(){
  'use strict';
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function waitForLoader(){for(let i=0;i<80;i+=1){if(window.QingdaoRainLayer)return window.QingdaoRainLayer;await sleep(100)}throw new Error('Rain layer loader unavailable')}
  async function waitForFrame(){for(let i=0;i<100;i+=1){const frame=document.querySelector('iframe[data-testid="legacy-v2-frame"]');if(frame)return frame;await sleep(100)}return null}
  async function enhance(frame){
    if(!frame)return false;
    if(!frame.contentDocument||frame.contentDocument.readyState==='loading')await new Promise(resolve=>frame.addEventListener('load',resolve,{once:true}));
    const loader=await waitForLoader();await loader.inject(frame.contentWindow);return true;
  }
  async function openRain(){
    document.querySelector('[data-action="switch-workspace"][data-workspace="guide"]')?.click();
    const frame=await waitForFrame();if(!frame)return;
    await enhance(frame);
    for(let i=0;i<50;i+=1){const tab=frame.contentDocument?.querySelector('[data-tab="rain"]');if(tab){tab.click();return}await sleep(100)}
  }
  function installLaunch(){
    if(document.querySelector('[data-v3-rain-launch]'))return;
    const button=document.createElement('button');button.type='button';button.dataset.v3RainLaunch='true';button.className='v3-rain-launch';button.textContent='☔ 雨天攻略 · 浴场封海';button.addEventListener('click',()=>openRain().catch(console.warn));document.body.appendChild(button);
    const style=document.createElement('style');style.textContent='.v3-rain-launch{position:fixed;right:16px;bottom:16px;z-index:2500;border:1px solid #dfc47d;background:#fff4d6;color:#705118;border-radius:999px;padding:11px 14px;box-shadow:0 12px 32px rgba(13,52,66,.2);font:800 11px/1 Inter,"PingFang SC","Microsoft YaHei",system-ui,sans-serif;cursor:pointer}.v3-rain-launch:hover{transform:translateY(-1px)}@media(max-width:520px){.v3-rain-launch{right:9px;bottom:9px;font-size:10px;padding:10px 12px}}';document.head.appendChild(style);
  }
  function observe(){
    const observer=new MutationObserver(()=>{const frame=document.querySelector('iframe[data-testid="legacy-v2-frame"]');if(frame&&!frame.dataset.rainBridge){frame.dataset.rainBridge='pending';enhance(frame).then(()=>{frame.dataset.rainBridge='ready'}).catch(()=>{frame.dataset.rainBridge='failed'})}});observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  function init(){installLaunch();observe();const frame=document.querySelector('iframe[data-testid="legacy-v2-frame"]');if(frame)enhance(frame).catch(console.warn)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
