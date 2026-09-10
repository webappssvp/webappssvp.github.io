/**
 * @fileoverview Módulo de Persistência Local via IndexedDB.
 * Responsável por armazenar, recuperar e limpar a conferência ativa e credenciais da sessão.
 * Conformidade com: dev/padroes/02_javascript_google.md
 */

const DB_NAME = 'webappssvp_db';
const DB_VERSION = 1;
const STORE_NAME = 'config_conferencia';
const CHAVE_CONFERENCIA_ATUAL = 'conferencia_atual';

/**
 * Abre a conexão com o banco de dados IndexedDB.
 * @return {Promise<IDBDatabase>} Instância ativa do IndexedDB.
 */
export function abrirBanco() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB não é suportado neste navegador.'));
      return;
    }

    const requisicao = indexedDB.open(DB_NAME, DB_VERSION);

    requisicao.onupgradeneeded = (evento) => {
      const db = /** @type {IDBOpenDBRequest} */ (evento.target).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'chave' });
      }
    };

    requisicao.onsuccess = () => {
      resolve(requisicao.result);
    };

    requisicao.onerror = () => {
      reject(new Error(`Falha ao abrir IndexedDB: ${requisicao.error?.message}`));
    };
  });
}

/**
 * Inicializa o banco de dados IndexedDB no carregamento do App.
 * @return {Promise<boolean>} Retorna true se disponível ou false se indisponível.
 */
export async function inicializarBanco() {
  try {
    await abrirBanco();
    return true;
  } catch (erro) {
    console.warn('[IndexedDB] Armazenamento offline indisponível, operando em memória:', erro);
    return false;
  }
}

/**
 * Salva ou atualiza os dados da sessão/conferência ativa no IndexedDB.
 * @param {Object} dados Objeto com as informações da conferência e vicentino.
 * @return {Promise<void>}
 */
export async function salvarSessao(dados) {
  try {
    const db = await abrirBanco();
    return new Promise((resolve, reject) => {
      const transacao = db.transaction(STORE_NAME, 'readwrite');
      const store = transacao.objectStore(STORE_NAME);
      const requisicao = store.put({ chave: CHAVE_CONFERENCIA_ATUAL, ...dados });

      requisicao.onsuccess = () => resolve();
      requisicao.onerror = () => reject(new Error(`Erro ao salvar sessão: ${requisicao.error?.message}`));
    });
  } catch (erro) {
    console.warn('[IndexedDB] Aviso ao salvar no IndexedDB:', erro);
  }
}

/**
 * Recupera os dados da sessão/conferência ativa do IndexedDB.
 * @return {Promise<Object|null>} Dados recuperados ou null se não houver registro.
 */
export async function lerSessao() {
  try {
    const db = await abrirBanco();
    return new Promise((resolve, reject) => {
      const transacao = db.transaction(STORE_NAME, 'readonly');
      const store = transacao.objectStore(STORE_NAME);
      const requisicao = store.get(CHAVE_CONFERENCIA_ATUAL);

      requisicao.onsuccess = () => resolve(requisicao.result || null);
      requisicao.onerror = () => reject(new Error(`Erro ao ler sessão: ${requisicao.error?.message}`));
    });
  } catch (erro) {
    console.warn('[IndexedDB] Falha na leitura do IndexedDB:', erro);
    return null;
  }
}

/**
 * Remove a conferência ativa do IndexedDB (Logout).
 * @return {Promise<void>}
 */
export async function limparSessao() {
  try {
    const db = await abrirBanco();
    return new Promise((resolve, reject) => {
      const transacao = db.transaction(STORE_NAME, 'readwrite');
      const store = transacao.objectStore(STORE_NAME);
      const requisicao = store.delete(CHAVE_CONFERENCIA_ATUAL);

      requisicao.onsuccess = () => resolve();
      requisicao.onerror = () => reject(new Error(`Erro ao limpar sessão: ${requisicao.error?.message}`));
    });
  } catch (erro) {
    console.warn('[IndexedDB] Aviso ao limpar sessão do IndexedDB:', erro);
  }
}
