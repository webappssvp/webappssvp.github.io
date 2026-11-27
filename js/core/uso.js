/**
 * @fileoverview Uso do app (homologação, pedido de 19/11/2026): junta no aparelho um resumo de como o app está sendo
 * usado, para refinar a experiência. O resumo vai junto com o envio da fila (lote) ou com o "Sincronizar agora", e vira
 * linhas na aba "uso" da planilha do índice do CC (Uso.gs).
 *
 * O que junta (contagens e tempos por dia, nunca o que foi digitado):
 * - tela: quantas vezes abriu cada tela e quanto tempo ficou (só com o app à vista);
 * - formulario_salvo / formulario_abandonado: começou a preencher e salvou, ou saiu sem salvar (com o último campo
 *   mexido, pelo rótulo dele);
 * - erro_campo: o app avisou de um problema num campo (o rótulo do campo);
 * - toques_repetidos: 3 toques seguidos no mesmo lugar, em algo que não faz nada (parece botão e não é);
 * - erro_app: erro do programa (mensagem e arquivo:linha);
 * - abrir_app: quanto o app levou para abrir;
 * - servidor: quanto o servidor levou para responder, por ação (e quantas falharam);
 * - aparelho: instalado ou no navegador, e o tamanho da tela.
 *
 * Desliga em Configurações ("Ajudar a melhorar o app", preferência ajudarApp): o que estava juntado é apagado.
 * Guardado no IndexedDB (config "uso_resumo"), até USO_DIAS dias e USO_MAX_ITENS itens.
 */

import * as db from './db.js';
import {eventosPreferencias, prefs} from './preferencias.js';

const CHAVE = 'uso_resumo';
const USO_DIAS = 7;
const USO_MAX_ITENS = 300;
/** Tela aberta por mais que isso (o celular ficou largado) conta só até aqui. */
const TELA_MAX_MS = 30 * 60 * 1000;

/** Nome da tela pelo #hash. */
const NOMES = {
  '#pessoas': 'Pessoas', '#vicentinos': 'Pessoas', '#familias': 'Famílias', '#visitas': 'Visitas',
  '#visita': 'Registrar visita', '#como-funciona': 'Como o app guarda e envia', '#importar': 'Importar pessoas',
  '#consolidacao': 'Consolidação',
  '#sugestoes': 'Sugestões e opiniões', '#sobre': 'Apresentação',
};

/**
 * @param {string} hash Ex.: "#pessoas/PES_000002".
 * @return {string} Ex.: "Pessoas (detalhes)".
 */
export function nomeDaTela(hash) {
  const [base, id] = String(hash || '').split('/');
  return (NOMES[base] || base.replace('#', '') || 'Pessoas') +
    (id && base !== '#visita' ? (id === 'novo' ? ' (cadastro)' : ' (detalhes)') : '');
}

const estado = {
  itens: {}, // chave -> {dia, tipo, tela, nome, vezes, soma_ms, maior_ms, falhas, detalhe}
  enviando: null, // os itens que foram num pedido e esperam a resposta
  carregado: false,
  timer: 0,
  tela: {nome: '', desde: 0, acumulado: 0},
  form: null, // {tela, inicio, campo, salvo}
  toques: {x: 0, y: 0, t: 0, n: 0},
};

const ligado = () => prefs.ajudarApp !== false;
const hoje = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const telaAgora = () => nomeDaTela(location.hash);

/**
 * Soma um acontecimento ao resumo do dia.
 * @param {string} tipo
 * @param {{tela: (string|undefined), nome: (string|undefined), ms: (number|undefined), falhou: (boolean|undefined),
 *     detalhe: (string|undefined)}} dados
 */
