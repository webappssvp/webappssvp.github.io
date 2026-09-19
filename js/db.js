/**
 * @fileoverview Módulo de Persistência Local via IndexedDB (Versão 3.0).
 * Responsável pelo armazenamento offline-first das 9 tabelas canônicas da conferência,
 * credenciais de sessão e fila de sincronização sob demanda.
 * Conformidade com: dev/padroes/02_javascript_google.md e dev/padroes/04_pwa_e_performance.md
 */

const DB_NAME = 'webappssvp_db';
const DB_VERSION = 3;

// Nomes Canônicos dos Object Stores (9 Abas + Sessão + Fila)
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

      // 2. Pessoas (PK: id_pessoa, Chave Natural: cpf)
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
        storeVisitas.createIndex('idx_status_sinc', 'status_sincronizacao', { unique: false });
      }

      // 4. Participantes da Visita (PK: id_participacao, Relação N:N 3NF)
      if (!db.objectStoreNames.contains(STORES.VISITAS_PARTICIPANTES)) {
        const storeParticipantes = db.createObjectStore(STORES.VISITAS_PARTICIPANTES, { keyPath: 'id_participacao' });
        storeParticipantes.createIndex('idx_visita', 'id_visita', { unique: false });
        storeParticipantes.createIndex('idx_pessoa', 'id_pessoa', { unique: false });
      }

      // 5. Plano de Promoção e Metas Fraternas (PK: id_meta)
      if (!db.objectStoreNames.contains(STORES.PLANO_PROMOCAO)) {
        const storePlano = db.createObjectStore(STORES.PLANO_PROMOCAO, { keyPath: 'id_meta' });
        storePlano.createIndex('idx_familia', 'id_familia', { unique: false });
        storePlano.createIndex('idx_pessoa', 'id_pessoa', { unique: false });
        storePlano.createIndex('idx_status', 'status_meta', { unique: false });
      }

      // 6. Papéis das Pessoas (PK: id_registro)
      if (!db.objectStoreNames.contains(STORES.PESSOAS_PAPEIS)) {
        const storePapeis = db.createObjectStore(STORES.PESSOAS_PAPEIS, { keyPath: 'id_registro' });
        storePapeis.createIndex('idx_pessoa', 'id_pessoa', { unique: false });
        storePapeis.createIndex('idx_papel', 'papel', { unique: false });
      }

      // 7. Cargos da Diretoria (PK: id_registro)
      if (!db.objectStoreNames.contains(STORES.PESSOAS_CARGOS)) {
        const storeCargos = db.createObjectStore(STORES.PESSOAS_CARGOS, { keyPath: 'id_registro' });
        storeCargos.createIndex('idx_pessoa', 'id_pessoa', { unique: false });
        storeCargos.createIndex('idx_cargo', 'cargo', { unique: false });
      }

      // 8. Histórico e Linha do Tempo (PK: id_historico)
      if (!db.objectStoreNames.contains(STORES.PESSOAS_HISTORICO)) {
        const storeHistorico = db.createObjectStore(STORES.PESSOAS_HISTORICO, { keyPath: 'id_historico' });
        storeHistorico.createIndex('idx_pessoa', 'id_pessoa', { unique: false });
        storeHistorico.createIndex('idx_data_registro', 'data_registro', { unique: false });
      }

      // 9. Fila de Sincronização Sob Demanda (PK auto-increment: id_fila)
      if (!db.objectStoreNames.contains(STORES.FILA_SINCRONIZACAO)) {
        const storeFila = db.createObjectStore(STORES.FILA_SINCRONIZACAO, { keyPath: 'id_fila', autoIncrement: true });
        storeFila.createIndex('idx_tabela', 'tabela', { unique: false });
        storeFila.createIndex('idx_status', 'status', { unique: false });
        storeFila.createIndex('idx_criado_em', 'criado_em', { unique: false });
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
      const transacao = db.transaction(STORES.CONFIG_CONFERENCIA, 'readwrite');
      const store = transacao.objectStore(STORES.CONFIG_CONFERENCIA);
      const requisicao = store.put({ chave: CHAVE_CONFERENCIA_ATUAL, ...dados });

      requisicao.onsuccess = () => resolve();
      requisicao.onerror = () => reject(new Error(`Erro ao salvar sessão: ${requisicao.error?.message}`));
    });
  } catch (erro) {
    console.warn('[IndexedDB] Aviso ao salvar sessão no IndexedDB:', erro);
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
      const transacao = db.transaction(STORES.CONFIG_CONFERENCIA, 'readonly');
      const store = transacao.objectStore(STORES.CONFIG_CONFERENCIA);
      const requisicao = store.get(CHAVE_CONFERENCIA_ATUAL);

      requisicao.onsuccess = () => resolve(requisicao.result || null);
      requisicao.onerror = () => reject(new Error(`Erro ao ler sessão: ${requisicao.error?.message}`));
    });
  } catch (erro) {
    console.warn('[IndexedDB] Falha na leitura de sessão do IndexedDB:', erro);
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
      const transacao = db.transaction(STORES.CONFIG_CONFERENCIA, 'readwrite');
      const store = transacao.objectStore(STORES.CONFIG_CONFERENCIA);
      const requisicao = store.delete(CHAVE_CONFERENCIA_ATUAL);

      requisicao.onsuccess = () => resolve();
      requisicao.onerror = () => reject(new Error(`Erro ao limpar sessão: ${requisicao.error?.message}`));
    });
  } catch (erro) {
    console.warn('[IndexedDB] Aviso ao limpar sessão do IndexedDB:', erro);
  }
}

