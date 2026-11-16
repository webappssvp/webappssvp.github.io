/**
 * @fileoverview Módulo de Gerenciamento da Interface de Usuário (UI).
 * Controla os estados visuais do Semáforo na Barra Superior, a manipulação do Modal de Conexão
 * em 3 etapas (Seleção Hierárquica, Validação de E-mail/Senha na Conferência e Sessão Ativa),
 * a renderização de selects e alertas de feedback.
 * Conformidade com: dev/padroes/02_javascript_google.md e dev/padroes/05_acessibilidade_ergonomia.md
 */

import { obterUrlApi, definirUrlApi } from './api.js';

/**
 * Enumeração de estados possíveis do Semáforo Vicentino.
 * @enum {string}
 */
export const EstadosSemaforo = {
  NAO_CONECTADO: 'NAO_CONECTADO',
  NAO_LOGADO: 'NAO_LOGADO',
  LOGADO: 'LOGADO'
};

/**
 * Cache dos elementos do DOM para evitar consultas repetitivas.
 * @type {Object<string, HTMLElement|null>}
 */
const dom = {};

/**
 * Inicializa e mapeia os elementos do DOM da interface.
 * @param {Object} eventos Callbacks para despacho de eventos da interface.
 * @param {Function} eventos.aoAbrirModal
 * @param {Function} eventos.aoFecharModal
 * @param {Function} eventos.aoVoltarParaSelects
 * @param {Function} eventos.aoTrocarCC
 * @param {Function} eventos.aoTrocarCP
 * @param {Function} eventos.aoTrocarCF
 * @param {Function} eventos.aoAvancarParaSenha
 * @param {function(string, string): void} eventos.aoSubmeterLogin
 * @param {Function} eventos.aoSolicitarLogout
 * @return {void}
 */
