/**
 * @fileoverview Tranca do app com um desenho (9 pontos) ou um PIN (decisão de 19/11/2026).
 *
 * Por que: com o celular roubado e desbloqueado, o app abria direto na conferência (a sessão vale 30 dias) e os
 * dados guardados para usar sem internet abriam sem senha por 12 horas.
 *
 * - O desenho (ou o PIN) não é guardado: vira uma chave (PBKDF2-SHA-256, sal aleatório) que tranca, no celular,
 *   os tokens das sessões (barra_conexao.js) e a chave lembrada dos dados guardados (cofre.js). Copiar o banco do
 *   celular não basta para abrir.
 * - Tranca depois de minutos() sem uso (1, 5, 10 ou 15, nas Configurações). Reaberto antes disso, o app não pede de novo: a chave da tranca fica
 *   lembrada até lá (sem poder ser exportada, como a do cofre).
 * - TENTATIVAS erradas seguidas: o app esquece as sessões e os dados guardados (tela_trava.js chama o apagar) e
 *   volta para o e-mail e a senha.
 * - O desenho não substitui a senha: a conta continua sendo e-mail e senha, que o servidor confere.
 */

import * as db from './db.js';
import {prefs, eventosPreferencias} from './preferencias.js';

/** Opções de minutos parado até trancar (Configurações e a criação da tranca). O máximo é 15. */
export const OPCOES_MINUTOS = [1, 5, 10, 15];

/** @return {number} Minutos sem uso até trancar (a escolha do vicentino; 15 se não escolheu). */
export function minutos() {
  const m = Number(prefs.trancar);
  return OPCOES_MINUTOS.includes(m) ? m : 15;
}

// Mudou o tempo: a tranca lembrada passa a valer o tempo novo a partir de agora.
eventosPreferencias.addEventListener('mudou', (e) => {
  if (e.detail.chave === 'trancar') {
    marcarUso(true);
  }
});

/** Erros seguidos até esquecer tudo neste celular. */
export const TENTATIVAS = 5;

/** Menos rodadas que o cofre (600 mil): a tranca abre várias vezes por dia, e o limite de tentativas protege. */
const ITERACOES = 300000;

const CHAVE = 'trava'; // {tipo, sal, iteracoes, iv, verificador, erros}
const CHAVE_LEMBRADA = 'trava_lembrada'; // {chave: CryptoKey, ate}
const VERIFICADOR = 'ssvp-trava-1';

/** De quanto em quanto tempo o uso renova a chave lembrada no banco (não a cada toque). */
const RENOVAR_MS = 60 * 1000;

const estado = {
  config: /** @type {?Object} */ (null),
  chave: /** @type {?CryptoKey} */ (null),
  ultimoUso: 0,
  gravadoEm: 0,
};

/** @param {string} segredo @param {!Uint8Array} sal @param {number} iteracoes @return {!Promise<!CryptoKey>} */
async function derivar(segredo, sal, iteracoes) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(segredo), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt: sal, iterations: iteracoes, hash: 'SHA-256'}, base,
      {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']);
}

/** Ao abrir o app: lê a tranca e, se o último uso foi há menos de minutos(), já a deixa aberta. */
export async function iniciar() {
  estado.config = (await db.lerConfig(CHAVE)) || null;
  if (!estado.config) {
    return;
  }
  const lembrada = await db.lerConfig(CHAVE_LEMBRADA);
  if (lembrada && lembrada.chave && lembrada.ate > Date.now()) {
    estado.chave = lembrada.chave;
    marcarUso();
  } else if (lembrada) {
    await db.apagarConfig(CHAVE_LEMBRADA);
  }
}

/** @return {boolean} Há desenho ou PIN neste celular. */
export function configurada() {
  return Boolean(estado.config);
}

/** @return {boolean} A tranca está aberta (a chave está na memória). */
export function aberta() {
  return Boolean(estado.chave);
}

/** @return {string} 'desenho' ou 'pin' ('' sem tranca). */
export function tipo() {
  return estado.config ? estado.config.tipo : '';
}

/** @return {number} Quantas tentativas restam antes de esquecer tudo. */
export function restantes() {
  return TENTATIVAS - ((estado.config && estado.config.erros) || 0);
}

/**
 * Cria a tranca (ou troca a que havia).
 * @param {string} qual 'desenho' ou 'pin'
 * @param {string} segredo O desenho ("1-5-9-6") ou os números do PIN.
 */
