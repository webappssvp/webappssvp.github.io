/**
 * @fileoverview Ponto de Entrada Principal (Entry Point) da SPA WebApp SSVP.
 * Inicializa o ciclo de vida do PWA, monitoramento de conectividade, IndexedDB v3,
 * configurações M3 (Bottom Sheet), Central de Ajuda "O que é isso?", autenticação hierárquica,
 * voz (STT/TTS com Cápsula Dupla) e painel de visitas.
 * Inclui sincronização dinâmica de altura útil (--vh) e compensação ergonômica inteligente
 * de barras de sistema para Moto Z 1 (3 botões virtuais), Moto E7 (gestos) e iPhone 8.
 * Conformidade estrita com: dev/padroes/02_javascript_google.md
 */

import { inicializarBanco } from './db.js';
import { inicializarConfiguracoes } from './config.js';
import { inicializarSistemaAjuda } from './ajuda.js';
import { inicializarAuth } from './auth.js';
import { inicializarModuloVoz } from './voz.js';
import { inicializarVisitasUI } from './visitas_ui.js';

/**
 * Calcula e injeta a altura real visível da janela do navegador na variável CSS --vh
 * e detecta se o dispositivo é um Android clássico com barra de navegação virtual de 3 botões.
 * Resolve o conflito ergonômico entre Moto Z 1 (3 botões), Moto E7 (gestos) e iPhone 8.
 * @return {void}
 */
export function ajustarAlturaRealViewport() {
  // Altura visível real (prioriza visualViewport se disponível no navegador)
  const alturaVisivel = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const vh = alturaVisivel * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);

  // Detecção de barra virtual clássica do Android (ex: 3 botões do Moto Z 1)
  const isAndroid = /Android/i.test(navigator.userAgent);
  let espacoBarraSistema = '0px';

  if (isAndroid) {
    // No Android com tela 16:9 clássica (proporção <= 1.92) e barra virtual de 3 botões
    const ratio = window.screen.height / Math.max(window.screen.width, 1);
    const diffTela = Math.abs(window.screen.height - window.innerHeight);

    // Se o dispositivo tem proporção clássica e diferença de altura física para útil
    if (ratio <= 1.92 && diffTela >= 36) {
      espacoBarraSistema = '2.2rem'; // ~35px adicionais para afastar os botões da barra virtual
      document.documentElement.classList.add('com-barra-sistema-antiga');
    } else {
      document.documentElement.classList.remove('com-barra-sistema-antiga');
    }
  } else {
    document.documentElement.classList.remove('com-barra-sistema-antiga');
  }

  document.documentElement.style.setProperty('--espaco-barra-sistema', espacoBarraSistema);
}

// Vincula ouvintes para recalcular sempre que a janela for redimensionada ou rotacionada
window.addEventListener('resize', ajustarAlturaRealViewport);
window.addEventListener('orientationchange', ajustarAlturaRealViewport);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', ajustarAlturaRealViewport);
}
ajustarAlturaRealViewport();

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
 * Inicialização central resiliente da aplicação.
 * @return {Promise<void>}
 */
async function inicializarAplicacao() {
  // Garante que o cálculo de altura esteja sincronizado logo no início
  ajustarAlturaRealViewport();

  inicializarServiceWorker();
  inicializarEventosConectividade();

  // 1. Inicializa o banco de dados IndexedDB v3
  await inicializarBanco();

  // 2. Inicializa as preferências do usuário e a Gaveta M3 (Bottom Sheet)
  inicializarConfiguracoes();

  // 3. Inicializa a Central de Ajuda Interativa "O que é isso?" (t5_barras_e_ajuda)
  inicializarSistemaAjuda();

  // 4. Inicializa o módulo de comando e leitura de voz universal (STT / TTS) com Cápsula Dupla
  inicializarModuloVoz();

  // 5. Inicializa a camada de autenticação e semáforo vicentino
  await inicializarAuth();

  // 6. Inicializa o painel de famílias e visitas
  await inicializarVisitasUI();

  console.log('[WebApp SSVP] Aplicação inicializada com sucesso na versão modular v1.0.');
}

// Inicialização segura que contempla DOMContentLoaded ou execução quando o documento já estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializarAplicacao);
} else {
  inicializarAplicacao();
}
