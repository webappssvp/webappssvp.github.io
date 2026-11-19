/**
 * @fileoverview Cofre dos dados guardados para usar sem internet (decisão de 14/11/2026,
 * mvp/telas/05_sincronizacao.md): os detalhes das pessoas ficam cifrados no IndexedDB, com a senha do login.
 *
 * - Ao entrar (a senha está na mão), a senha vira uma chave com PBKDF2-SHA-256 (ITERACOES rodadas, sal aleatório
 *   da conferência). Essa chave só embrulha a chave dos dados (AES-256-GCM, aleatória). A senha não é guardada.
 * - Guardado na store config, por conferência ("cofre:<id>"): o sal, as rodadas e a chave dos dados embrulhada.
 * - Aberto, o cofre deixa a chave dos dados na memória (CryptoKey que não pode ser exportada) e a **lembra por
 *   LEMBRAR_HORAS** (decisão de 14/11/2026): fica no IndexedDB ("cofre_lembrado:<id>"), ainda sem poder ser
 *   exportada, para o app reaberto no mesmo dia não pedir a senha. Passado o prazo, ou no Sair, é esquecida.
 * - Depois do prazo, sem internet, abrir pede a senha de novo. Senha errada: a chave não desembrulha e nada é lido.
 * - Senha trocada (o login com a senha nova não abre o cofre antigo): o cofre e os dados guardados são refeitos.
 * - Tranca (19/11/2026, trava.js): a chave lembrada fica embrulhada pela chave do desenho ou do PIN. Sem tranca
 *   aberta, a chave não é lembrada no banco: fica na memória esperando a tranca ser criada (lembrarPendentes).
 *   A lembrada do formato anterior (sem tranca) é esquecida: sem internet, a senha é pedida uma vez.
 */

import * as db from './db.js';
import * as trava from './trava.js';

/** OWASP 2023 para PBKDF2-SHA-256. Em celulares antigos leva cerca de 1 s, uma vez por uso. */
const ITERACOES = 600000;

/** @param {string} cf @return {string} */
const chaveDoCofre = (cf) => 'cofre:' + cf;

/** Quanto tempo a chave fica lembrada depois de digitar a senha: um dia de visitas. */
const LEMBRAR_HORAS = 12;

/** @param {string} cf @return {string} */
const chaveLembrada = (cf) => 'cofre_lembrado:' + cf;

/** Chaves (que podem ser exportadas) esperando a tranca ser criada para serem lembradas. @type {!Object<string, !CryptoKey>} */
const pendentes = {};

/**
 * Guarda a chave aberta por LEMBRAR_HORAS (a partir de agora; usar não renova), embrulhada pela tranca.
 * @param {string} cf
 * @param {!CryptoKey} exportavel A mesma chave dos dados, que pode ser exportada (só para embrulhar).
 */
async function lembrar(cf, exportavel) {
  if (!trava.aberta()) {
    pendentes[cf] = exportavel;
    return;
  }
  delete pendentes[cf];
  try {
    const embrulho = await trava.embrulhar(exportavel);
    await db.salvarConfig(chaveLembrada(cf), {...embrulho, ate: Date.now() + LEMBRAR_HORAS * 3600 * 1000});
  } catch (erro) {
    // sem guardar: pede a senha a cada abertura sem internet
  }
}

/** A tranca acabou de ser criada ou aberta: lembra as chaves que esperavam por ela. */
export async function lembrarPendentes() {
  await Promise.all(Object.keys(pendentes).map((cf) => lembrar(cf, pendentes[cf])));
}

/**
 * App reaberto: volta a chave lembrada, se ainda está no prazo; senão, esquece.
 * @param {string} cf
 * @return {!Promise<boolean>} Se o cofre ficou aberto.
 */
export async function restaurar(cf) {
  if (abertas[cf]) {
    return true;
  }
  const lembrada = await db.lerConfig(chaveLembrada(cf));
  if (lembrada && lembrada.embrulhada && lembrada.ate > Date.now()) {
    const chave = await trava.desembrulhar(lembrada);
    if (chave) {
      abertas[cf] = chave;
      return true;
    }
  }
  if (lembrada) {
    await db.apagarConfig(chaveLembrada(cf));
  }
  return false;
}

/** Chaves dos dados abertas nesta execução do app, por conferência. @type {!Object<string, !CryptoKey>} */
const abertas = {};

/**
 * @param {string} senha
 * @param {!Uint8Array} sal
 * @param {number} iteracoes
 * @return {!Promise<!CryptoKey>} Chave que embrulha a chave dos dados.
 */
