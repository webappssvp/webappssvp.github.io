/**
 * @fileoverview Tutorial de cada tela (pedido de 20/11/2026; substitui o modo "O que é isso?").
 *
 * - O botão "Ajuda" fica na barra da tela (barra_tela.js) quando a tela tem tutorial (tutoriais.js).
 * - Em cada tela, o ícone da Ajuda pulsa até ser tocado ali (23/11/2026, no lugar do aviso que cobria o conteúdo;
 *   config "tutoriais_vistos", neste aparelho).
 * - O card flutuante ocupa a largura da tela, fica logo acima ou logo abaixo do elemento explicado (no lado com mais
 *   espaço) e uma seta liga os dois. O elemento ganha destaque (o resto escurece). ‹ e › passam os passos; ✕ fecha.
 * - Rolando a tela, o card acompanha o elemento; se o elemento sai da tela, o card fica na borda.
 * - O passo cujo elemento não está na tela é pulado. A tela continua usável: tocar em algo que troca de tela fecha
 *   o tutorial.
 * - Ouvir lê o passo aberto. O uso vai para a aba "uso" (tipo tutorial: aberto, terminou ou até que passo foi).
 * - O botão Ajuda fica em todas as telas, também no login (22/11/2026). Com login, ele pergunta: "Conhecer esta tela" ou
 *   "Praticar". No treino (tutoriais.js, TREINOS), a pessoa faz cada passo de verdade: acertou, "Ótimo! Próximo passo";
 *   errou, "Tente de novo" com uma explicação mais detalhada, e o toque errado não tem efeito. Depois de dois erros, o
 *   elemento pulsa e aparece "Mostrar para mim". O treino grava de verdade (ambiente de homologação).
 */

import * as db from '../core/db.js';
import {prefs, vibrar} from '../core/preferencias.js';
import {definirLeitor, leitorAtual} from '../core/voz.js';
import {contar} from '../core/uso.js';
import {TREINOS, TUTORIAIS, chaveDoTutorial} from './tutoriais.js';

const CHAVE_VISTOS = 'tutoriais_vistos';
const MARGEM = 16; // gutter da tela
const ESPACO = 12; // entre o card e o elemento (a seta fica aqui)

const estado = {
  vistos: {},
  chave: '',
  passos: [],
  n: 0,
  alvo: null,
  raiz: null,
  quadro: 0,
  leitorAntes: null,
  maiorPasso: 0,
  escolhendo: false, // card "Conhecer esta tela" ou "Praticar"
  treino: null, // {id, titulo, passos, n, erros, ocupado, concluiu, timer}
};

/** @return {string} O tutorial da tela à vista (o painel de entrar cobre a tela). */
export function chaveAtual() {
  return document.body.classList.contains('painel-aberto') ? 'login' : chaveDoTutorial(location.hash);
}

/** @param {string} chave @return {boolean} A Ajuda desta tela ainda não foi tocada: o ícone pulsa. */
export function ajudaPulsa(chave) {
  return Boolean(chave) && !estado.vistos[chave];
}

/** @return {boolean} */
export function tutorialAberto() {
  return Boolean(estado.raiz);
}

/** @param {string} chave */
async function marcarVisto(chave) {
  if (estado.vistos[chave]) {
    return;
  }
  estado.vistos[chave] = new Date().toISOString();
  document.querySelectorAll('.barra-tela-ajuda.pulsando').forEach((b) => b.classList.remove('pulsando'));
  try {
    await db.salvarConfig(CHAVE_VISTOS, estado.vistos);
  } catch (erro) {
    // fica só nesta abertura do app
  }
}

/** O ícone da Ajuda volta a pulsar em todas as telas (Ajuda, na gaveta do alto). */
export async function mostrarAvisosDeNovo() {
  estado.vistos = {};
  try {
    await db.salvarConfig(CHAVE_VISTOS, {});
  } catch (erro) {
    // só nesta abertura
  }
}

// ---------------------------------------------------------------------------
// Abrir, passar e fechar
// ---------------------------------------------------------------------------

