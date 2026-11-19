/**
 * @fileoverview Tela da tranca (19/11/2026, trava.js): criar e abrir com um desenho de 9 pontos, ou com um PIN de
 * 4 a 6 números (para quem tem dificuldade de arrastar o dedo ou usa leitor de tela).
 *
 * - Criar: desenhar (4 pontos ou mais) e repetir; ou "Prefiro números", digitar o PIN e repetir.
 * - Abrir: desenho ou PIN. Errado: "Restam N tentativas". Na última errada, o app esquece tudo neste celular.
 * - "Esqueci o desenho": esquece as sessões e os dados guardados e volta para o e-mail e a senha.
 * A tela fica por cima de tudo (dentro da moldura de celular no computador) até terminar.
 */

import * as trava from '../core/trava.js';
import {definirPreferencia} from '../core/preferencias.js';

/** Pontos do campo, de 1 a 9, em linhas de 3. Coordenadas no SVG de 300 × 300. */
const PONTOS = Array.from({length: 9}, (_, i) => ({n: i + 1, x: 50 + (i % 3) * 100, y: 50 + Math.floor(i / 3) * 100}));
const RAIO_TOQUE = 38;
const MINIMO_PONTOS = 4;

/** @param {*} t @return {string} */
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  '\'': '&#39;'}[c]));

let aberta = null; // a tela em uso (uma por vez)

/**
 * Mostra a tela e espera terminar.
 * @param {string} modo 'criar' ou 'abrir'
 * @param {{aoEsquecer: function(): !Promise<void>, aposLogin: (boolean|undefined)}} opcoes aoEsquecer: apaga as
 *     sessões e os dados guardados (esqueci o desenho, erros demais). aposLogin: acabou de entrar com a senha;
 *     "esqueci o desenho" só troca o desenho, sem sair.
 * @return {!Promise<void>} Resolve com a tranca aberta (criada ou desenhada certo).
 */
export function pedir(modo, opcoes) {
  if (aberta) {
    return aberta.promessa;
  }
  let concluir;
  const promessa = new Promise((r) => {
    concluir = r;
  });
  const fundo = document.createElement('div');
  fundo.className = 'tela-trava';
  fundo.setAttribute('role', 'dialog');
  fundo.setAttribute('aria-modal', 'true');
  fundo.setAttribute('aria-labelledby', 'travaTitulo');
  document.body.appendChild(fundo);
  document.body.classList.add('com-trava');
  aberta = {promessa, fundo, modo, opcoes, usarPin: modo === 'abrir' ? trava.tipo() === 'pin' : false, primeiro: '',
    concluir: () => {
      fundo.remove();
      document.body.classList.remove('com-trava');
      aberta = null;
      concluir();
    }};
  desenhar();
  return promessa;
}

/** @return {boolean} A tela está aberta. */
export function mostrando() {
  return Boolean(aberta);
}

