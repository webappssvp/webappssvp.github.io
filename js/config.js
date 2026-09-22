/**
 * @fileoverview Módulo de Configurações Globais e Acessibilidade M3 (t3_navegacao e t5_barras_e_ajuda).
 * Gerencia a Gaveta Inferior (Bottom Sheet), temas (Modo Escuro / Claro),
 * acessibilidade para idosos (Fonte Grande, Redução de Animações),
 * simulação de daltonismo (WCAG 1.4.1), feedbacks táteis (Vibração) e
 * sonoros (Web Audio API), e persistência local no IndexedDB.
 * Conformidade estrita com: dev/padroes/02_javascript_google.md e dev/padroes/05_acessibilidade_ergonomia.md
 */

import { abrirBanco, STORES, lerSessao } from './db.js';

const CHAVE_CONFIG = 'preferencias_usuario';
const STORAGE_KEY = 'webappssvp_config';

/**
 * Configuração padrão do sistema.
 */
export const CONFIG_PADRAO = {
  modoEscuro: true,
  fonteGrande: false,
  reduzirAnimacoes: false,
  vibracaoAtiva: true,
  somAtivo: false,
  somenteWifi: false,
  simulacaoVisual: 'normal'
};

/**
 * Estado em memória das configurações ativas.
 * @type {typeof CONFIG_PADRAO}
 */
let configAtual = { ...CONFIG_PADRAO };

/**
 * Contexto de áudio para sintetizador de cliques suaves.
 * @type {AudioContext|null}
 */
let audioCtx = null;

/**
 * Dispara feedback tátil de clique no celular via Vibration API.
 * @return {void}
 */
export function dispararFeedbackTabil() {
  if (configAtual.vibracaoAtiva && 'vibrate' in navigator) {
    try {
      navigator.vibrate(15);
    } catch {
      // Ignora restrições de permissão do navegador
    }
  }
}

/**
 * Dispara feedback sonoro harmônico de clique via Web Audio API (100% offline).
 * Sintetiza um tom senoidal sutil de 587Hz (D5) por 80ms.
 * @param {number} [frequencia=587.33] Frequência em Hz (padrão D5)
 * @return {void}
 */
export function dispararFeedbackSonoro(frequencia = 587.33) {
  if (!configAtual.somAtivo) {
    return;
  }

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return;
    }

    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const oscilador = audioCtx.createOscillator();
    const ganho = audioCtx.createGain();

    oscilador.type = 'sine';
    oscilador.frequency.setValueAtTime(frequencia, audioCtx.currentTime);

    ganho.gain.setValueAtTime(0.04, audioCtx.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

    oscilador.connect(ganho);
    ganho.connect(audioCtx.destination);

    oscilador.start();
    oscilador.stop(audioCtx.currentTime + 0.08);
  } catch {
    // Ignora restrições de inicialização de áudio sem interação
  }
}

/**
 * Aplica a simulação de daltonismo / percepção visual no elemento raiz.
 * @param {string} tipo Tipo de visão ('normal', 'deuteranopia', 'protanopia', 'tritanopia', 'monocromia', 'alto-contraste')
 * @return {void}
 */
export function aplicarSimulacaoVisual(tipo) {
  const root = document.documentElement;
  const classesFiltros = [
    'simular-deuteranopia',
    'simular-protanopia',
    'simular-tritanopia',
    'simular-monocromia',
    'simular-alto-contraste'
  ];

  classesFiltros.forEach((cls) => root.classList.remove(cls));

  if (tipo && tipo !== 'normal') {
    root.classList.add(`simular-${tipo}`);
  }

  const select = document.getElementById('selectDaltonismo');
  if (select instanceof HTMLSelectElement) {
    select.value = tipo;
  }
}

/**
 * Aplica visualmente todas as configurações aos elementos da interface e ao DOM.
 * @param {typeof CONFIG_PADRAO} cfg
 * @return {void}
 */
