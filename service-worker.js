/* NY27 — service worker.
   Estrategia: red primero, copia guardada como respaldo.
   - Con conexión, cada archivo (código y data/*.json) se pide a la red y se guarda de nuevo.
   - Sin conexión, o si la red tarda más de 3 s, se sirve la copia guardada.
   - Las peticiones a otros dominios (el servicio del tiempo) no pasan por aquí.
   Si se añaden o renombran archivos, hay que añadirlos a PRECACHE y subir la versión de CACHE. */
var CACHE = 'ny27-v3';
var ESPERA_RED_MS = 3000;

var PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/styles.css',
  'js/app.js',
  'data/dia-1.json', 'data/dia-2.json', 'data/dia-3.json',
  'data/dia-4.json', 'data/dia-5.json', 'data/dia-6.json',
  'fonts/inter-latin-400-normal.woff2', 'fonts/inter-latin-500-normal.woff2', 'fonts/inter-latin-700-normal.woff2',
  'fonts/inter-latin-ext-400-normal.woff2', 'fonts/inter-latin-ext-500-normal.woff2', 'fonts/inter-latin-ext-700-normal.woff2',
  'img/cabecera.png',
  'icons/tiempo.svg', 'icons/tren.svg', 'icons/chevron-derecha.svg', 'icons/flecha-45.svg', 'icons/flecha-izquierda.svg',
  'icons/weather/day.svg', 'icons/weather/night.svg', 'icons/weather/cloudy-day-1.svg', 'icons/weather/cloudy-night-1.svg', 'icons/weather/cloudy.svg',
  'icons/weather/rainy-1.svg', 'icons/weather/rainy-3.svg', 'icons/weather/rainy-6.svg',
  'icons/weather/snowy-3.svg', 'icons/weather/snowy-5.svg', 'icons/weather/snowy-6.svg', 'icons/weather/thunder.svg',
  'icons/pin.svg', 'icons/lugares.svg', 'icons/comer.svg', 'icons/tiendas.svg', 'icons/cine.svg', 'icons/wc.svg',
  'icons/apple-touch-icon.png', 'icons/app-icon-192.png', 'icons/app-icon-512.png', 'icons/app-icon-maskable-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

function redPrimero(request) {
  return caches.open(CACHE).then(function (cache) {
    var red = fetch(request.url, { cache: 'no-cache' }).then(function (res) {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    });
    red.catch(function () {});   // evita avisos si la red falla después de servir la copia
    var tope = new Promise(function (_, rechazar) { setTimeout(function () { rechazar(new Error('tiempo')); }, ESPERA_RED_MS); });
    return Promise.race([red, tope]).catch(function () {
      return cache.match(request, { ignoreSearch: true }).then(function (copia) {
        if (copia) return copia;
        if (request.mode === 'navigate') return cache.match('index.html');
        return red;   // sin copia: se espera a la red
      });
    });
  });
}

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(redPrimero(request));
});