export function inicializarUI(eventos) {
  // Barra Superior (Header Reativo / Semáforo)
  dom.barraSuperior = document.getElementById('barraSuperior');
  dom.txtStatusPrincipal = document.getElementById('txtStatusPrincipal');
  dom.txtStatusSub = document.getElementById('txtStatusSub');
  dom.statusHeaderBtn = document.getElementById('statusHeaderBtn');

  // Modal Principal
  dom.overlayModal = document.getElementById('overlayModal');
  dom.btnFecharModal = document.getElementById('btnFecharModal');
  dom.msgFeedback = document.getElementById('msgFeedback');

  // ETAPA 1: Cascata de Seleção (CM -> CC -> CP -> CF)
  dom.secaoSelects = document.getElementById('secaoSelects');
  dom.selConselhoMetropolitano = document.getElementById('selConselhoMetropolitano');
  dom.selConselhoCentral = document.getElementById('selConselhoCentral');
  dom.selConselhoParticular = document.getElementById('selConselhoParticular');
  dom.selConferencia = document.getElementById('selConferencia');
  dom.btnAvancarParaSenha = document.getElementById('btnAvancarParaSenha');

  // ETAPA 2: Validação de E-mail e Senha do Vicentino
  dom.secaoSenha = document.getElementById('secaoSenha');
  dom.txtConfSelecionada = document.getElementById('txtConfSelecionada');
  dom.inputEmail = document.getElementById('inputEmail');
  dom.inputSenha = document.getElementById('inputSenha');
  dom.btnToggleSenha = document.getElementById('btnToggleSenha');
  dom.btnVoltarSelects = document.getElementById('btnVoltarSelects');
  dom.btnVoltarSelectsBottom = document.getElementById('btnVoltarSelectsBottom');
  dom.btnConfirmarConexao = document.getElementById('btnConfirmarConexao');

  // ETAPA 3: Sessão Ativa (Já Conectado)
  dom.secaoConectado = document.getElementById('secaoConectado');
  dom.txtBoasVindas = document.getElementById('txtBoasVindas');
  dom.txtDetalhesSessao = document.getElementById('txtDetalhesSessao');
  dom.btnDesconectar = document.getElementById('btnDesconectar');

  // Configuração Manual do Endpoint de API
  dom.lblUrlAtiva = document.getElementById('lblUrlAtiva');
  dom.btnAlterarUrl = document.getElementById('btnAlterarUrl');

  // Vinculação de eventos do usuário
  if (dom.statusHeaderBtn) {
    dom.statusHeaderBtn.addEventListener('click', () => {
      eventos.aoAbrirModal();
    });
  }

  if (dom.btnFecharModal) {
    dom.btnFecharModal.addEventListener('click', () => {
      eventos.aoFecharModal();
    });
  }

  // Fechar ao clicar no overlay escurecido fora do card
  if (dom.overlayModal) {
    dom.overlayModal.addEventListener('click', (e) => {
      if (e.target === dom.overlayModal) {
        eventos.aoFecharModal();
      }
    });
  }

  if (dom.selConselhoCentral) {
    dom.selConselhoCentral.addEventListener('change', (e) => {
      const select = /** @type {HTMLSelectElement} */ (e.target);
      const idCc = select.value;
      if (dom.btnAvancarParaSenha) {
        dom.btnAvancarParaSenha.disabled = true;
      }
      eventos.aoTrocarCC(idCc);
    });
  }

  if (dom.selConselhoParticular) {
    dom.selConselhoParticular.addEventListener('change', (e) => {
      const select = /** @type {HTMLSelectElement} */ (e.target);
      const idCp = select.value;
      const opt = select.options[select.selectedIndex];
      if (dom.btnAvancarParaSenha) {
        dom.btnAvancarParaSenha.disabled = true;
      }
      eventos.aoTrocarCP(idCp, opt?.dataset);
    });
  }

  if (dom.selConferencia) {
    dom.selConferencia.addEventListener('change', (e) => {
      const select = /** @type {HTMLSelectElement} */ (e.target);
      const idSsvp = select.value;
      const opt = select.options[select.selectedIndex];
      const nomeCf = opt?.dataset?.nomeCf || opt?.textContent || '';

      if (idSsvp) {
        if (dom.btnAvancarParaSenha) {
          dom.btnAvancarParaSenha.disabled = false;
        }
        eventos.aoTrocarCF(idSsvp, nomeCf);
      } else {
        if (dom.btnAvancarParaSenha) {
          dom.btnAvancarParaSenha.disabled = true;
        }
      }
    });
  }

  if (dom.btnAvancarParaSenha) {
    dom.btnAvancarParaSenha.addEventListener('click', () => {
      const select = /** @type {HTMLSelectElement|null} */ (dom.selConferencia);
      if (!select || !select.value) {
        exibirFeedback('Selecione uma Conferência para avançar.', 'erro');
        return;
      }
      const idSsvp = select.value;
      const opt = select.options[select.selectedIndex];
      const nomeCf = opt?.dataset?.nomeCf || opt?.textContent || '';
      eventos.aoAvancarParaSenha(idSsvp, nomeCf);
    });
  }

  if (dom.btnVoltarSelects) {
    dom.btnVoltarSelects.addEventListener('click', () => {
      eventos.aoVoltarParaSelects();
    });
  }

  if (dom.btnVoltarSelectsBottom) {
    dom.btnVoltarSelectsBottom.addEventListener('click', () => {
      eventos.aoVoltarParaSelects();
    });
  }

  if (dom.btnToggleSenha && dom.inputSenha) {
    dom.btnToggleSenha.addEventListener('click', () => {
      const input = /** @type {HTMLInputElement} */ (dom.inputSenha);
      const estaOculta = input.type === 'password';
      input.type = estaOculta ? 'text' : 'password';
      dom.btnToggleSenha.textContent = estaOculta ? '🙈' : '👁️';
    });
  }

  if (dom.btnConfirmarConexao) {
    dom.btnConfirmarConexao.addEventListener('click', () => {
      const email = (dom.inputEmail ? /** @type {HTMLInputElement} */ (dom.inputEmail).value : '').trim();
      const senha = (dom.inputSenha ? /** @type {HTMLInputElement} */ (dom.inputSenha).value : '').trim();
      eventos.aoSubmeterLogin(email, senha);
    });
  }

  const dispararLoginComEnter = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const email = (dom.inputEmail ? /** @type {HTMLInputElement} */ (dom.inputEmail).value : '').trim();
      const senha = (dom.inputSenha ? /** @type {HTMLInputElement} */ (dom.inputSenha).value : '').trim();
      eventos.aoSubmeterLogin(email, senha);
    }
  };

  if (dom.inputEmail) {
    dom.inputEmail.addEventListener('keydown', dispararLoginComEnter);
  }

  if (dom.inputSenha) {
    dom.inputSenha.addEventListener('keydown', dispararLoginComEnter);
  }

  if (dom.btnDesconectar) {
    dom.btnDesconectar.addEventListener('click', () => {
      eventos.aoSolicitarLogout();
    });
  }

  if (dom.btnAlterarUrl) {
    dom.btnAlterarUrl.addEventListener('click', () => {
      configurarUrlManual();
    });
  }

  atualizarLabelUrlAtiva();
}

