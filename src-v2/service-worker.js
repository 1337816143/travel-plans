const CACHE='travel-plans-__VERSION__';
const CORE=[
  './',
  './index.html',
  './versions/2026-07-27-v__VERSION__.html',
  './assets/v__VERSION__/payload-0.b64',
  './assets/v__VERSION__/payload-1.b64',
  './assets/v__VERSION__/payload-2.b64',
  './assets/v__VERSION__/payload-3.b64',
  './versions/2026-07-27-v1.0.15.html'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE))));
self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
  if(event.data?.type==='CACHE_OFFLINE_CORE')event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>event.source?.postMessage?.({type:'OFFLINE_CORE_READY'})));
});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('travel-plans-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(url.origin!==location.origin)return;
  event.respondWith(fetch(request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));return response}).catch(()=>caches.match(request).then(hit=>hit||caches.match('./index.html'))));
});
