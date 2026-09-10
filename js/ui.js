/**
 * @fileoverview Módulo de Gerenciamento da Interface de Usuário (UI).
 * Controla os estados visuais do Semáforo na Barra Superior, a manipulação do Modal,
 * a renderização de selects e alertas de feedback.
 * Conformidade com: dev/padroes/02_javascript_google.md
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
 * @param {Function} eventos.aoSubmeterLogin
 * @param {Function} eventos.aoSolicitarLogout
 * @return {void}
 */
export function inicializarUI(eventos) {
  dom.barraSuperior = document.getElementById('barraSuperior');
  dom.txtStatusPrincipal = document.getElementById('txtStatusPrincipal');
  dom.txtStatusSub = document.getElementById('txtStatusSub');
  dom.statusHeaderBtn = document.getElementById('statusHeaderBtn');

  dom.overlayModal = document.getElementById('overlayModal');
  dom.btnFecharModal = document.getElementById('btnFecharModal');
  dom.msgFeedback = document.getElementById('msgFeedback');

  dom.secaoSelects = document.getElementById('secaoSelects');
  dom.selConselhoCentral = document.getElementById('selConselhoCentral');
  dom.grupoCP = document.getElementById('grupoCP');
  dom.selConselhoParticular = document.getElementById('selConselhoParticular');
  dom.grupoCF = document.getElementById('grupoCF');
  dom.selConferencia = document.getElementById('selConferencia');

  dom.secaoFormLogin = document.getElementById('secaoFormLogin');
  dom.txtNomeCfaSelecionada = document.getElementById('txtNomeCfaSelecionada');
  dom.btnVoltarSelects = document.getElementById('btnVoltarSelects');
  dom.iptEmail = document.getElementById('iptEmail');
  dom.iptSenha = document.getElementById('iptSenha');
  dom.btnLogin = document.getElementById('btnLogin');

  dom.secaoSessaoAtiva = document.getElementById('secaoSessaoAtiva');
  dom.txtBoasVindas = document.getElementById('txtBoasVindas');
  dom.txtDetalhesSessao = document.getElementById('txtDetalhesSessao');
  dom.btnDesconectar = document.getElementById('btnDesconectar');

  dom.lblUrlAtiva = document.getElementById('lblUrlAtiva');
  dom.btnAlterarUrl = document.getElementById('btnAlterarUrl');
  dom.btnConfigRodape = document.getElementById('btn_config');

  // Vinculação de eventos do usuário
  if (dom.statusHeaderBtn) {
    dom.statusHeaderBtn.addEventListener('click', () => eventos.aoAbrirModal());
  }

  if (dom.btnConfigRodape) {
    dom.btnConfigRodape.addEventListener('click', () => eventos.aoAbrirModal());
  }

  if (dom.btnFecharModal) {
    dom.btnFecharModal.addEventListener('click', () => eventos.aoFecharModal());
  }

  if (dom.btnVoltarSelects) {
    dom.btnVoltarSelects.addEventListener('click', () => eventos.aoVoltarParaSelects());
  }

  if (dom.selConselhoCentral) {
    dom.selConselhoCentral.addEventListener('change', (e) => {
      const idCc = /** @type {HTMLSelectElement} */ (e.target).value;
      eventos.aoTrocarCC(idCc);
    });
  }

  if (dom.selConselhoParticular) {
    dom.selConselhoParticular.addEventListener('change', (e) => {
      const select = /** @type {HTMLSelectElement} */ (e.target);
      const idCp = select.value;
      const opt = select.options[select.selectedIndex];
      eventos.aoTrocarCP(idCp, opt?.dataset);
    });
  }

  if (dom.selConferencia) {
    dom.selConferencia.addEventListener('change', (e) => {
      const select = /** @type {HTMLSelectElement} */ (e.target);
      const idSsvp = select.value;
      const opt = select.options[select.selectedIndex];
      const nomeCf = opt?.dataset?.nomeCf || opt?.textContent || '';
      eventos.aoTrocarCF(idSsvp, nomeCf);
    });
  }

  if (dom.secaoFormLogin) {
    dom.secaoFormLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = dom.iptEmail?.value || '';
      const senha = dom.iptSenha?.value || '';
      eventos.aoSubmeterLogin(email, senha);
    });
  }

  if (dom.btnDesconectar) {
    dom.btnDesconectar.addEventListener('click', () => eventos.aoSolicitarLogout());
  }

  if (dom.btnAlterarUrl) {
    dom.btnAlterarUrl.addEventListener('click', () => configurarUrlManual());
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
 * Alterna a visualização para a Seção de Selects em Cascata.
 * @return {void}
 */
export function mostrarSecaoSelects() {
  if (dom.secaoSelects) dom.secaoSelects.style.display = 'flex';
  if (dom.secaoFormLogin) dom.secaoFormLogin.style.display = 'none';
  if (dom.secaoSessaoAtiva) dom.secaoSessaoAtiva.style.display = 'none';
}

/**
 * Alterna a visualização para o Formulário de Login.
 * @param {string} nomeCf Nome da conferência selecionada.
 * @return {void}
 */
export function mostrarSecaoLogin(nomeCf) {
  if (dom.secaoSelects) dom.secaoSelects.style.display = 'none';
  if (dom.secaoFormLogin) dom.secaoFormLogin.style.display = 'flex';
  if (dom.secaoSessaoAtiva) dom.secaoSessaoAtiva.style.display = 'none';

  if (dom.txtNomeCfaSelecionada) {
    dom.txtNomeCfaSelecionada.textContent = nomeCf;
  }
  if (dom.iptEmail) {
    dom.iptEmail.focus();
  }
}

/**
 * Alterna a visualização para o Card de Vicentino Conectado/Logado.
 * @param {{nome_pessoa?: string, nome_cf?: string, id_ssvp?: string}} sessaoAtiva
 * @return {void}
 */
export function mostrarSecaoSessaoAtiva(sessaoAtiva) {
  if (dom.secaoSelects) dom.secaoSelects.style.display = 'none';
  if (dom.secaoFormLogin) dom.secaoFormLogin.style.display = 'none';
  if (dom.secaoSessaoAtiva) dom.secaoSessaoAtiva.style.display = 'flex';

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
  if (!dom.selConselhoCentral) return;

  dom.selConselhoCentral.innerHTML = '<option value="">Selecione o Conselho Central...</option>';
  lista.forEach((cc) => {
    const opt = document.createElement('option');
    opt.value = cc.id_cc;
    opt.textContent = cc.nome_cc || cc.id_cc;
    dom.selConselhoCentral.appendChild(opt);
  });
  dom.selConselhoCentral.disabled = false;
  if (dom.grupoCP) dom.grupoCP.style.display = 'none';
  if (dom.grupoCF) dom.grupoCF.style.display = 'none';
}

/**
 * Define estado de carregamento do select de Conselhos Centrais.
 * @return {void}
 */
export function definirCarregandoConselhosCentrais() {
  if (!dom.selConselhoCentral) return;
  dom.selConselhoCentral.innerHTML = '<option value="">Carregando conselhos...</option>';
  dom.selConselhoCentral.disabled = true;
  if (dom.grupoCP) dom.grupoCP.style.display = 'none';
  if (dom.grupoCF) dom.grupoCF.style.display = 'none';
}

/**
 * Popula o select de Conselhos Particulares.
 * @param {Array<{id_cp: string, id_ssvp?: string, id_conselho?: string, nome_cp: string}>} lista
 * @return {void}
 */
export function popularSelectConselhosParticulares(lista) {
  if (!dom.selConselhoParticular || !dom.grupoCP) return;

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

  dom.grupoCP.style.display = 'flex';
  if (dom.grupoCF) dom.grupoCF.style.display = 'none';
}

/**
 * Define estado de carregamento do select de Conselhos Particulares.
 * @return {void}
 */
export function definirCarregandoCPs() {
  if (!dom.selConselhoParticular || !dom.grupoCP) return;
  dom.selConselhoParticular.innerHTML = '<option value="">Carregando CPs...</option>';
  dom.grupoCP.style.display = 'flex';
  if (dom.grupoCF) dom.grupoCF.style.display = 'none';
}

/**
 * Popula o select de Conferências.
 * @param {Array<{id_ssvp: string, nome_cf: string}>} lista
 * @return {void}
 */
export function popularSelectConferencias(lista) {
  if (!dom.selConferencia || !dom.grupoCF) return;

  dom.selConferencia.innerHTML = '<option value="">Selecione a Conferência...</option>';
  lista.forEach((cf) => {
    const opt = document.createElement('option');
    opt.value = cf.id_ssvp;
    opt.textContent = cf.nome_cf ? `${cf.nome_cf} (${cf.id_ssvp})` : cf.id_ssvp;
    opt.dataset.nomeCf = cf.nome_cf || cf.id_ssvp;
    dom.selConferencia.appendChild(opt);
  });

  dom.grupoCF.style.display = 'flex';
}

/**
 * Oculta o seletor de Conferências.
 * @return {void}
 */
export function ocultarSelectConferencias() {
  if (dom.grupoCF) dom.grupoCF.style.display = 'none';
}

/**
 * Exibe mensagem de feedback visual no modal.
 * @param {string} texto Mensagem explicativa.
 * @param {'erro'|'sucesso'} tipo Tipo do feedback visual.
 * @return {void}
 */
export function exibirFeedback(texto, tipo) {
  if (!dom.msgFeedback) return;
  dom.msgFeedback.textContent = texto;
  dom.msgFeedback.className = `feedback-msg feedback-${tipo}`;
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
 * Atualiza o botão de login para estado de carregamento ou normal.
 * @param {boolean} carregando
 * @return {void}
 */
export function definirCarregandoLogin(carregando) {
  if (!dom.btnLogin) return;

  if (carregando) {
    dom.btnLogin.disabled = true;
    dom.btnLogin.innerHTML = '<span class="spinner"></span> Validando credenciais...';
  } else {
    dom.btnLogin.disabled = false;
    dom.btnLogin.innerHTML = '<span>Entrar no WebApp</span>';
  }
}
