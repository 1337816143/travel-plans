/* Additive loader: enhances a same-origin frozen v2.5.4 document without mutating it. */
(function(){
  'use strict';
  const current=document.currentScript?.src||new URL('./rain-layer-loader.js',location.href).href;
  const base=new URL('./',current);
  const dataUrl=new URL('../data/qingdao/rain/rain-guide.v1.json',base).href;
  const cssUrl=new URL('./rain-guide.css',base).href;
  const scriptUrl=new URL('./rain-guide.js',base).href;
  let dataPromise=null;
  function loadData(){
    if(!dataPromise)dataPromise=fetch(dataUrl,{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error(`Rain guide data HTTP ${response.status}`);return response.json()});
    return dataPromise;
  }
  async function inject(targetWindow){
    if(!targetWindow?.document)throw new Error('Rain layer target is unavailable');
    const doc=targetWindow.document;
    const data=await loadData();
    targetWindow.__QINGDAO_RAIN_GUIDE_DATA__=data;
    if(!doc.querySelector('link[data-qingdao-rain-layer]')){
      const link=doc.createElement('link');link.rel='stylesheet';link.href=cssUrl;link.dataset.qingdaoRainLayer='css';doc.head.appendChild(link);
    }
    if(doc.querySelector('script[data-qingdao-rain-layer]'))return true;
    await new Promise((resolve,reject)=>{
      const script=doc.createElement('script');script.src=scriptUrl;script.dataset.qingdaoRainLayer='js';script.onload=resolve;script.onerror=()=>reject(new Error('Rain guide script failed to load'));doc.body.appendChild(script);
    });
    return true;
  }
  window.QingdaoRainLayer=Object.freeze({inject,loadData,dataUrl,version:'2.5.5-additive'});
})();
