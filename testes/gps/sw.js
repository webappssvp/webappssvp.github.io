/**
 * @fileoverview Service worker do teste de GPS offline.
 * Cache primeiro: depois de aberto uma vez com internet, o app abre em modo avião.
 * Para publicar uma versão nova, aumente a VERSAO (e a versão no topo do index.html).
 */

const VERSAO = 'teste-gps-v1.2';

const ARQUIVOS = [
  './',
  './index.html',
  './manifest.json',
  './icon.png',
  '../testes.css',
  '../testes.js',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(
        nomes.filter((nome) => nome.startsWith('teste-gps-') && nome !== VERSAO)
          .map((nome) => caches.delete(nome))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET' || new URL(pedido.url).origin !== self.location.origin) {
    return;
  }
  evento.respondWith(
    caches.match(pedido, {ignoreSearch: true})
      .then((guardado) => guardado || fetch(pedido))
  );
});
