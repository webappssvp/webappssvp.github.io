/**
 * @fileoverview Cuidados (#cuidados, 23/11/2026): fichas de micro-hábitos para o vicentino ler ou ouvir antes da visita.
 *
 * O conteúdo vem de siglas/cuidados.json, gerado de dev_local/oms/micro_habitos_oms.md, e faz parte da casca: funciona
 * sem internet. É geral e não guarda nada sobre as famílias. Enquanto não houver revisão, a tela avisa.
 */

import {esc} from './comum.js';
import {definirBarra} from '../componentes/barra_tela.js';
import {vibrar} from '../core/preferencias.js';
import {lerEmVozAlta, pararLeitura} from '../core/voz.js';

const ARQUIVO = 'siglas/cuidados.json';

const INTRO = 'Pequenos hábitos para conversar com as famílias. Leia em casa ou ouça a caminho da visita.';
const AVISO = 'Estas fichas ainda estão em revisão por profissionais de saúde, de assistência social e pela assessoria ' +
  'espiritual. Não falam em nome da SSVP nem da OMS.';

let conteudo = null;
let vigia = 0;

/** Negrito, itálico e nada mais: todo o resto é escapado. */
function inline(texto) {
  return String(texto).split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((t) => {
    if (/^\*\*.+\*\*$/.test(t)) {
      return `<strong>${esc(t.slice(2, -2))}</strong>`;
    }
    if (/^\*.+\*$/.test(t)) {
      return `<em>${esc(t.slice(1, -1))}</em>`;
    }
    return esc(t);
  }).join('');
}

/** "Documento: <https://...>" vira um link com o nome. */
function item(texto) {
  const link = String(texto).match(/^([^:]+): <(https:\/\/[^>\s]+)>$/);
  if (link) {
    return `<a href="${esc(link[2])}" target="_blank" rel="noopener noreferrer">${esc(link[1])} ↗</a>`;
  }
  return inline(texto);
}

function bloco(b) {
  if (b.tipo === 'p') {
    return `<p>${inline(b.texto)}</p>`;
  }
  return `<${b.tipo}>${b.itens.map((i) => `<li>${item(i)}</li>`).join('')}</${b.tipo}>`;
}

/** Destino com número vira um toque para ligar. */
function destino(texto) {
  const nome = String(texto).replace(/\*/g, '');
  return esc(nome).replace(/\b(\d{3})\b/g, '<a href="tel:$1">$1</a>');
}

const limpo = (t) => String(t).replace(/\*/g, '');

/** O texto da ficha para ouvir, sem os links. */
function falaDaFicha(cuidado, ficha) {
  const partes = [cuidado.titulo + '. ' + ficha.titulo + '.'];
  ficha.secoes.forEach((s) => {
    partes.push(s.titulo + '.');
    s.blocos.forEach((b) => {
      if (b.tipo === 'p') {
        partes.push(limpo(b.texto));
      } else {
        b.itens.filter((i) => !/<https?:/.test(i)).forEach((i, n) => {
          partes.push((b.tipo === 'ol' ? (n + 1) + '. ' : '') + limpo(i));
        });
      }
    });
  });
  return partes.join(' ');
}

function htmlFicha(ficha, ci, fi) {
  return `
    <details class="cuidados-ficha" data-ficha="${ci}.${fi}">
      <summary>${esc(ficha.titulo)}</summary>
      <div class="cuidados-corpo">
        <button type="button" class="btn-secundario cuidados-ouvir" data-ouvir="${ci}.${fi}">🔊 Ouvir esta ficha</button>
        ${ficha.secoes.map((s) => `
        <section class="cuidados-secao">
          <h3>${esc(s.titulo)}${s.nota ? ` <small>(${esc(s.nota)})</small>` : ''}</h3>
          ${s.blocos.map(bloco).join('')}
        </section>`).join('')}
      </div>
    </details>`;
}