export function contar(tipo, dados = {}) {
  if (!ligado()) {
    return;
  }
  const dia = hoje();
  const tela = dados.tela === undefined ? telaAgora() : dados.tela;
  const nome = String(dados.nome || '').slice(0, 120);
  const chave = [dia, tipo, tela, nome].join('|');
  if (!estado.itens[chave] && Object.keys(estado.itens).length >= USO_MAX_ITENS) {
    return; // cheio: o que já está junto vale mais que o novo
  }
  const item = estado.itens[chave] || (estado.itens[chave] = {dia, tipo, tela, nome, vezes: 0, soma_ms: 0, maior_ms: 0,
    falhas: 0, detalhe: ''});
  item.vezes += 1;
  if (dados.ms > 0) {
    const ms = Math.round(dados.ms);
    item.soma_ms += ms;
    item.maior_ms = Math.max(item.maior_ms, ms);
  }
  if (dados.falhou) {
    item.falhas += 1;
  }
  if (dados.detalhe) {
    item.detalhe = String(dados.detalhe).slice(0, 200);
  }
  guardarLogo();
}

function guardarLogo() {
  clearTimeout(estado.timer);
  estado.timer = setTimeout(guardar, 3000);
}

async function guardar() {
  clearTimeout(estado.timer);
  if (!estado.carregado) {
    return;
  }
  try {
    await db.salvarConfig(CHAVE, ligado() ? estado.itens : {});
  } catch (erro) {
    // sem espaço ou banco fechado: fica só na memória
  }
}

/** @return {boolean} Há resumo para mandar. */
export function temPendente() {
  return ligado() && Object.keys(estado.itens).length > 0;
}

/**
 * Tira o resumo para ir num pedido. Depois: enviado(true) apaga; enviado(false) devolve para ir no próximo.
 * @return {?{versao_app: string, aparelho: string, itens: !Array<!Object>}}
 */
export function separar() {
  if (!temPendente() || estado.enviando) {
    return null;
  }
  estado.enviando = estado.itens;
  estado.itens = {};
  const itens = Object.values(estado.enviando).map(({falhas, ...i}) => ({...i,
    detalhe: i.tipo === 'servidor' && falhas ? 'falhas: ' + falhas : i.detalhe}));
  return {versao_app: versaoDoApp(), aparelho: tipoDeAparelho(), itens};
}

/** @param {boolean} chegou */
export function enviado(chegou) {
  if (!estado.enviando) {
    return;
  }
  if (!chegou) {
    // volta, somando ao que juntou enquanto o pedido ia
    Object.entries(estado.enviando).forEach(([chave, velho]) => {
      const novo = estado.itens[chave];
      estado.itens[chave] = !novo ? velho : {...velho, vezes: velho.vezes + novo.vezes,
        soma_ms: velho.soma_ms + novo.soma_ms, maior_ms: Math.max(velho.maior_ms, novo.maior_ms),
        falhas: velho.falhas + novo.falhas, detalhe: novo.detalhe || velho.detalhe};
    });
  }
  estado.enviando = null;
  guardar();
}

/** @return {string} Android, iPhone, iPad ou Computador. */
export function tipoDeAparelho() {
  const ua = navigator.userAgent;
  return /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' :
    /iPhone|iPod/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : 'Computador';
}

/** @return {string} Ex.: "0.19.0" ('' se ainda não se sabe). */
export function versaoDoApp() {
  const versao = ((document.getElementById('versaoApp') || {}).textContent || '').replace(/^v/, '');
  return /^\d/.test(versao) ? versao : '';
}

// ---------------------------------------------------------------------------
// Telas e formulários
// ---------------------------------------------------------------------------

/** Conta a tela que está saindo (vezes e o tempo à vista). */
function fecharTela() {
  const t = estado.tela;
  estado.tela = {nome: '', desde: 0, acumulado: 0};
  if (!t.nome) {
    return;
  }
  const ms = Math.min(TELA_MAX_MS, t.acumulado + (t.desde ? Date.now() - t.desde : 0));
  contar('tela', {tela: t.nome, ms: ms >= 1000 ? ms : 0});
}

