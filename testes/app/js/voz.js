/**
 * @fileoverview Módulo de Acessibilidade de Voz Universal (STT / TTS) com Cápsula Dupla.
 * Módulo: testes/app/js/voz.js
 * Conformidade com: dev/padroes/02_javascript_google.md e dev/padroes/05_acessibilidade_ergonomia.md
 */

let synth = null;
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  synth = window.speechSynthesis;
}

let elementoLeituraAtivo = null;
let campoDitadoAtivo = null;
let reconhecimentoVoz = null;
let estaGravando = false;

/**
 * Lê um texto em voz alta utilizando SpeechSynthesis.
 * @param {string} texto
 * @param {HTMLElement} [elementoVisual=null]
 * @return {void}
 */
export function lerTextoEmVozAlta(texto, elementoVisual = null) {
  if (!synth) {
    alert('Síntese de voz não suportada neste navegador.');
    return;
  }

  if (synth.speaking) {
    synth.cancel();
    if (elementoLeituraAtivo) {
      elementoLeituraAtivo.style.outline = 'none';
      elementoLeituraAtivo = null;
    }
  }

  if (!texto || texto.trim() === '') {
    return;
  }

  const utter = new SpeechSynthesisUtterance(texto.trim());
  utter.lang = 'pt-BR';
  utter.rate = 0.95;

  if (elementoVisual) {
    elementoLeituraAtivo = elementoVisual;
    elementoVisual.style.outline = '3px solid var(--ssvp-blue)';
  }

  utter.onend = () => {
    if (elementoLeituraAtivo) {
      elementoLeituraAtivo.style.outline = 'none';
      elementoLeituraAtivo = null;
    }
  };

  utter.onerror = () => {
    if (elementoLeituraAtivo) {
      elementoLeituraAtivo.style.outline = 'none';
      elementoLeituraAtivo = null;
    }
  };

  synth.speak(utter);
}

/**
 * Define o elemento focado para o modo de ditado da Cápsula Dupla.
 * @param {HTMLInputElement|HTMLTextAreaElement|null} campo
 * @return {void}
 */
export function vincularCampoParaDitado(campo) {
  campoDitadoAtivo = campo;
  const capsula = document.getElementById('capsulaDupla');
  const btnCentral = document.getElementById('btn_voz');

  if (campo) {
    if (capsula) capsula.classList.add('ativa');
    if (btnCentral) btnCentral.style.display = 'none';
  } else {
    if (capsula) capsula.classList.remove('ativa');
    if (btnCentral) btnCentral.style.display = 'flex';
  }
}

/**
 * Alterna a gravação de voz (STT) para ditar no campo ativo.
 * @return {void}
 */
export function alternarDitadoVoz() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    alert('Reconhecimento de voz não suportado neste navegador. Use digitação manual.');
    return;
  }

  if (estaGravando && reconhecimentoVoz) {
    reconhecimentoVoz.stop();
    return;
  }

  try {
    reconhecimentoVoz = new SpeechRecognition();
    reconhecimentoVoz.lang = 'pt-BR';
    reconhecimentoVoz.continuous = false;
    reconhecimentoVoz.interimResults = false;

    const btnFalar = document.getElementById('btnCapsulaFalar');

    reconhecimentoVoz.onstart = () => {
      estaGravando = true;
      if (btnFalar) btnFalar.style.backgroundColor = 'var(--ssvp-green)';
    };

    reconhecimentoVoz.onresult = (evento) => {
      const transcricao = evento.results[0][0].transcript;
      if (campoDitadoAtivo) {
        const valorAtual = campoDitadoAtivo.value;
        campoDitadoAtivo.value = valorAtual ? `${valorAtual} ${transcricao}` : transcricao;
        campoDitadoAtivo.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    reconhecimentoVoz.onend = () => {
      estaGravando = false;
      if (btnFalar) btnFalar.style.backgroundColor = 'var(--ssvp-red)';
    };

    reconhecimentoVoz.onerror = () => {
      estaGravando = false;
      if (btnFalar) btnFalar.style.backgroundColor = 'var(--ssvp-red)';
    };

    reconhecimentoVoz.start();
  } catch (erro) {
    console.warn('[Voz] Falha ao iniciar reconhecimento:', erro);
  }
}
