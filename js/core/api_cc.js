/**
 * @fileoverview Conversa com o Apps Script de um Conselho Central (dev_local/implement/appscript_cc).
 * Cada CC tem o seu script; o endereço (url_api) vem de siglas/siglas_conselhos_centrais.json.
 * Pedido: POST com JSON {acao, ...}. Content-Type text/plain para o navegador não fazer pré-consulta (CORS).
 * Resposta: {status: 'success', ...} ou {status: 'erro', codigo, mensagem}.
 * Módulo: js/core/api_cc.js
 */

import {respostaDoServidor} from './uso.js';

/** Tempo máximo de espera por resposta do script (o Apps Script pode demorar a "acordar"). */
const ESPERA_MS = 30000;

/**
 * Erro com a mensagem e o código que o script devolveu.
 */
export class ErroCC extends Error {
  /**
   * @param {string} mensagem
   * @param {string=} codigo
   */
  constructor(mensagem, codigo) {
    super(mensagem);
    this.codigo = codigo || '';
  }
}

/**
 * @param {string} urlApi Endereço /exec do script do CC.
 * @param {string} acao Ex.: 'conferencias', 'entrar', 'pedir_codigo', 'criar_senha'.
 * @param {!Object=} dados Demais campos do pedido.
 * @return {Promise<!Object>} A resposta com status 'success'.
 */
export async function chamarCC(urlApi, acao, dados = {}) {
  if (acao === 'registrar_uso') {
    return chamarCCSemMedir(urlApi, acao, dados); // o envio do resumo não entra no resumo
  }
  const inicio = performance.now();
  try {
    const corpo = await chamarCCSemMedir(urlApi, acao, dados);
    respostaDoServidor(acao, performance.now() - inicio, false);
    return corpo;
  } catch (erro) {
    // Sem resposta ou resposta estranha conta como falha; recusa normal (senha errada) é resposta.
    if (erro.codigo !== 'SEM_INTERNET' && erro.codigo !== 'SEM_URL_API') {
      respostaDoServidor(acao, performance.now() - inicio, ['SEM_CONEXAO', 'RESPOSTA_INVALIDA'].includes(erro.codigo));
    }
    throw erro;
  }
}

/** @param {string} urlApi @param {string} acao @param {!Object} dados @return {!Promise<!Object>} */
async function chamarCCSemMedir(urlApi, acao, dados) {
  if (!urlApi) {
    throw new ErroCC('Este Conselho Central ainda não está ligado ao aplicativo.', 'SEM_URL_API');
  }
  if (!navigator.onLine) {
    throw new ErroCC('Sem internet agora. Tente de novo quando estiver conectado.', 'SEM_INTERNET');
  }
  const controle = new AbortController();
  const espera = setTimeout(() => controle.abort(), ESPERA_MS);
  let resposta;
  try {
    resposta = await fetch(urlApi, {
      method: 'POST',
      headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify({...dados, acao}),
      signal: controle.signal,
    });
  } catch (erro) {
    throw new ErroCC(erro.name === 'AbortError' ? 'O servidor demorou demais para responder. Tente de novo.' :
      'Não consegui falar com o servidor do Conselho Central. Confira a internet.', 'SEM_CONEXAO');
  } finally {
    clearTimeout(espera);
  }
  let corpo;
  try {
    corpo = await resposta.json();
  } catch (erro) {
    throw new ErroCC('O servidor do Conselho Central respondeu algo inesperado.', 'RESPOSTA_INVALIDA');
  }
  if (!corpo || corpo.status !== 'success') {
    throw new ErroCC((corpo && corpo.mensagem) || 'Não deu certo. Tente de novo.', corpo && corpo.codigo);
  }
  return corpo;
}
