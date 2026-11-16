/**
 * @fileoverview Orquestrador da Lógica de Autenticação e Hierarquia SSVP.
 * Integra a camada de UI com o cliente de API e o banco de dados IndexedDB v3.
 * Suporta fluxo hierárquico em 3 etapas (Conselho Central ➔ Particular ➔ Conferência ➔ E-mail/Senha).
 * Valida credenciais consultando a aba 'pessoas' na planilha da Conferência via Google Apps Script.
 * Conformidade com: dev/padroes/02_javascript_google.md
 */

import * as db from './db.js';
import * as api from './api.js';
import * as ui from './ui.js';

/**
 * Estado da sessão em memória da aplicação.
 */
let sessaoAtiva = {
  conectado: false,
  conselho_metropolitano: 'São Paulo',
  id_cc: null,
  nome_cc: null,
  id_cp: null,
  nome_cp: null,
  id_ssvp: null,
  nome_cf: null,
  nome_pessoa: null,
  email_pessoa: null
};

/**
 * Cache em memória da estrutura do Conselho Central selecionado.
 */
let cacheEstruturaCC = {
  id_cc: null,
  nome_cc: null,
  conselhos_particulares: [],
  conferencias: []
};

/**
 * Retorna uma cópia do estado atual da sessão ativa.
 * @return {Object}
 */
export function obterSessaoAtiva() {
  return { ...sessaoAtiva };
}

/**
 * Inicializa os fluxos de autenticação, conectando os eventos da UI.
 * @return {Promise<void>}
 */
export async function inicializarAuth() {
  ui.inicializarUI({
    aoAbrirModal: tratarAberturaModal,
    aoFecharModal: ui.fecharModal,
    aoVoltarParaSelects: tratarVoltarParaSelects,
    aoTrocarCC: tratarTrocaCC,
    aoTrocarCP: tratarTrocaCP,
    aoTrocarCF: tratarTrocaCF,
    aoAvancarParaSenha: tratarAvancoParaSenha,
    aoSubmeterLogin: tratarSubmissaoConexao,
    aoSolicitarLogout: tratarLogout
  });

  await restaurarSessaoPersistida();
}

/**
 * Restaura a sessão do IndexedDB na inicialização do aplicativo.
 * @return {Promise<void>}
 * @private
 */
async function restaurarSessaoPersistida() {
  const registro = await db.lerSessao();

  if (registro && registro.id_ssvp) {
    sessaoAtiva = { ...sessaoAtiva, ...registro };

    if (sessaoAtiva.conectado) {
      ui.atualizarSemaforo(ui.EstadosSemaforo.LOGADO, sessaoAtiva);
    } else {
      ui.atualizarSemaforo(ui.EstadosSemaforo.NAO_LOGADO, sessaoAtiva);
    }
  } else {
    ui.atualizarSemaforo(ui.EstadosSemaforo.NAO_CONECTADO);
  }
}

/**
 * Gerencia a exibição correta da tela ao abrir o modal.
 * @return {void}
 * @private
 */
function tratarAberturaModal() {
  ui.abrirModal();

  if (sessaoAtiva.conectado) {
    ui.mostrarSecaoConectado(sessaoAtiva);
  } else if (sessaoAtiva.id_ssvp) {
    ui.mostrarSecaoSenha(sessaoAtiva.nome_cf || sessaoAtiva.id_ssvp);
  } else {
    ui.mostrarSecaoSelects();
    carregarListaConselhosCentrais();
  }
}

/**
 * Retorna da tela de credenciais para a seleção de conferência.
 * @return {void}
 * @private
 */
function tratarVoltarParaSelects() {
  ui.mostrarSecaoSelects();
  if (!cacheEstruturaCC.id_cc) {
    carregarListaConselhosCentrais();
  }
}

/**
 * Carrega a lista de Conselhos Centrais da API.
 * @return {Promise<void>}
 * @private
 */
async function carregarListaConselhosCentrais() {
  ui.definirCarregandoConselhosCentrais();
  ui.ocultarFeedback();

  try {
    const lista = await api.buscarConselhosCentrais();

    if (lista.length === 0) {
      ui.exibirFeedback("A aba 'conselhos_centrais' está vazia na planilha central do WebApp.", 'erro');
      return;
    }

    ui.popularSelectConselhosCentrais(lista);
  } catch (erro) {
    ui.exibirFeedback(`Erro de conexão com a API do WebApp: ${erro.message}`, 'erro');
  }
}

