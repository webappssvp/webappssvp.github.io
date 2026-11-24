/**
 * @fileoverview Botão central da barra inferior: FALAR (ditado) e OUVIR (leitura em voz alta).
 * - Toque rápido: faz a ação do modo (ditar no campo, ou ler / parar a leitura).
 * - Segurar 0,6 s: troca entre Falar e Ouvir.
 * O ditado vai para o último campo de texto tocado. O que é lido vem da tela atual (definirLeitor).
 * Origem: testes/app/t3_casca.html. Decisões: mvp/telas/00_casca.md
 */

import {vibrar, bipar} from './preferencias.js';
import {paraComplemento, paraEmail, paraLogradouro, paraNumeroDoEndereco} from './numeros_falados.js';

const TEMPO_SEGURAR_MS = 600;

const estado = {
  modo: 'falar', // 'falar' ou 'ouvir'
  lendo: false,
  timer: null,
  foiLongo: false,
  /** @type {?HTMLInputElement|?HTMLTextAreaElement} */
  campo: null,
  /** @type {function(): string} */
  leitor: () => '',
  avisar: (texto) => {},
  bloqueado: () => false,
};
const el = {};

/**
 * @param {{avisar: function(string): void, bloqueado: function(): boolean}} opcoes
 *     avisar mostra um aviso curto; bloqueado diz se o modo de ajuda está ligado.
 */
export function iniciarBotaoVoz(opcoes) {
  estado.avisar = opcoes.avisar;
  estado.bloqueado = opcoes.bloqueado;
  ['btnAudioHub', 'imgMicSvg', 'svgSpeaker', 'svgStop', 'lblAudioTexto'].forEach((id) => {
    el[id] = document.getElementById(id);
  });
  const b = el.btnAudioHub;
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('pointerdown', apertar);
  b.addEventListener('pointerup', soltar);
  b.addEventListener('pointerleave', cancelar);
  b.addEventListener('pointercancel', cancelar);
  // Teclado (Enter/Espaço) também aciona, sem o toque longo.
  b.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      acao();
    }
  });

  document.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && /^(text|search|email|tel|)$/.test(t.type))) {
      estado.campo = t;
    }
  });
  mostrarModo();
}

/**
 * A tela atual diz o que o modo Ouvir lê.
 * @param {function(): string} leitor
 */
/** @return {function(): string} O leitor atual (o tutorial guarda e devolve ao fechar). */
export function leitorAtual() {
  return estado.leitor;
}

export function definirLeitor(leitor) {
  estado.leitor = leitor || (() => '');
  pararLeitura();
}

function apertar() {
  if (estado.bloqueado()) {
    return;
  }
  estado.foiLongo = false;
  el.btnAudioHub.classList.add('pressionando');
  vibrar(15);
  estado.timer = setTimeout(() => {
    estado.foiLongo = true;
    trocarModo();
  }, TEMPO_SEGURAR_MS);
}

function soltar() {
  if (estado.bloqueado()) {
    return;
  }
  el.btnAudioHub.classList.remove('pressionando');
  clearTimeout(estado.timer);
  if (!estado.foiLongo) {
    acao();
  }
}

function cancelar() {
  el.btnAudioHub.classList.remove('pressionando');
  clearTimeout(estado.timer);
}

function trocarModo() {
  vibrar(60);
  bipar(880);
  pararLeitura();
  estado.modo = estado.modo === 'falar' ? 'ouvir' : 'falar';
  mostrarModo();
  estado.avisar(estado.modo === 'ouvir' ? 'Modo Ouvir: toque para ouvir a tela' : 'Modo Falar: toque num campo e depois aqui');
}

function mostrarModo() {
  const ouvir = estado.modo === 'ouvir';
  el.btnAudioHub.classList.toggle('modo-ouvir', ouvir);
  el.btnAudioHub.classList.toggle('falando-ativo', estado.lendo);
  // toggleAttribute: o <svg> não tem a propriedade hidden, só o atributo.
  el.imgMicSvg.toggleAttribute('hidden', ouvir);
  el.svgSpeaker.toggleAttribute('hidden', !ouvir || estado.lendo);
  el.svgStop.toggleAttribute('hidden', !(ouvir && estado.lendo));
  el.lblAudioTexto.textContent = !ouvir ? 'Falar' : (estado.lendo ? 'Parar' : 'Ouvir');
}

function acao() {
  vibrar(35);
  if (estado.modo === 'falar') {
    ditar();
  } else if (estado.lendo) {
    pararLeitura();
  } else {
    ler(estado.leitor());
  }
}

// ---------------------------------------------------------------------------
// Ouvir
// ---------------------------------------------------------------------------

/** Cada leitura tem um número: o aviso de uma fala cancelada não mexe na leitura seguinte. */
let vezDaLeitura = 0;

/**
 * Divide em frases de até 200 letras: o Chrome pode interromper uma fala muito longa (23/11/2026).
 * @param {string} texto
 * @return {!Array<string>}
 */
