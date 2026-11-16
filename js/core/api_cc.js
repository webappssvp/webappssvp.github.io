/**
 * @fileoverview Conversa com o Apps Script de um Conselho Central (dev_local/implement/appscript_cc).
 * Cada CC tem o seu script; o endereço (url_api) vem de siglas/siglas_conselhos_centrais.json.
 * Pedido: POST com JSON {acao, ...}. Content-Type text/plain para o navegador não fazer pré-consulta (CORS).
 * Resposta: {status: 'success', ...} ou {status: 'erro', codigo, mensagem}.
 * Módulo: js/core/api_cc.js
 */

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