function desenhar(aviso = '', tipoAviso = '') {
  const t = aberta;
  const criando = t.modo === 'criar';
  const repetindo = criando && Boolean(t.primeiro);
  const nome = t.usarPin ? 'PIN' : 'desenho';
  const titulo = criando ? (repetindo ? `Repita o ${nome}` : (t.usarPin ? 'Crie um PIN para abrir o app' :
    'Crie um desenho para abrir o app')) : (t.usarPin ? 'Digite o seu PIN' : 'Desenhe para abrir o app');
  const explica = criando ? (repetindo ? 'Para conferir.' : `O app tranca quando fica parado e pede o ${nome}. ` +
    `Se o celular for perdido, ninguém abre a conferência sem ele.` +
    (t.usarPin ? ' De 4 a 6 números.' : ` Ligue ${MINIMO_PONTOS} pontos ou mais.`)) :
    'Por segurança, o app trancou.';
  t.fundo.innerHTML = `
    <div class="trava-caixa">
      <h2 class="trava-titulo" id="travaTitulo">${esc(titulo)}</h2>
      <p class="trava-texto">${esc(explica)}</p>
      ${criando && !repetindo ? `<p class="trava-dica">${t.usarPin ?
    'Dica: 6 números, sem data de nascimento, sequência (123456) ou repetidos (111111).' :
    'Dica: diferente do desenho que desbloqueia o celular, com 5 pontos ou mais. Evite L, Z, quadrado e linha reta.'}</p>` : ''}
      ${t.usarPin ? `
        <form class="trava-pin" data-trava="pin" autocomplete="off">
          <label class="visualmente-oculto" for="travaPin">${esc(titulo)}</label>
          <input id="travaPin" class="form-input trava-pin-campo" type="password" inputmode="numeric" pattern="[0-9]*"
            minlength="4" maxlength="6" autocomplete="off" required>
          <button type="submit" class="btn-submit">${criando ? (repetindo ? 'Confirmar' : 'Continuar') : 'Abrir'}</button>
        </form>` : `
        <svg class="trava-desenho" viewBox="0 0 300 300" role="img" aria-label="Campo de 9 pontos para desenhar">
          <polyline class="trava-linha" points=""/>
          <line class="trava-linha-dedo" x1="0" y1="0" x2="0" y2="0" visibility="hidden"/>
          ${PONTOS.map((p) => `<g class="trava-ponto" data-ponto="${p.n}">
            <circle class="trava-ponto-aro" cx="${p.x}" cy="${p.y}" r="28"/>
            <circle class="trava-ponto-miolo" cx="${p.x}" cy="${p.y}" r="9"/></g>`).join('')}
        </svg>`}
      <p class="trava-aviso ${esc(tipoAviso)}" role="alert">${esc(aviso)}</p>
      <div class="trava-links">
        ${criando && !repetindo ? `<button type="button" class="link-conexao" data-trava="trocar">${t.usarPin ?
    'Prefiro desenhar' : 'Prefiro números (PIN)'}</button>` : ''}
        ${repetindo ? '<button type="button" class="link-conexao" data-trava="recomecar">Começar de novo</button>' : ''}
        ${!criando ? `<button type="button" class="link-conexao" data-trava="esqueci">Esqueci o ${nome}</button>` : ''}
      </div>
    </div>`;
  ligar();
}

function ligar() {
  const t = aberta;
  const f = t.fundo;
  const trocar = f.querySelector('[data-trava="trocar"]');
  if (trocar) {
    trocar.addEventListener('click', () => {
      t.usarPin = !t.usarPin;
      t.primeiro = '';
      desenhar();
    });
  }
  const recomecar = f.querySelector('[data-trava="recomecar"]');
  if (recomecar) {
    recomecar.addEventListener('click', () => {
      t.primeiro = '';
      desenhar();
    });
  }
  const esqueci = f.querySelector('[data-trava="esqueci"]');
  if (esqueci) {
    esqueci.addEventListener('click', esqueceu);
  }
  const pin = f.querySelector('[data-trava="pin"]');
  if (pin) {
    const campo = f.querySelector('#travaPin');
    campo.focus();
    pin.addEventListener('submit', (e) => {
      e.preventDefault();
      const valor = campo.value.trim();
      if (!/^\d{4,6}$/.test(valor)) {
        desenhar('O PIN tem de 4 a 6 números.', 'erro');
        return;
      }
      recebeu(valor);
    });
  }
  const svg = f.querySelector('.trava-desenho');
  if (svg) {
    ligarDesenho(svg);
  }
}

/** Arrastar o dedo (ou o mouse) pelos pontos. @param {!SVGSVGElement} svg */
function ligarDesenho(svg) {
  const linha = svg.querySelector('.trava-linha');
  const dedo = svg.querySelector('.trava-linha-dedo');
  let caminho = [];
  let desenhando = false;
  const ponto = (e) => {
    const r = svg.getBoundingClientRect();
    return {x: (e.clientX - r.left) * 300 / r.width, y: (e.clientY - r.top) * 300 / r.height};
  };
  const marcar = (n) => {
    // Passou por cima de um ponto do meio sem tocá-lo (ex.: de 1 a 3): ele entra também, como no Android.
    const ultimo = caminho[caminho.length - 1];
    if (ultimo) {
      const a = PONTOS[ultimo - 1];
      const b = PONTOS[n - 1];
      const meio = PONTOS.find((p) => p.x === (a.x + b.x) / 2 && p.y === (a.y + b.y) / 2);
      if (meio && !caminho.includes(meio.n)) {
        caminho.push(meio.n);
      }
    }
    caminho.push(n);
    svg.querySelector(`[data-ponto="${n}"]`).classList.add('ligado');
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    linha.setAttribute('points', caminho.map((k) => PONTOS[k - 1].x + ',' + PONTOS[k - 1].y).join(' '));
  };
  const mover = (e) => {
    if (!desenhando) {
      return;
    }
    const p = ponto(e);
    const perto = PONTOS.find((q) => Math.hypot(q.x - p.x, q.y - p.y) < RAIO_TOQUE && !caminho.includes(q.n));
    if (perto) {
      marcar(perto.n);
    }
    const ultimo = caminho[caminho.length - 1];
    if (ultimo) {
      dedo.setAttribute('x1', PONTOS[ultimo - 1].x);
      dedo.setAttribute('y1', PONTOS[ultimo - 1].y);
      dedo.setAttribute('x2', p.x);
      dedo.setAttribute('y2', p.y);
      dedo.setAttribute('visibility', 'visible');
    }
  };
  svg.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    caminho = [];
    svg.querySelectorAll('.ligado').forEach((g) => g.classList.remove('ligado'));
    desenhando = true;
    mover(e);
  });
  svg.addEventListener('pointermove', mover);
  const fim = () => {
    if (!desenhando) {
      return;
    }
    desenhando = false;
    dedo.setAttribute('visibility', 'hidden');
    if (!caminho.length) {
      return;
    }
    if (caminho.length < MINIMO_PONTOS && aberta.modo === 'criar') {
      desenhar(`Ligue ${MINIMO_PONTOS} pontos ou mais.`, 'erro');
      return;
    }
    recebeu(caminho.join('-'));
  };
  svg.addEventListener('pointerup', fim);
  svg.addEventListener('pointercancel', fim);
}