/**
 * Atualiza o indicador da URL ativa da API na tela.
 * @return {void}
 */
export function atualizarLabelUrlAtiva() {
  if (dom.lblUrlAtiva) {
    const url = obterUrlApi();
    dom.lblUrlAtiva.textContent = url.replace('https://script.google.com/macros/s/', '').substring(0, 20) + '...';
  }
}

/**
 * Permite ao desenvolvedor/usuário configurar uma URL customizada do Apps Script.
 * @return {void}
 */
function configurarUrlManual() {
  const atual = obterUrlApi();
  const nova = prompt('Cole a URL do Google Apps Script (/exec) ou deixe em branco para restaurar a oficial:', atual);
  if (nova !== null) {
    definirUrlApi(nova);
    atualizarLabelUrlAtiva();
    alert('Endpoint da API configurado com sucesso!');
  }
}

/**
 * Aplica visualmente o estado correspondente do Semáforo na Barra Superior.
 * @param {string} estado Um dos valores de EstadosSemaforo.
 * @param {{nome_cf?: string, nome_pessoa?: string}} [detalhes={}] Informações para exibição.
 * @return {void}
 */
export function atualizarSemaforo(estado, detalhes = {}) {
  if (!dom.barraSuperior || !dom.txtStatusPrincipal || !dom.txtStatusSub) {
    return;
  }

  dom.txtStatusPrincipal.classList.remove('pulsar');

  switch (estado) {
    case EstadosSemaforo.NAO_CONECTADO:
      dom.barraSuperior.style.backgroundColor = 'var(--ssvp-red)';
      dom.txtStatusPrincipal.textContent = 'Não conectado';
      dom.txtStatusPrincipal.classList.add('pulsar');
      dom.txtStatusSub.textContent = 'Toque para conectar';
      break;

    case EstadosSemaforo.NAO_LOGADO:
      dom.barraSuperior.style.backgroundColor = 'var(--ssvp-red)';
      dom.txtStatusPrincipal.textContent = 'Não logado';
      dom.txtStatusSub.textContent = detalhes.nome_cf || 'Toque para entrar';
      break;

    case EstadosSemaforo.LOGADO:
      dom.barraSuperior.style.backgroundColor = 'var(--ssvp-navy)';
      dom.txtStatusPrincipal.textContent = detalhes.nome_cf || 'Conferência Ativa';
      dom.txtStatusSub.textContent = detalhes.nome_pessoa ? `Olá, ${detalhes.nome_pessoa}` : 'Conectado';
      break;

    default:
      console.warn('[UI] Estado de Semáforo desconhecido:', estado);
      break;
  }
}

/**
 * Exibe o Modal de Conexão.
 * @return {void}
 */
export function abrirModal() {
  if (dom.overlayModal) {
    dom.overlayModal.classList.add('ativo');
    ocultarFeedback();
  }
}

/**
 * Fecha o Modal de Conexão.
 * @return {void}
 */
export function fecharModal() {
  if (dom.overlayModal) {
    dom.overlayModal.classList.remove('ativo');
  }
}

/**
 * Alterna a visualização para a Seção de Selects em Cascata (Etapa 1).
 * @return {void}
 */
export function mostrarSecaoSelects() {
  if (dom.secaoSelects) {
    dom.secaoSelects.style.display = 'flex';
  }
  if (dom.secaoSenha) {
    dom.secaoSenha.style.display = 'none';
  }
  if (dom.secaoConectado) {
    dom.secaoConectado.style.display = 'none';
  }
}

/**
 * Alterna a visualização para o Formulário de E-mail e Senha da Conferência (Etapa 2).
 * @param {string} nomeCf Nome da conferência selecionada.
 * @return {void}
 */