/** @param {!Element} e @return {boolean} Tem tamanho (está desenhado). */
const visivel = (e) => {
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/**
 * O elemento do passo: pelo seletor (alvo; com perto, o grupo em volta dele) ou pelo cartão cujo título começa com o
 * texto (secao).
 * @param {!Object} passo
 * @return {?HTMLElement}
 */
function achar(passo) {
  if (passo.secao) {
    // O cartão (section) ou o grupo do formulário (fieldset) do título; em: só um dos dois (a visualização e a
    // edição têm cartões com o mesmo título).
    const area = document.getElementById('areaConteudo') || document;
    const titulo = [...area.querySelectorAll('.detalhe-titulo')].find((t) => {
      const caixa = t.closest('section, fieldset');
      return t.textContent.trim().startsWith(passo.secao) && caixa && (!passo.em || caixa.matches(passo.em)) &&
        visivel(caixa);
    });
    return titulo ? titulo.closest('section, fieldset') : null;
  }
  let el = null;
  try {
    el = [...document.querySelectorAll(passo.alvo)].find(visivel) || null;
  } catch (erro) {
    return null; // seletor que o navegador não conhece: pula o passo
  }
  // perto: destaca o grupo em volta (as opções de "Vou de", e não só a primeira).
  return el && passo.perto ? el.closest(passo.perto) || el : el;
}

/**
 * Elemento alto demais para caber com o card na tela: destaca só o título dele.
 * @param {!HTMLElement} el
 * @param {number} hCard Altura do card.
 * @return {!HTMLElement}
 */
function parteVisivel(el, hCard) {
  const {topo, base} = limites(el);
  if (el.getBoundingClientRect().height + hCard + ESPACO + 16 <= base - topo) {
    return el;
  }
  const titulo = el.querySelector('.detalhe-titulo, legend');
  return titulo && visivel(titulo) ? titulo : el;
}

/**
 * A área em que o card é desenhado. No computador, o app fica numa moldura de celular (desktop.css) e o "fixed" conta a
 * partir dela, e não da janela (23/11/2026).
 * @return {{left: number, top: number, bottom: number, width: number}}
 */
function moldura() {
  const janela = document.documentElement.clientWidth;
  if (!estado.raiz) {
    return {left: 0, top: 0, bottom: window.innerHeight, width: janela};
  }
  const r = estado.raiz.getBoundingClientRect();
  return {left: r.left, top: r.top, bottom: r.bottom, width: Math.min(janela, r.width)};
}

/** @return {number} Largura do card: a tela toda, com a margem (até 560px). */
const larguraDoCard = () => Math.min(moldura().width - MARGEM * 2, 560);

/**
 * Rola a tela quando o elemento não está todo à vista ou não sobra lugar para o card: o elemento vai para o alto da
 * área, com o card logo abaixo (no fim da página, o card vai para cima). Os elementos das barras fixas não rolam.
 * @param {!HTMLElement} alvo
 * @param {number} hCard
 * @param {boolean} soOTitulo O elemento era alto demais e só o título está destacado: ele vai para o alto da área,
 *     para o resto aparecer logo abaixo.
 */
function rolarAte(alvo, hCard, soOTitulo) {
  const area = alvo.closest('#areaConteudo, #painelConexao'); // a tela ou o painel de entrar
  if (!area) {
    return;
  }
  const r = alvo.getBoundingClientRect();
  const {topo, base} = limites(alvo);
  const todoVisivel = r.top >= topo && r.bottom <= base;
  const cabe = base - r.bottom >= hCard + ESPACO || r.top - topo >= hCard + ESPACO;
  if (todoVisivel && cabe && (!soOTitulo || r.top - topo < 24)) {
    return;
  }
  area.scrollBy({top: r.top - (topo + 8), behavior: prefs.reduzirAnimacoes ? 'auto' : 'smooth'});
}

/** @param {!Object} passo @return {boolean} O elemento fica na área da tela (não nas barras). */
const daTela = (passo) => {
  const el = achar(passo);
  return Boolean(el && el.closest('#areaConteudo'));
};

/** @param {string} chave */
export async function abrirTutorial(chave) {
  const tutorial = TUTORIAIS[chave];
  if (!tutorial) {
    return;
  }
  fechar(false);
  marcarVisto(chave);
  // A lista ou os dados podem estar chegando: espera um pouco por algum elemento da própria tela.
  for (let i = 0; i < 20 && !tutorial.passos.some(daTela); i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
  estado.chave = chave;
  estado.passos = tutorial.passos.filter((p) => achar(p));
  if (!estado.passos.length) {
    return;
  }
  estado.n = 0;
  estado.maiorPasso = 0;
  estado.leitorAntes = leitorAtual();
  montar();
  contar('tutorial', {nome: 'aberto', tela: tutorial.titulo});
  mostrarPasso();
}

function montar() {
  const raiz = document.createElement('div');
  raiz.className = 'tutorial';
  raiz.innerHTML = `
    <div class="tutorial-destaque" aria-hidden="true"></div>
    <section class="tutorial-card" role="dialog" aria-modal="false" aria-labelledby="tutorialTitulo"
        aria-describedby="tutorialTexto">
      <span class="tutorial-seta" aria-hidden="true"></span>
      <div class="tutorial-topo">
        <span class="tutorial-contagem" id="tutorialContagem"></span>
        <button type="button" class="tutorial-fechar" data-tutorial="fechar" aria-label="Fechar a ajuda">✕</button>
      </div>
      <h2 class="tutorial-titulo" id="tutorialTitulo" tabindex="-1"></h2>
      <p class="tutorial-retorno" id="tutorialRetorno" role="status" hidden></p>
      <p class="tutorial-texto" id="tutorialTexto" aria-live="polite"></p>
      <div class="tutorial-escolha" hidden>
        <button type="button" class="tutorial-opcao" data-tutorial="conhecer">Conhecer esta tela</button>
        <button type="button" class="tutorial-opcao tutorial-seguir" data-tutorial="praticar">Praticar: registrar uma
          visita</button>
      </div>
      <div class="tutorial-acoes-treino" hidden>
        <button type="button" class="tutorial-opcao" data-tutorial="mostrar" hidden>Mostrar para mim</button>
        <button type="button" class="tutorial-opcao tutorial-seguir" data-tutorial="continuar" hidden>Continuar</button>
      </div>
      <div class="tutorial-acoes">
        <button type="button" class="tutorial-passo" data-tutorial="voltar" aria-label="Passo anterior">‹</button>
        <button type="button" class="tutorial-passo tutorial-seguir" data-tutorial="seguir"
          aria-label="Próximo passo">›</button>
      </div>
    </section>`;
  raiz.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tutorial]');
    if (!b) {
      return;
    }
    vibrar();
    if (b.dataset.tutorial === 'fechar') {
      fechar(true);
    } else if (b.dataset.tutorial === 'conhecer') {
      const chave = estado.chave;
      fechar(false);
      abrirTutorial(chave);
    } else if (b.dataset.tutorial === 'praticar') {
      iniciarTreino('visita');
    } else if (b.dataset.tutorial === 'mostrar') {
      mostrarParaMim();
    } else if (b.dataset.tutorial === 'continuar') {
      continuarTreino();
    } else if (b.dataset.tutorial === 'voltar') {
      irPara(estado.n - 1);
    } else if (estado.n >= estado.passos.length - 1) {
      fechar(true);
    } else {
      irPara(estado.n + 1);
    }
  });
  document.body.appendChild(raiz);
  estado.raiz = raiz;
}

