/**
 * @fileoverview Barra da tela: faixa fixa logo abaixo da barra do app (decisões de 15/11/2026, mvp/telas/00_casca.md).
 *
 * - Listas: nome da tela e o botão que abre a gaveta (desce do topo da tela) com Buscar (campo), Mostrar (filtros com o número de
 *   cada um) e Ações (ex.: Nova pessoa, Atualizar a lista). A lista começa no topo da área de conteúdo.
 * - O botão diz "Opções" quando nada está aplicado, e **o que está aplicado** quando há filtro ou busca
 *   ("Vicentinos", "“ana”", "Vicentinos · “ana”"). Tocar numa opção aplica e fecha a gaveta; a busca filtra a cada
 *   letra, e a lupa ou o "Ir" do teclado fecham a gaveta (15/11/2026).
 * - Busca ou filtro ativo sem depender da cor (WCAG 1.4.1, tons de cinza): o **funil** aparece (sem filtro, só "Opções"),
 *   **o texto do botão** e a borda grossa; o fundo de destaque só reforça.
 * - Detalhes: seta de voltar e o nome da pessoa ou da família (sem Opções).
 * Cada tela chama definirBarra() ao montar e atualizarOpcoes() quando a lista muda. Sem sessão, a barra some.
 */

import {vibrar} from '../core/preferencias.js';
import {iconeSync} from './icone_sync.js';

/** Ícones do Material Symbols (viewBox 0 -960 960 960). */
const ICONES = {
  voltar: 'm313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z',
  limpar: 'm256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z',
  busca: 'M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580' +
    'q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580' +
    'q0 75 52.5 127.5T380-400Z',
  atualizar: 'M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168' +
    'q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z',
  // filter_alt: cheio (com busca ou filtro) e vazado (sem nada ativo)
  funilCheio: 'M440-160q-17 0-28.5-11.5T400-200v-240L168-736q-15-20-4.5-42t36.5-22h560q26 0 36.5 22t-4.5 42L560-440v240' +
    'q0 17-11.5 28.5T520-160h-80Z',
  funilVazado: 'M440-160q-17 0-28.5-11.5T400-200v-240L168-736q-15-20-4.5-42t36.5-22h560q26 0 36.5 22t-4.5 42L560-440v240' +
    'q0 17-11.5 28.5T520-160h-80Zm40-308 198-252H282l198 252Zm0 0Z',
};

/** @param {string} nome @return {string} SVG */
const icone = (nome) => `<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="${ICONES[nome]}"/></svg>`;

/** @param {*} texto @return {string} */
const esc = (texto) => String(texto).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  '\'': '&#39;'}[c]));

/*
 * definirBarra({titulo, voltar?, opcoes?}) — opcoes:
 *   busca:    {valor, rotulo, aoMudar(texto)}
 *   filtros:  [{titulo, valor, padrao, tipo?: 'lista'|'select', itens: [{valor, texto, n?, aEnviar?}], aoEscolher(valor)}]
 *             (aEnviar: quantos do filtro têm mudança esperando; o filtro ganha destaque)
 *   acoes:    [{texto, aoTocar(), destaque?, contador?, rotulo?}] (destaque: fundo azul; contador: número ao lado)
 *   aoLimpar(): volta busca e filtros ao padrão
 */
const estado = {
  config: /** @type {?Object} */ (null),
  aberta: false, // gaveta das Opções
  ocupado: false,
};

const $barra = () => document.getElementById('barraTela');

/** A gaveta das Opções (criada uma vez, junto da gaveta do Menu). @return {!HTMLElement} */
function $gaveta() {
  let g = document.getElementById('scrimOpcoes');
  if (!g) {
    g = document.createElement('div');
    g.className = 'scrim-overlay-bottom';
    g.id = 'scrimOpcoes';
    g.innerHTML = '<div class="bottom-sheet gaveta-opcoes" role="dialog" aria-modal="true" aria-labelledby="tituloOpcoes"></div>';
    g.addEventListener('click', (e) => {
      if (e.target === g) {
        fecharGaveta();
      }
    });
    document.body.appendChild(g);
  }
  return g;
}

/**
 * Define a barra da tela que está sendo desenhada (fecha a gaveta de uma tela anterior).
 * @param {{titulo: string, voltar: (string|undefined), opcoes: (?Object|undefined)}} config
 */