export function mostrarSecaoSenha(nomeCf) {
  if (dom.secaoSelects) {
    dom.secaoSelects.style.display = 'none';
  }
  if (dom.secaoSenha) {
    dom.secaoSenha.style.display = 'flex';
  }
  if (dom.secaoConectado) {
    dom.secaoConectado.style.display = 'none';
  }

  if (dom.txtConfSelecionada) {
    dom.txtConfSelecionada.textContent = nomeCf || '-';
  }
  if (dom.inputEmail) {
    const inputEmailEl = /** @type {HTMLInputElement} */ (dom.inputEmail);
    inputEmailEl.value = '';
  }
  if (dom.inputSenha) {
    const inputSenhaEl = /** @type {HTMLInputElement} */ (dom.inputSenha);
    inputSenhaEl.value = '';
    inputSenhaEl.type = 'password';
    if (dom.btnToggleSenha) {
      dom.btnToggleSenha.textContent = '👁️';
    }
  }
  if (dom.inputEmail) {
    dom.inputEmail.focus();
  } else if (dom.inputSenha) {
    dom.inputSenha.focus();
  }
}

/**
 * Alterna a visualização para o Card de Vicentino Conectado/Logado (Etapa 3).
 * @param {{nome_pessoa?: string, nome_cf?: string, id_ssvp?: string}} sessaoAtiva
 * @return {void}
 */
export function mostrarSecaoConectado(sessaoAtiva) {
  if (dom.secaoSelects) {
    dom.secaoSelects.style.display = 'none';
  }
  if (dom.secaoSenha) {
    dom.secaoSenha.style.display = 'none';
  }
  if (dom.secaoConectado) {
    dom.secaoConectado.style.display = 'flex';
  }

  if (dom.txtBoasVindas) {
    dom.txtBoasVindas.textContent = `Olá, ${sessaoAtiva.nome_pessoa || 'Vicentino(a)'}!`;
  }
  if (dom.txtDetalhesSessao) {
    dom.txtDetalhesSessao.textContent = `Conferência: ${sessaoAtiva.nome_cf || 'Ativa'} (ID: ${sessaoAtiva.id_ssvp || '--'})`;
  }
}

/**
 * Popula o select de Conselhos Centrais.
 * @param {Array<{id_cc: string, nome_cc: string}>} lista
 * @return {void}
 */
export function popularSelectConselhosCentrais(lista) {
  if (!dom.selConselhoCentral) {
    return;
  }

  dom.selConselhoCentral.innerHTML = '<option value="">Selecione o Conselho Central...</option>';
  lista.forEach((cc) => {
    const opt = document.createElement('option');
    opt.value = cc.id_cc;
    opt.textContent = cc.nome_cc || cc.id_cc;
    dom.selConselhoCentral.appendChild(opt);
  });
  dom.selConselhoCentral.disabled = false;

  desabilitarSelectConselhoParticular();
  desabilitarSelectConferencias();
}

/**
 * Define estado de carregamento do select de Conselhos Centrais.
 * @return {void}
 */
export function definirCarregandoConselhosCentrais() {
  if (!dom.selConselhoCentral) {
    return;
  }
  dom.selConselhoCentral.innerHTML = '<option value="">⏳ Buscando Conselhos no Google Drive...</option>';
  dom.selConselhoCentral.disabled = true;

  desabilitarSelectConselhoParticular();
  desabilitarSelectConferencias();
}

/**
 * Popula o select de Conselhos Particulares.
 * @param {Array<{id_cp: string, id_ssvp?: string, id_conselho?: string, nome_cp: string}>} lista
 * @return {void}
 */
export function popularSelectConselhosParticulares(lista) {
  if (!dom.selConselhoParticular) {
    return;
  }

  dom.selConselhoParticular.innerHTML = '<option value="">Selecione o Conselho Particular...</option>';
  lista.forEach((cp) => {
    const opt = document.createElement('option');
    const codigoExibicao = cp.id_ssvp || cp.id_cp;
    opt.value = codigoExibicao;
    opt.textContent = cp.nome_cp ? `${cp.nome_cp} (${codigoExibicao})` : codigoExibicao;
    opt.dataset.idConselho = cp.id_conselho || '';
    opt.dataset.idSsvp = cp.id_ssvp || '';
    opt.dataset.nomeCp = cp.nome_cp || '';
    dom.selConselhoParticular.appendChild(opt);
  });

  dom.selConselhoParticular.disabled = false;
  desabilitarSelectConferencias();
}