/** Trocou de tela: fecha o formulário largado e a tela anterior. */
function trocouDeTela() {
  largarFormulario();
  fecharTela();
  estado.tela = {nome: telaAgora(), desde: document.hidden ? 0 : Date.now(), acumulado: 0};
}

/** O formulário começado e não salvo vira "abandonado". */
function largarFormulario() {
  const f = estado.form;
  estado.form = null;
  if (f && !f.salvo) {
    contar('formulario_abandonado', {tela: f.tela, nome: f.campo, ms: Date.now() - f.inicio});
  }
}

/** A tela salvou (pôs na fila ou enviou): o formulário começado conta como salvo. */
export function formularioSalvo() {
  const f = estado.form;
  estado.form = null;
  if (f && !f.salvo) {
    contar('formulario_salvo', {tela: f.tela, ms: Date.now() - f.inicio});
  }
}

/**
 * O nome do campo pelo rótulo (nunca o valor).
 * @param {?Element} campo
 * @return {string}
 */
function rotulo(campo) {
  if (!campo || !(campo instanceof HTMLElement)) {
    return '';
  }
  const limpar = (t) => String(t || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  if (campo.type === 'radio' || campo.type === 'checkbox') {
    const legenda = campo.closest('fieldset') && campo.closest('fieldset').querySelector('legend');
    if (legenda) {
      return limpar(legenda.textContent);
    }
  }
  const pelo = campo.id && document.querySelector(`label[for="${CSS.escape(campo.id)}"]`);
  return limpar((pelo && pelo.textContent) || campo.getAttribute('aria-label') ||
    (campo.closest('label') && campo.closest('label').textContent) || campo.getAttribute('placeholder') ||
    campo.name || campo.id || campo.tagName.toLowerCase());
}

/** Campos que não são preenchimento (busca, filtros). */
const ehBusca = (alvo) => alvo.type === 'search' || /busca|filtro/i.test(alvo.id + ' ' + alvo.className);

/** @param {!Event} e */
function aoDigitar(e) {
  const alvo = e.target;
  if (!(alvo instanceof HTMLElement) || !alvo.closest('#areaConteudo form') || ehBusca(alvo)) {
    return;
  }
  if (!estado.form) {
    estado.form = {tela: telaAgora(), inicio: Date.now(), campo: '', salvo: false};
  }
  estado.form.campo = rotulo(alvo);
}

/**
 * O app mostrou um aviso de erro (.feedback-msg.erro) na tela: conta o campo em que o cursor ficou.
 * @param {!Array<!MutationRecord>} mudancas
 */
function aoMudarAviso(mudancas) {
  // Texto e classe mudam juntos: cada aviso conta uma vez.
  const avisos = new Set(mudancas.map((m) => (m.target.nodeType === Node.TEXT_NODE ? m.target.parentElement : m.target)));
  avisos.forEach((aviso) => {
    if (!(aviso instanceof HTMLElement) || !aviso.classList.contains('feedback-msg') ||
        !aviso.classList.contains('erro') || !aviso.textContent.trim()) {
      return;
    }
    const ativo = document.activeElement;
    const campo = ativo && ativo.closest && ativo.closest('#areaConteudo') && ativo.matches('input, select, textarea') ?
      ativo : null;
    contar('erro_campo', {nome: campo ? rotulo(campo) : 'aviso sem campo'});
  });
}

/** @param {!PointerEvent} e */
function aoTocar(e) {
  const alvo = e.target;
  if (!(alvo instanceof Element)) {
    return;
  }
  const t = estado.toques;
  if (alvo.closest('a, button, input, select, textarea, label, summary, [role="button"], [tabindex], [contenteditable]')) {
    t.n = 0;
    return;
  }
  const agora = Date.now();
  const perto = Math.hypot(e.clientX - t.x, e.clientY - t.y) < 30;
  t.n = perto && agora - t.t < 700 ? t.n + 1 : 1;
  t.x = e.clientX;
  t.y = e.clientY;
  t.t = agora;
  if (t.n === 3) {
    const comClasse = alvo.closest('[class]');
    const nome = comClasse ? comClasse.tagName.toLowerCase() + '.' + String(comClasse.className).split(/\s+/)[0] :
      alvo.tagName.toLowerCase();
    contar('toques_repetidos', {nome});
  }
}

// ---------------------------------------------------------------------------
// Erros, tempos e aparelho
// ---------------------------------------------------------------------------

/**
 * @param {string} mensagem
 * @param {string} arquivo
 * @param {number} linha
 */
function erroDoApp(mensagem, arquivo, linha) {
  const onde = String(arquivo || '').split('/').pop().split('?')[0];
  contar('erro_app', {nome: String(mensagem || 'erro').slice(0, 120), detalhe: onde ? onde + ':' + (linha || 0) : ''});
}

/**
 * Resposta do servidor (api_cc.js).
 * @param {string} acao
 * @param {number} ms
 * @param {boolean} falhou Sem resposta ou resposta inesperada (não conta recusa normal, como senha errada).
 */
export function respostaDoServidor(acao, ms, falhou) {
  contar('servidor', {tela: '', nome: acao, ms, falhou});
}

/** O app terminou de abrir (app.js). */
export function appAberto() {
  contar('abrir_app', {tela: '', ms: performance.now()});
  const instalado = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const chave = [hoje(), 'aparelho', ''].join('|');
  if (!Object.keys(estado.itens).some((k) => k.startsWith(chave))) {
    contar('aparelho', {tela: '', nome: instalado ? 'instalado' : 'no navegador',
      detalhe: screen.width + 'x' + screen.height});
  }
}

/** Liga a coleta (uma vez, ao abrir o app). */
export async function iniciar() {
  try {
    const guardados = (await db.lerConfig(CHAVE)) || {};
    const limite = new Date(Date.now() - USO_DIAS * 86400000).toISOString().slice(0, 10);
    Object.entries(guardados).forEach(([chave, item]) => {
      if (item && item.dia >= limite && !estado.itens[chave]) {
        estado.itens[chave] = item;
      }
    });
  } catch (erro) {
    // começa vazio
  }
  estado.carregado = true;
  estado.tela = {nome: telaAgora(), desde: Date.now(), acumulado: 0};
  window.addEventListener('hashchange', trocouDeTela);
  document.addEventListener('input', aoDigitar, true);
  document.addEventListener('change', aoDigitar, true);
  document.addEventListener('pointerdown', aoTocar, true);
  document.addEventListener('visibilitychange', () => {
    const t = estado.tela;
    if (document.hidden) {
      t.acumulado += t.desde ? Date.now() - t.desde : 0;
      t.desde = 0;
      guardar();
    } else {
      t.desde = Date.now();
    }
  });
  window.addEventListener('pagehide', () => {
    largarFormulario();
    fecharTela();
    guardar();
  });
  window.addEventListener('error', (e) => erroDoApp(e.message, e.filename, e.lineno));
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    if (r && r.codigo !== undefined) {
      return; // recusa do servidor ou sem internet: não é erro do programa
    }
    const pilha = String((r && r.stack) || '').match(/([\w.-]+\.js):(\d+)/);
    erroDoApp(r && r.message ? r.message : String(r), pilha ? pilha[1] : '', pilha ? Number(pilha[2]) : 0);
  });
  const area = document.getElementById('areaConteudo');
  if (area) {
    new MutationObserver(aoMudarAviso).observe(area, {subtree: true, attributes: true, attributeFilter: ['class'],
      characterData: true, childList: true});
  }
  // Desligou: apaga o que estava junto.
  eventosPreferencias.addEventListener('mudou', (e) => {
    if (e.detail.chave === 'ajudarApp' && !e.detail.valor) {
      estado.itens = {};
      estado.form = null;
      guardar();
    }
  });
}