/** @param {number} n */
function irPara(n) {
  if (n < 0 || n >= estado.passos.length) {
    return;
  }
  estado.n = n;
  estado.maiorPasso = Math.max(estado.maiorPasso, n);
  mostrarPasso();
}

function mostrarPasso() {
  const passo = estado.passos[estado.n];
  const achado = achar(passo);
  if (!achado) {
    // sumiu (a lista mudou): tira o passo e segue
    estado.passos.splice(estado.n, 1);
    if (!estado.passos.length) {
      fechar(true);
      return;
    }
    estado.n = Math.min(estado.n, estado.passos.length - 1);
    mostrarPasso();
    return;
  }
  const raiz = estado.raiz;
  const ultimo = estado.n === estado.passos.length - 1;
  raiz.querySelector('#tutorialContagem').textContent = (estado.n + 1) + ' de ' + estado.passos.length;
  raiz.querySelector('#tutorialTitulo').textContent = passo.titulo;
  raiz.querySelector('#tutorialTexto').textContent = passo.texto;
  raiz.querySelector('[data-tutorial="voltar"]').disabled = estado.n === 0;
  const seguir = raiz.querySelector('[data-tutorial="seguir"]');
  seguir.textContent = ultimo ? 'Pronto' : '›';
  seguir.classList.toggle('tutorial-pronto', ultimo);
  seguir.setAttribute('aria-label', ultimo ? 'Terminar a ajuda' : 'Próximo passo');
  definirLeitor(() => passo.titulo + '. ' + passo.texto);
  // Com o texto do passo, a altura do card; com ela, o que destacar e quanto rolar (o card acompanha a rolagem).
  const card = raiz.querySelector('.tutorial-card');
  card.style.width = larguraDoCard() + 'px';
  const hCard = card.offsetHeight;
  const alvo = parteVisivel(achado, hCard);
  estado.alvo = alvo;
  rolarAte(alvo, hCard, alvo !== achado);
  posicionar();
  raiz.querySelector('#tutorialTitulo').focus({preventScroll: true});
}