export function definirBarra(config) {
  estado.config = config;
  estado.ocupado = false;
  if (estado.aberta) {
    fecharGaveta();
  }
  desenharBarra();
}

/**
 * A lista mudou (filtro, busca, contagens): atualiza o resumo, o contador e a gaveta aberta (sem tirar o
 * foco do campo de busca).
 * @param {!Object} opcoes
 */
export function atualizarOpcoes(opcoes) {
  if (!estado.config) {
    return;
  }
  estado.config = {...estado.config, opcoes};
  desenharBarra();
  if (estado.aberta) {
    desenharGaveta(false);
  }
}

/** Mostra a nuvem descendo na barra enquanto a tela busca na nuvem. @param {boolean} ocupado */
export function barraOcupada(ocupado) {
  if (estado.ocupado !== Boolean(ocupado)) {
    estado.ocupado = Boolean(ocupado);
    desenharBarra();
  }
}

/** @param {?Object} o opcoes @return {number} Quantos filtros e buscas estão ativos. */
function ativos(o) {
  if (!o) {
    return 0;
  }
  return (o.busca && o.busca.valor ? 1 : 0) + (o.filtros || []).filter((g) => g.valor !== g.padrao).length;
}

/** @param {string} texto @return {string} "Vicentinos" → "vic", "Assistidas" → "ass", "Promovidas" → "pro". */
const abreviar = (texto) => String(texto).slice(0, 3).toLowerCase();

/**
 * O que está aplicado. Com filtro e busca juntos, o filtro vai abreviado, para caber no botão ("vic · “ana”";
 * 15/11/2026); o bairro (lista de escolha) fica inteiro.
 * @param {?Object} o
 * @param {boolean=} completo Sem abreviar (leitor de tela).
 * @return {string} '' se nada ativo.
 */
function resumo(o, completo = false) {
  if (!o) {
    return '';
  }
  const curto = !completo && Boolean(o.busca && o.busca.valor);
  const partes = (o.filtros || []).filter((g) => g.valor !== g.padrao).map((g) => {
    const texto = (g.itens.find((i) => i.valor === g.valor) || {}).texto || g.valor;
    return curto && g.tipo !== 'select' ? abreviar(texto) : texto;
  });
  if (o.busca && o.busca.valor) {
    partes.push('“' + o.busca.valor + '”');
  }
  return partes.join(' · ');
}

/**
 * Botão que abre as Opções. Atualizando (ao abrir a tela ou pelo "Atualizar a lista"): fundo vermelho, "Atualizando"
 * e a seta girando (15/11/2026). Com filtro ou busca: o que está aplicado, com o funil cheio.
 * @param {number} n Filtros e buscas ativos.
 * @param {string} linha O que está aplicado.
 * @return {string} HTML
 */
function botaoOpcoes(n, linha) {
  // Sem nada: só "Opções". Filtro: funil. Busca: lupa. Os dois: funil e lupa (15/11/2026).
  const o = estado.config && estado.config.opcoes;
  const iconesAtivos = () => ((o && (o.filtros || []).some((g) => g.valor !== g.padrao) ? icone('funilCheio') : '') +
    (o && o.busca && o.busca.valor ? icone('busca') : ''));
  if (estado.ocupado) {
    return `<button type="button" class="barra-tela-opcoes atualizando" data-barra="opcoes" aria-haspopup="dialog"
      aria-label="Atualizando a lista. Toque para as opções">${icone('atualizar')}<span class="barra-tela-opcoes-rotulo"
      role="status">Atualizando</span></button>`;
  }
  return `<button type="button" class="barra-tela-opcoes${n ? ' ativo' : ''}" data-barra="opcoes" aria-haspopup="dialog"
    aria-label="${n ? 'Aplicado: ' + esc(resumo(o, true)) + '. Toque para mudar' : 'Opções: buscar, filtrar e ações'}">
    ${iconesAtivos()}<span class="barra-tela-opcoes-rotulo">${esc(n ? linha : 'Opções')}</span>
  </button>`;
}