/**
 * Trata a troca do Conselho Central selecionado.
 * @param {string} idCc Código do Conselho Central.
 * @return {Promise<void>}
 * @private
 */
async function tratarTrocaCC(idCc) {
  if (!idCc) {
    cacheEstruturaCC = { id_cc: null, nome_cc: null, conselhos_particulares: [], conferencias: [] };
    ui.desabilitarSelectConselhoParticular();
    ui.desabilitarSelectConferencias();
    return;
  }

  ui.definirCarregandoCPs();
  ui.ocultarFeedback();

  try {
    const dados = await api.buscarEstruturaCC(idCc);

    cacheEstruturaCC = {
      id_cc: idCc,
      nome_cc: dados.nome_cc,
      conselhos_particulares: dados.conselhos_particulares,
      conferencias: dados.conferencias
    };

    ui.popularSelectConselhosParticulares(cacheEstruturaCC.conselhos_particulares);
  } catch (erro) {
    ui.exibirFeedback(`Falha ao ler estrutura do Conselho: ${erro.message}`, 'erro');
  }
}

/**
 * Trata a troca do Conselho Particular selecionado, aplicando filtragem híbrida de conferências.
 * @param {string} idCp Código do Conselho Particular (ex: SPCAPA).
 * @param {DOMStringMap} [dataset={}] Metadados do option selecionado.
 * @return {void}
 * @private
 */
function tratarTrocaCP(idCp, dataset = {}) {
  if (!idCp) {
    ui.desabilitarSelectConferencias();
    return;
  }

  const idConselho = String(dataset.idConselho || '').trim().toUpperCase();
  const nomeCp = String(dataset.nomeCp || '').trim().toLowerCase();
  const cpVal = String(idCp).trim().toUpperCase();

  // Filtragem Híbrida e Resiliente de Conferências
  const cfsFiltradas = cacheEstruturaCC.conferencias.filter((cf) => {
    const cfCp = String(cf.id_cp || '').trim().toUpperCase();
    const cfSsvp = String(cf.id_ssvp || '').trim().toUpperCase();

    // 1. Vínculo exato por id_ssvp do CP (ex: cfCp === "SPCAPA")
    if (cfCp && cfCp === cpVal) {
      return true;
    }

    // 2. Vínculo por código local do CP (ex: cfCp === "PA")
    if (idConselho && cfCp === idConselho) {
      return true;
    }

    // 3. Vínculo pelo nome do CP
    if (nomeCp && cfCp.toLowerCase() === nomeCp) {
      return true;
    }

    // 4. Vínculo hierárquico cumulativo: o id_ssvp da CF começa com o id_ssvp do CP (ex: "SPCAPAFA".startsWith("SPCAPA"))
    if (cpVal.length >= 4 && cfSsvp.startsWith(cpVal)) {
      return true;
    }

    return false;
  });

  ui.popularSelectConferencias(cfsFiltradas);
}

/**
 * Trata a alteração de seleção da Conferência no dropdown.
 * @param {string} idSsvp Código SSVP da Conferência.
 * @param {string} nomeCf Nome da Conferência.
 * @return {void}
 * @private
 */
function tratarTrocaCF(idSsvp, nomeCf) {
  if (!idSsvp) {
    return;
  }

  sessaoAtiva.conselho_metropolitano = 'São Paulo';
  sessaoAtiva.id_cc = cacheEstruturaCC.id_cc;
  sessaoAtiva.nome_cc = cacheEstruturaCC.nome_cc;
  sessaoAtiva.id_ssvp = idSsvp;
  sessaoAtiva.nome_cf = nomeCf;
}

/**
 * Trata o avanço da Etapa 1 (Selects) para a Etapa 2 (E-mail e Senha).
 * @param {string} idSsvp Código SSVP da Conferência.
 * @param {string} nomeCf Nome da Conferência.
 * @return {Promise<void>}
 * @private
 */