/** @param {boolean} pelaPessoa Fechou (✕ ou Pronto); false: trocou de tela ou abriu outro. */
function fechar(pelaPessoa) {
  if (!estado.raiz) {
    return;
  }
  const t = estado.treino;
  if (t) {
    clearInterval(t.timer);
    contar('tutorial', {nome: t.concluiu ? 'treino terminou' : 'treino parou no passo ' + (t.n + 1) + ' de ' +
      t.passos.length, tela: t.titulo});
    estado.treino = null;
  } else if (!estado.escolhendo) {
    const titulo = (TUTORIAIS[estado.chave] || {}).titulo || estado.chave;
    const terminou = estado.maiorPasso >= estado.passos.length - 1;
    contar('tutorial', {nome: terminou ? 'terminou' : 'parou no passo ' + (estado.maiorPasso + 1) + ' de ' +
      estado.passos.length, tela: titulo});
  }
  estado.escolhendo = false;
  estado.raiz.remove();
  estado.raiz = null;
  estado.alvo = null;
  if (estado.leitorAntes) {
    definirLeitor(estado.leitorAntes);
    estado.leitorAntes = null;
  }
  if (pelaPessoa) {
    const ajuda = document.querySelector('[data-barra="ajuda"]');
    if (ajuda) {
      ajuda.focus({preventScroll: true});
    }
  }
}

// ---------------------------------------------------------------------------
// "Conhecer esta tela" ou "Praticar"
// ---------------------------------------------------------------------------

/** @param {string} chave */
function abrirEscolha(chave) {
  fechar(false);
  marcarVisto(chave);
  estado.chave = chave;
  estado.passos = [];
  estado.escolhendo = true;
  estado.leitorAntes = leitorAtual();
  montar();
  const raiz = estado.raiz;
  raiz.querySelector('.tutorial-acoes').hidden = true;
  raiz.querySelector('.tutorial-escolha').hidden = false;
  raiz.querySelector('#tutorialContagem').textContent = 'Ajuda';
  raiz.querySelector('#tutorialTitulo').textContent = 'Como quer aprender?';
  raiz.querySelector('#tutorialTexto').textContent = 'Veja o que cada parte desta tela faz, ou pratique fazendo uma visita ' +
    'passo a passo. O treino grava de verdade, nos dados de teste.';
  definirLeitor(() => 'Como quer aprender? Conhecer esta tela, ou praticar registrar uma visita.');
  estado.alvo = document.querySelector('[data-barra="ajuda"]');
  raiz.querySelector('.tutorial-card').style.width = larguraDoCard() + 'px';
  posicionar();
  raiz.querySelector('#tutorialTitulo').focus({preventScroll: true});
}

