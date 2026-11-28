/**
 * @fileoverview Aniversários da semana (28/11/2026): a vela 🕯️ nas telas Pessoas e Famílias.
 *
 * O script do CC (rota "aniversarios") manda só o dia e o mês de quem faz aniversário nos próximos 14 dias, nunca o
 * ano. O app mostra hoje e os 6 dias seguintes, com o dia da semana calculado aqui. A lista fica guardada no celular
 * (config "aniversarios:<conferência>", apagada ao sair) e é buscada de novo, no máximo, a cada hora ou quando o dia
 * muda. Sem internet, vale a guardada: as datas que já passaram somem sozinhas.
 */

import * as db from './db.js';

/** Chave da lista guardada (+ id da conferência). */
export const CHAVE_GUARDADA = 'aniversarios:';
/** Quantos dias aparecem: hoje e os 6 seguintes. */
const DIAS_NA_TELA = 7;
const DE_NOVO_MS = 60 * 60 * 1000;
const DIAS_DA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Avisa as telas quando a lista muda ("mudou", detail: {conferencia}). */
export const eventos = new EventTarget();

/** Pergunta em andamento, por conferência. @type {!Object<string, !Promise>} */
const buscando = {};

/** @return {string} Hoje, "aaaa-mm-dd", na hora do celular. */
function hoje() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/**
 * Busca a lista no script do CC, se a guardada é de outro dia ou tem mais de uma hora.
 * @param {string} cf
 * @param {function(string, !Object): !Promise<!Object>} chamar
 * @param {boolean=} forcar Busca mesmo dentro da hora: a lista de pessoas trouxe mudança (ex.: uma data de nascimento
 *     corrigida) ou foi atualizada pelo botão.
 * @return {!Promise<void>}
 */
export function atualizar(cf, chamar, forcar = false) {
  if (!buscando[cf]) {
    buscando[cf] = buscar(cf, chamar, forcar).catch(() => {
      // sem resposta: fica a guardada
    }).finally(() => {
      delete buscando[cf];
    });
  }
  return buscando[cf];
}

/**
 * @param {string} cf
 * @param {function(string, !Object): !Promise<!Object>} chamar
 * @param {boolean} forcar
 */
async function buscar(cf, chamar, forcar) {
  const guardada = await db.lerConfig(CHAVE_GUARDADA + cf);
  if (!navigator.onLine ||
      (!forcar && guardada && guardada.dia === hoje() && Date.now() - guardada.em < DE_NOVO_MS)) {
    return;
  }
  const r = await chamar('aniversarios', {});
  const lista = (r.aniversarios || []).map((a) => ({id_pessoa: String(a.id_pessoa), dia: String(a.dia)}));
  await db.salvarConfig(CHAVE_GUARDADA + cf, {em: Date.now(), dia: hoje(), lista});
  eventos.dispatchEvent(new CustomEvent('mudou', {detail: {conferencia: cf}}));
}

/**
 * Os aniversários de hoje e dos 6 dias seguintes, pela lista guardada.
 * @param {string} cf
 * @return {!Promise<!Object<string, {dia: string, em: number, texto: string}>>} id_pessoa → aniversário.
 */
export async function daSemana(cf) {
  const guardada = await db.lerConfig(CHAVE_GUARDADA + cf).catch(() => null);
  const porId = {};
  if (!guardada || !Array.isArray(guardada.lista)) {
    return porId;
  }
  const agora = new Date();
  const zero = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  guardada.lista.forEach((a) => {
    const [dd, mm] = a.dia.split('/').map(Number);
    if (!dd || !mm) {
      return;
    }
    // Este ano ou, se já passou (ex.: hoje é 30/12 e o aniversário é 02/01), o ano que vem.
    let data = new Date(zero.getFullYear(), mm - 1, dd);
    if (data < zero) {
      data = new Date(zero.getFullYear() + 1, mm - 1, dd);
    }
    const em = Math.round((data - zero) / 86400000);
    if (em >= 0 && em < DIAS_NA_TELA && !porId[a.id_pessoa]) {
      porId[a.id_pessoa] = {dia: a.dia, em, texto: textoDoDia(em, data, a.dia)};
    }
  });
  return porId;
}

/**
 * "Hoje", "Amanhã, sex 05/12" ou "qua, 03/12".
 * @param {number} em Dias a partir de hoje.
 * @param {!Date} data
 * @param {string} dia "dd/mm"
 * @return {string}
 */
function textoDoDia(em, data, dia) {
  const semana = DIAS_DA_SEMANA[data.getDay()];
  if (em === 0) {
    return 'Hoje, ' + semana + ' ' + dia;
  }
  if (em === 1) {
    return 'Amanhã, ' + semana + ' ' + dia;
  }
  return semana + ', ' + dia;
}

/**
 * O selo da vela, para os cards.
 * @param {?{texto: string, em: number}} a
 * @param {string=} quem Nome de quem faz aniversário (no card da família).
 * @return {string} HTML (vazio sem aniversário).
 */
export function selo(a, quem) {
  if (!a) {
    return '';
  }
  const texto = (quem ? quem + ': ' : '') + a.texto;
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
    '\'': '&#39;'}[c]));
  return `<span class="selo-aniversario${a.em === 0 ? ' e-hoje' : ''}"><span aria-hidden="true">🕯️</span> ` +
    `<span class="visualmente-escondido">Aniversário: </span>${esc(texto)}</span>`;
}
