/**
 * @fileoverview Módulo de Voz Universal SSVP (STT & TTS Sincronizados com Cápsula Dupla).
 * Gerencia a ponte cromática e visual:
 * - AZUL SSVP (#0064B6 / #38BDF8) para OUVIR relatos e metas em voz alta (TTS).
 * - VERMELHO SSVP (#DC2626 / #EF4444) para FALAR e ditar em campos de texto (STT).
 * - Opção B: Cápsula Dupla no Rodapé ([🎙️ Falar] e [⌨️ Teclado]) ativada ao focar em campos.
 * - Controle de teclado virtual com inputmode="none" para não cobrir a tela na fala por voz.
 * - Ditado limpo com interimResults=false para eliminar repetições de palavras.
 * Conformidade estrita com: dev/padroes/02_javascript_google.md e dev/padroes/05_acessibilidade_ergonomia.md
 */

/**
 * Estados operacionais do botão central de voz.
 * @enum {string}
 */
export const ModosVoz = {
  OUVIR: 'OUVIR',
  FALAR: 'FALAR',
  GRAVANDO: 'GRAVANDO',
  TOCANDO: 'TOCANDO'
};

/**
 * Estado atual da máquina de estados de voz.
 * @type {string}
 */
let modoAtual = ModosVoz.OUVIR;

/**
 * Instância global da API de Reconhecimento de Fala (STT).
 * @type {SpeechRecognition|null}
 */
let reconhecimentoAtivo = null;

/**
 * Indicador de captura de voz ativa (microfone aberto).
 * @type {boolean}
 */
let estaOuvindo = false;

/**
 * Indicador de áudio sintetizado em execução (leitura em andamento).
 * @type {boolean}
 */
let estaFalando = false;

/**
 * Referência ao elemento de entrada que receberá o texto transcrito.
 * @type {HTMLInputElement|HTMLTextAreaElement|null}
 */
let elementoEscritaAtivo = null;

/**
 * Referência ao elemento de texto que está selecionado para leitura.
 * @type {HTMLElement|null}
 */
let elementoLeituraAtivo = null;

/**
 * Texto selecionado para leitura em áudio.
 * @type {string}
 */
let textoParaLeitura = '';

/**
 * Armazena o texto existente no campo antes de começar o ditado atual.
 * @type {string}
 */
let textoBaseAntesDitado = '';

/**
 * Flag para indicar se a digitação manual via teclado nativo foi autorizada.
 * @type {boolean}
 */
let tecladoManualAutorizado = false;

/**
 * Referências aos elementos da interface no DOM.
 */
let btnVoz = null;
let iconeVozCentral = null;
let rotuloVozCentral = null;
let capsulaDupla = null;
let btnCapsulaFalar = null;
let iconeCapsulaFalar = null;
let textoCapsulaFalar = null;
let btnCapsulaTeclado = null;

/**
 * Verifica o suporte do navegador à Web Speech API (Reconhecimento de Fala).
 * @return {boolean} Retorna true se houver suporte.
 */