// ---------------------------------------------------------------------------
// Treino: a pessoa faz cada passo
// ---------------------------------------------------------------------------

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** @param {string} id */
function iniciarTreino(id) {
  fechar(false);
  const modelo = TREINOS[id];
  estado.treino = {id, titulo: modelo.titulo, passos: modelo.passos, n: -1, erros: 0, ocupado: true, concluiu: false,
    timer: setInterval(seguirAlvoDoTreino, 300)};
  estado.leitorAntes = leitorAtual();
  montar();
  const raiz = estado.raiz;
  raiz.querySelector('.tutorial-acoes').hidden = true;
  raiz.querySelector('.tutorial-acoes-treino').hidden = false;
  contar('tutorial', {nome: 'treino aberto', tela: modelo.titulo});
  proximoPassoDoTreino();
}

/** A tela redesenha a cada toque: o destaque acompanha o elemento novo. */
function seguirAlvoDoTreino() {
  const t = estado.treino;
  const passo = t && t.passos[t.n];
  const el = passo && achar(passo);
  if (el) {
    estado.alvo = el;
    posicionar();
  }
}

/**
 * Espera o elemento do passo aparecer (a tela pode estar trocando ou buscando os dados).
 * @param {!Object} t
 * @param {!Object} passo
 * @return {!Promise<?HTMLElement>}
 */
async function esperarAlvo(t, passo) {
  const limite = Date.now() + (passo.opcional ? 1200 : 8000);
  while (estado.treino === t && Date.now() < limite) {
    const el = achar(passo);
    if (el) {
      return el;
    }
    await espera(100);
  }
  return null;
}

/**
 * O passo já foi feito (rascunho de uma visita em andamento) ou não se aplica.
 * @param {!Object} t
 * @param {!Object} passo
 * @return {!Promise<boolean>}
 */
async function passoJaFeito(t, passo) {
  if (passo.pularSeExiste && document.querySelector(passo.pularSeExiste)) {
    return true;
  }
  if (passo.textoDoBotao) {
    const limite = Date.now() + 1200; // o botão muda de nome logo depois do toque anterior
    while (estado.treino === t && Date.now() < limite) {
      const el = achar(passo);
      if (el && el.textContent.includes(passo.textoDoBotao)) {
        return false;
      }
      await espera(100);
    }
    return true;
  }
  return false;
}

async function proximoPassoDoTreino() {
  const t = estado.treino;
  if (!t) {
    return;
  }
  t.ocupado = true;
  t.erros = 0;
  for (;;) {
    t.n += 1;
    const passo = t.passos[t.n];
    if (!passo) {
      fechar(true);
      return;
    }
    if (passo.pularEm && passo.pularEm.includes(location.hash.split('/')[0])) {
      continue;
    }
    const el = await esperarAlvo(t, passo);
    if (estado.treino !== t) {
      return;
    }
    if (!el) {
      if (passo.opcional) {
        continue;
      }
      treinoSemSaida(passo.semAlvo || 'Não encontrei o próximo passo nesta tela. Feche e comece de novo pela Ajuda.');
      return;
    }
    if (await passoJaFeito(t, passo)) {
      if (estado.treino !== t) {
        return;
      }
      continue;
    }
    if (estado.treino !== t) {
      return;
    }
    if (passo.tipo === 'fim') {
      t.concluiu = true;
    }
    t.ocupado = false;
    desenharPassoDoTreino(passo, achar(passo) || el);
    return;
  }
}

