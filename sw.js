/**
 * @fileoverview Service worker do app (padrão: dev/padroes/04_pwa_e_performance.md).
 * - Casca (lista ARQUIVOS): cache primeiro. Abre na hora, com ou sem internet.
 *   Para publicar uma versão nova, aumente a VERSAO: o app avisa e a nova vale ao abrir de novo.
 * - Demais arquivos deste site: rede primeiro; sem internet, o que estiver guardado.
 * - No computador do desenvolvedor (localhost, 127.0.0.1, 192.168.*): tudo rede primeiro,
 *   para cada alteração aparecer sem precisar mudar a VERSAO.
 * - Só GET deste site: os pedidos ao script do CC (POST, outro endereço) nunca passam pelo cache.
 */

const VERSAO = 'ssvp-casca-v0.17.1';

const EM_DESENVOLVIMENTO = /^(localhost|127\.0\.0\.1|192\.168\.)/.test(self.location.hostname);

const ARQUIVOS = [
  './',
  './index.html',
  './manifest.json',
  './favicon.svg',
  './css/base.css',
  './css/casca.css',
  './css/telas.css',
  './css/desktop.css',
  './js/app.js',
  './js/casca.js',
  './js/core/api_cc.js',
  './js/core/cep.js',
  './js/core/cofre.js',
  './js/core/conselhos.js',
  './js/core/db.js',
  './js/core/preferencias.js',
  './js/core/sync.js',
  './js/core/voz.js',
  './js/core/numeros_falados.js',
  './js/componentes/barra_conexao.js',
  './js/componentes/barra_tela.js',
  './js/componentes/carregando.js',
  './js/componentes/icone_sync.js',
  './js/componentes/folha_item.js',
  './js/componentes/mapa.js',
  './js/componentes/compartilhar.js',
  './js/componentes/confirmar_email.js',
  './js/componentes/tela_trava.js',
  './js/core/trava.js',
  './js/componentes/bloco_mudanca.js',
  './js/telas/como_funciona.js',
  './js/telas/sugestoes.js',
  './js/componentes/endereco_busca.js',
  './js/componentes/de_onde_vem.js',
  './js/componentes/painel_sync.js',
  './js/componentes/logins_dev.js',
  './js/telas/comum.js',
  './js/telas/pessoas.js',
  './js/telas/pessoa_dados.js',
  './js/telas/pessoa_detalhe.js',
  './js/telas/pessoa_nova.js',
  './js/telas/familias.js',
  './js/telas/familia_dados.js',
  './js/telas/familia_detalhe.js',
  './js/telas/familia_acoes.js',
  './js/telas/visita.js',
  './js/telas/visitas.js',
  './js/telas/visita_completar.js',
  './js/telas/importar_pessoas.js',
  './siglas/siglas_conselhos_centrais.json',
  './siglas/siglas_vinculos.json',
  './siglas/regra_trechos.json',
  './siglas/siglas_auxilios.json',
  './siglas/siglas_meios_transporte.json',
  './img/marca_ssvp.svg',
  './img/mic.svg',
  './img/home_app_logo.svg',
  './img/icones/icone_192.png',
  './img/icones/apple_touch_icon_180.png',
];

/** Endereços completos da casca, para saber se um pedido é dela. */
const CASCA = new Set(ARQUIVOS.map((a) => new URL(a, self.location).href));

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS)));
});

self.addEventListener('activate', (evento) => {
  // Apaga os caches de versões anteriores (inclusive o do protótipo antigo, ssvp-shell-*).
  evento.waitUntil(caches.keys().then((nomes) =>
    Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});

// A página pergunta a versão (etiqueta do alto) e pede para trocar já pela versão nova ("Atualizar agora", 18/11/2026).
self.addEventListener('message', (evento) => {
  if (evento.data === 'versao' && evento.source) {
    evento.source.postMessage({versao: VERSAO.replace(/^ssvp-casca-v/, '')});
  } else if (evento.data === 'atualizar') {
    self.skipWaiting();
  }
});

/** Sinal fraco: depois deste tempo, desiste da rede e usa o que estiver guardado. */
const ESPERA_REDE_MS = 5000;

/**
 * Rede primeiro; guarda a resposta; sem rede (ou rede lenta demais), o que estiver guardado.
 * @param {!Request} pedido
 * @return {!Promise<!Response>}
 */
async function redePrimeiro(pedido) {
  let espera;
  const relogio = new Promise((_, falhar) => {
    espera = setTimeout(() => falhar(new Error('rede lenta')), ESPERA_REDE_MS);
  });
  try {
    const resposta = await Promise.race([fetch(pedido), relogio]);
    clearTimeout(espera);
    if (resposta.ok) {
      const cache = await caches.open(VERSAO);
      await cache.put(pedido, resposta.clone());
    }
    return resposta;
  } catch (erro) {
    clearTimeout(espera);
    const guardada = await caches.match(pedido, {ignoreSearch: true});
    if (guardada) {
      return guardada;
    }
    if (pedido.mode === 'navigate') {
      return (await caches.match('./index.html')) || Response.error();
    }
    return Response.error();
  }
}

/**
 * Cache primeiro (casca); se não estiver guardado, busca na rede.
 * @param {!Request} pedido
 * @return {!Promise<!Response>}
 */
async function cachePrimeiro(pedido) {
  const guardada = await caches.match(pedido, {ignoreSearch: true});
  return guardada || redePrimeiro(pedido);
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  const url = new URL(pedido.url);
  if (pedido.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }
  // Só os arquivos da lista: páginas de testes/ continuam rede primeiro, para não ficarem velhas.
  const daCasca = CASCA.has(url.origin + url.pathname);
  evento.respondWith(!EM_DESENVOLVIMENTO && daCasca ? cachePrimeiro(pedido) : redePrimeiro(pedido));
});