function pedacosDeFala(texto) {
  const frases = String(texto).match(/[^.!?;:]+[.!?;:]*\s*/g) || [String(texto)];
  const pedacos = [];
  frases.forEach((frase) => {
    const ultimo = pedacos.length - 1;
    if (ultimo >= 0 && pedacos[ultimo].length + frase.length <= 200) {
      pedacos[ultimo] += frase;
    } else {
      pedacos.push(frase);
    }
  });
  return pedacos;
}

/** @param {string} texto */
function ler(texto) {
  if (!texto) {
    estado.avisar('Nada para ler nesta tela.');
    return;
  }
  if (!('speechSynthesis' in window)) {
    estado.avisar('Este navegador não lê em voz alta.');
    return;
  }
  window.speechSynthesis.cancel();
  const vez = ++vezDaLeitura;
  const terminar = () => {
    if (vez === vezDaLeitura) {
      estado.lendo = false;
      mostrarModo();
    }
  };
  const pedacos = pedacosDeFala(texto);
  pedacos.forEach((pedaco, i) => {
    const fala = new SpeechSynthesisUtterance(pedaco);
    fala.lang = 'pt-BR';
    fala.rate = 0.95; // um pouco mais devagar, para quem tem mais idade
    fala.onstart = () => {
      if (vez === vezDaLeitura) {
        estado.lendo = true;
        mostrarModo();
      }
    };
    fala.onerror = terminar;
    if (i === pedacos.length - 1) {
      fala.onend = terminar;
    }
    window.speechSynthesis.speak(fala);
  });
}

/**
 * Lê um texto em voz alta, fora do modo Ouvir (ex.: o "Ouvir" da gaveta "O que diz a Regra").
 * @param {string} texto
 */
export function lerEmVozAlta(texto) {
  ler(texto);
}

export function pararLeitura() {
  vezDaLeitura++;
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  estado.lendo = false;
  if (el.btnAudioHub) {
    mostrarModo();
  }
}

// ---------------------------------------------------------------------------
// Falar (ditado)
// ---------------------------------------------------------------------------

/**
 * Campo de endereço que converte números falados (15/11/2026): pelo data-voz, ou pelo fim do id
 * (novo_numero, end_complemento, fam_logradouro…).
 * @param {!HTMLElement} campo
 * @return {string} numero, complemento, logradouro ou ''.
 */
function tipoDoCampo(campo) {
  if (campo.dataset.voz) {
    return campo.dataset.voz;
  }
  if (campo.type === 'email' || /_email$/.test(campo.id || '')) {
    return 'email'; // sem espaços nem maiúsculas (24/11/2026)
  }
  const m = /_(numero|complemento|logradouro)$/.exec(campo.id || '');
  return m ? m[1] : '';
}

/**
 * @param {string} tipo
 * @param {string} texto O que o reconhecedor mandou.
 * @return {string} Número e complemento em algarismos; rua na grafia dos Correios (por extenso); o resto como veio.
 */
function converterDitado(tipo, texto) {
  if (tipo === 'numero') {
    return paraNumeroDoEndereco(texto);
  }
  if (tipo === 'complemento') {
    return paraComplemento(texto);
  }
  if (tipo === 'logradouro') {
    return paraLogradouro(texto, {datas: 'extenso'}); // a grafia dos Correios ("Avenida Vinte e Três de Maio"; 15/11/2026)
  }
  if (tipo === 'email') {
    return paraEmail(texto);
  }
  return texto;
}

function ditar() {
  const campo = estado.campo && document.contains(estado.campo) ? estado.campo : null;
  if (!campo) {
    estado.avisar('Toque primeiro no campo onde quer escrever.');
    return;
  }
  const Reconhecedor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Reconhecedor) {
    estado.avisar('Este navegador não reconhece a fala. Use o teclado.');
    return;
  }
  const ligar = (sim) => {
    campo.classList.toggle('gravando-voz', sim);
    el.btnAudioHub.classList.toggle('gravando-ativo', sim);
  };
  try {
    const rec = new Reconhecedor();
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onstart = () => {
      ligar(true);
      bipar(700);
      estado.avisar('🎙️ Pode falar…');
    };
    rec.onresult = (e) => {
      const tipo = tipoDoCampo(campo);
      const falado = e.results[0][0].transcript;
      // No número, ditar de novo é corrigir: substitui. No e-mail, continua do que já estava (ditar em partes) e
      // converte tudo junto, para não repetir o final. Nos outros campos, junta ao que já estava, com um espaço.
      if (tipo === 'email') {
        campo.value = converterDitado(tipo, campo.value + ' ' + falado);
      } else {
        const texto = converterDitado(tipo, falado);
        campo.value = tipo === 'numero' || !campo.value ? texto : campo.value + ' ' + texto;
      }
      campo.dataset.ditado = 'sim'; // a visita grava relato_origem = VOZ
      campo.dispatchEvent(new Event('input', {bubbles: true}));
      bipar(1046.5);
    };
    rec.onerror = () => estado.avisar('Não consegui ouvir. Tente de novo.');
    rec.onend = () => ligar(false);
    rec.start();
  } catch (erro) {
    ligar(false);
    estado.avisar('Precisa permitir o uso do microfone.');
  }
}
