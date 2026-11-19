/**
 * @fileoverview Preferências do aparelho (Configurações) e retorno de toque (vibração e som).
 * Guardadas no IndexedDB (store config, chave preferencias_usuario). Valem só neste aparelho.
 * Decisões: mvp/telas/00_casca.md
 */

import * as db from './db.js';

const CHAVE = 'preferencias_usuario';

/** Valores padrão (os do js/config.js antigo e da t5). */
const PADRAO = {
  fonteGrande: false,
  modoCanhoto: false,
  temaClaro: false,
  reduzirAnimacoes: false,
  vibracaoAtiva: true,
  somAtivo: false,
  somenteWifi: false,
  simulacaoVisual: 'normal',
  // "na_hora": envia logo depois de salvar; "quando_mandar": junta e envia pela Nuvem (o relato de visita vai
  // sempre na hora). Decisão de 17/11/2026, mvp/telas/05_sincronizacao.md.
  envio: 'na_hora',
  // Minutos parado até a tranca pedir o desenho ou o PIN (19/11/2026, trava.js): '1', '5', '10' ou '15'.
  trancar: '15',
};

const SIMULACOES = ['deuteranopia', 'protanopia', 'tritanopia', 'monocromia', 'alto-contraste'];

/** Preferências atuais (leitura livre; para mudar, use definirPreferencia). */
export const prefs = {...PADRAO};

/** "mudou": {detail: {chave, valor}} uma preferência mudou (a fila e as Configurações escutam). */
export const eventosPreferencias = new EventTarget();

/** Aplica as preferências na página (classes no <html> e no <body>). */
function aplicar() {
  const html = document.documentElement;
  html.classList.toggle('fonte-grande', prefs.fonteGrande);
  document.body.classList.toggle('layout-canhoto', prefs.modoCanhoto);
  document.body.classList.toggle('tema-claro', prefs.temaClaro);
  document.body.classList.toggle('sem-animacoes', prefs.reduzirAnimacoes);
  SIMULACOES.forEach((s) => html.classList.toggle('simular-' + s, prefs.simulacaoVisual === s));
  const corBarra = getComputedStyle(document.body).getPropertyValue('--md-surface-2').trim();
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && corBarra) {
    meta.setAttribute('content', corBarra);
  }
}

/** @return {!Promise<void>} */
export async function carregarPreferencias() {
  const guardadas = (await db.lerConfig(CHAVE)) || {};
  Object.keys(PADRAO).forEach((k) => {
    if (typeof guardadas[k] === typeof PADRAO[k]) {
      prefs[k] = guardadas[k];
    }
  });
  aplicar();
}

/**
 * @param {string} chave Uma das chaves de PADRAO.
 * @param {boolean|string} valor
 * @return {!Promise<void>}
 */
export async function definirPreferencia(chave, valor) {
  if (!(chave in PADRAO) || typeof valor !== typeof PADRAO[chave]) {
    return;
  }
  prefs[chave] = valor;
  aplicar();
  try {
    await db.salvarConfig(CHAVE, {...prefs});
  } catch (erro) {
    // sem IndexedDB a preferência vale só até fechar o app
  }
  eventosPreferencias.dispatchEvent(new CustomEvent('mudou', {detail: {chave, valor}}));
}

/** @param {number=} ms */
export function vibrar(ms = 25) {
  if (prefs.vibracaoAtiva && 'vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch (erro) {
      // alguns navegadores bloqueiam sem toque do usuário
    }
  }
}

let contextoAudio = null;

/** Bipe curto e suave (Web Audio, funciona offline). @param {number=} frequencia */
export function bipar(frequencia = 600) {
  if (!prefs.somAtivo) {
    return;
  }
  try {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) {
      return;
    }
    contextoAudio = contextoAudio || new Contexto();
    const osc = contextoAudio.createOscillator();
    const ganho = contextoAudio.createGain();
    osc.connect(ganho);
    ganho.connect(contextoAudio.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequencia, contextoAudio.currentTime);
    ganho.gain.setValueAtTime(0.04, contextoAudio.currentTime);
    ganho.gain.exponentialRampToValueAtTime(0.001, contextoAudio.currentTime + 0.1);
    osc.start();
    osc.stop(contextoAudio.currentTime + 0.1);
  } catch (erro) {
    // sem som
  }
}

/**
 * Tipo de rede, quando o navegador informa (Chrome no Android); senão, null (iPhone, Firefox).
 * @return {?string}
 */
export function tipoDeRede() {
  const c = navigator.connection;
  return c && c.type ? c.type : null;
}

/**
 * Pode sincronizar agora? Respeita "Sincronizar só em Wi-Fi" quando o navegador informa a rede.
 * @return {{pode: boolean, motivo: string}}
 */
export function podeSincronizar() {
  if (!navigator.onLine) {
    return {pode: false, motivo: 'Sem internet agora. Seus dados estão salvos no celular.'};
  }
  const rede = tipoDeRede();
  if (prefs.somenteWifi && rede && rede !== 'wifi' && rede !== 'ethernet') {
    return {pode: false, motivo: 'Sem Wi-Fi agora. Conecte-se ao Wi-Fi ou desligue a opção nas Configurações.'};
  }
  return {pode: true, motivo: ''};
}
