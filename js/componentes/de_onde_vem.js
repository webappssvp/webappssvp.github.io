/**
 * @fileoverview De onde vem cada regra do app (decisão de 16/11/2026, mvp/telas/00_casca.md).
 *
 * - 📖 "O que diz a Regra" (menu_book): o trecho exato da Regra, com a referência, "Ouvir" e "Ler a Regra inteira".
 * - 🤝 "Combinado na criação do app" (handshake): escolhas que a Regra não traz, com os motivos, a data e o
 *   "Ver o que diz a Regra" quando o motivo se apoia nela.
 * Os textos ficam em siglas/regra_trechos.json (funciona sem internet).
 *
 * Uso: `${botaoRegra('sindicancia')}` ou `${botaoCombinado(['promover_presidente', 'promover_assistida'])}` no HTML. Um ouvinte
 * só, no documento, abre a gaveta.
 */

import {lerEmVozAlta, pararLeitura} from '../core/voz.js';
import {vibrar} from '../core/preferencias.js';

const ARQUIVO = 'siglas/regra_trechos.json';

/** Material Symbols (outlined), viewBox 0 -960 960 960. */
const ICONES = {
  regra: 'M560-564v-68q33-14 67.5-21t72.5-7q26 0 51 4t49 10v64q-24-9-48.5-13.5T700-600q-38 0-73 9.5T560-564Zm0 220v-68' +
    'q33-14 67.5-21t72.5-7q26 0 51 4t49 10v64q-24-9-48.5-13.5T700-380q-38 0-73 9t-67 27Zm0-110v-68q33-14 67.5-21t72.5-7' +
    'q26 0 51 4t49 10v64q-24-9-48.5-13.5T700-490q-38 0-73 9.5T560-454ZM260-320q47 0 91.5 10.5T440-278v-394q-41-24-87-36' +
    't-93-12q-36 0-71.5 7T120-692v396q35-12 69.5-18t70.5-6Zm260 42q44-21 88.5-31.5T700-320q36 0 70.5 6t69.5 18v-396' +
    'q-33-14-68.5-21t-71.5-7q-47 0-93 12t-87 36v394Zm-40 118q-48-38-104-59t-116-21q-42 0-82.5 11T100-198q-21 11-40.5-1' +
    'T40-234v-482q0-11 5.5-21T62-752q46-24 96-36t102-12q58 0 113.5 15T480-740q51-30 106.5-45T700-800q52 0 102 12t96 36' +
    'q11 5 16.5 15t5.5 21v482q0 23-19.5 35t-40.5 1q-37-20-77.5-31T700-240q-60 0-116 21t-104 59ZM280-494Z',
  combinado: 'M475-160q4 0 8-2t6-4l328-328q12-12 17.5-27t5.5-30q0-16-5.5-30.5T817-607L647-777q-11-12-25.5-17.5T591-800' +
    'q-15 0-30 5.5T534-777l-11 11 74 75q15 14 22 32t7 38q0 42-28.5 70.5T527-522q-20 0-38.5-7T456-550l-75-74-175 175' +
    'q-3 3-4.5 6.5T200-435q0 8 6 14.5t14 6.5q4 0 8-2t6-4l136-136 56 56-135 136q-3 3-4.5 6.5T285-350q0 8 6 14t14 6q4 0 8-2' +
    't6-4l136-135 56 56-135 136q-3 2-4.5 6t-1.5 8q0 8 6 14t14 6q4 0 7.5-1.5t6.5-4.5l136-135 56 56-136 136q-3 3-4.5 6.5' +
    'T454-180q0 8 6.5 14t14.5 6Zm-1 80q-37 0-65.5-24.5T375-166q-34-5-57-28t-28-57q-34-5-56.5-28.5T206-336q-38-5-62-33' +
    't-24-66q0-20 7.5-38.5T149-506l232-231 131 131q2 3 6 4.5t8 1.5q9 0 15-5.5t6-14.5q0-4-1.5-8t-4.5-6L398-777' +
    'q-11-12-25.5-17.5T342-800q-15 0-30 5.5T285-777L144-635q-9 9-15 21t-8 24q-2 12 0 24.5t8 23.5l-58 58q-17-23-25-50.5' +
    'T40-590q2-28 14-54.5T87-692l141-141q24-23 53.5-35t60.5-12q31 0 60.5 12t52.5 35l11 11 11-11q24-23 53.5-35t60.5-12' +
    'q31 0 60.5 12t52.5 35l169 169q23 23 35 53t12 61q0 31-12 60.5T873-437L545-110q-14 14-32.5 22T474-80Zm-99-560Z',
};

