/**
 * @fileoverview Tutorial de cada tela (pedido de 20/11/2026; substitui o modo "O que é isso?").
 *
 * - O botão "Ajuda" fica na barra da tela (barra_tela.js) quando a tela tem tutorial (tutoriais.js).
 * - Na primeira vez em cada tela, um aviso discreto logo abaixo da barra, com o ícone da Ajuda pulsando. Some ao
 *   abrir o tutorial ou ao fechar o aviso (config "tutoriais_vistos", neste aparelho).
 * - O card flutuante ocupa a largura da tela, fica logo acima ou logo abaixo do elemento explicado (no lado com mais
 *   espaço) e uma seta liga os dois. O elemento ganha destaque (o resto escurece). ‹ e › passam os passos; ✕ fecha.
 * - Rolando a tela, o card acompanha o elemento; se o elemento sai da tela, o card fica na borda.
 * - O passo cujo elemento não está na tela é pulado. A tela continua usável: tocar em algo que troca de tela fecha
 *   o tutorial.
 * - Ouvir lê o passo aberto. O uso vai para a aba "uso" (tipo tutorial: aberto, terminou ou até que passo foi).
 */

import * as db from '../core/db.js';
import {prefs, vibrar} from '../core/preferencias.js';
import {definirLeitor, leitorAtual} from '../core/voz.js';
import {contar} from '../core/uso.js';
import {TUTORIAIS, chaveDoTutorial} from './tutoriais.js';

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
};

/** @param {string} chave @return {boolean} Mostra o aviso de primeira vez nesta tela. */
export function precisaAviso(chave) {
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
  document.querySelectorAll('.aviso-ajuda').forEach((a) => a.remove());
  document.querySelectorAll('.barra-tela-ajuda.pulsando').forEach((b) => b.classList.remove('pulsando'));
  try {
    await db.salvarConfig(CHAVE_VISTOS, estado.vistos);
  } catch (erro) {
    // fica só nesta abertura do app
  }
}

/** Volta a mostrar o aviso de primeira vez em todas as telas (Ajuda, na gaveta do alto). */
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

/** @return {number} Largura do card: a tela toda, com a margem (até 560px no computador). */
const larguraDoCard = () => Math.min(document.documentElement.clientWidth - MARGEM * 2, 560);

/**
 * Rola a tela quando o elemento não está todo à vista ou não sobra lugar para o card: o elemento vai para o alto da
 * área, com o card logo abaixo (no fim da página, o card vai para cima). Os elementos das barras fixas não rolam.
 * @param {!HTMLElement} alvo
 * @param {number} hCard
 * @param {boolean} soOTitulo O elemento era alto demais e só o título está destacado: ele vai para o alto da área,
 *     para o resto aparecer logo abaixo.
 */
function rolarAte(alvo, hCard, soOTitulo) {
  const area = alvo.closest('#areaConteudo');
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
      <p class="tutorial-texto" id="tutorialTexto" aria-live="polite"></p>
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
    } else if (b.dataset.tutorial === 'voltar') {
      irPara(estado.n - 1);
    } else if (estado.n >= estado.passos.length - 1) {
      fechar(true);
    } else {
      irPara(estado.n + 1);
    }
  });
  document.body.appendChild(raiz);
  document.body.classList.add('com-tutorial');
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
  const titulo = (TUTORIAIS[estado.chave] || {}).titulo || estado.chave;
  const terminou = estado.maiorPasso >= estado.passos.length - 1;
  contar('tutorial', {nome: terminou ? 'terminou' : 'parou no passo ' + (estado.maiorPasso + 1) + ' de ' +
    estado.passos.length, tela: titulo});
  estado.raiz.remove();
  estado.raiz = null;
  estado.alvo = null;
  document.body.classList.remove('com-tutorial');
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
// Posição do card, da seta e do destaque
// ---------------------------------------------------------------------------

/**
 * A faixa da tela onde o card pode ficar: entre a barra da tela e a barra de baixo, salvo quando o elemento
 * explicado está numa delas.
 * @param {!HTMLElement} alvo
 * @return {{topo: number, base: number}}
 */
function limites(alvo) {
  const altura = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  const barra = document.getElementById('barraTela');
  const header = document.getElementById('appHeader');
  const rodape = document.getElementById('appFooter');
  const emCima = alvo.closest('#appHeader, #barraTela');
  const embaixo = alvo.closest('#appFooter');
  const fundoDe = (el) => (el && el.getBoundingClientRect().height ? el.getBoundingClientRect().bottom : 0);
  let topo = emCima ? 0 : Math.max(fundoDe(barra), fundoDe(header));
  let base = altura;
  if (!embaixo && rodape && rodape.getBoundingClientRect().height) {
    base = Math.min(base, rodape.getBoundingClientRect().top);
  }
  topo = Math.max(0, topo);
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
    mostrarPasso(); // a tela redesenhou: acha o elemento de novo
    return;
  }
  const card = raiz.querySelector('.tutorial-card');
  const seta = raiz.querySelector('.tutorial-seta');
  const destaque = raiz.querySelector('.tutorial-destaque');
  const r = alvo.getBoundingClientRect();
  const largura = document.documentElement.clientWidth;
  const {topo, base} = limites(alvo);

  // Destaque: um pouco maior que o elemento.
  const folga = 4;
  Object.assign(destaque.style, {left: (r.left - folga) + 'px', top: (r.top - folga) + 'px',
    width: (r.width + folga * 2) + 'px', height: (r.height + folga * 2) + 'px'});

  const larguraCard = larguraDoCard();
  const esquerda = (largura - larguraCard) / 2;
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
  card.style.top = y + 'px';
  card.classList.toggle('seta-em-cima', emBaixo);
  card.classList.toggle('seta-embaixo', !emBaixo);
  const meio = Math.max(r.left, Math.min(r.right, r.left + r.width / 2));
  seta.style.left = Math.max(18, Math.min(larguraCard - 18, meio - esquerda)) + 'px';
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

/** Liga o botão Ajuda, o aviso e a posição do card (uma vez, ao abrir o app). */
export async function iniciarTutoriais() {
  try {
    estado.vistos = (await db.lerConfig(CHAVE_VISTOS)) || {};
  } catch (erro) {
    estado.vistos = {};
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-barra="ajuda"]')) {
      vibrar();
      const chave = chaveDoTutorial(location.hash);
      if (estado.raiz && estado.chave === chave) {
        fechar(true);
      } else {
        abrirTutorial(chave);
      }
    } else if (e.target.closest('[data-aviso-ajuda="fechar"]')) {
      vibrar();
      marcarVisto(chaveDoTutorial(location.hash));
    }
  });
  window.addEventListener('hashchange', () => fechar(false));
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
    } else if (e.key === 'ArrowRight' && !e.target.matches('input, textarea, select')) {
      irPara(estado.n + 1);
    } else if (e.key === 'ArrowLeft' && !e.target.matches('input, textarea, select')) {
      irPara(estado.n - 1);
    }
  });
}

/** @return {string} HTML do aviso de primeira vez (vai dentro da barra da tela). */
export function avisoDePrimeiraVez() {
  return `<div class="aviso-ajuda" role="note">
    <span>Primeira vez aqui? Toque em <strong>Ajuda</strong> para ver como esta tela funciona.</span>
    <button type="button" class="aviso-ajuda-fechar" data-aviso-ajuda="fechar" aria-label="Fechar o aviso">✕</button>
  </div>`;
}
