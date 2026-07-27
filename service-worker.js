const CACHE='travel-plans-2.1.0';
const CORE=[
  './',
  './index.html',
  './versions/2026-07-27-v2.1.0.html',
  './assets/v2.1.0/payload-0.b64',
  './assets/v2.1.0/payload-1.b64',
  './assets/v2.1.0/payload-2.b64',
  './assets/v2.1.0/payload-3.b64',
  './versions/2026-07-27-v1.0.15.html'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE))));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('travel-plans-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==location.origin)return;
  event.respondWith(fetch(request).then(response=>{
    const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));return response;
  }).catch(()=>caches.match(request).then(hit=>hit||caches.match('./index.html'))));
});