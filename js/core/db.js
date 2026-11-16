/**
 * @fileoverview Banco local do app (IndexedDB).
 * - config: escolha da conferência, sessões, lista de conferências e preferências.
 * - pessoas: a lista da tela Pessoas, um registro por pessoa (chave "<conferência>|<id>"), como veio do servidor.
 * - fila: o que foi gravado no celular e ainda não foi confirmado pelo servidor (js/core/sync.js).
 * - detalhes: os detalhes de cada pessoa para usar sem internet, cifrados com a senha (js/core/cofre.js).
 * - familias: a lista da tela Famílias, sem cifra; detalhes_familias: endereço e moradores, cifrados.
 * Decisões: mvp/telas/05_sincronizacao.md (uma store por tela; 14/11/2026).
 *
 * O nome é diferente do banco dos protótipos (webappssvp_db) de propósito: no localhost os dois
 * dividem a mesma origem, e um não pode mudar a estrutura do outro.
 */

const NOME_BANCO = 'ssvp_app';
const VERSAO_BANCO = 4;
const STORE_CONFIG = 'config';

/** Stores com um registro por item, todas com o índice "conferencia". */
export const STORES = {PESSOAS: 'pessoas', FILA: 'fila', DETALHES: 'detalhes', FAMILIAS: 'familias',
  DETALHES_FAMILIAS: 'detalhes_familias'};
const CHAVES = {pessoas: 'chave', fila: 'id_operacao', detalhes: 'chave', familias: 'chave', detalhes_familias: 'chave'};

/** @type {?Promise<!IDBDatabase>} */
let conexao = null;

/** @return {!Promise<!IDBDatabase>} */
function abrirBanco() {
  if (!conexao) {
    conexao = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('Este navegador não guarda dados no aparelho (IndexedDB).'));
        return;
      }
      const pedido = indexedDB.open(NOME_BANCO, VERSAO_BANCO);
      pedido.onupgradeneeded = () => {
        const db = pedido.result;
        if (!db.objectStoreNames.contains(STORE_CONFIG)) {
          db.createObjectStore(STORE_CONFIG, {keyPath: 'chave'});
        }
        Object.keys(CHAVES).forEach((nome) => {
          if (!db.objectStoreNames.contains(nome)) {
            db.createObjectStore(nome, {keyPath: CHAVES[nome]}).createIndex('conferencia', 'conferencia');
          }
        });
      };
      pedido.onsuccess = () => {
        const db = pedido.result;
        // Outra aba abriu uma versão nova do banco: fecha esta conexão para não travar a atualização.
        db.onversionchange = () => {
          db.close();
          conexao = null;
        };
        resolve(db);
      };
      pedido.onerror = () => reject(pedido.error);
      // Outra aba aberta com a versão anterior do app segura o banco: sem isto, o app ficaria parado esperando.
      // Avisa (app.js mostra a mensagem) e segue sem o banco; ao fechar a outra aba e recarregar, volta ao normal.
      pedido.onblocked = () => {
        window.dispatchEvent(new CustomEvent('banco-bloqueado'));
        reject(new Error('O app está aberto em outra aba. Feche as outras abas e recarregue esta.'));
      };
    });
    conexao.catch(() => {
      conexao = null;
    });
  }
  return conexao;
}

/**
 * @param {!IDBRequest|!IDBTransaction} alvo
 * @return {!Promise<*>}
 */
function esperar(alvo) {
  return new Promise((resolve, reject) => {
    if (alvo instanceof IDBTransaction) {
      alvo.oncomplete = () => resolve();
      alvo.onerror = () => reject(alvo.error);
      alvo.onabort = () => reject(alvo.error);
    } else {
      alvo.onsuccess = () => resolve(alvo.result);
      alvo.onerror = () => reject(alvo.error);
    }
  });
}

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

/**
 * @param {string} chave
 * @return {!Promise<*>} O valor guardado, ou null.
 */
export async function lerConfig(chave) {
  try {
    const db = await abrirBanco();
    const registro = await esperar(db.transaction(STORE_CONFIG, 'readonly').objectStore(STORE_CONFIG).get(chave));
    return registro ? registro.dados : null;
  } catch (erro) {
    return null;
  }
}

/**
 * @param {string} chave
 * @param {*} dados
 * @return {!Promise<void>}
 */
export async function salvarConfig(chave, dados) {
  const db = await abrirBanco();
  await esperar(db.transaction(STORE_CONFIG, 'readwrite').objectStore(STORE_CONFIG)
      .put({chave: chave, dados: dados, atualizado_em: new Date().toISOString()}));
}

/**
 * @param {string} chave
 * @return {!Promise<void>}
 */
export async function apagarConfig(chave) {
  try {
    const db = await abrirBanco();
    const tx = db.transaction(STORE_CONFIG, 'readwrite');
    tx.objectStore(STORE_CONFIG).delete(chave);
    await esperar(tx);
  } catch (erro) {
    // nada a apagar
  }
}

// ---------------------------------------------------------------------------
// pessoas, fila e detalhes
// ---------------------------------------------------------------------------

/**
 * @param {string} store
 * @param {string} chave
 * @return {!Promise<?Object>} O registro, ou null.
 */
export async function ler(store, chave) {
  try {
    const db = await abrirBanco();
    return (await esperar(db.transaction(store, 'readonly').objectStore(store).get(chave))) || null;
  } catch (erro) {
    return null;
  }
}

/**
 * @param {string} store Uma das STORES.
 * @param {string=} conferencia Sem ela, todos os registros.
 * @return {!Promise<!Array<!Object>>}
 */
export async function listar(store, conferencia) {
  try {
    const db = await abrirBanco();
    const os = db.transaction(store, 'readonly').objectStore(store);
    return await esperar(conferencia ? os.index('conferencia').getAll(conferencia) : os.getAll());
  } catch (erro) {
    return [];
  }
}

/**
 * Grava (ou substitui) registros.
 * @param {string} store
 * @param {!Array<!Object>} registros
 * @return {!Promise<void>}
 */
export async function gravar(store, registros) {
  const db = await abrirBanco();
  const tx = db.transaction(store, 'readwrite');
  registros.forEach((r) => tx.objectStore(store).put(r));
  await esperar(tx);
}

/**
 * @param {string} store
 * @param {!Array<string>} chaves
 * @return {!Promise<void>}
 */
export async function apagar(store, chaves) {
  const db = await abrirBanco();
  const tx = db.transaction(store, 'readwrite');
  chaves.forEach((c) => tx.objectStore(store).delete(c));
  await esperar(tx);
}

/**
 * Troca todos os registros de uma conferência pelos novos, numa transação só.
 * @param {string} store
 * @param {string} conferencia
 * @param {!Array<!Object>} registros
 * @return {!Promise<void>}
 */
export async function substituirDaConferencia(store, conferencia, registros) {
  const db = await abrirBanco();
  const tx = db.transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  const fim = esperar(tx);
  // Dentro do onsuccess (não depois de um await), para a transação não fechar no meio em navegadores antigos.
  os.index('conferencia').getAllKeys(conferencia).onsuccess = (e) => {
    e.target.result.forEach((c) => os.delete(c));
    registros.forEach((r) => os.put(r));
  };
  await fim;
}