function html(c) {
  return `
    <p class="sobre-intro">${esc(INTRO)}</p>
    <p class="sobre-aviso cuidados-aviso" role="note"><strong>Em revisão:</strong> ${esc(AVISO)}</p>
    <div class="sobre-perguntas cuidados-lista">
      ${c.cuidados.map((cuidado, ci) => `
      <details class="sobre-pergunta cuidados-cuidado" name="cuidado">
        <summary>${esc(cuidado.titulo)}</summary>
        <div class="cuidados-fichas">${cuidado.fichas.map((f, fi) => htmlFicha(f, ci, fi)).join('')}</div>
      </details>`).join('')}
    </div>
    <div class="sobre-perguntas cuidados-apoio">
      <details class="sobre-pergunta cuidados-encaminhar" name="cuidado">
        <summary>Onde encaminhar</summary>
        <div class="sobre-resposta">
          <dl class="cuidados-destinos">
            ${c.encaminhar.map((e) => `<div><dt>${esc(e.situacao)}</dt><dd>${destino(e.destino)}</dd></div>`).join('')}
          </dl>
        </div>
      </details>
      <details class="sobre-pergunta cuidados-principios" name="cuidado">
        <summary>Como conversar</summary>
        <div class="sobre-resposta"><ol>${c.principios.map((p) => `<li>${inline(p)}</li>`).join('')}</ol></div>
      </details>
    </div>`;
}

/** Troca o botão entre Ouvir e Parar, e volta sozinho quando a leitura termina. */
function mostrarLendo(tela, botao) {
  clearInterval(vigia);
  tela.querySelectorAll('[data-ouvir]').forEach((b) => {
    b.textContent = b === botao ? '⏹ Parar' : '🔊 Ouvir esta ficha';
  });
  if (!botao) {
    return;
  }
  let comecou = false;
  const inicio = Date.now();
  vigia = setInterval(() => {
    const falando = window.speechSynthesis && window.speechSynthesis.speaking;
    comecou = comecou || falando;
    if (!botao.isConnected || (!falando && (comecou || Date.now() - inicio > 3000))) {
      mostrarLendo(tela, null);
    }
  }, 400);
}

/**
 * @param {!HTMLElement} area
 * @return {function(): string} Texto para o modo Ouvir: a ficha aberta ou o resumo.
 */
export function renderizar(area) {
  definirBarra({titulo: 'Cuidados'});
  area.innerHTML = '<div class="tela-sobre tela-cuidados"><p class="sobre-intro">Carregando…</p></div>';
  const tela = area.querySelector('.tela-cuidados');
  let lendo = '';

  const ficha = (chave) => {
    const [ci, fi] = chave.split('.').map(Number);
    return {cuidado: conteudo.cuidados[ci], ficha: conteudo.cuidados[ci].fichas[fi]};
  };

  (conteudo ? Promise.resolve(conteudo) : fetch(ARQUIVO).then((r) => r.json())).then((c) => {
    conteudo = c;
    if (tela.isConnected) {
      tela.innerHTML = html(c);
    }
  }).catch(() => {
    tela.innerHTML = '<p class="sobre-aviso">Não foi possível abrir as fichas. Tente de novo com internet.</p>';
  });

  tela.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-ouvir]');
    if (!botao) {
      return;
    }
    vibrar();
    if (lendo === botao.dataset.ouvir && window.speechSynthesis && window.speechSynthesis.speaking) {
      lendo = '';
      pararLeitura();
      mostrarLendo(tela, null);
      return;
    }
    lendo = botao.dataset.ouvir;
    const f = ficha(lendo);
    lerEmVozAlta(falaDaFicha(f.cuidado, f.ficha));
    mostrarLendo(tela, botao);
  });

  // Saiu da tela: a leitura da ficha não continua em outra.
  window.addEventListener('hashchange', () => {
    clearInterval(vigia);
    if (lendo) {
      pararLeitura();
    }
  }, {once: true});

  return () => {
    const aberta = tela.querySelector('.cuidados-ficha[open]');
    if (aberta && conteudo) {
      const f = ficha(aberta.dataset.ficha);
      return falaDaFicha(f.cuidado, f.ficha);
    }
    return conteudo ? 'Cuidados. ' + INTRO + ' ' + AVISO + ' ' + conteudo.cuidados.map((c) => c.titulo).join('. ') + '.' :
      INTRO;
  };
}