export async function criar(qual, segredo) {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chave = await derivar(qual + ':' + segredo, sal, ITERACOES);
  const verificador = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, chave, new TextEncoder().encode(VERIFICADOR));
  estado.config = {tipo: qual, sal: Array.from(sal), iteracoes: ITERACOES, iv: Array.from(iv), verificador, erros: 0};
  estado.chave = chave;
  await db.salvarConfig(CHAVE, estado.config);
  marcarUso(true);
}

/**
 * @param {string} segredo
 * @return {!Promise<boolean>} Se abriu. Errado conta uma tentativa (veja restantes()).
 */
export async function abrir(segredo) {
  const c = estado.config;
  if (!c) {
    return false;
  }
  try {
    const chave = await derivar(c.tipo + ':' + segredo, new Uint8Array(c.sal), c.iteracoes);
    await crypto.subtle.decrypt({name: 'AES-GCM', iv: new Uint8Array(c.iv)}, chave, c.verificador);
    estado.chave = chave;
    if (c.erros) {
      c.erros = 0;
      await db.salvarConfig(CHAVE, c);
    }
    marcarUso(true);
    return true;
  } catch (erro) {
    c.erros = (c.erros || 0) + 1;
    await db.salvarConfig(CHAVE, c);
    return false;
  }
}

/** Tranca agora (sem uso há minutos()): a próxima abertura pede o desenho. A chave fica na memória desta página. */
export async function trancar() {
  await db.apagarConfig(CHAVE_LEMBRADA);
}

/** Esquece a tranca (esqueci o desenho, erros demais): o que ela trancava não abre mais. */
export async function esquecer() {
  estado.config = null;
  estado.chave = null;
  await db.apagarConfig(CHAVE);
  await db.apagarConfig(CHAVE_LEMBRADA);
}

/**
 * Houve uso: adia a tranca. Grava no banco no máximo a cada RENOVAR_MS.
 * @param {boolean=} agora Grava já.
 */
export function marcarUso(agora) {
  estado.ultimoUso = Date.now();
  if (!estado.chave || (!agora && estado.ultimoUso - estado.gravadoEm < RENOVAR_MS)) {
    return;
  }
  estado.gravadoEm = estado.ultimoUso;
  db.salvarConfig(CHAVE_LEMBRADA, {chave: estado.chave, ate: estado.ultimoUso + minutos() * 60000}).catch(() => {
    // navegador que não guarda CryptoKey no banco: pede o desenho a cada abertura
  });
}

/** @return {boolean} Passou minutos() sem uso. */
export function venceu() {
  return Boolean(estado.config) && Date.now() - estado.ultimoUso > minutos() * 60000;
}

/**
 * @param {string} texto
 * @return {!Promise<{iv: !Array<number>, cifrado: !ArrayBuffer}>}
 */
export async function cifrarTexto(texto) {
  if (!estado.chave) {
    throw new Error('Tranca fechada.');
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, estado.chave, new TextEncoder().encode(texto));
  return {iv: Array.from(iv), cifrado};
}

/** @param {?Object} registro @return {!Promise<?string>} null se não abre. */
export async function decifrarTexto(registro) {
  if (!estado.chave || !registro) {
    return null;
  }
  try {
    const claro = await crypto.subtle.decrypt({name: 'AES-GCM', iv: new Uint8Array(registro.iv)}, estado.chave,
        registro.cifrado);
    return new TextDecoder().decode(claro);
  } catch (erro) {
    return null;
  }
}

/**
 * Tranca uma chave AES (que possa ser exportada) com a chave da tranca.
 * @param {!CryptoKey} chave
 * @return {!Promise<{iv: !Array<number>, embrulhada: !ArrayBuffer}>}
 */
export async function embrulhar(chave) {
  if (!estado.chave) {
    throw new Error('Tranca fechada.');
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const embrulhada = await crypto.subtle.wrapKey('raw', chave, estado.chave, {name: 'AES-GCM', iv});
  return {iv: Array.from(iv), embrulhada};
}

/**
 * @param {?Object} registro O que embrulhar() devolveu.
 * @param {boolean=} exportavel Só para trocar a tranca: a chave volta podendo ser exportada, para ser embrulhada
 *     de novo pela tranca nova.
 * @return {!Promise<?CryptoKey>} A chave (sem poder ser exportada, salvo exportavel), ou null.
 */
export async function desembrulhar(registro, exportavel = false) {
  if (!estado.chave || !registro || !registro.embrulhada) {
    return null;
  }
  try {
    return await crypto.subtle.unwrapKey('raw', registro.embrulhada, estado.chave,
        {name: 'AES-GCM', iv: new Uint8Array(registro.iv)}, {name: 'AES-GCM', length: 256}, exportavel,
        ['encrypt', 'decrypt']);
  } catch (erro) {
    return null;
  }
}