/**
 * Salva um único registro em um store especificado.
 * @param {string} storeName Nome do object store.
 * @param {Object} item Dados a serem persistidos.
 * @return {Promise<any>} Chave gerada ou persistida.
 */
export async function salvarItem(storeName, item) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transacao = db.transaction(storeName, 'readwrite');
    const store = transacao.objectStore(storeName);
    const requisicao = store.put(item);

    requisicao.onsuccess = () => resolve(requisicao.result);
    requisicao.onerror = () => reject(new Error(`Erro ao salvar no store ${storeName}: ${requisicao.error?.message}`));
  });
}

/**
 * Salva múltiplos registros em lote (batch) em um store especificado.
 * @param {string} storeName Nome do object store.
 * @param {Array<Object>} registros Lista de objetos a serem salvos.
 * @return {Promise<number>} Quantidade de registros persistidos com sucesso.
 */
export async function salvarRegistrosLote(storeName, registros) {
  if (!Array.isArray(registros) || registros.length === 0) {
    return 0;
  }

  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transacao = db.transaction(storeName, 'readwrite');
    const store = transacao.objectStore(storeName);
    let inseridos = 0;

    registros.forEach((registro) => {
      store.put(registro);
      inseridos++;
    });

    transacao.oncomplete = () => resolve(inseridos);
    transacao.onerror = () => reject(new Error(`Erro no salvamento em lote em ${storeName}: ${transacao.error?.message}`));
  });
}

/**
 * Recupera todos os registros de um object store.
 * @param {string} storeName Nome do object store.
 * @return {Promise<Array<Object>>} Lista de registros recuperados.
 */
export async function obterTodos(storeName) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transacao = db.transaction(storeName, 'readonly');
    const store = transacao.objectStore(storeName);
    const requisicao = store.getAll();

    requisicao.onsuccess = () => resolve(requisicao.result || []);
    requisicao.onerror = () => reject(new Error(`Erro ao buscar registros de ${storeName}: ${requisicao.error?.message}`));
  });
}

/**
 * Recupera um único registro pela chave primária.
 * @param {string} storeName Nome do object store.
 * @param {string|number} id Chave primária do item.
 * @return {Promise<Object|null>} Registro encontrado ou null.
 */
export async function obterPorId(storeName, id) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transacao = db.transaction(storeName, 'readonly');
    const store = transacao.objectStore(storeName);
    const requisicao = store.get(id);

    requisicao.onsuccess = () => resolve(requisicao.result || null);
    requisicao.onerror = () => reject(new Error(`Erro ao buscar ${id} em ${storeName}: ${requisicao.error?.message}`));
  });
}

/**
 * Recupera registros através de um índice secundário.
 * @param {string} storeName Nome do object store.
 * @param {string} indexName Nome do índice cadastrado.
 * @param {any} valor Valor pesquisado no índice.
 * @return {Promise<Array<Object>>} Lista de registros que coincidem.
 */