export function suportaReconhecimentoVoz() {
  return Boolean('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

/**
 * Verifica o suporte do navegador à Síntese de Fala (Text-to-Speech).
 * @return {boolean} Retorna true se houver suporte.
 */
export function suportaSinteseVoz() {
  return Boolean('speechSynthesis' in window);
}

/**
 * Inicializa os ouvintes de eventos da barra de voz e da Cápsula Dupla no DOM.
 * Deve ser invocada no carregamento do DOM.
 * @return {void}
 */
export function inicializarModuloVoz() {
  btnVoz = document.getElementById('btn_voz');
  iconeVozCentral = document.getElementById('iconeVozCentral');
  rotuloVozCentral = document.getElementById('rotuloVozCentral');

  capsulaDupla = document.getElementById('capsulaDupla');
  btnCapsulaFalar = document.getElementById('btnCapsulaFalar');
  iconeCapsulaFalar = document.getElementById('iconeCapsulaFalar');
  textoCapsulaFalar = document.getElementById('textoCapsulaFalar');
  btnCapsulaTeclado = document.getElementById('btnCapsulaTeclado');

  if (!btnVoz) {
    console.warn('[Voz] Botão #btn_voz não localizado no DOM.');
    return;
  }

  // 1. Monitora foco em campos de entrada (Ativa a Cápsula Dupla)
  document.addEventListener('focusin', (evento) => {
    const alvo = evento.target;
    if (alvo instanceof HTMLInputElement || alvo instanceof HTMLTextAreaElement) {
      if (alvo.type === 'text' || alvo.type === 'search' || alvo.tagName.toLowerCase() === 'textarea') {
        definirElementoEscrita(alvo, tecladoManualAutorizado);
      }
    }
  });

  // 2. Monitora toque fora de campos para retornar ao Modo Ouvir simples
  document.addEventListener('click', (evento) => {
    const alvo = /** @type {HTMLElement} */ (evento.target);
    const dentroDeCampo = Boolean(
      alvo instanceof HTMLInputElement ||
      alvo instanceof HTMLTextAreaElement ||
      alvo.closest('.form-input')
    );
    const dentroDaBarra = Boolean(alvo.closest('.bar-inf'));
    const dentroDeCardLeitura = Boolean(alvo.closest('[data-leitura="true"]'));
    const dentroDeModal = Boolean(alvo.closest('.card-login'));

    if (!dentroDeCampo && !dentroDaBarra && !dentroDeCardLeitura && !dentroDeModal) {
      exibirModoOuvir();
      limparEfeitosVisuaisFoco();
      desfocarCampos();
    }
  });

  // 3. Clique no botão central simples de Ouvir
  btnVoz.addEventListener('click', (evento) => {
    evento.preventDefault();
    acionarBotaoVozCentral();
  });

  // 4. Clique no botão [Falar] da Cápsula Dupla
  if (btnCapsulaFalar) {
    btnCapsulaFalar.addEventListener('click', (evento) => {
      evento.preventDefault();
      if (estaOuvindo) {
        pararReconhecimentoVoz();
      } else {
        iniciarReconhecimentoVoz();
      }
    });
  }

  // 5. Clique no botão [Teclado] da Cápsula Dupla
  if (btnCapsulaTeclado) {
    btnCapsulaTeclado.addEventListener('click', (evento) => {
      evento.preventDefault();
      if (elementoEscritaAtivo) {
        alternarTecladoVirtual(elementoEscritaAtivo);
      }
    });
  }

  console.log('[Voz] Módulo de voz universal com Cápsula Dupla inicializado.');
}

/**
 * Exibe a Cápsula Dupla e oculta o botão central simples.
 * @return {void}
 */
export function exibirModoCapsula() {
  if (btnVoz) {
    btnVoz.style.display = 'none';
  }
  if (capsulaDupla) {
    capsulaDupla.classList.add('visivel');
  }
  if (btnCapsulaFalar) {
    btnCapsulaFalar.classList.add('pulso-falar-vermelho');
  }
}

/**
 * Oculta a Cápsula Dupla e restaura o botão central simples de Ouvir.
 * @return {void}
 */
export function exibirModoOuvir() {
  if (capsulaDupla) {
    capsulaDupla.classList.remove('visivel');
  }
  if (btnVoz) {
    btnVoz.style.display = 'inline-flex';
  }
  elementoEscritaAtivo = null;
  tecladoManualAutorizado = false;
  if (btnCapsulaTeclado) {
    btnCapsulaTeclado.classList.remove('teclado-ativo');
  }
}

/**
 * Remove foco e teclado virtual de campos de entrada.
 * @return {void}
 */
function desfocarCampos() {
  const campos = document.querySelectorAll('input, textarea');
  campos.forEach((c) => {
    if (c instanceof HTMLInputElement || c instanceof HTMLTextAreaElement) {
      c.setAttribute('inputmode', 'none');
      c.blur();
    }
  });
}

/**
 * Define um elemento de texto/relato para ser lido em áudio (Modo OUVIR - Azul SSVP).
 * @param {HTMLElement} elemento
 * @param {string} texto
 * @return {void}
 */
export function definirElementoLeitura(elemento, texto) {
  if (!elemento || !texto) {
    return;
  }

  limparEfeitosVisuaisFoco();
  exibirModoOuvir();

  elementoLeituraAtivo = elemento;
  textoParaLeitura = texto.trim();
  elementoEscritaAtivo = null;
  modoAtual = ModosVoz.OUVIR;

  // Aplica pulso Azul SSVP no card selecionado
  elemento.classList.add('pulso-ouvir-azul');

  // Atualiza o botão inferior para Ouvir com pulso Azul SSVP
  atualizarBotaoCentral('🔊', 'Ouvir', 'pulso-ouvir-azul');
  exibirFeedbackVoz('Card selecionado. Toque em [Ouvir] no rodapé.', 'info');
}

/**
 * Define um campo de formulário para ditado de texto (Modo FALAR - Cápsula Dupla).
 * @param {HTMLInputElement|HTMLTextAreaElement} campo
 * @param {boolean} [permitirTecladoNativo=false]
 * @return {void}
 */
export function definirElementoEscrita(campo, permitirTecladoNativo = false) {
  if (!campo) {
    return;
  }

  limparEfeitosVisuaisFoco();

  elementoEscritaAtivo = campo;
  elementoLeituraAtivo = null;
  textoParaLeitura = '';
  modoAtual = ModosVoz.FALAR;

  if (!permitirTecladoNativo) {
    campo.setAttribute('inputmode', 'none');
  } else {
    campo.setAttribute('inputmode', 'text');
  }

  // Aplica pulso Vermelho SSVP no campo ativo
  campo.classList.add('pulso-falar-vermelho');

  // Abre a Cápsula Dupla no rodapé
  exibirModoCapsula();

  if (btnCapsulaTeclado) {
    btnCapsulaTeclado.classList.toggle('teclado-ativo', permitirTecladoNativo);
  }

  if (!permitirTecladoNativo) {
    exibirFeedbackVoz('Cápsula ativa: toque em [Falar] ou [Teclado].', 'info');
  }
}

/**
 * Alterna a exibição ou recolhimento do teclado virtual manual.
 * @param {HTMLInputElement|HTMLTextAreaElement} campo
 * @param {HTMLElement} [btnOpcional] Botão [Teclado] opcional
 * @return {boolean} Retorna true se aberto, false se recolhido.
 */
export function alternarTecladoVirtual(campo, btnOpcional) {
  if (!campo) {
    return false;
  }

  const estaAberto = campo.getAttribute('inputmode') === 'text' &&
    (btnCapsulaTeclado?.classList.contains('teclado-ativo') || btnOpcional?.classList.contains('ativo'));

  if (estaAberto) {
    // 1. OCULTAR TECLADO (Modo Voz restabelecido)
    tecladoManualAutorizado = false;
    campo.setAttribute('inputmode', 'none');
    campo.blur();

    if (btnCapsulaTeclado) {
      btnCapsulaTeclado.classList.remove('teclado-ativo');
    }
    if (btnOpcional) {
      btnOpcional.classList.remove('ativo');
    }

    definirElementoEscrita(campo, false);
    exibirFeedbackVoz('Teclado recolhido', 'info');
    return false;
  } else {
    // 2. EXIBIR TECLADO (Digitação manual com os dedos)
    tecladoManualAutorizado = true;
    campo.removeAttribute('inputmode');
    campo.setAttribute('inputmode', 'text');
    campo.focus();

    const len = campo.value ? campo.value.length : 0;
    if (typeof campo.setSelectionRange === 'function') {
      campo.setSelectionRange(len, len);
    }

    if (btnCapsulaTeclado) {
      btnCapsulaTeclado.classList.add('teclado-ativo');
    }
    if (btnOpcional) {
      btnOpcional.classList.add('ativo');
    }

    definirElementoEscrita(campo, true);
    exibirFeedbackVoz('Teclado aberto para digitação', 'sucesso');
    return true;
  }
}

/**
 * Limpa classes de foco e pulsos visuais de elementos anteriores.
 * @return {void}
 */
export function limparEfeitosVisuaisFoco() {
  if (elementoLeituraAtivo) {
    elementoLeituraAtivo.classList.remove('pulso-ouvir-azul', 'tocando-audio-ativo');
  }
  if (elementoEscritaAtivo) {
    elementoEscritaAtivo.classList.remove('pulso-falar-vermelho', 'pulso-gravando-ativo');
  }

  if (btnVoz) {
    btnVoz.classList.remove('pulso-ouvir-azul', 'pulso-falar-vermelho', 'pulso-gravando-ativo', 'tocando-audio-ativo');
  }
  if (btnCapsulaFalar) {
    btnCapsulaFalar.classList.remove('pulso-falar-vermelho', 'pulso-gravando-ativo');
  }
}

/**
 * Executa a ação contextual correspondente ao toque no botão central simples de Ouvir.
 * @return {void}
 */
export function acionarBotaoVozCentral() {
  // 1. Se estiver reproduzindo som no momento, interrompe a leitura
  if (estaFalando) {
    pararLeituraVozAlta();
    return;
  }

  // 2. Se houver texto selecionado para leitura (Modo OUVIR)
  if (elementoLeituraAtivo && textoParaLeitura) {
    modoAtual = ModosVoz.TOCANDO;
    atualizarBotaoCentral('⏹️', 'Parar', 'tocando-audio-ativo');

    elementoLeituraAtivo.classList.remove('pulso-ouvir-azul');
    elementoLeituraAtivo.classList.add('tocando-audio-ativo');

    ouvirTextoEmVozAlta(textoParaLeitura, () => {
      modoAtual = ModosVoz.OUVIR;
      atualizarBotaoCentral('🔊', 'Ouvir', 'pulso-ouvir-azul');
      if (elementoLeituraAtivo) {
        elementoLeituraAtivo.classList.remove('tocando-audio-ativo');
        elementoLeituraAtivo.classList.add('pulso-ouvir-azul');
      }
    });
    return;
  }

  exibirFeedbackVoz('Selecione um relato acima para ouvir.', 'info');
}

/**
 * Dispara a captura de voz no microfone via Web Speech API (STT).
 * Configurado com interimResults=false para garantir um ditado limpo sem palavras repetidas.
 * @return {void}
 */
export function iniciarReconhecimentoVoz() {
  if (!suportaReconhecimentoVoz()) {
    exibirFeedbackVoz('Reconhecimento de voz não suportado neste navegador.', 'aviso');
    return;
  }

  if (!elementoEscritaAtivo) {
    exibirFeedbackVoz('Toque em um campo de texto antes de falar.', 'aviso');
    return;
  }

  try {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    reconhecimentoAtivo = new SpeechRecognitionClass();

    reconhecimentoAtivo.lang = 'pt-BR';
    reconhecimentoAtivo.interimResults = false;
    reconhecimentoAtivo.maxAlternatives = 1;
    reconhecimentoAtivo.continuous = false;

    textoBaseAntesDitado = elementoEscritaAtivo.value || '';

    reconhecimentoAtivo.onstart = () => {
      estaOuvindo = true;
      modoAtual = ModosVoz.GRAVANDO;

      if (elementoEscritaAtivo) {
        elementoEscritaAtivo.classList.remove('pulso-falar-vermelho');
        elementoEscritaAtivo.classList.add('pulso-gravando-ativo');
      }

      if (btnCapsulaFalar) {
        btnCapsulaFalar.classList.remove('pulso-falar-vermelho');
        btnCapsulaFalar.classList.add('pulso-gravando-ativo');
      }
      if (iconeCapsulaFalar) {
        iconeCapsulaFalar.textContent = '🔴';
      }
      if (textoCapsulaFalar) {
        textoCapsulaFalar.textContent = 'Gravando';
      }

      exibirFeedbackVoz('Microfone ativo: pode falar...', 'sucesso');
    };

    reconhecimentoAtivo.onresult = (evento) => {
      const textoTranscrito = evento.results[0] && evento.results[0][0]
        ? evento.results[0][0].transcript.trim()
        : '';

      if (elementoEscritaAtivo && textoTranscrito) {
        injetarTextoFinalNoCampo(elementoEscritaAtivo, textoTranscrito);
      }
    };

    reconhecimentoAtivo.onerror = (evento) => {
      console.warn('[Voz] Erro na captura de fala:', evento.error);
      if (evento.error !== 'no-speech') {
        exibirFeedbackVoz(`Aviso de voz: ${evento.error}`, 'aviso');
      }
      pararReconhecimentoVoz();
    };

    reconhecimentoAtivo.onend = () => {
      pararReconhecimentoVoz();
    };

    reconhecimentoAtivo.start();
  } catch (erro) {
    console.error('[Voz] Falha ao iniciar reconhecimento:', erro);
    pararReconhecimentoVoz();
  }
}

/**
 * Encerra a escuta ativa do microfone e restaura o botão para Falar.
 * @return {void}
 */
export function pararReconhecimentoVoz() {
  estaOuvindo = false;
  modoAtual = ModosVoz.FALAR;

  if (elementoEscritaAtivo) {
    elementoEscritaAtivo.classList.remove('pulso-gravando-ativo');
    elementoEscritaAtivo.classList.add('pulso-falar-vermelho');
  }

  if (btnCapsulaFalar) {
    btnCapsulaFalar.classList.remove('pulso-gravando-ativo');
    btnCapsulaFalar.classList.add('pulso-falar-vermelho');
  }
  if (iconeCapsulaFalar) {
    iconeCapsulaFalar.textContent = '🎙️';
  }
  if (textoCapsulaFalar) {
    textoCapsulaFalar.textContent = 'Falar';
  }

  if (reconhecimentoAtivo) {
    try {
      reconhecimentoAtivo.stop();
    } catch {
      // Ignora erro caso já esteja parado
    }
    reconhecimentoAtivo = null;
  }
}

/**
 * Síntese de Voz (TTS): Converte texto em fala nativa do dispositivo.
 * @param {string} texto Texto a ser lido em voz alta
 * @param {Function} [onFim] Callback disparado ao término da fala
 * @return {void}
 */
export function ouvirTextoEmVozAlta(texto, onFim) {
  if (!suportaSinteseVoz()) {
    exibirFeedbackVoz('Seu dispositivo não suporta leitura em voz alta.', 'aviso');
    if (typeof onFim === 'function') {
      onFim();
    }
    return;
  }

  window.speechSynthesis.cancel();

  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = 'pt-BR';
  fala.rate = 0.95; // Cadência pausada e confortável para idosos 60+
  fala.pitch = 1.0;

  fala.onend = () => {
    estaFalando = false;
    if (typeof onFim === 'function') {
      onFim();
    }
  };

  fala.onerror = (evento) => {
    console.warn('[Voz] Erro na síntese de voz:', evento);
    estaFalando = false;
    if (typeof onFim === 'function') {
      onFim();
    }
  };

  estaFalando = true;
  window.speechSynthesis.speak(fala);
}

/**
 * Interrompe qualquer reprodução de áudio em andamento.
 * @return {void}
 */
export function pararLeituraVozAlta() {
  if (suportaSinteseVoz()) {
    window.speechSynthesis.cancel();
  }
  estaFalando = false;
  modoAtual = ModosVoz.OUVIR;

  if (elementoLeituraAtivo) {
    elementoLeituraAtivo.classList.remove('tocando-audio-ativo');
    elementoLeituraAtivo.classList.add('pulso-ouvir-azul');
  }

  atualizarBotaoCentral('🔊', 'Ouvir', 'pulso-ouvir-azul');
}

/**
 * Injeta o texto final transcrito de forma limpa, sem repetições.
 * @param {HTMLInputElement|HTMLTextAreaElement} campo
 * @param {string} textoTranscrito
 * @private
 */
function injetarTextoFinalNoCampo(campo, textoTranscrito) {
  const prefixo = (textoBaseAntesDitado.length > 0 && !textoBaseAntesDitado.match(/\s$/)) ? ' ' : '';
  const novoValor = textoBaseAntesDitado + prefixo + textoTranscrito;

  campo.value = novoValor;
  campo.selectionStart = campo.selectionEnd = campo.value.length;

  campo.dispatchEvent(new Event('input', { bubbles: true }));
  campo.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Atualiza o texto, ícone e classe CSS de pulso do botão central simples da barra inferior.
 * @param {string} icone
 * @param {string} texto
 * @param {string} classeCss
 * @private
 */
function atualizarBotaoCentral(icone, texto, classeCss) {
  if (iconeVozCentral) {
    iconeVozCentral.textContent = icone;
  }
  if (rotuloVozCentral) {
    rotuloVozCentral.textContent = texto;
  }

  if (btnVoz) {
    btnVoz.classList.remove('pulso-ouvir-azul', 'pulso-falar-vermelho', 'pulso-gravando-ativo', 'tocando-audio-ativo');
    if (classeCss) {
      btnVoz.classList.add(classeCss);
    }
  }
}

/**
 * Exibe um feedback visual discreto (Toast flutuante).
 * @param {string} mensagem
 * @param {'sucesso'|'aviso'|'info'} [tipo='info']
 * @return {void}
 */
export function exibirFeedbackVoz(mensagem, tipo = 'info') {
  let toast = document.getElementById('toast-voz');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-voz';
    toast.style.position = 'fixed';
    toast.style.bottom = '5.8rem';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = '#0F172A';
    toast.style.color = '#FFFFFF';
    toast.style.padding = '0.6rem 1.2rem';
    toast.style.borderRadius = '9999px';
    toast.style.fontSize = '0.85rem';
    toast.style.fontWeight = '600';
    toast.style.boxShadow = '0 6px 16px rgba(0,0,0,0.5)';
    toast.style.zIndex = '999';
    toast.style.transition = 'opacity 0.3s ease';
    toast.style.pointerEvents = 'none';
    toast.style.textAlign = 'center';
    toast.style.maxWidth = '90vw';
    toast.style.whiteSpace = 'nowrap';
    document.body.appendChild(toast);
  }

  if (tipo === 'sucesso') {
    toast.style.border = '1px solid #22c55e';
  } else if (tipo === 'aviso') {
    toast.style.border = '1px solid #f59e0b';
  } else {
    toast.style.border = '1px solid #0064B6';
  }

  toast.textContent = mensagem;
  toast.style.opacity = '1';

  clearTimeout(toast.tempoSumir);
  toast.tempoSumir = setTimeout(() => {
    toast.style.opacity = '0';
  }, 2500);
}
