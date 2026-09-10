/**
 * @fileoverview Ponto de Entrada Principal (Entry Point) da SPA WebApp SSVP.
 * Inicializa o ciclo de vida do PWA, monitoramento de conectividade, IndexedDB e autenticação.
 * Conformidade estrita com: dev/padroes/02_javascript_google.md
 */

import { inicializarBanco } from './db.js';
import { inicializarAuth } from './auth.js';

/**
 * Registra o Service Worker e monitora detecção de novas versões para atualização em 1 toque.
 * Em ambiente de desenvolvimento local (localhost/127.0.0.1), o registro é suspenso
 * para assegurar recargas limpas sem retenção de cache.
 * @return {void}
 */
function inicializarServiceWorker() {
  const isLocalhost = Boolean(
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname.startsWith('192.168.')
  );

  if (isLocalhost) {
    console.log('[PWA] Modo Desenvolvimento Local ativo. Service Worker desativado para evitar cache.');
    return;
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((registro) => {
        registro.addEventListener('updatefound', () => {
          const novoWorker = registro.installing;
          if (novoWorker) {
            novoWorker.addEventListener('statechange', () => {
              if (novoWorker.state === 'installed' && navigator.serviceWorker.controller) {
                exibirBannerAtualizacao();
              }
            });
          }
        });
      }).catch((erro) => {
        console.error('[PWA] Falha ao registrar Service Worker:', erro.message);
      });
    });
  }
}

/**
 * Exibe o banner de nova versão pronta para atualização com 1 toque.
 * @return {void}
 */
function exibirBannerAtualizacao() {
  const banner = document.getElementById('banner-atualizacao');
  const btnAtualizar = document.getElementById('btn-atualizar-pwa');

  if (banner) {
    banner.classList.add('ativo');
  }

  if (btnAtualizar) {
    btnAtualizar.addEventListener('click', () => {
      window.location.reload();
    });
  }
}

/**
 * Monitora os eventos de conectividade de rede (Online / Offline).
 * @return {void}
 */
function inicializarEventosConectividade() {
  window.addEventListener('online', () => {
    console.log('[Rede] Dispositivo online.');
  });

  window.addEventListener('offline', () => {
    console.log('[Rede] Dispositivo offline. Operando em modo de resiliência local.');
  });
}

/**
 * Inicialização central quando o DOM estiver completamente carregado.
 */
document.addEventListener('DOMContentLoaded', async () => {
  inicializarServiceWorker();
  inicializarEventosConectividade();

  // Inicializa o banco de dados IndexedDB
  await inicializarBanco();

  // Inicializa a camada de interface e autenticação
  await inicializarAuth();

  console.log('[WebApp SSVP] Aplicação inicializada com sucesso na versão modular.');
});