async function tratarAvancoParaSenha(idSsvp, nomeCf) {
  if (!idSsvp) {
    ui.exibirFeedback('Selecione uma Conferência antes de avançar.', 'erro');
    return;
  }

  sessaoAtiva.conselho_metropolitano = 'São Paulo';
  sessaoAtiva.id_cc = cacheEstruturaCC.id_cc;
  sessaoAtiva.nome_cc = cacheEstruturaCC.nome_cc;
  sessaoAtiva.id_ssvp = idSsvp;
  sessaoAtiva.nome_cf = nomeCf;
  sessaoAtiva.conectado = false;

  await db.salvarSessao({
    conselho_metropolitano: 'São Paulo',
    id_cc: sessaoAtiva.id_cc,
    nome_cc: sessaoAtiva.nome_cc,
    id_ssvp: sessaoAtiva.id_ssvp,
    nome_cf: sessaoAtiva.nome_cf,
    conectado: false
  });

  ui.atualizarSemaforo(ui.EstadosSemaforo.NAO_LOGADO, sessaoAtiva);
  ui.mostrarSecaoSenha(nomeCf);
}

/**
 * Trata a validação das credenciais de login (e-mail e senha) na Conferência.
 * Consulta a planilha da Conferência via API (aba 'pessoas') para verificar a existência do cadastro.
 * @param {string} email E-mail informado pelo vicentino.
 * @param {string} senha Senha informada pelo vicentino.
 * @return {Promise<void>}
 * @private
 */
async function tratarSubmissaoConexao(email, senha) {
  if (!email || !senha) {
    ui.exibirFeedback('Preencha seu e-mail e sua senha para entrar.', 'erro');
    return;
  }

  if (!sessaoAtiva.id_cc || !sessaoAtiva.id_ssvp) {
    ui.exibirFeedback('Selecione uma Conferência antes de entrar.', 'erro');
    return;
  }

  ui.definirCarregandoConexao(true);
  ui.ocultarFeedback();

  try {
    const resposta = await api.autenticarPessoa(
      sessaoAtiva.id_cc,
      sessaoAtiva.id_ssvp,
      email,
      senha
    );

    if (resposta && resposta.sucesso && resposta.dados) {
      sessaoAtiva.conectado = true;
      sessaoAtiva.nome_pessoa = resposta.dados.nome_pessoa || 'Vicentino(a)';
      sessaoAtiva.email_pessoa = resposta.dados.email_pessoa || email;
      if (resposta.dados.nome_cf) {
        sessaoAtiva.nome_cf = resposta.dados.nome_cf;
      }

      await db.salvarSessao({
        ...sessaoAtiva,
        conectado: true
      });

      ui.atualizarSemaforo(ui.EstadosSemaforo.LOGADO, sessaoAtiva);
      ui.exibirFeedback(`🎉 Olá, ${sessaoAtiva.nome_pessoa}! Conectado(a) com sucesso.`, 'sucesso');

      setTimeout(() => {
        ui.fecharModal();
      }, 1200);
    } else {
      const msgErro = resposta?.erro?.mensagem || 'Pessoa não encontrada na aba pessoas da Conferência ou senha incorreta.';
      ui.atualizarSemaforo(ui.EstadosSemaforo.NAO_LOGADO, { nome_cf: sessaoAtiva.nome_cf || 'Credenciais inválidas' });
      ui.exibirFeedback(msgErro, 'erro');
    }
  } catch (erro) {
    ui.exibirFeedback(`Erro de autenticação: ${erro.message}`, 'erro');
  } finally {
    ui.definirCarregandoConexao(false);
  }
}

/**
 * Desconecta a conferência ativa e limpa o banco de dados IndexedDB.
 * @return {Promise<void>}
 * @private
 */
async function tratarLogout() {
  if (confirm('Deseja desconectar da conferência atual?')) {
    await db.limparSessao();

    sessaoAtiva = {
      conectado: false,
      conselho_metropolitano: 'São Paulo',
      id_cc: null,
      nome_cc: null,
      id_cp: null,
      nome_cp: null,
      id_ssvp: null,
      nome_cf: null,
      nome_pessoa: null,
      email_pessoa: null
    };

    ui.atualizarSemaforo(ui.EstadosSemaforo.NAO_CONECTADO);
    ui.fecharModal();
    alert('Sessão desconectada com sucesso.');
  }
}
