/**
 * @fileoverview Cliente HTTP para consumo da API do WebApp SSVP no Google Apps Script.
 * Fornece métodos assíncronos tipados para ping, listagem de conselhos e autenticação.
 * Conformidade com: dev/padroes/02_javascript_google.md
 */

/**
 * URL Oficial Padrão da API WebApp SSVP (Google Apps Script).
 * @const {string}
 */
export const URL_PADRAO_WEBAPP = 'https://script.google.com/macros/s/AKfycbzP6CehGh2U_kLhVPMZNZKeoaWIWzpzd-fgNh03qnmwYVBJFoI3nMP6TZBGH1ZahT9t/exec';

/**
 * Chave de armazenamento no localStorage para URL personalizada de desenvolvimento.
 * @const {string}
 */
const STORAGE_KEY_URL = 'ssvp_webapp_url';

/**
 * Retorna a URL ativa do endpoint da API.
 * @return {string} URL configurada ou padrão.
 */
export function obterUrlApi() {
  const urlSalva = localStorage.getItem(STORAGE_KEY_URL);
  return (urlSalva && urlSalva.trim() !== '') ? urlSalva.trim() : URL_PADRAO_WEBAPP;
}

/**
 * Define ou limpa uma URL personalizada da API no localStorage.
 * @param {string|null} novaUrl Nova URL do Apps Script ou string vazia para restaurar o padrão.
 * @return {void}
 */
export function definirUrlApi(novaUrl) {
  if (!novaUrl || novaUrl.trim() === '') {
    localStorage.removeItem(STORAGE_KEY_URL);
  } else {
    localStorage.setItem(STORAGE_KEY_URL, novaUrl.trim());
  }
}

/**
 * Executa uma requisição HTTP genérica para a API com tratamento de erros.
 * @param {string} queryString Parâmetros de consulta URL.
 * @param {RequestInit} [opcoes={}] Opções adicionais do fetch.
 * @return {Promise<Object>} Resposta JSON parseada.
 * @private
 */
async function chamarApi(queryString, opcoes = {}) {
  const urlBase = obterUrlApi();
  const separador = urlBase.includes('?') ? '&' : '?';
  const urlCompleta = `${urlBase}${separador}${queryString}`;

  const resposta = await fetch(urlCompleta, opcoes);

  if (!resposta.ok) {
    throw new Error(`Erro de comunicação com o servidor (${resposta.status}: ${resposta.statusText})`);
  }

  const dados = await resposta.json();
  return dados;
}

/**
 * Realiza Health Check na API do WebApp.
 * @return {Promise<{sucesso: boolean, dados?: Object, erro?: Object}>}
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
    const msgErro = dados.erro?.mensagem || 'Falha ao obter Conselhos Centrais da API.';
    throw new Error(msgErro);
  }

  return dados.dados.conselhos_centrais;
}

/**
 * Busca os Conselhos Particulares e Conferências do Conselho Central informado.
 * @param {string} idCc Identificador do Conselho Central.
 * @return {Promise<{id_cc: string, nome_cc: string, conselhos_particulares: Array, conferencias: Array}>}
 */
export async function buscarEstruturaCC(idCc) {
  if (!idCc) {
    throw new Error("O parâmetro 'idCc' é obrigatório para buscar a estrutura.");
  }

  const dados = await chamarApi(`action=get_estrutura_cc&id_cc=${encodeURIComponent(idCc)}`);

  if (!dados.sucesso || !dados.dados) {
    const msgErro = dados.erro?.mensagem || 'Falha ao obter estrutura do Conselho Central.';
    throw new Error(msgErro);
  }

  return {
    id_cc: dados.dados.id_cc || idCc,
    nome_cc: dados.dados.nome_cc || idCc,
    conselhos_particulares: dados.dados.conselhos_particulares || [],
    conferencias: dados.dados.conferencias || []
  };
}

/**
 * Valida as credenciais de login do Vicentino na planilha da Conferência.
 * @param {string} idCc Código do Conselho Central.
 * @param {string} idSsvp Código SSVP da Conferência (ex: SPCAPAFA).
 * @param {string} email E-mail de login.
 * @param {string} senha Senha do usuário.
 * @return {Promise<{sucesso: boolean, dados?: {id_ssvp: string, nome_cf: string, nome_pessoa: string, email_pessoa: string}, erro?: {codigo: string, mensagem: string}}>}
 */
export async function autenticarPessoa(idCc, idSsvp, email, senha) {
  if (!idCc || !idSsvp) {
    throw new Error('Conselho Central e Conferência são obrigatórios para login.');
  }
  if (!email || !senha) {
    throw new Error('Preencha seu e-mail e sua senha.');
  }

  const payload = {
    id_cc: idCc,
    id_ssvp: idSsvp,
    email: email.trim(),
    senha: senha.trim()
  };

  const urlParams = `action=login&id_cc=${encodeURIComponent(idCc)}&id_ssvp=${encodeURIComponent(idSsvp)}&email=${encodeURIComponent(payload.email)}&senha=${encodeURIComponent(payload.senha)}`;

  const dados = await chamarApi(urlParams, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  return dados;
}