function desenharBarra() {
  const barra = $barra();
  const c = estado.config;
  if (!barra || !c) {
    return;
  }
  const o = c.opcoes;
  const n = ativos(o);
  const linha = resumo(o);
  barra.innerHTML = `
    ${c.voltar ? `<button type="button" class="barra-tela-botao barra-tela-voltar" data-voltar href="${esc(c.voltar)}"
      aria-label="Voltar">${icone('voltar')}</button>` : ''}
    <div class="barra-tela-textos">
      <h1 class="barra-tela-titulo">${esc(c.titulo)}</h1>
    </div>
    ${o ? botaoOpcoes(n, linha) : ''}`;
  const botao = barra.querySelector('[data-barra="opcoes"]');
  if (botao) {
    botao.addEventListener('click', () => {
      vibrar();
      abrirGaveta();
    });
  }
}

// ---------------------------------------------------------------------------
// Gaveta das Opções
// ---------------------------------------------------------------------------

/**
 * Só a busca na gaveta, sem filtros e ações, e sem o fundo escuro: a lista aparece (e aceita toques) atrás.
 * @param {boolean} ligado
 */
function modoSoBusca(ligado) {
  const g = $gaveta();
  g.classList.toggle('so-busca', ligado);
}

function abrirGaveta() {
  modoSoBusca(false);
  estado.aberta = true;
  desenharGaveta(true);
  $gaveta().classList.add('aberto');
}

function fecharGaveta() {
  estado.aberta = false;
  const g = document.getElementById('scrimOpcoes');
  if (g) {
    g.classList.remove('aberto', 'so-busca');
  }
}

/** @param {!Object} g Grupo de filtros. @return {string} HTML */
function htmlDoGrupo(g, indice) {
  if (g.tipo === 'select') {
    return `<label class="gaveta-grupo"><span class="gaveta-secao">${esc(g.titulo)}</span>
      <select class="form-select" data-grupo="${indice}">${g.itens.map((i) => `<option value="${esc(i.valor)}"${
  i.valor === g.valor ? ' selected' : ''}>${esc(i.texto)}</option>`).join('')}</select></label>`;
  }
  return `<fieldset class="gaveta-grupo"><legend class="gaveta-secao">${esc(g.titulo)}</legend>
    ${g.itens.map((i) => `<button type="button" class="gaveta-filtro${i.aEnviar ? ' gaveta-filtro-a-enviar' : ''}"
      data-grupo="${indice}" data-valor="${esc(i.valor)}" aria-pressed="${i.valor === g.valor}"${i.aEnviar ?
    ` aria-label="${esc(i.texto + (i.n !== undefined ? ', ' + i.n : '') + ', ' + i.aEnviar +
      (i.aEnviar === 1 ? ' com mudança a enviar' : ' com mudanças a enviar'))}"` : ''}>
      <span class="gaveta-marca" aria-hidden="true">${i.valor === g.valor ? '●' : '○'}</span>
      <span class="gaveta-filtro-texto">${esc(i.texto)}</span>${i.aEnviar ? `<span class="gaveta-filtro-envio" aria-hidden="true">${
  iconeSync('local')}</span>` : ''}${i.n !== undefined ? `<span class="chip-numero">${i.n}</span>` : ''}
    </button>`).join('')}</fieldset>`;
}

/**
 * @param {boolean} tudo true: monta a gaveta inteira (ao abrir); false: só filtros, ações e rodapé (o campo de
 *     busca fica como está, com o foco e o cursor).
 */