/** @param {*} t @return {string} */
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  '\'': '&#39;'}[c]));

/** @param {string} nome @return {string} */
const icone = (nome) => `<svg class="origem-icone" viewBox="0 -960 960 960" aria-hidden="true" focusable="false">
  <path d="${ICONES[nome]}"/></svg>`;

let dados = null;

/** @return {!Promise<?Object>} */
async function carregar() {
  if (!dados) {
    try {
      dados = await (await fetch(ARQUIVO)).json();
    } catch (erro) {
      return null;
    }
  }
  return dados;
}

/**
 * @param {string} id Chave em "trechos".
 * @param {string=} texto
 * @param {{titulo: (string|undefined), classe: (string|undefined)}=} opcoes titulo: da gaveta, no lugar de
 *     "O que diz a Regra" (ex.: a oração antes da visita); o Ouvir lê só o texto. classe: do botão.
 * @return {string} HTML do botão.
 */
export const botaoRegra = (id, texto = 'O que diz a Regra', opcoes = {}) =>
  `<button type="button" class="origem origem-regra ${esc(opcoes.classe || '')}" data-regra="${esc(id)}"${
    opcoes.titulo ? ` data-titulo="${esc(opcoes.titulo)}"` : ''}>${icone('regra')}<span>${esc(texto)}</span></button>`;

/**
 * Um botão só por ponto da tela, mesmo com vários combinados (a gaveta mostra todos).
 * @param {(string|!Array<string>)} ids Chaves em "combinados".
 * @return {string} HTML do botão.
 */
export const botaoCombinado = (ids) => `<button type="button" class="origem origem-combinado" data-combinado="${
  esc([].concat(ids).join(','))}">${
  icone('combinado')}<span>Combinado na criação do app</span></button>`;

/** @return {!HTMLElement} */
function $gaveta() {
  let g = document.getElementById('scrimOrigem');
  if (!g) {
    g = document.createElement('div');
    g.className = 'scrim-overlay-bottom';
    g.id = 'scrimOrigem';
    g.innerHTML = '<div class="bottom-sheet gaveta-origem" role="dialog" aria-modal="true" aria-labelledby="tituloOrigem"></div>';
    g.addEventListener('click', (e) => {
      if (e.target === g || e.target.closest('[data-origem-fechar]')) {
        fechar();
      }
    });
    document.body.appendChild(g);
  }
  return g;
}

let voltarPara = null; // quem abriu, para devolver o foco

function fechar() {
  pararLeitura();
  const g = document.getElementById('scrimOrigem');
  if (g) {
    g.classList.remove('aberto');
  }
  if (voltarPara && document.contains(voltarPara)) {
    voltarPara.focus();
  }
  voltarPara = null;
}

/** @param {string} titulo @param {string} corpo @param {string} botoes */
function mostrar(titulo, classe, corpo, botoes) {
  const g = $gaveta();
  const folha = g.querySelector('.gaveta-origem');
  folha.className = 'bottom-sheet gaveta-origem ' + classe;
  folha.innerHTML = `
    <div class="origem-topo">
      <h2 class="origem-titulo" id="tituloOrigem">${titulo}</h2>
      <button type="button" class="origem-fechar" data-origem-fechar aria-label="Fechar">✕</button>
    </div>
    <div class="origem-corpo">${corpo}</div>
    <div class="origem-botoes">${botoes}</div>`;
  g.classList.add('aberto');
  folha.scrollTop = 0;
  folha.querySelector('.origem-fechar').focus();
}

