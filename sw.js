// 오프라인 실행용 서비스 워커: 게임 파일을 저장해 두고, 인터넷이 되면 새 버전으로 갱신
const CACHE = 'dev-idle-v3';
const CORE = ['./', 'index.html', 'css/style.css', 'js/data.js', 'js/game.js', 'manifest.webmanifest', 'favicon.ico', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// 먼저 저장본으로 빠르게 보여주고, 뒤에서 새 파일을 받아 저장본을 바꿈
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