/**
 * Define estado de carregamento do select de Conselhos Particulares.
 * @return {void}
 */
export function definirCarregandoCPs() {
  if (!dom.selConselhoParticular) {
    return;
  }
  dom.selConselhoParticular.innerHTML = '<option value="">⏳ Conectando ao Google Drive... (aguarde)</option>';
  dom.selConselhoParticular.disabled = true;
  desabilitarSelectConferencias();
}

/**
 * Redefine o select de Conselhos Particulares para o estado desabilitado.
 * @return {void}
 */
export function desabilitarSelectConselhoParticular() {
  if (!dom.selConselhoParticular) {
    return;
  }
  dom.selConselhoParticular.innerHTML = '<option value="">Selecione o Conselho Central primeiro</option>';
  dom.selConselhoParticular.disabled = true;
}

/**
 * Popula o select de Conferências.
 * @param {Array<{id_ssvp: string, nome_cf: string}>} lista
 * @return {void}
 */
export function popularSelectConferencias(lista) {
  if (!dom.selConferencia) {
    return;
  }

  dom.selConferencia.innerHTML = '<option value="">Selecione a Conferência...</option>';
  lista.forEach((cf) => {
    const opt = document.createElement('option');
    opt.value = cf.id_ssvp;
    opt.textContent = cf.nome_cf ? `${cf.nome_cf} (${cf.id_ssvp})` : cf.id_ssvp;
    opt.dataset.nomeCf = cf.nome_cf || cf.id_ssvp;
    dom.selConferencia.appendChild(opt);
  });

  dom.selConferencia.disabled = false;
  if (dom.btnAvancarParaSenha) {
    dom.btnAvancarParaSenha.disabled = true;
  }
}

/**
 * Define estado de carregamento do select de Conferências.
 * @return {void}
 */
export function definirCarregandoConferencias() {
  if (!dom.selConferencia) {
    return;
  }
  dom.selConferencia.innerHTML = '<option value="">⏳ Filtrando Conferências...</option>';
  dom.selConferencia.disabled = true;
  if (dom.btnAvancarParaSenha) {
    dom.btnAvancarParaSenha.disabled = true;
  }
}

/**
 * Redefine o select de Conferências para o estado desabilitado.
 * @return {void}
 */
export function desabilitarSelectConferencias() {
  if (!dom.selConferencia) {
    return;
  }
  dom.selConferencia.innerHTML = '<option value="">Selecione o Conselho Particular primeiro</option>';
  dom.selConferencia.disabled = true;
  if (dom.btnAvancarParaSenha) {
    dom.btnAvancarParaSenha.disabled = true;
  }
}

/**
 * Exibe mensagem de feedback visual no modal.
 * @param {string} texto Mensagem explicativa.
 * @param {'erro'|'sucesso'|'info'} tipo Tipo do feedback visual.
 * @return {void}
 */
export function exibirFeedback(texto, tipo) {
  if (!dom.msgFeedback) {
    return;
  }
  dom.msgFeedback.textContent = texto;
  dom.msgFeedback.className = `feedback-msg ${tipo}`;
  dom.msgFeedback.style.display = 'block';
}

/**
 * Oculta a mensagem de feedback.
 * @return {void}
 */
export function ocultarFeedback() {
  if (dom.msgFeedback) {
    dom.msgFeedback.style.display = 'none';
  }
}

/**
 * Atualiza o botão de confirmação de conexão para estado de carregamento ou normal.
 * @param {boolean} carregando
 * @return {void}
 */
export function definirCarregandoConexao(carregando) {
  if (!dom.btnConfirmarConexao) {
    return;
  }

  if (carregando) {
    dom.btnConfirmarConexao.disabled = true;
    dom.btnConfirmarConexao.innerHTML = '<span class="spinner"></span> Verificando...';
  } else {
    dom.btnConfirmarConexao.disabled = false;
    dom.btnConfirmarConexao.innerHTML = '<span>Entrar no WebApp</span>';
  }
}