/** @param {string} texto */
function treinoSemSaida(texto) {
  const raiz = estado.raiz;
  raiz.querySelector('#tutorialTitulo').textContent = 'Não deu para continuar';
  raiz.querySelector('#tutorialTexto').textContent = texto;
  raiz.querySelector('#tutorialRetorno').hidden = true;
  raiz.querySelector('[data-tutorial="mostrar"]').hidden = true;
  raiz.querySelector('[data-tutorial="continuar"]').hidden = true;
  estado.alvo = document.querySelector('[data-barra="ajuda"]');
  posicionar();
}

/** @param {string} texto @param {string} classe ok ou erro */
function retornoDoTreino(texto, classe) {
  const r = estado.raiz.querySelector('#tutorialRetorno');
  r.textContent = texto;
  r.className = 'tutorial-retorno ' + classe;
  r.hidden = false;
}

/** @param {!Object} passo @param {!HTMLElement} el */
function desenharPassoDoTreino(passo, el) {
  const t = estado.treino;
  const raiz = estado.raiz;
  raiz.querySelector('#tutorialContagem').textContent = 'Treino · passo ' + (t.n + 1) + ' de ' + t.passos.length;
  raiz.querySelector('#tutorialTitulo').textContent = passo.titulo;
  raiz.querySelector('#tutorialTexto').textContent = passo.pede;
  raiz.querySelector('#tutorialRetorno').hidden = true;
  raiz.querySelector('.tutorial-destaque').classList.remove('tutorial-pulsando');
  raiz.querySelector('[data-tutorial="mostrar"]').hidden = true;
  const continuar = raiz.querySelector('[data-tutorial="continuar"]');
  continuar.hidden = passo.tipo === 'tocar';
  continuar.textContent = passo.tipo === 'fim' ? 'Pronto' : 'Continuar';
  definirLeitor(() => passo.titulo + '. ' + passo.pede);
  const card = raiz.querySelector('.tutorial-card');
  card.style.width = larguraDoCard() + 'px';
  estado.alvo = el;
  rolarAte(el, card.offsetHeight, false);
  posicionar();
  raiz.querySelector('#tutorialTitulo').focus({preventScroll: true});
}

/** @param {string=} detalhe O que a tela disse (ex.: ao salvar). */
function errouNoTreino(detalhe) {
  const t = estado.treino;
  const passo = t.passos[t.n];
  t.erros += 1;
  vibrar(60);
  contar('tutorial', {nome: 'treino errou: ' + passo.titulo, tela: t.titulo});
  retornoDoTreino('Tente de novo', 'erro');
  const raiz = estado.raiz;
  raiz.querySelector('#tutorialTexto').textContent = detalhe || passo.erro;
  definirLeitor(() => 'Tente de novo. ' + (detalhe || passo.erro));
  if (t.erros >= 2) {
    raiz.querySelector('.tutorial-destaque').classList.add('tutorial-pulsando');
    raiz.querySelector('[data-tutorial="mostrar"]').hidden = false;
  }
  const el = achar(passo);
  if (el) {
    estado.alvo = el;
    rolarAte(el, raiz.querySelector('.tutorial-card').offsetHeight, false);
  }
  posicionar();
}

async function acertouNoTreino() {
  const t = estado.treino;
  const passo = t.passos[t.n];
  t.ocupado = true;
  retornoDoTreino('✓ Ótimo! Próximo passo', 'ok');
  const raiz = estado.raiz;
  raiz.querySelector('[data-tutorial="mostrar"]').hidden = true;
  raiz.querySelector('[data-tutorial="continuar"]').hidden = true;
  raiz.querySelector('.tutorial-destaque').classList.remove('tutorial-pulsando');
  if (passo.espera === 'salvar') {
    const limite = Date.now() + 8000;
    while (estado.treino === t && Date.now() < limite && !location.hash.startsWith('#familias/')) {
      const aviso = document.querySelector('#msgVisita.erro');
      if (aviso && aviso.textContent.trim()) {
        t.ocupado = false;
        errouNoTreino(aviso.textContent.trim());
        return;
      }
      await espera(100);
    }
    if (estado.treino !== t) {
      return;
    }
  }
  await espera(900);
  if (estado.treino === t) {
    proximoPassoDoTreino();
  }
}