export async function obterPorIndice(storeName, indexName, valor) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transacao = db.transaction(storeName, 'readonly');
    const store = transacao.objectStore(storeName);

    if (!store.indexNames.contains(indexName)) {
      reject(new Error(`Índice ${indexName} não existe em ${storeName}.`));
      return;
    }

    const indice = store.index(indexName);
    const requisicao = indice.getAll(valor);

    requisicao.onsuccess = () => resolve(requisicao.result || []);
    requisicao.onerror = () => reject(new Error(`Erro ao consultar índice ${indexName}: ${requisicao.error?.message}`));
  });
}

/**
 * Remove todos os dados de um object store específico.
 * @param {string} storeName Nome do object store a ser limpo.
 * @return {Promise<void>}
 */
export async function limparStore(storeName) {
  const db = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transacao = db.transaction(storeName, 'readwrite');
    const store = transacao.objectStore(storeName);
    const requisicao = store.clear();

    requisicao.onsuccess = () => resolve();
    requisicao.onerror = () => reject(new Error(`Erro ao limpar ${storeName}: ${requisicao.error?.message}`));
  });
}

/**
 * Enfileira uma operação na fila de sincronização sob demanda (offline-first).
 * @param {string} tabela Nome canônico da tabela de destino no Google Sheets.
 * @param {'INSERIR'|'ATUALIZAR'|'EXCLUIR'} operacao Tipo de mutação.
 * @param {Object} dados Payload dos dados afetados.
 * @return {Promise<number>} ID gerado na fila.
 */
export async function enfileirarSincronizacao(tabela, operacao, dados) {
  const itemFila = {
    tabela: tabela,
    operacao: operacao,
    dados: dados,
    status: 'pendente',
    tentativas: 0,
    criado_em: new Date().toISOString(),
    sincronizado_em: null,
    ultimo_erro: null
  };

  return await salvarItem(STORES.FILA_SINCRONIZACAO, itemFila);
}

/**
 * Retorna todos os itens pendentes na fila de sincronização.
 * @return {Promise<Array<Object>>}
 */
export async function obterFilaPendente() {
  return await obterPorIndice(STORES.FILA_SINCRONIZACAO, 'idx_status', 'pendente');
}

/**
 * Marca um item da fila de sincronização como concluído com sucesso.
 * @param {number} idFila Chave primária da fila.
 * @return {Promise<void>}
 */
export async function marcarComoSincronizado(idFila) {
  const item = await obterPorId(STORES.FILA_SINCRONIZACAO, idFila);
  if (item) {
    item.status = 'sincronizado';
    item.sincronizado_em = new Date().toISOString();
    await salvarItem(STORES.FILA_SINCRONIZACAO, item);
  }
}

/**
 * Carrega o cenário completo de testes de 4 semanas no IndexedDB local.
 * Popula todas as entidades (Famílias, Pessoas, Visitas, Participantes, Metas, Papéis e Cargos).
 * @return {Promise<{sucesso: boolean, totalItens: number}>}
 */
