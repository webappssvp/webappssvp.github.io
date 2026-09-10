/**
 * Service Worker Oficial do WebApp SSVP
 * Padrão: dev/padroes/04_pwa_e_performance.md
 */

const VERSAO_CACHE = 'ssvp-shell-v1.0.0';

const ARQUIVOS_APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './js/app.js',
  './img/home_app_logo.svg',
  './img/marca_ssvp.svg'
];

// Instalação: Cacheia os arquivos essenciais do App Shell
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(VERSAO_CACHE).then((cache) => {
      return cache.addAll(ARQUIVOS_APP_SHELL);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Ativação: Assume o controle imediato e limpa caches defasados
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) => {
      return Promise.all(
        chaves.map((chave) => {
          if (chave !== VERSAO_CACHE) {
            return caches.delete(chave);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Interceptação de Requisições (Cache-First para ativos locais)
self.addEventListener('fetch', (evento) => {
  // Ignora requisições que não sejam GET (como POST do login)
  if (evento.request.method !== 'GET') {
    return;
  }

  const url = new URL(evento.request.url);

  // Se for requisição ao Google Apps Script, deixa ir direto para a rede
  if (url.hostname.includes('script.google.com') || url.hostname.includes('script.googleusercontent.com')) {
    return;
  }

  evento.respondWith(
    caches.match(evento.request).then((respostaCache) => {
      if (respostaCache) {
        return respostaCache;
      }

      return fetch(evento.request).then((respostaRede) => {
        // Se a resposta for válida e do mesmo domínio, guarda cópia no cache
        if (respostaRede && respostaRede.status === 200 && respostaRede.type === 'basic') {
          const respostaClonada = respostaRede.clone();
          caches.open(VERSAO_CACHE).then((cache) => {
            cache.put(evento.request, respostaClonada);
          });
        }
        return respostaRede;
      }).catch(() => {
        // Se offline e requisição de navegação, retorna a página inicial
        if (evento.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Escuta mensagens do cliente para forçar atualização
self.addEventListener('message', (evento) => {
  if (evento.data && evento.data.acao === 'PULAR_ESPERA') {
    self.skipWaiting();
  }
});