export function aplicarTodasConfiguracoes(cfg) {
  // 1. Modo Escuro / Claro
  if (cfg.modoEscuro) {
    document.body.classList.remove('tema-claro');
  } else {
    document.body.classList.add('tema-claro');
  }
  const switchModoEscuro = document.getElementById('switchModoEscuro');
  if (switchModoEscuro instanceof HTMLInputElement) {
    switchModoEscuro.checked = cfg.modoEscuro;
  }

  // 2. Fonte Grande (Acessibilidade 60+ na raiz HTML)
  if (cfg.fonteGrande) {
    document.documentElement.classList.add('fonte-grande');
  } else {
    document.documentElement.classList.remove('fonte-grande');
  }
  const switchFonteGrande = document.getElementById('switchFonteGrande');
  if (switchFonteGrande instanceof HTMLInputElement) {
    switchFonteGrande.checked = cfg.fonteGrande;
  }

  // 3. Reduzir Animações
  if (cfg.reduzirAnimacoes) {
    document.body.classList.add('sem-animacoes');
  } else {
    document.body.classList.remove('sem-animacoes');
  }
  const switchReduzirAnim = document.getElementById('switchReduzirAnim');
  if (switchReduzirAnim instanceof HTMLInputElement) {
    switchReduzirAnim.checked = cfg.reduzirAnimacoes;
  }

  // 4. Operação em Campo
  const switchVibracao = document.getElementById('switchVibracao');
  if (switchVibracao instanceof HTMLInputElement) {
    switchVibracao.checked = cfg.vibracaoAtiva;
  }

  const switchSom = document.getElementById('switchSom');
  if (switchSom instanceof HTMLInputElement) {
    switchSom.checked = cfg.somAtivo;
  }

  const switchWifi = document.getElementById('switchWifi');
  if (switchWifi instanceof HTMLInputElement) {
    switchWifi.checked = cfg.somenteWifi;
  }

  // 5. Simulação Visual de Daltonismo
  aplicarSimulacaoVisual(cfg.simulacaoVisual || 'normal');
}

/**
 * Salva e persiste uma preferência individual no armazenamento.
 * @param {keyof typeof CONFIG_PADRAO} chave
 * @param {boolean|string} valor
 * @return {Promise<void>}
 */
export async function alterarConfiguracao(chave, valor) {
  configAtual = {
    ...configAtual,
    [chave]: valor
  };

  dispararFeedbackTabil();
  dispararFeedbackSonoro();
  aplicarTodasConfiguracoes(configAtual);

  // Cache síncrono imediato para recargas rápidas
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configAtual));
  } catch {
    // Ignora restrições de localStorage
  }

  // Persistência robusta no IndexedDB
  try {
    const db = await abrirBanco();
    const transacao = db.transaction(STORES.CONFIG_CONFERENCIA, 'readwrite');
    const store = transacao.objectStore(STORES.CONFIG_CONFERENCIA);
    store.put({ chave: CHAVE_CONFIG, ...configAtual });
  } catch (erro) {
    console.warn('[Config] Erro ao persistir configurações no IndexedDB:', erro);
  }
}

/**
 * Carrega as preferências salvas no IndexedDB ou localStorage.
 * @return {Promise<void>}
 */
export async function carregarConfiguracoes() {
  // 1. Tenta carregar do cache síncrono rápido
  try {
    const salvoStorage = localStorage.getItem(STORAGE_KEY);
    if (salvoStorage) {
      configAtual = { ...CONFIG_PADRAO, ...JSON.parse(salvoStorage) };
      aplicarTodasConfiguracoes(configAtual);
    }
  } catch {
    // Fallback normal
  }

  // 2. Consulta o IndexedDB para garantia de persistência integral
  try {
    const db = await abrirBanco();
    const transacao = db.transaction(STORES.CONFIG_CONFERENCIA, 'readonly');
    const store = transacao.objectStore(STORES.CONFIG_CONFERENCIA);
    const req = store.get(CHAVE_CONFIG);

    req.onsuccess = () => {
      if (req.result) {
        const { chave, ...dados } = req.result;
        configAtual = { ...CONFIG_PADRAO, ...dados };
      }
      aplicarTodasConfiguracoes(configAtual);
    };
  } catch {
    aplicarTodasConfiguracoes(configAtual);
  }
}

/**
 * Abre a Gaveta Inferior (Bottom Sheet) de Configurações.
 * @return {Promise<void>}
 */
