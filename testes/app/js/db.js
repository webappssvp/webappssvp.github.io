/**
 * @fileoverview Módulo de Persistência Local via IndexedDB (Versão 3.0).
 * Armazenamento offline-first das 9 tabelas canônicas da conferência,
 * credenciais de sessão e dados de demonstração para os protótipos de teste.
 * Módulo: testes/app/js/db.js
 * Conformidade com: dev/padroes/02_javascript_google.md e dev/padroes/04_pwa_e_performance.md
 */

const DB_NAME = 'webappssvp_db';
const DB_VERSION = 3;

/**
 * Nomes Canônicos dos Object Stores (9 Abas + Sessão + Fila).
 * @enum {string}
 */
export const STORES = {
  CONFIG_CONFERENCIA: 'config_conferencia',
  FAMILIAS: 'familias',
  PESSOAS: 'pessoas',
  VISITAS: 'visitas',
  VISITAS_PARTICIPANTES: 'visitas_participantes',
  PLANO_PROMOCAO: 'plano_promocao',
  PESSOAS_PAPEIS: 'pessoas_papeis',
  PESSOAS_CARGOS: 'pessoas_cargos',
  PESSOAS_HISTORICO: 'pessoas_historico',
  FILA_SINCRONIZACAO: 'fila_sincronizacao'
};

const CHAVE_CONFERENCIA_ATUAL = 'conferencia_atual';

/**
 * Abre a conexão com o banco de dados IndexedDB e provisiona a estrutura relacional.
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

      // 0. Sessão e Configuração Ativa
      if (!db.objectStoreNames.contains(STORES.CONFIG_CONFERENCIA)) {
        db.createObjectStore(STORES.CONFIG_CONFERENCIA, { keyPath: 'chave' });
      }

      // 1. Famílias Assistidas (PK: id_familia)
      if (!db.objectStoreNames.contains(STORES.FAMILIAS)) {
        const storeFamilias = db.createObjectStore(STORES.FAMILIAS, { keyPath: 'id_familia' });
        storeFamilias.createIndex('idx_status', 'status', { unique: false });
        storeFamilias.createIndex('idx_bairro', 'bairro', { unique: false });
      }

      // 2. Pessoas (PK: id_pessoa)
      if (!db.objectStoreNames.contains(STORES.PESSOAS)) {
        const storePessoas = db.createObjectStore(STORES.PESSOAS, { keyPath: 'id_pessoa' });
        storePessoas.createIndex('idx_familia', 'id_familia', { unique: false });
        storePessoas.createIndex('idx_cpf', 'cpf', { unique: false });
        storePessoas.createIndex('idx_status', 'status_cadastro', { unique: false });
      }

      // 3. Visitas Domiciliares (PK: id_visita)
      if (!db.objectStoreNames.contains(STORES.VISITAS)) {
        const storeVisitas = db.createObjectStore(STORES.VISITAS, { keyPath: 'id_visita' });
        storeVisitas.createIndex('idx_familia', 'id_familia', { unique: false });
        storeVisitas.createIndex('idx_data_visita', 'data_visita', { unique: false });
      }

      // 4. Participantes da Visita (PK: id_participacao)
      if (!db.objectStoreNames.contains(STORES.VISITAS_PARTICIPANTES)) {
        const storeParticipantes = db.createObjectStore(STORES.VISITAS_PARTICIPANTES, { keyPath: 'id_participacao' });
        storeParticipantes.createIndex('idx_visita', 'id_visita', { unique: false });
        storeParticipantes.createIndex('idx_pessoa', 'id_pessoa', { unique: false });
      }

      // 5. Plano de Promoção Humana (PK: id_meta)
      if (!db.objectStoreNames.contains(STORES.PLANO_PROMOCAO)) {
        const storePlano = db.createObjectStore(STORES.PLANO_PROMOCAO, { keyPath: 'id_meta' });
        storePlano.createIndex('idx_familia', 'id_familia', { unique: false });
      }

      // 6. Papéis das Pessoas (PK: id_registro)
      if (!db.objectStoreNames.contains(STORES.PESSOAS_PAPEIS)) {
        const storePapeis = db.createObjectStore(STORES.PESSOAS_PAPEIS, { keyPath: 'id_registro' });
        storePapeis.createIndex('idx_pessoa', 'id_pessoa', { unique: false });
      }

      // 7. Cargos da Diretoria (PK: id_registro)
      if (!db.objectStoreNames.contains(STORES.PESSOAS_CARGOS)) {
        const storeCargos = db.createObjectStore(STORES.PESSOAS_CARGOS, { keyPath: 'id_registro' });
        storeCargos.createIndex('idx_pessoa', 'id_pessoa', { unique: false });
      }

      // 8. Histórico (PK: id_historico)
      if (!db.objectStoreNames.contains(STORES.PESSOAS_HISTORICO)) {
        db.createObjectStore(STORES.PESSOAS_HISTORICO, { keyPath: 'id_historico' });
      }

      // 9. Fila de Sincronização (PK: id_operacao)
      if (!db.objectStoreNames.contains(STORES.FILA_SINCRONIZACAO)) {
        db.createObjectStore(STORES.FILA_SINCRONIZACAO, { keyPath: 'id_operacao' });
      }
    };

    requisicao.onsuccess = () => resolve(requisicao.result);
    requisicao.onerror = () => reject(requisicao.error);
  });
}

/**
 * Salva ou atualiza a sessão ativa da conferência.
 * @param {Object} dados
 * @return {Promise<void>}
 */