/** @param {string} id @param {string=} titulo */
async function abrirRegra(id, titulo = '') {
  const d = await carregar();
  const trechos = d && d.trechos[id];
  if (!trechos) {
    mostrar(icone('regra') + esc(titulo || 'O que diz a Regra'), 'origem-regra-folha',
        '<p class="tela-texto">Não deu para abrir o texto da Regra agora.</p>',
        '<button type="button" class="btn-secundario" data-origem-fechar>Fechar</button>');
    return;
  }
  const corpo = trechos.map((t) => `
    <figure class="origem-trecho">
      <blockquote>${esc(t.texto)}</blockquote>
      <figcaption>${esc(t.referencia)}</figcaption>
    </figure>`).join('') + `<p class="detalhe-nota">${esc(d.fonte.titulo)}.</p>`;
  mostrar(icone('regra') + esc(titulo || 'O que diz a Regra'), 'origem-regra-folha', corpo, `
    <button type="button" class="btn-secundario" data-origem-ouvir>Ouvir</button>
    <a class="btn-secundario btn-link" href="${esc(d.fonte.link)}" target="_blank" rel="noopener">Ler a Regra inteira</a>
    <button type="button" class="btn-submit" data-origem-fechar>Fechar</button>`);
  $gaveta().querySelector('[data-origem-ouvir]').addEventListener('click', () => {
    vibrar();
    lerEmVozAlta(trechos.map((t) => (titulo ? '' : t.referencia + '. ') + t.texto).join(' '));
  });
}

/** @param {string} lista Chaves separadas por vírgula. */
async function abrirCombinado(lista) {
  const d = await carregar();
  const itens = lista.split(',').map((id) => d && d.combinados[id]).filter(Boolean);
  if (!itens.length) {
    mostrar(icone('combinado') + 'Combinado na criação do app', 'origem-combinado-folha',
        '<p class="tela-texto">Não deu para abrir os motivos agora.</p>',
        '<button type="button" class="btn-secundario" data-origem-fechar>Fechar</button>');
    return;
  }
  const regra = [];
  const corpo = itens.map((c) => {
    (c.regra || []).forEach((r) => regra.includes(r) || regra.push(r));
    const desde = c.desde ? new Date(c.desde + 'T12:00').toLocaleDateString('pt-BR') : '';
    return `
    <section class="origem-combinado-item">
      <p class="origem-combinado-texto">${esc(c.combinado)}</p>
      <h3 class="origem-secao">Por quê</h3>
      <ul class="origem-motivos">${c.motivos.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
      ${desde ? `<p class="detalhe-nota">Combinado em ${esc(desde)}.</p>` : ''}
    </section>`;
  }).join('') + `<p class="detalhe-nota">${itens.length > 1 ? 'Não são textos' : 'Não é texto'} da Regra: pode${
    itens.length > 1 ? 'm' : ''} mudar. Não concorda? Fale com o presidente da conferência ou com o Conselho Central.</p>`;
  mostrar(icone('combinado') + 'Combinado na criação do app', 'origem-combinado-folha', corpo, `
    ${regra.length ? `<button type="button" class="btn-secundario" data-origem-regra>${icone('regra')}Ver o que diz a Regra</button>` : ''}
    <button type="button" class="btn-submit" data-origem-fechar>Fechar</button>`);
  if (regra.length) {
    $gaveta().querySelector('[data-origem-regra]').addEventListener('click', () => {
      vibrar();
      abrirVarios(regra);
    });
  }
}

/** Vários trechos (de um combinado) numa gaveta só. @param {!Array<string>} ids */
async function abrirVarios(ids) {
  const d = await carregar();
  if (!d) {
    return abrirRegra('');
  }
  const juntos = [];
  ids.forEach((id) => (d.trechos[id] || []).forEach((t) => {
    if (!juntos.some((j) => j.referencia === t.referencia)) {
      juntos.push(t);
    }
  }));
  d.trechos['__juntos'] = juntos;
  return abrirRegra('__juntos');
}

document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-regra], [data-combinado]');
  if (!b || b.closest('#scrimOrigem')) {
    return;
  }
  e.preventDefault();
  vibrar();
  voltarPara = b;
  if (b.dataset.regra) {
    abrirRegra(b.dataset.regra, b.dataset.titulo || '');
  } else {
    abrirCombinado(b.dataset.combinado);
  }
});

document.addEventListener('keydown', (e) => {
  const g = document.getElementById('scrimOrigem');
  if (e.key === 'Escape' && g && g.classList.contains('aberto')) {
    fechar();
  }
});
