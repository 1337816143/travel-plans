/* v2.5 accessibility and comfort preferences. */
(function(){
  'use strict';
  const prefs=window.TravelPreferences,KEY='accessibility',defaults={fontScale:1,contrast:'normal',reduceMotion:false,simpleMode:false};
  function normalize(value={}){return{fontScale:Math.min(1.35,Math.max(.9,Number(value.fontScale)||1)),contrast:value.contrast==='high'?'high':'normal',reduceMotion:Boolean(value.reduceMotion),simpleMode:Boolean(value.simpleMode)}}
  function read(){return normalize(prefs?.get(KEY,defaults)||defaults)}
  function apply(value=read()){const settings=normalize(value),root=document.documentElement;root.style.setProperty('--user-font-scale',String(settings.fontScale));root.dataset.contrast=settings.contrast;root.dataset.reduceMotion=String(settings.reduceMotion);root.dataset.simpleMode=String(settings.simpleMode);root.classList.toggle('user-reduce-motion',settings.reduceMotion);root.classList.toggle('user-simple-mode',settings.simpleMode);document.dispatchEvent(new CustomEvent('travel:accessibility-change',{detail:settings}));return settings}
  function set(patch){const next=normalize({...read(),...patch});prefs?.set(KEY,next);return apply(next)}
  apply();
  window.TravelAccessibility=Object.freeze({KEY,defaults,read,set,apply});
})();