export async function salvarSessao(dados) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.CONFIG_CONFERENCIA, 'readwrite');
    const store = tx.objectStore(STORES.CONFIG_CONFERENCIA);
    const req = store.put({ chave: CHAVE_CONFERENCIA_ATUAL, ...dados });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Recupera os dados da sessão ativa.
 * @return {Promise<Object|null>}
 */
export async function lerSessao() {
  const db = await abrirBanco();
  return new Promise((resolve) => {
    const tx = db.transaction(STORES.CONFIG_CONFERENCIA, 'readonly');
    const store = tx.objectStore(STORES.CONFIG_CONFERENCIA);
    const req = store.get(CHAVE_CONFERENCIA_ATUAL);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

/**
 * Limpa a sessão ativa da conferência.
 * @return {Promise<void>}
 */
export async function limparSessao() {
  const db = await abrirBanco();
  return new Promise((resolve) => {
    const tx = db.transaction(STORES.CONFIG_CONFERENCIA, 'readwrite');
    tx.objectStore(STORES.CONFIG_CONFERENCIA).delete(CHAVE_CONFERENCIA_ATUAL);
    tx.oncomplete = () => resolve();
  });
}

/**
 * Retorna todos os registros de uma determinada store.
 * @param {string} storeName
 * @return {Promise<Array<Object>>}
 */
export async function obterTodos(storeName) {
  const db = await abrirBanco();
  return new Promise((resolve) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

/**
 * Salva ou atualiza um registro em uma determinada store.
 * @param {string} storeName
 * @param {Object} item
 * @return {Promise<void>}
 */
export async function salvarRegistro(storeName, item) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(item);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Popula dados iniciais de demonstração de vicentinos se a store estiver vazia.
 * @param {string} idSsvp Código da Conferência (ex: SPCAPAFA).
 * @param {string} nomeCf Nome da Conferência.
 * @return {Promise<void>}
 */
export async function provisionarDadosDemonstracaoVicentinos(idSsvp, nomeCf) {
  const pessoasExistentes = await obterTodos(STORES.PESSOAS);
  const vicentinos = pessoasExistentes.filter((p) => !p.id_familia || p.papel === 'Vicentino');

  if (vicentinos.length > 0) {
    return; // Já existem pessoas cadastradas
  }

  const vicentinosExemplo = [
    {
      id_pessoa: `${idSsvp}_P1`,
      id_ssvp: idSsvp,
      nome_completo: 'Paulo Martins',
      nome_exibicao: 'Paulo Martins',
      email: 'webapp.ssvp+paulo.martins@gmail.com',
      telefone: '(11) 98765-4321',
      cargo: 'Presidente',
      papel: 'Vicentino',
      status_cadastro: 'Ativo'
    },
    {
      id_pessoa: `${idSsvp}_P2`,
      id_ssvp: idSsvp,
      nome_completo: 'Maria Aparecida Souza',
      nome_exibicao: 'Maria Souza',
      email: 'webapp.ssvp+maria.souza@gmail.com',
      telefone: '(11) 98123-4567',
      cargo: 'Vice-Presidente',
      papel: 'Vicentino',
      status_cadastro: 'Ativo'
    },
    {
      id_pessoa: `${idSsvp}_P3`,
      id_ssvp: idSsvp,
      nome_completo: 'José Antônio Ferreira',
      nome_exibicao: 'José Ferreira',
      email: 'webapp.ssvp+jose.ferreira@gmail.com',
      telefone: '(11) 99456-7890',
      cargo: 'Tesoureiro',
      papel: 'Vicentino',
      status_cadastro: 'Ativo'
    },
    {
      id_pessoa: `${idSsvp}_P4`,
      id_ssvp: idSsvp,
      nome_completo: 'Ana Paula Ribeiro',
      nome_exibicao: 'Ana Paula',
      email: 'webapp.ssvp+ana.ribeiro@gmail.com',
      telefone: '(11) 97321-6549',
      cargo: 'Secretária',
      papel: 'Vicentino',
      status_cadastro: 'Ativo'
    }
  ];

  for (const v of vicentinosExemplo) {
    await salvarRegistro(STORES.PESSOAS, v);
  }
}