/** Um desenho ou PIN completo. @param {string} segredo */
async function recebeu(segredo) {
  const t = aberta;
  const qual = t.usarPin ? 'pin' : 'desenho';
  if (t.modo === 'criar') {
    if (!t.primeiro) {
      t.primeiro = segredo;
      desenhar();
      return;
    }
    if (segredo !== t.primeiro) {
      t.primeiro = '';
      desenhar(`Os dois não são iguais. Crie o ${t.usarPin ? 'PIN' : 'desenho'} de novo.`, 'erro');
      return;
    }
    desenhar('Guardando…');
    await trava.criar(qual, segredo);
    escolherTempo();
    return;
  }
  desenhar('Conferindo…');
  if (await trava.abrir(segredo)) {
    t.concluir();
    return;
  }
  const restam = trava.restantes();
  if (restam <= 0) {
    desenhar(`Errou ${trava.TENTATIVAS} vezes. Por segurança, o app saiu das conferências neste celular. ` +
      'Entre de novo com o seu e-mail e a sua senha.', 'erro');
    await t.opcoes.aoEsquecer();
    return;
  }
  desenhar(`${t.usarPin ? 'PIN' : 'Desenho'} errado. ${restam === 1 ? 'Resta 1 tentativa' :
    'Restam ' + restam + ' tentativas'}; depois, o app sai das conferências neste celular.`, 'erro');
}

/** Depois de criar: quanto tempo parado até trancar (o mesmo das Configurações). */
function escolherTempo() {
  const t = aberta;
  const atual = trava.minutos();
  t.fundo.innerHTML = `
    <div class="trava-caixa">
      <h2 class="trava-titulo" id="travaTitulo">Trancar o app depois de quanto tempo parado?</h2>
      <p class="trava-texto">Dá para mudar depois: toque nos 3 pontinhos do alto e em Configurações.</p>
      <fieldset class="trava-tempos">
        <legend class="visualmente-oculto">Trancar depois de</legend>
        ${trava.OPCOES_MINUTOS.map((m) => `<label class="trava-tempo">
          <input type="radio" name="travaTempo" value="${m}"${m === atual ? ' checked' : ''}>
          <span>${m === 1 ? '1 minuto' : m + ' minutos'}</span></label>`).join('')}
      </fieldset>
      <button type="button" class="btn-submit" data-trava="pronto">Pronto</button>
    </div>`;
  t.fundo.querySelector('[data-trava="pronto"]').addEventListener('click', async () => {
    const escolhido = t.fundo.querySelector('input[name="travaTempo"]:checked');
    await definirPreferencia('trancar', escolhido ? escolhido.value : '15');
    t.concluir();
  });
}

async function esqueceu() {
  const t = aberta;
  if (t.opcoes.aposLogin) {
    // Acabou de entrar com a senha: só troca o desenho (as outras conferências deste celular saem).
    await trava.esquecer();
    t.modo = 'criar';
    t.primeiro = '';
    desenhar();
    return;
  }
  if (!window.confirm('Para criar outro, o app sai das conferências neste celular e pede o seu e-mail e a sua ' +
    'senha. O que ainda não foi enviado continua guardado. Continuar?')) {
    return;
  }
  await t.opcoes.aoEsquecer();
}
