/**
 * @fileoverview Orquestrador principal da SPA WebApp SSVP.
 * Controla o ciclo de vida do PWA, o Semáforo Vicentino e a navegação.
 * Conformidade estrita com: dev/padroes/02_javascript_google.md
 */

/**
 * Estados possíveis do Semáforo da Barra Superior.
 * @enum {string}
 */
export const EstadosSemaforo = {
  NAO_CONECTADO: 'NAO_CONECTADO',
  NAO_LOGADO: 'NAO_LOGADO',
  LOGADO: 'LOGADO'
};

/**
 * Estado global em memória da aplicação.
 */
const estadoApp = {
  semaforo: EstadosSemaforo.NAO_CONECTADO,
  conferencia: null,
  vicentino: null,
  online: navigator.onLine
};

/**
 * Registra o Service Worker e monitora detecção de novas versões.
 * Em ambiente de desenvolvimento local (localhost), o registro é ignorado
 * para evitar retenção indesejada de cache.
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
        // Escuta atualizações de versão do Service Worker
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
 * Exibe a notificação de nova versão pronta para instalação em 1 toque.
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
 * Aplica visualmente o estado correspondente do Semáforo na Barra Superior.
 * @param {string} estado Um dos valores de EstadosSemaforo.
 * @param {{nomeConferencia?: string, nomeVicentino?: string}} [dados={}]
 * @return {void}
 */
export function aplicarEstadoSemaforo(estado, dados = {}) {
  const barraSup = document.getElementById('barra-superior');
  const btnStatus = document.getElementById('btn-status-semaforo');
  const txtTitulo = document.getElementById('status-titulo');
  const txtSubtitulo = document.getElementById('status-subtitulo');

  if (!barraSup || !btnStatus || !txtTitulo || !txtSubtitulo) {
    return;
  }

  estadoApp.semaforo = estado;

  // Limpa classes anteriores
  barraSup.classList.remove('semaforo-vermelho', 'semaforo-amarelo', 'semaforo-azul');
  btnStatus.classList.remove('pulsar-atencao');

  switch (estado) {
    case EstadosSemaforo.NAO_CONECTADO:
      barraSup.classList.add('semaforo-vermelho');
      btnStatus.classList.add('pulsar-atencao');
      txtTitulo.textContent = 'NÃO CONECTADO';
      txtSubtitulo.textContent = 'Toque para conectar';
      btnStatus.setAttribute('aria-label', 'Semáforo: Não conectado. Toque para selecionar sua conferência.');
      break;

    case EstadosSemaforo.NAO_LOGADO:
      barraSup.classList.add('semaforo-amarelo');
      txtTitulo.textContent = 'NÃO LOGADO';
      txtSubtitulo.textContent = dados.nomeConferencia || 'Conferência Selecionada';
      btnStatus.setAttribute('aria-label', `Semáforo: Não logado. Conferência ${txtSubtitulo.textContent}. Toque para entrar.`);
      break;

    case EstadosSemaforo.LOGADO:
      barraSup.classList.add('semaforo-azul');
      txtTitulo.textContent = dados.nomeConferencia || 'SSVP Brasil';
      txtSubtitulo.textContent = dados.nomeVicentino ? `Olá, ${dados.nomeVicentino}` : 'Acesso Liberado';
      btnStatus.setAttribute('aria-label', `Semáforo: Logado na Conferência ${txtTitulo.textContent}.`);
      break;

    default:
      console.warn(`[Semáforo] Estado desconhecido: ${estado}`);
      break;
  }
}

/**
 * Inicialização dos eventos de conectividade (Online / Offline).
 * @return {void}
 */
function inicializarEventosConexao() {
  window.addEventListener('online', () => {
    estadoApp.online = true;
    console.log('[Rede] Dispositivo conectado à internet.');
  });

  window.addEventListener('offline', () => {
    estadoApp.online = false;
    console.log('[Rede] Dispositivo operando desconectado (Modo Offline seguro).');
  });
}

/**
 * Ponto de entrada quando o DOM estiver completamente carregado.
 */
document.addEventListener('DOMContentLoaded', () => {
  inicializarServiceWorker();
  inicializarEventosConexao();

  // Define o estado inicial do Semáforo como NÃO CONECTADO
  aplicarEstadoSemaforo(EstadosSemaforo.NAO_CONECTADO);

  // Botão central do Semáforo: direciona para ação correspondente
  const btnStatus = document.getElementById('btn-status-semaforo');
  if (btnStatus) {
    btnStatus.addEventListener('click', () => {
      // Dispara evento customizado para o módulo de auth tratar
      window.dispatchEvent(new CustomEvent('ssvp:toque-semaforo', {
        detail: { estadoAtual: estadoApp.semaforo }
      }));
    });
  }

  console.log('[WebApp SSVP] App Shell e Semáforo Vicentino carregados com sucesso.');
});