export async function carregarCenarioTesteLocal() {
  const cfa = 'SPSDITIC'; // Código canônico de 8 caracteres da Conferência Santa Dulce dos Pobres

  const familias = [
    {
      id_familia: `${cfa}FM0001`,
      nome_responsavel: 'Neuza Pereira dos Santos',
      endereco: 'Rua das Flores, 120',
      bairro: 'Vila Esperança',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '03690-010',
      telefone: '(11) 98765-4321',
      status: 'ativa',
      data_abertura: '2026-08-01',
      data_encerramento: '',
      motivo_encerramento: '',
      observacoes: 'Dona Neuza mora com seu neto Lucas (7 anos). Hipertensa, necessita de acompanhamento contínuo.'
    },
    {
      id_familia: `${cfa}FM0002`,
      nome_responsavel: 'Antônio Bezerra',
      endereco: 'Av. dos Ipês, 450',
      bairro: 'Jardim Progresso',
      cidade: 'São Paulo',
      uf: 'SP',
      cep: '03692-040',
      telefone: '(11) 91234-5678',
      status: 'ativa',
      data_abertura: '2026-08-10',
      data_encerramento: '',
      motivo_encerramento: '',
      observacoes: 'Casal de idosos com sequelas de AVC. Casa necessita de melhorias de acessibilidade.'
    }
  ];

  const pessoas = [
    // Família 1 - Dona Neuza
    {
      id_pessoa: `${cfa}PS0001`,
      id_familia: `${cfa}FM0001`,
      nome_completo: 'Neuza Pereira dos Santos',
      data_nascimento: '1962-05-14',
      cpf: '123.456.789-01',
      parentesco: 'Titular',
      telefone: '(11) 98765-4321',
      status_cadastro: 'ativo',
      observacoes: 'Acolhida com amor fraterno. Cuida do neto com dedicação.'
    },
    {
      id_pessoa: `${cfa}PS0002`,
      id_familia: `${cfa}FM0001`,
      nome_completo: 'Lucas Pereira dos Santos',
      data_nascimento: '2019-03-22',
      cpf: '234.567.890-12',
      parentesco: 'Neto',
      telefone: '',
      status_cadastro: 'ativo',
      observacoes: 'Estudante da Escola Municipal da Vila Esperança. Muito carinhoso.'
    },
    // Família 2 - Seu Antônio
    {
      id_pessoa: `${cfa}PS0003`,
      id_familia: `${cfa}FM0002`,
      nome_completo: 'Antônio Bezerra',
      data_nascimento: '1955-11-03',
      cpf: '345.678.901-23',
      parentesco: 'Titular',
      telefone: '(11) 91234-5678',
      status_cadastro: 'ativo',
      observacoes: 'Em recuperação de mobilidade após AVC.'
    },
    {
      id_pessoa: `${cfa}PS0004`,
      id_familia: `${cfa}FM0002`,
      nome_completo: 'Tereza Bezerra',
      data_nascimento: '1958-08-20',
      cpf: '456.789.012-34',
      parentesco: 'Esposa',
      telefone: '(11) 91234-5678',
      status_cadastro: 'ativo',
      observacoes: 'Cuidadora dedicada do Sr. Antônio.'
    },
    // Membros Vicentinos e Benfeitores
    {
      id_pessoa: `${cfa}PS0005`,
      id_familia: '',
      nome_completo: 'Paulo Silva',
      data_nascimento: '1980-04-12',
      cpf: '567.890.123-45',
      parentesco: '',
      telefone: '(11) 97777-1111',
      status_cadastro: 'ativo',
      observacoes: 'Presidente da Conferência. Vicentino dedicado.'
    },
    {
      id_pessoa: `${cfa}PS0006`,
      id_familia: '',
      nome_completo: 'Maria Oliveira',
      data_nascimento: '1985-09-25',
      cpf: '678.901.234-56',
      parentesco: '',
      telefone: '(11) 97777-2222',
      status_cadastro: 'ativo',
      observacoes: 'Secretária da Conferência.'
    },
    {
      id_pessoa: `${cfa}PS0007`,
      id_familia: '',
      nome_completo: 'Carlos Eduardo Santos',
      data_nascimento: '1975-01-18',
      cpf: '789.012.345-67',
      parentesco: '',
      telefone: '(11) 97777-3333',
      status_cadastro: 'ativo',
      observacoes: 'Empresário benfeitor e visitante esporádico.'
    }
  ];

  const visitas = [
    {
      id_visita: `${cfa}VS0001`,
      id_familia: `${cfa}FM0001`,
      data_visita: '2026-08-24',
      horario_inicio: '14:30',
      horario_fim: '15:15',
      tipo_visita: 'regular',
      relato_visita: 'Primeira visita do ciclo. Dona Neuza estava com a pressão descontrolada e receosa de ir ao posto sozinha. O neto Lucas estava bem.',
      auxilio_entregue: 'Cesta de alimentos e leite em pó.',
      status_sincronizacao: 'sincronizado'
    },
    {
      id_visita: `${cfa}VS0002`,
      id_familia: `${cfa}FM0001`,
      data_visita: '2026-08-31',
      horario_inicio: '15:00',
      horario_fim: '15:40',
      tipo_visita: 'regular',
      relato_visita: 'Dona Neuza relatou que não conseguiu ir ao posto na semana anterior porque o neto adoeceu e não tinha com quem deixá-lo. Pactuamos pedir apoio à vizinha Rosa.',
      auxilio_entregue: 'Hortifrúti e fraldas infantis.',
      status_sincronizacao: 'sincronizado'
    },
    {
      id_visita: `${cfa}VS0003`,
      id_familia: `${cfa}FM0001`,
      data_visita: '2026-09-07',
      horario_inicio: '14:45',
      horario_fim: '15:30',
      tipo_visita: 'regular',
      relato_visita: 'Vitória fraterna celebrada! Dona Neuza deixou Lucas com a vizinha Rosa na terça-feira e conseguiu marcar a consulta cardiológica para o dia 22/09. Muito alegre e motivada.',
      auxilio_entregue: 'Cesta básica mensal e kit de higiene.',
      status_sincronizacao: 'sincronizado'
    },
    {
      id_visita: `${cfa}VS0004`,
      id_familia: `${cfa}FM0002`,
      data_visita: '2026-09-07',
      horario_inicio: '16:00',
      horario_fim: '16:50',
      tipo_visita: 'regular',
      relato_visita: 'Visita muito especial realizada na companhia do benfeitor Carlos Eduardo. Seu Antônio recebeu a doação de um andador com apoio de braço, facilitando sua locomoção.',
      auxilio_entregue: 'Andador ortopédico semi-novo e cesta básica.',
      status_sincronizacao: 'sincronizado'
    }
  ];

  const participantes = [
    // Visita 1
    { id_participacao: `${cfa}VP0001`, id_visita: `${cfa}VS0001`, id_pessoa: `${cfa}PS0005`, papel_na_visita: 'visitador_titular' },
    { id_participacao: `${cfa}VP0002`, id_visita: `${cfa}VS0001`, id_pessoa: `${cfa}PS0006`, papel_na_visita: 'visitador_acompanhante' },
    // Visita 2
    { id_participacao: `${cfa}VP0003`, id_visita: `${cfa}VS0002`, id_pessoa: `${cfa}PS0005`, papel_na_visita: 'visitador_titular' },
    { id_participacao: `${cfa}VP0004`, id_visita: `${cfa}VS0002`, id_pessoa: `${cfa}PS0006`, papel_na_visita: 'visitador_acompanhante' },
    // Visita 3
    { id_participacao: `${cfa}VP0005`, id_visita: `${cfa}VS0003`, id_pessoa: `${cfa}PS0005`, papel_na_visita: 'visitador_titular' },
    { id_participacao: `${cfa}VP0006`, id_visita: `${cfa}VS0003`, id_pessoa: `${cfa}PS0006`, papel_na_visita: 'visitador_acompanhante' },
    // Visita 4 (com Benfeitor)
    { id_participacao: `${cfa}VP0007`, id_visita: `${cfa}VS0004`, id_pessoa: `${cfa}PS0005`, papel_na_visita: 'visitador_titular' },
    { id_participacao: `${cfa}VP0008`, id_visita: `${cfa}VS0004`, id_pessoa: `${cfa}PS0007`, papel_na_visita: 'benfeitor_convidado' }
  ];

  const metas = [
    {
      id_meta: `${cfa}PL0001`,
      id_familia: `${cfa}FM0001`,
      id_pessoa: `${cfa}PS0001`,
      tipo_registro: 'meta',
      descricao: 'Ir ao posto de saúde na terça-feira marcar consulta com cardiologista',
      prazo_estimado: '2026-09-08',
      status_meta: 'cumprida',
      justificativa_obstaculo: 'Neto adoeceu na semana anterior; obstáculo superado com auxílio da vizinha Rosa.',
      solucao_combinada: 'Vizinha Rosa cuida de Lucas nas manhãs de terça quando necessário.',
      data_conclusao: '2026-09-07',
      observacoes: 'Consulta marcada para 22/09 às 08:30 no Posto de Saúde Central.'
    },
    {
      id_meta: `${cfa}PL0002`,
      id_familia: `${cfa}FM0001`,
      id_pessoa: `${cfa}PS0001`,
      tipo_registro: 'micro_habito',
      descricao: 'Fazer caminhada leve de 15 minutos 3 vezes por semana pela manhã com Lucas',
      prazo_estimado: '2026-09-30',
      status_meta: 'em_andamento',
      justificativa_obstaculo: '',
      solucao_combinada: '',
      data_conclusao: '',
      observacoes: 'Estimular melhora cardiovascular gradual conforme orientação médica.'
    },
    {
      id_meta: `${cfa}PL0003`,
      id_familia: `${cfa}FM0002`,
      id_pessoa: `${cfa}PS0003`,
      tipo_registro: 'sonho',
      descricao: 'Voltar a caminhar até a pracinha do bairro no domingo sem sentir dor',
      prazo_estimado: '2026-12-25',
      status_meta: 'em_andamento',
      justificativa_obstaculo: '',
      solucao_combinada: 'Fisioterapia domiciliar quinzenal e uso do andador ortopédico doado.',
      data_conclusao: '',
      observacoes: 'Sonho familiar compartilhado por Dona Tereza.'
    }
  ];

  const papeis = [
    { id_registro: `${cfa}PR0001`, id_pessoa: `${cfa}PS0001`, papel: 'as', data_inicio: '2026-08-01', data_fim: '', observacoes: 'Assistida regular' },
    { id_registro: `${cfa}PR0002`, id_pessoa: `${cfa}PS0002`, papel: 'as', data_inicio: '2026-08-01', data_fim: '', observacoes: 'Dependente familiar' },
    { id_registro: `${cfa}PR0003`, id_pessoa: `${cfa}PS0003`, papel: 'as', data_inicio: '2026-08-10', data_fim: '', observacoes: 'Assistido em recuperação' },
    { id_registro: `${cfa}PR0004`, id_pessoa: `${cfa}PS0004`, papel: 'as', data_inicio: '2026-08-10', data_fim: '', observacoes: 'Esposa e cuidadora' },
    { id_registro: `${cfa}PR0005`, id_pessoa: `${cfa}PS0005`, papel: 'vc', data_inicio: '2020-02-15', data_fim: '', observacoes: 'Confrade ativo' },
    { id_registro: `${cfa}PR0006`, id_pessoa: `${cfa}PS0006`, papel: 'vc', data_inicio: '2022-06-10', data_fim: '', observacoes: 'Consócia ativa' },
    { id_registro: `${cfa}PR0007`, id_pessoa: `${cfa}PS0007`, papel: 'bf', data_inicio: '2024-01-20', data_fim: '', observacoes: 'Benfeitor parceiro' }
  ];

  const cargos = [
    { id_registro: `${cfa}CG0001`, id_pessoa: `${cfa}PS0005`, cargo: 'pr', data_inicio: '2025-01-01', data_fim: '', observacoes: 'Presidente eleito' },
    { id_registro: `${cfa}CG0002`, id_pessoa: `${cfa}PS0006`, cargo: 'sc', data_inicio: '2025-01-01', data_fim: '', observacoes: 'Secretária empossada' }
  ];

  let total = 0;
  total += await salvarRegistrosLote(STORES.FAMILIAS, familias);
  total += await salvarRegistrosLote(STORES.PESSOAS, pessoas);
  total += await salvarRegistrosLote(STORES.VISITAS, visitas);
  total += await salvarRegistrosLote(STORES.VISITAS_PARTICIPANTES, participantes);
  total += await salvarRegistrosLote(STORES.PLANO_PROMOCAO, metas);
  total += await salvarRegistrosLote(STORES.PESSOAS_PAPEIS, papeis);
  total += await salvarRegistrosLote(STORES.PESSOAS_CARGOS, cargos);

  // Também persiste a sessão ativa na conferência modelo
  await salvarSessao({
    conselho_metropolitano: 'São Paulo',
    id_cc: 'SPCC',
    nome_cc: 'Conselho Central São Paulo',
    id_cp: 'SPCP',
    nome_cp: 'Conselho Particular São Paulo',
    id_ssvp: 'SPSDITIC',
    nome_cf: 'Conferência Santa Dulce dos Pobres',
    nome_pessoa: 'Paulo Silva',
    email_pessoa: 'paulo.vicentino@ssvpbrasil.org.br',
    conectado: true
  });

  return { sucesso: true, totalItens: total };
}
