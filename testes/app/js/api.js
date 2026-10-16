/**
 * @fileoverview Cliente HTTP para consumo da API do WebApp SSVP (Google Apps Script).
 * Módulo: testes/app/js/api.js
 * Conformidade com: dev/padroes/02_javascript_google.md
 */

export const URL_PADRAO_WEBAPP = 'https://script.google.com/macros/s/AKfycbzP6CehGh2U_kLhVPMZNZKeoaWIWzpzd-fgNh03qnmwYVBJFoI3nMP6TZBGH1ZahT9t/exec';
const STORAGE_KEY_URL = 'ssvp_webapp_url';

/**
 * Retorna a URL ativa do endpoint da API.
 * @return {string}
 */
export function obterUrlApi() {
  const salva = localStorage.getItem(STORAGE_KEY_URL);
  return (salva && salva.trim() !== '') ? salva.trim() : URL_PADRAO_WEBAPP;
}

/**
 * Executa requisição HTTP com tratamento de erro.
 * @param {string} queryString
 * @param {RequestInit} [opcoes={}]
 * @return {Promise<Object>}
 * @private
 */
async function chamarApi(queryString, opcoes = {}) {
  const urlBase = obterUrlApi();
  const sep = urlBase.includes('?') ? '&' : '?';
  const urlCompleta = `${urlBase}${sep}${queryString}`;

  const res = await fetch(urlCompleta, opcoes);
  if (!res.ok) {
    throw new Error(`Erro de comunicação com o servidor (${res.status}: ${res.statusText})`);
  }
  return await res.json();
}

/**
 * Realiza Health Check na API do WebApp.
 * @return {Promise<Object>}
 */
export async function executarPing() {
  return await chamarApi('action=ping');
}

/**
 * Busca a lista de Conselhos Centrais cadastrados na Planilha Central.
 * @return {Promise<Array<{id_cc: string, nome_cc: string}>>}
 */
export async function buscarConselhosCentrais() {
  const dados = await chamarApi('action=get_ccs');
  if (!dados.sucesso || !dados.dados || !Array.isArray(dados.dados.conselhos_centrais)) {
    throw new Error(dados.erro?.mensagem || 'Falha ao obter Conselhos Centrais.');
  }
  return dados.dados.conselhos_centrais;
}

/**
 * Busca a estrutura de Conselhos Particulares e Conferências do Conselho Central.
 * @param {string} idCc Identificador do Conselho Central.
 * @return {Promise<{id_cc: string, nome_cc: string, conselhos_particulares: Array, conferencias: Array}>}
 */
export async function buscarEstruturaCC(idCc) {
  if (!idCc) {
    throw new Error("Parâmetro 'idCc' é obrigatório.");
  }
  const dados = await chamarApi(`action=get_estrutura_cc&id_cc=${encodeURIComponent(idCc)}`);
  if (!dados.sucesso || !dados.dados) {
    throw new Error(dados.erro?.mensagem || 'Falha ao obter estrutura do Conselho Central.');
  }
  return {
    id_cc: dados.dados.id_cc || idCc,
    nome_cc: dados.dados.nome_cc || idCc,
    conselhos_particulares: dados.dados.conselhos_particulares || [],
    conferencias: dados.dados.conferencias || []
  };
}

/**
 * Dados locais de fallback para testes offline ou antes do deploy da API.
 */
export const DADOS_FALLBACK_INDICE = {
  conselhos_particulares: [
    { id_conselho: 'ITA', nome_conselho: 'TESTE Conselho Particular Itaim', link_pasta: 'cp_itaim' },
    { id_conselho: 'SAU', nome_conselho: 'TESTE Conselho Particular Saúde', link_pasta: 'cp_saude' }
  ],
  conferencias: [
    {
      conselho_particular: 'TESTE Conselho Particular Saúde',
      id_conferencia: 'SP-SUD-SAU-NSL',
      nome_conferencia: 'TESTE Nossa Senhora de Loreto',
      status: 'ativa',
      link_planilha: 'https://docs.google.com/spreadsheets/d/1ZXA74veROnpdjhBuDadIu7JZ2JFLMEItBFjGnrVDAWY/edit?usp=sharing',
      id_planilha: '1ZXA74veROnpdjhBuDadIu7JZ2JFLMEItBFjGnrVDAWY'
    },
    {
      conselho_particular: 'TESTE Conselho Particular Itaim',
      id_conferencia: 'SP-SUD-ITA-ICO',
      nome_conferencia: 'TESTE Imaculada Conceição',
      status: 'ativa',
      link_planilha: 'https://docs.google.com/spreadsheets/d/1Dh4ndhz9PurBS2ArV2v32D0bqt0NbksA4fuyW26S7a8/edit?usp=sharing',
      id_planilha: '1Dh4ndhz9PurBS2ArV2v32D0bqt0NbksA4fuyW26S7a8'
    }
  ]
};

/**
 * Busca o índice de conferências (CPs e CFs) do Google Drive via Apps Script.
 * @param {string} [idPlanilhaIndice]
 * @return {Promise<{hash: string, dados: {conselhos_particulares: Array, conferencias: Array}}>}
 */
export async function buscarIndiceConferencias(idPlanilhaIndice = '') {
  try {
    const url = obterUrlApi();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao: 'get_indice', id_planilha_indice: idPlanilhaIndice })
    });
    const json = await res.json();
    if (json.sucesso && json.dados && Array.isArray(json.dados.conselhos_particulares) && Array.isArray(json.dados.conferencias)) {
      return { hash: json.hash || 'hash_drive_1', dados: json.dados };
    }
    throw new Error(json.erro || 'A API remota ainda não possui a ação get_indice implantada.');
  } catch (err) {
    console.warn('API remota sem get_indice ou inacessível, utilizando dados locais de fallback do índice:', err.message);
    return {
      hash: 'fallback_local_v1',
      dados: DADOS_FALLBACK_INDICE
    };
  }
}

/**
 * Checa se o hash do índice no Drive é igual ao do cache local (Stale-While-Revalidate).
 * @param {string} hashAtual
 * @param {string} [idPlanilhaIndice]
 * @return {Promise<{igual: boolean, hash?: string, dados?: Object}>}
 */
export async function checarIndiceHash(hashAtual, idPlanilhaIndice = '') {
  try {
    const url = obterUrlApi();
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ acao: 'check_indice_hash', hash: hashAtual, id_planilha_indice: idPlanilhaIndice })
    });
    if (!res.ok) throw new Error('Status HTTP ' + res.status);
    return await res.json();
  } catch (err) {
    return { igual: true }; // Se offline, mantém o cache local intacto
  }
}

/**
 * Valida credenciais de login do Vicentino na planilha da Conferência.
 * @param {string} idPlanilha ID da planilha da conferência
 * @param {string} email
 * @param {string} senha
 * @return {Promise<{sucesso: boolean, pessoa?: Object, conferencia?: Object, erro?: string}>}
 */
export async function autenticarPessoa(idPlanilha, email, senha) {
  if (!idPlanilha) {
    throw new Error('ID da planilha da conferência é obrigatório.');
  }
  if (!email || !senha) {
    throw new Error('Preencha e-mail e senha.');
  }

  const payload = {
    acao: 'login',
    id_planilha: idPlanilha,
    email: email.trim(),
    senha: senha.trim()
  };

  const url = obterUrlApi();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Erro no servidor (${res.status})`);
  }
  return await res.json();
}