async function chaveDaSenha(senha, sal, iteracoes) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name: 'PBKDF2', salt: sal, iterations: iteracoes, hash: 'SHA-256'}, base,
      {name: 'AES-GCM', length: 256}, false, ['wrapKey', 'unwrapKey']);
}

/** @param {string} cf @return {boolean} A chave desta conferência está na memória. */
export function aberto(cf) {
  return Boolean(abertas[cf]);
}

/** @param {string} cf @return {!Promise<boolean>} Há cofre (e talvez dados guardados) desta conferência. */
export async function existe(cf) {
  return Boolean(await db.lerConfig(chaveDoCofre(cf)));
}

/**
 * Abre o cofre com a senha.
 * @param {string} cf
 * @param {string} senha
 * @param {{criar: boolean}} opcoes criar: no login (a senha acabou de ser conferida pelo servidor). Cria o cofre
 *     se não há; se a senha não abre o antigo (foi trocada), refaz o cofre e apaga os dados guardados.
 * @return {!Promise<boolean>} false: senha não confere (só sem criar) ou não há cofre.
 */
export async function abrir(cf, senha, opcoes) {
  const guardado = await db.lerConfig(chaveDoCofre(cf));
  if (guardado) {
    try {
      const chave = await chaveDaSenha(senha, new Uint8Array(guardado.sal), guardado.iteracoes);
      const desembrulhar = (exportavel) => crypto.subtle.unwrapKey('raw', guardado.embrulhada, chave,
          {name: 'AES-GCM', iv: new Uint8Array(guardado.iv)}, {name: 'AES-GCM', length: 256}, exportavel,
          ['encrypt', 'decrypt']);
      abertas[cf] = await desembrulhar(false);
      await lembrar(cf, await desembrulhar(true));
      return true;
    } catch (erro) {
      if (!opcoes.criar) {
        return false; // senha errada
      }
      await apagar(cf); // senha trocada: o que estava guardado não abre mais
    }
  } else if (!opcoes.criar) {
    return false;
  }
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chave = await chaveDaSenha(senha, sal, ITERACOES);
  const dados = await crypto.subtle.generateKey({name: 'AES-GCM', length: 256}, true, ['encrypt', 'decrypt']);
  const embrulhada = await crypto.subtle.wrapKey('raw', dados, chave, {name: 'AES-GCM', iv});
  await db.salvarConfig(chaveDoCofre(cf), {sal: Array.from(sal), iv: Array.from(iv), iteracoes: ITERACOES, embrulhada});
  // Na memória, a mesma chave sem poder ser exportada.
  abertas[cf] = await crypto.subtle.unwrapKey('raw', embrulhada, chave, {name: 'AES-GCM', iv},
      {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
  await lembrar(cf, dados);
  return true;
}

/**
 * @param {string} cf
 * @param {*} valor Qualquer coisa que vire JSON.
 * @return {!Promise<{iv: !Uint8Array, cifrado: !ArrayBuffer}>}
 */
export async function cifrar(cf, valor) {
  const chave = abertas[cf];
  if (!chave) {
    throw new Error('Cofre fechado.');
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, chave, new TextEncoder().encode(JSON.stringify(valor)));
  return {iv, cifrado};
}

/**
 * @param {string} cf
 * @param {{iv: !Uint8Array, cifrado: !ArrayBuffer}} registro
 * @return {!Promise<*>} O valor, ou null se não abre.
 */
export async function decifrar(cf, registro) {
  const chave = abertas[cf];
  if (!chave || !registro) {
    return null;
  }
  try {
    const claro = await crypto.subtle.decrypt({name: 'AES-GCM', iv: registro.iv}, chave, registro.cifrado);
    return JSON.parse(new TextDecoder().decode(claro));
  } catch (erro) {
    return null;
  }
}

/** Esquece a chave e apaga o cofre e os dados guardados da conferência (Sair, sessão vencida). @param {string} cf */
export async function apagar(cf) {
  delete abertas[cf];
  delete pendentes[cf];
  await db.apagarConfig(chaveDoCofre(cf));
  await db.apagarConfig(chaveLembrada(cf));
  await db.apagarConfig('detalhes_baixados:' + cf);
  await db.apagarConfig('detalhes_desde:' + cf);
  await db.apagarConfig('detalhes_versao:' + cf);
  try {
    await db.substituirDaConferencia(db.STORES.DETALHES, cf, []);
    await db.substituirDaConferencia(db.STORES.DETALHES_FAMILIAS, cf, []);
  } catch (erro) {
    // banco indisponível: nada a apagar
  }
}
