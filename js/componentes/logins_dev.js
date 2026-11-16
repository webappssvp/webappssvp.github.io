/**
 * @fileoverview SÓ PARA DESENVOLVIMENTO: lembra o e-mail e a senha dos logins que deram certo, para trocar de conta
 * rápido nos testes (pedido de 11/11/2026). A senha fica SEM CIFRAR no IndexedDB deste navegador.
 *
 * Por isso só liga em localhost, 127.0.0.1 e 192.168.* (o *.github.io é o site público e fica de fora).
 * Remover antes do MVP (mvp/telas/01_conexao.md, pendências).
 */

import * as db from '../core/db.js';

/** Liga só no computador de quem desenvolve (ou no celular pela rede local). */
export const LOGINS_DEV_ATIVOS = /^(localhost|127\.0\.0\.1|192\.168\.)/.test(location.hostname);

const CHAVE = 'dev_logins';

/**
 * lista: os logins lembrados. ocultos: "cf|email" das contas do arquivo que o "Esquecer" escondeu.
 * @return {Promise<{lista: !Array<{cf: string, email: string, senha: string, nome: string, salvo_em: string}>,
 *     ocultos: !Array<string>}>}
 */
async function guardado() {
  const dados = LOGINS_DEV_ATIVOS ? (await db.lerConfig(CHAVE)) || {} : {};
  return {lista: dados.lista || [], ocultos: dados.ocultos || []};
}

/**
 * Guarda (ou atualiza) o login que acabou de dar certo.
 * @param {string} cf Conferência.
 * @param {string} email
 * @param {string} senha
 * @param {string} nome nome_exibicao do perfil.
 */
export async function lembrarLogin(cf, email, senha, nome) {
  if (!LOGINS_DEV_ATIVOS || !cf || !email || !senha) {
    return;
  }
  const normalizado = email.trim().toLowerCase();
  const {lista, ocultos} = await guardado();
  const outros = lista.filter((l) => !(l.cf === cf && l.email === normalizado));
  outros.push({cf, email: normalizado, senha, nome: nome || '', salvo_em: new Date().toISOString()});
  // Entrou de novo com uma conta do arquivo que estava oculta: ela volta para a lista.
  await db.salvarConfig(CHAVE, {lista: outros, ocultos: ocultos.filter((o) => o !== cf + '|' + normalizado)});
}

/**
 * Contas escritas à mão em dev_local/seguranca/logins_dev.json (pasta fora do git, até do repositório privado).
 * Formato: [{"cf": "SP_SUD_ITA_ICO", "email": "...", "senha": "...", "nome": "Pessoa1"}]. Sem o arquivo, nada.
 * @return {Promise<!Array<{cf: string, email: string, senha: string, nome: string}>>}
 */
async function doArquivo() {
  try {
    const resposta = await fetch(new URL('../../dev_local/seguranca/logins_dev.json', import.meta.url), {cache: 'no-store'});
    const lista = resposta.ok ? await resposta.json() : [];
    return (Array.isArray(lista) ? lista : []).filter((l) => l && l.cf && l.email && l.senha)
        .map((l) => ({cf: String(l.cf).toUpperCase(), email: String(l.email).trim().toLowerCase(), senha: String(l.senha),
          nome: String(l.nome || '')}));
  } catch (erro) {
    return [];
  }
}

/**
 * @param {string} cf
 * @return {Promise<!Array<{email: string, senha: string, nome: string}>>} Os logins desta conferência, por e-mail.
 *     Os do arquivo valem mais que os lembrados (se a senha mudou no arquivo, vale a do arquivo).
 */
export async function loginsDaConferencia(cf) {
  if (!LOGINS_DEV_ATIVOS) {
    return [];
  }
  const {lista, ocultos} = await guardado();
  const doArquivoVisiveis = (await doArquivo()).filter((l) => !ocultos.includes(l.cf + '|' + l.email));
  const porEmail = {};
  lista.concat(doArquivoVisiveis).filter((l) => l.cf === cf).forEach((l) => {
    porEmail[l.email] = l;
  });
  return Object.values(porEmail).sort((a, b) => a.email.localeCompare(b.email));
}

/**
 * Apaga os logins lembrados e esconde os do arquivo (o arquivo não muda). Uma conta do arquivo volta
 * quando alguém entra com ela de novo.
 */
export async function esquecerLogins() {
  const ocultos = (await doArquivo()).map((l) => l.cf + '|' + l.email);
  await db.salvarConfig(CHAVE, {lista: [], ocultos});
}