export async function abrirBottomSheetConfig() {
  dispararFeedbackTabil();
  dispararFeedbackSonoro();

  const scrim = document.getElementById('scrimBottomSheetConfig');
  if (scrim) {
    scrim.classList.add('aberto');
  }

  // Atualiza indicador da conferência ativa na gaveta
  const txtNome = document.getElementById('txtSheetNomeConferencia');
  if (txtNome) {
    const sessao = await lerSessao();
    if (sessao && sessao.nome_cf) {
      txtNome.textContent = sessao.nome_cf;
      txtNome.style.color = '#86efac';
    } else if (sessao && sessao.nome_conferencia) {
      txtNome.textContent = sessao.nome_conferencia;
      txtNome.style.color = '#86efac';
    } else {
      txtNome.textContent = 'Não conectado';
      txtNome.style.color = '#cbd5e1';
    }
  }
}

/**
 * Fecha a Gaveta Inferior (Bottom Sheet) de Configurações.
 * @return {void}
 */
export function fecharBottomSheetConfig() {
  dispararFeedbackTabil();
  dispararFeedbackSonoro();

  const scrim = document.getElementById('scrimBottomSheetConfig');
  if (scrim) {
    scrim.classList.remove('aberto');
  }
}

/**
 * Inicializa a orquestração do Bottom Sheet e os switches M3 no DOM.
 * @return {Promise<void>}
 */
export function inicializarConfiguracoes() {
  carregarConfiguracoes();

  // 1. Botão [Config] na Barra Inferior
  const btnConfig = document.getElementById('btn_config');
  if (btnConfig) {
    btnConfig.addEventListener('click', (evento) => {
      evento.preventDefault();
      abrirBottomSheetConfig();
    });
  }

  // 2. Botões de Fechar a Gaveta
  const btnFecharX = document.getElementById('btnFecharSheetConfig');
  if (btnFecharX) {
    btnFecharX.addEventListener('click', (evento) => {
      evento.preventDefault();
      fecharBottomSheetConfig();
    });
  }

  const btnFecharBottom = document.getElementById('btnFecharSheetConfigBottom');
  if (btnFecharBottom) {
    btnFecharBottom.addEventListener('click', (evento) => {
      evento.preventDefault();
      fecharBottomSheetConfig();
    });
  }

  const scrim = document.getElementById('scrimBottomSheetConfig');
  if (scrim) {
    scrim.addEventListener('click', (evento) => {
      if (evento.target === scrim) {
        fecharBottomSheetConfig();
      }
    });
  }

  // 3. Botão "Conectar / Trocar" dentro da gaveta (Aciona o modal com fluxo coordenado)
  const btnConectarSheet = document.getElementById('btnAbrirModalConexaoSheet');
  if (btnConectarSheet) {
    btnConectarSheet.addEventListener('click', (evento) => {
      evento.preventDefault();
      fecharBottomSheetConfig();

      const btnStatus = document.getElementById('statusHeaderBtn');
      if (btnStatus) {
        btnStatus.click();
      } else {
        const modalConexao = document.getElementById('overlayModal');
        if (modalConexao) {
          modalConexao.classList.add('ativo');
        }
      }
    });
  }

  // 4. Vinculação dos 6 Switches M3
  const switches = [
    { id: 'switchModoEscuro', chave: 'modoEscuro' },
    { id: 'switchFonteGrande', chave: 'fonteGrande' },
    { id: 'switchReduzirAnim', chave: 'reduzirAnimacoes' },
    { id: 'switchVibracao', chave: 'vibracaoAtiva' },
    { id: 'switchSom', chave: 'somAtivo' },
    { id: 'switchWifi', chave: 'somenteWifi' }
  ];

  switches.forEach(({ id, chave }) => {
    const elem = document.getElementById(id);
    if (elem instanceof HTMLInputElement) {
      elem.addEventListener('change', () => {
        alterarConfiguracao(/** @type {keyof typeof CONFIG_PADRAO} */ (chave), elem.checked);
      });
    }
  });

  // 5. Vinculação do Seletor de Simulação Visual (Daltonismo)
  const selectDaltonismo = document.getElementById('selectDaltonismo');
  if (selectDaltonismo instanceof HTMLSelectElement) {
    selectDaltonismo.addEventListener('change', () => {
      alterarConfiguracao('simulacaoVisual', selectDaltonismo.value);
    });
  }

  console.log('[Config] Módulo de configurações e acessibilidade M3 inicializado com sucesso.');
}
