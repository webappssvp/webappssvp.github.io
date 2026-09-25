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
 * Valida credenciais de login do Vicentino na planilha da Conferência.
 * @param {string} idCc
 * @param {string} idSsvp
 * @param {string} email
 * @param {string} senha
 * @return {Promise<{sucesso: boolean, dados?: Object, erro?: Object}>}
 */
export async function autenticarPessoa(idCc, idSsvp, email, senha) {
  if (!idCc || !idSsvp) {
    throw new Error('Conselho Central e Conferência são obrigatórios para login.');
  }
  if (!email || !senha) {
    throw new Error('Preencha e-mail e senha.');
  }

  const payload = {
    id_cc: idCc,
    id_ssvp: idSsvp,
    email: email.trim(),
    senha: senha.trim()
  };

  const urlParams = `action=login&id_cc=${encodeURIComponent(idCc)}&id_ssvp=${encodeURIComponent(idSsvp)}&email=${encodeURIComponent(payload.email)}&senha=${encodeURIComponent(payload.senha)}`;

  return await chamarApi(urlParams, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });
}