/** Depois de dois erros: o app faz o passo pela pessoa. */
function mostrarParaMim() {
  const t = estado.treino;
  const passo = t && t.passos[t.n];
  const el = passo && achar(passo);
  if (!el || t.ocupado) {
    return;
  }
  if (passo.tipo === 'escrever') {
    el.value = el.value.trim() || passo.exemplo || '';
    el.dispatchEvent(new Event('input', {bubbles: true}));
    acertouNoTreino();
  } else {
    // Com "perto", o destaque é o grupo: o toque vai na primeira opção dele.
    (el.matches(passo.alvo) ? el : el.querySelector(passo.alvo)).click(); // passa por aoClicarNoTreino, como um toque certo
  }
}

function continuarTreino() {
  const t = estado.treino;
  const passo = t && t.passos[t.n];
  if (!passo || t.ocupado) {
    return;
  }
  if (passo.tipo === 'fim') {
    fechar(true);
    return;
  }
  const el = achar(passo);
  if (el && el.value.trim().length >= 5) {
    acertouNoTreino();
  } else {
    errouNoTreino();
  }
}

/**
 * No treino, só o toque certo tem efeito: o errado é barrado antes de chegar ao botão. Rolar a tela continua livre.
 * @param {!MouseEvent} e
 */
function aoClicarNoTreino(e) {
  const t = estado.treino;
  if (!t || !(e.target instanceof Element) || e.target.closest('.tutorial-card, [data-barra="ajuda"]')) {
    return;
  }
  const barrar = () => {
    e.preventDefault();
    e.stopPropagation();
  };
  if (t.ocupado) {
    barrar();
    return;
  }
  const passo = t.passos[t.n];
  const noAlvo = e.target.closest(passo.alvo);
  if (passo.tipo === 'escrever') {
    if (!noAlvo && !e.target.closest('#btnAudioHub')) {
      barrar();
      errouNoTreino();
    }
  } else if (passo.tipo === 'fim') {
    barrar();
  } else if (noAlvo) {
    acertouNoTreino();
  } else {
    barrar();
    errouNoTreino();
  }
}

// ---------------------------------------------------------------------------
// Posição do card, da seta e do destaque
// ---------------------------------------------------------------------------

/**
 * A faixa da tela onde o card pode ficar: entre a barra da tela e a barra de baixo, salvo quando o elemento
 * explicado está numa delas.
 * @param {!HTMLElement} alvo
 * @return {{topo: number, base: number}}
 */
function limites(alvo) {
  const caixa = moldura();
  const altura = Math.min(caixa.bottom, window.visualViewport ? window.visualViewport.height : window.innerHeight);
  const barra = document.getElementById('barraTela');
  const header = document.getElementById('appHeader');
  const rodape = document.getElementById('appFooter');
  if (alvo.closest('#bottomSheet, #scrimOpcoes')) {
    return {topo: caixa.top, base: altura}; // gaveta aberta, por cima das barras
  }
  const emCima = alvo.closest('#appHeader, #barraTela');
  const embaixo = alvo.closest('#appFooter');
  const fundoDe = (el) => (el && el.getBoundingClientRect().height ? el.getBoundingClientRect().bottom : 0);
  let topo = emCima ? caixa.top : Math.max(fundoDe(barra), fundoDe(header));
  let base = altura;
  if (!embaixo && rodape && rodape.getBoundingClientRect().height) {
    base = Math.min(base, rodape.getBoundingClientRect().top);
  }
  topo = Math.max(caixa.top, topo);
  return {topo, base};
}

