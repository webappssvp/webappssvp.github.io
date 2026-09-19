/**
 * @fileoverview Módulo da Central de Ajuda Interativa "O que é isso?" (t5_barras_e_ajuda).
 * Permite que vicentinos (especialmente idosos 60+) toquem em qualquer elemento
 * da tela para abrir um cartão explicativo com linguagem simples e clara.
 * Conformidade estrita com: dev/padroes/02_javascript_google.md e 05_acessibilidade_ergonomia.md
 */

import { dispararFeedbackTabil, dispararFeedbackSonoro, fecharBottomSheetConfig } from './config.js';

/**
 * Estado em memória do Modo de Ajuda.
 * @type {{ ativo: boolean }}
 */
const estadoAjuda = {
  ativo: false
};

/**
 * Retorna se o Modo de Ajuda interativo está ativo.
 * @return {boolean}
 */
export function isModoAjudaAtivo() {
  return estadoAjuda.ativo;
}

/**
 * Ativa o modo de ajuda interativo na tela inteira.
 * @return {void}
 */
export function iniciarModoAjuda() {
  // Fecha a gaveta de configurações se estiver aberta
  fecharBottomSheetConfig();

  estadoAjuda.ativo = true;
  document.body.classList.add('modo-ajuda-ativo');

  const banner = document.getElementById('bannerModoAjuda');
  if (banner) {
    banner.classList.add('visivel');
  }

  dispararFeedbackTabil();
  dispararFeedbackSonoro();
  console.log('[Ajuda] Modo "O que é isso?" ativado.');
}

/**
 * Desativa o modo de ajuda interativo e retorna a aplicação ao fluxo normal.
 * @return {void}
 */
export function desativarModoAjuda() {
  estadoAjuda.ativo = false;
  document.body.classList.remove('modo-ajuda-ativo');

  const banner = document.getElementById('bannerModoAjuda');
  if (banner) {
    banner.classList.remove('visivel');
  }

  fecharModalAjuda();
  dispararFeedbackTabil();
  dispararFeedbackSonoro();
  console.log('[Ajuda] Modo "O que é isso?" desativado.');
}

/**
 * Alterna entre ativar e desativar o modo de ajuda.
 * @return {void}
 */
export function alternarModoAjuda() {
  if (estadoAjuda.ativo) {
    desativarModoAjuda();
  } else {
    iniciarModoAjuda();
  }
}

/**
 * Abre o modal explicativo com título e texto formatado.
 * @param {string} titulo Título do elemento clicado
 * @param {string} texto Explicação detalhada e acessível
 * @return {void}
 */
export function abrirModalAjuda(titulo, texto) {
  const lblTitulo = document.getElementById('lblModalAjudaTitulo');
  const lblCorpo = document.getElementById('lblModalAjudaCorpo');
  const modalOverlay = document.getElementById('modalAjudaOverlay');

  if (lblTitulo) {
    lblTitulo.textContent = titulo;
  }
  if (lblCorpo) {
    lblCorpo.innerHTML = texto;
  }
  if (modalOverlay) {
    modalOverlay.classList.add('visivel');
  }

  dispararFeedbackTabil();
  dispararFeedbackSonoro();
}

/**
 * Fecha o modal explicativo do modo de ajuda.
 * @return {void}
 */
export function fecharModalAjuda() {
  const modalOverlay = document.getElementById('modalAjudaOverlay');
  if (modalOverlay) {
    modalOverlay.classList.remove('visivel');
  }
  dispararFeedbackTabil();
}

/**
 * Intercepta cliques nos elementos marcados com a classe .ajuda-alvo
 * quando o Modo de Ajuda estiver ativo.
 * @param {MouseEvent} evento
 * @return {void}
 */
function interceptarCliquesAjuda(evento) {
  if (!estadoAjuda.ativo) {
    return;
  }

  // Não intercepta cliques dentro do próprio banner ou do próprio modal explicativo
  const banner = document.getElementById('bannerModoAjuda');
  const modal = document.getElementById('modalAjudaOverlay');

  if (banner && banner.contains(/** @type {Node} */ (evento.target))) {
    return;
  }
  if (modal && modal.contains(/** @type {Node} */ (evento.target))) {
    return;
  }

  const alvo = (/** @type {Element} */ (evento.target)).closest('.ajuda-alvo');
  if (alvo) {
    evento.preventDefault();
    evento.stopPropagation();

    const titulo = alvo.getAttribute('data-ajuda-titulo') || 'Elemento da Tela';
    const texto = alvo.getAttribute('data-ajuda-texto') || 'Este elemento faz parte do fluxo do aplicativo.';
    abrirModalAjuda(titulo, texto);
  }
}

/**
 * Inicializa os ouvintes de evento da Central de Ajuda.
 * @return {void}
 */
export function inicializarSistemaAjuda() {
  // 1. Botão [Ajuda] no Rodapé
  const btnAjuda = document.getElementById('btn_ajuda');
  if (btnAjuda) {
    btnAjuda.onclick = null; // Remove onclick antigo inline
    btnAjuda.addEventListener('click', (evento) => {
      evento.preventDefault();
      alternarModoAjuda();
    });
  }

  // 2. Botão "Sair" do Banner de Ajuda
  const btnSair = document.getElementById('btnSairModoAjuda');
  if (btnSair) {
    btnSair.addEventListener('click', (evento) => {
      evento.preventDefault();
      desativarModoAjuda();
    });
  }

  // 3. Botão "Entendi" do Modal Explicativo
  const btnEntendi = document.getElementById('btnEntendiAjuda');
  if (btnEntendi) {
    btnEntendi.addEventListener('click', (evento) => {
      evento.preventDefault();
      fecharModalAjuda();
    });
  }

  // 4. Fechar modal clicando no overlay escurecido
  const modalOverlay = document.getElementById('modalAjudaOverlay');
  if (modalOverlay) {
    modalOverlay.addEventListener('click', (evento) => {
      if (evento.target === modalOverlay) {
        fecharModalAjuda();
      }
    });
  }

  // 5. Botão "Ativar Modo O que é isso?" na Gaveta de Configurações
  const btnAtivarGaveta = document.getElementById('btnAtivarAjudaSheet');
  if (btnAtivarGaveta) {
    btnAtivarGaveta.addEventListener('click', (evento) => {
      evento.preventDefault();
      iniciarModoAjuda();
    });
  }

  // 6. Interceptor de cliques em modo captura para prevalecer sobre outros botões
  document.addEventListener('click', interceptarCliquesAjuda, true);

  console.log('[Ajuda] Sistema interativo "O que é isso?" inicializado com sucesso.');
}
