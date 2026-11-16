/**
 * @fileoverview Endereço na grafia oficial dos Correios, pelo ViaCEP (gratuito, base DNE dos Correios).
 * Decisões: dev_local/implement/frontend_offline_voz.md §2.4 (15/11/2026).
 *
 * - porCep("01316060") → a rua, o bairro, a cidade e a UF daquele CEP.
 * - ruas("SP", "São Paulo", "av 23 de maio") → as ruas com esse nome na cidade, cada uma com bairro, faixa de
 *   números e CEP (a mesma avenida tem CEPs por trecho).
 * Privacidade: só vão o CEP, ou a UF, a cidade e o nome da rua. Nunca o número da casa nem o nome de alguém.
 */

const BASE = 'https://viacep.com.br/ws/';
const TEMPO_MS = 8000;

/** Tipos de logradouro que a busca tira do começo (a busca do ViaCEP é pelo nome). */
const TIPOS = /^(rua|r\.?|avenida|av\.?|travessa|tv\.?|alameda|al\.?|pra[cç]a|p[cç]\.?|estrada|est\.?|rodovia|rod\.?|largo|lgo\.?|viela|vila|beco|passagem|ladeira|servid[aã]o)\s+/i;

/**
 * @param {string} url
 * @return {!Promise<*>} O JSON, ou null se não deu (sem internet, tempo esgotado, serviço fora).
 */
async function buscar(url) {
  const controle = new AbortController();
  const tempo = setTimeout(() => controle.abort(), TEMPO_MS);
  try {
    const r = await fetch(url, {signal: controle.signal});
    return r.ok ? await r.json() : null;
  } catch (erro) {
    return null;
  } finally {
    clearTimeout(tempo);
  }
}

/**
 * @param {!Object} v Registro do ViaCEP.
 * @return {{logradouro: string, bairro: string, cidade: string, estado_uf: string, cep: string, faixa: string}}
 */
const doViaCep = (v) => ({logradouro: v.logradouro || '', bairro: v.bairro || '', cidade: v.localidade || '',
  estado_uf: v.uf || '', cep: String(v.cep || '').replace(/\D/g, ''), faixa: v.complemento || ''});

/**
 * @param {string} cep Com ou sem traço.
 * @return {!Promise<?Object>} null se não achou ou não deu para consultar.
 */
export async function porCep(cep) {
  const digitos = String(cep || '').replace(/\D/g, '');
  if (digitos.length !== 8) {
    return null;
  }
  const v = await buscar(BASE + digitos + '/json/');
  return v && !v.erro && v.logradouro ? doViaCep(v) : null;
}

/**
 * As ruas com esse nome na cidade (no máximo 50, como o ViaCEP devolve).
 * @param {string} uf
 * @param {string} cidade
 * @param {string} rua O que o vicentino escreveu ou ditou (o tipo, "Rua", "Av.", sai da busca).
 * @return {!Promise<?Array<!Object>>} null se não deu para consultar; [] se não achou.
 */
export async function ruas(uf, cidade, rua) {
  const nome = String(rua || '').trim().replace(TIPOS, '');
  if (!/^[A-Za-z]{2}$/.test(String(uf || '').trim()) || String(cidade || '').trim().length < 3 || nome.length < 3) {
    return [];
  }
  const url = BASE + encodeURIComponent(uf.trim().toUpperCase()) + '/' + encodeURIComponent(cidade.trim()) + '/' +
    encodeURIComponent(nome) + '/json/';
  const lista = await buscar(url);
  return Array.isArray(lista) ? lista.map(doViaCep) : null;
}

/** @param {string} cep 8 dígitos. @return {string} "01316-060" */
export const formatarCep = (cep) => (String(cep).length === 8 ? cep.slice(0, 5) + '-' + cep.slice(5) : cep);