function posicionar() {
  cancelAnimationFrame(estado.quadro);
  estado.quadro = 0;
  const {raiz, alvo} = estado;
  if (!raiz || !alvo) {
    return;
  }
  if (!alvo.isConnected) {
    if (!estado.treino && !estado.escolhendo) {
      mostrarPasso(); // a tela redesenhou: acha o elemento de novo
    }
    return;
  }
  const card = raiz.querySelector('.tutorial-card');
  const seta = raiz.querySelector('.tutorial-seta');
  const destaque = raiz.querySelector('.tutorial-destaque');
  const r = alvo.getBoundingClientRect();
  const caixa = moldura();
  const {topo, base} = limites(alvo);

  // Destaque: um pouco maior que o elemento. As medidas vêm da janela; o desenho conta a partir da moldura.
  const folga = 4;
  Object.assign(destaque.style, {left: (r.left - caixa.left - folga) + 'px', top: (r.top - caixa.top - folga) + 'px',
    width: (r.width + folga * 2) + 'px', height: (r.height + folga * 2) + 'px'});

  const larguraCard = larguraDoCard();
  const esquerda = (caixa.width - larguraCard) / 2;
  card.style.width = larguraCard + 'px';
  card.style.left = esquerda + 'px';
  const h = card.offsetHeight;
  const acima = r.top - topo;
  const abaixo = base - r.bottom;
  let emBaixo;
  if (abaixo >= h + ESPACO) {
    emBaixo = true;
  } else if (acima >= h + ESPACO) {
    emBaixo = false;
  } else {
    emBaixo = abaixo >= acima;
  }
  let y = emBaixo ? r.bottom + ESPACO : r.top - ESPACO - h;
  // Elemento fora da faixa visível (rolou): o card fica preso na borda.
  y = Math.max(topo + 4, Math.min(y, base - h - 4));
  card.style.top = (y - caixa.top) + 'px';
  card.classList.toggle('seta-em-cima', emBaixo);
  card.classList.toggle('seta-embaixo', !emBaixo);
  const meio = Math.max(r.left, Math.min(r.right, r.left + r.width / 2));
  seta.style.left = Math.max(18, Math.min(larguraCard - 18, meio - caixa.left - esquerda)) + 'px';
  // Sem o elemento à vista, a seta some (o card não aponta para o vazio).
  seta.hidden = r.bottom < topo || r.top > base;
}

function agendarPosicao() {
  if (estado.raiz && !estado.quadro) {
    estado.quadro = requestAnimationFrame(posicionar);
  }
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

/** Liga o botão Ajuda e a posição do card (uma vez, ao abrir o app). */
export async function iniciarTutoriais() {
  try {
    estado.vistos = (await db.lerConfig(CHAVE_VISTOS)) || {};
  } catch (erro) {
    estado.vistos = {};
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-barra="ajuda"]')) {
      vibrar();
      const chave = chaveAtual();
      if (estado.raiz) {
        fechar(true);
      } else if (chave !== 'login' && !document.body.classList.contains('sem-sessao')) {
        abrirEscolha(chave);
      } else {
        abrirTutorial(chave);
      }
    }
  });
  document.addEventListener('click', aoClicarNoTreino, true);
  window.addEventListener('hashchange', () => {
    if (!estado.treino) {
      fechar(false);
      return;
    }
    // O treino atravessa as telas: guarda o leitor da tela nova, para devolver ao terminar.
    setTimeout(() => {
      const t = estado.treino;
      if (t) {
        estado.leitorAntes = leitorAtual();
        const passo = t.passos[t.n];
        if (passo && !t.ocupado) {
          definirLeitor(() => passo.titulo + '. ' + passo.pede);
        }
      }
    }, 0);
  });
  document.addEventListener('scroll', agendarPosicao, true);
  window.addEventListener('resize', agendarPosicao);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', agendarPosicao);
    window.visualViewport.addEventListener('scroll', agendarPosicao);
  }
  document.addEventListener('keydown', (e) => {
    if (!estado.raiz) {
      return;
    }
    if (e.key === 'Escape') {
      fechar(true);
    } else if (estado.treino || estado.escolhendo) {
      return;
    } else if (e.key === 'ArrowRight' && !e.target.matches('input, textarea, select')) {
      irPara(estado.n + 1);
    } else if (e.key === 'ArrowLeft' && !e.target.matches('input, textarea, select')) {
      irPara(estado.n - 1);
    }
  });
}