function desenharGaveta(tudo) {
  const folha = $gaveta().querySelector('.gaveta-opcoes');
  const c = estado.config;
  const o = c && c.opcoes;
  if (!o) {
    fecharGaveta();
    return;
  }
  const n = ativos(o);
  const variavel = `
    ${(o.filtros || []).map(htmlDoGrupo).join('')}
    ${(o.acoes || []).length || n ? `<div class="gaveta-grupo gaveta-grupo-acoes"><span class="gaveta-secao">Ações</span>
      ${(o.acoes || []).map((a, i) => `<button type="button" class="nav-item-btn gaveta-acao${
  a.destaque ? ' gaveta-acao-destaque' : ''}" data-acao="${i}"${a.rotulo ? ` aria-label="${esc(a.rotulo)}"` : ''}>
        <span>${esc(a.texto)}</span>${a.contador ? `<span class="gaveta-contador" aria-hidden="true">${
  esc(a.contador)}</span>` : ''}</button>`).join('')}
      ${n ? '<button type="button" class="nav-item-btn gaveta-acao" data-acao="limpar"><span>Limpar busca e filtros</span></button>' : ''}
    </div>` : ''}`;
  if (tudo) {
    folha.innerHTML = `
      <div class="bottom-sheet-topo">
        <h2 class="bottom-sheet-titulo" id="tituloOpcoes">Opções de ${esc(c.titulo)}</h2>
        <button type="button" class="btn-fechar-sheet" data-acao="fechar" aria-label="Fechar">✕</button>
      </div>
      ${o.busca ? `<label class="gaveta-grupo"><span class="gaveta-secao">Buscar</span>
        <span class="gaveta-busca${o.busca.valor ? ' com-texto' : ''}">
          <input type="search" id="iptBuscaOpcoes" class="form-input" placeholder="${esc(o.busca.rotulo)}" autocomplete="off"
            enterkeyhint="search" value="${esc(o.busca.valor || '')}" aria-label="${esc(o.busca.rotulo)}">
          <button type="button" class="barra-tela-botao" data-acao="limpar-busca" aria-label="Limpar a busca"${
  o.busca.valor ? '' : ' hidden'}>${icone('limpar')}</button>
          <button type="button" class="gaveta-lupa" data-acao="aplicar-busca" aria-label="Buscar">${icone('busca')}</button>
        </span></label>` : ''}
      <div id="gavetaVariavel" class="gaveta-variavel">${variavel}</div>`;
    ligarBusca(folha);
    folha.querySelector('[data-acao="fechar"]').addEventListener('click', fecharGaveta);
  } else {
    folha.querySelector('#gavetaVariavel').innerHTML = variavel;
  }
  ligarVariavel(folha);
}

/** @param {!HTMLElement} folha */
function ligarBusca(folha) {
  const campo = folha.querySelector('#iptBuscaOpcoes');
  if (!campo) {
    return;
  }
  // A busca filtra a cada letra; a lupa e o "Ir"/"Buscar" do teclado fecham a gaveta (15/11/2026).
  const caixa = folha.querySelector('.gaveta-busca');
  const limparBotao = folha.querySelector('[data-acao="limpar-busca"]');
  campo.addEventListener('input', () => {
    // Digitando: a gaveta fica só com o campo e o fundo some, para ver a lista filtrando (15/11/2026).
    modoSoBusca(Boolean(campo.value));
    caixa.classList.toggle('com-texto', Boolean(campo.value));
    limparBotao.hidden = !campo.value;
    estado.config.opcoes.busca.aoMudar(campo.value);
  });
  const aplicar = (texto) => {
    vibrar();
    campo.blur();
    fecharGaveta();
    estado.config.opcoes.busca.aoMudar(texto.trim());
  };
  campo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      aplicar(campo.value);
    }
  });
  folha.querySelector('[data-acao="aplicar-busca"]').addEventListener('click', () => aplicar(campo.value));
  const limpar = folha.querySelector('[data-acao="limpar-busca"]');
  if (limpar) {
    limpar.addEventListener('click', () => aplicar(''));
  }
}

/** @param {!HTMLElement} folha */
function ligarVariavel(folha) {
  const o = estado.config.opcoes;
  folha.querySelectorAll('.gaveta-filtro').forEach((b) => b.addEventListener('click', () => {
    vibrar();
    fecharGaveta(); // tocar numa opção já mostra a lista (15/11/2026)
    o.filtros[Number(b.dataset.grupo)].aoEscolher(b.dataset.valor);
  }));
  folha.querySelectorAll('select[data-grupo]').forEach((s) => s.addEventListener('change', () => {
    fecharGaveta();
    o.filtros[Number(s.dataset.grupo)].aoEscolher(s.value);
  }));
  folha.querySelectorAll('[data-acao]').forEach((b) => {
    const acao = b.dataset.acao;
    if (acao === 'limpar') {
      b.addEventListener('click', () => {
        vibrar();
        fecharGaveta();
        o.aoLimpar();
        const campo = folha.querySelector('#iptBuscaOpcoes');
        if (campo) {
          campo.value = '';
        }
      });
    } else if (/^\d+$/.test(acao)) {
      b.addEventListener('click', () => {
        vibrar();
        fecharGaveta();
        o.acoes[Number(acao)].aoTocar();
      });
    }
  });
}
