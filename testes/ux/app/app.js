/* ==========================================================================
   JavaScript Unificado - Controle Interativo de Layout SSVP
   Compartilhado entre protótipos na pasta testes/ux/app/
   ========================================================================== */

// Paleta de Cores SSVP Oficial com numeração identificadora
const ssvpColors = [
  { id: 1, name: "Azul Escuro", hex: "#002d62", isLight: false },
  { id: 2, name: "Azul Royal", hex: "#007fff", isLight: false },
  { id: 3, name: "Vermelho SSVP", hex: "#d32f2f", isLight: false },
  { id: 4, name: "Amarelo Ouro", hex: "#f59e0b", isLight: false },
  { id: 5, name: "Verde SSVP", hex: "#10b981", isLight: false },
  { id: 6, name: "Branco", hex: "#ffffff", isLight: true },
  { id: 7, name: "Preto/Lab", hex: "#0b0f19", isLight: false }
];

// Valores iniciais e limites (em rem e segundos)
const state = {
  canto: 2.50,
  audio: 3.50,
  padding: 0.50,
  speed: 0.08, // Velocidade de transição padrão definida no CSS externo
  holdTime: 0.80, // Tempo padrão de tocar e segurar em segundos
  speakMessages: true // Configuração de leitura automática de mensagens por voz (v5)
};

const limits = {
  canto: { min: 1.50, max: 4.00, step: 0.10 },
  audio: { min: 2.00, max: 6.00, step: 0.10 },
  padding: { min: 0.25, max: 1.50, step: 0.05 },
  speed: { min: 0.05, max: 2.00, step: 0.01 },
  holdTime: { min: 0.40, max: 2.00, step: 0.10 }
};

// Mapeamento local das cores selecionadas em tempo real
const activeColors = {
  barras: "#002d62",
  canto: "#ffffff",
  audio: "#ffffff",
  fundo: "#0b0f19"
};

let activeCard = null;

// --- 1. Função Dinâmica de Viewport (Exclusão exata das barras de navegação do sistema) ---
function resetHeight() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

window.addEventListener('resize', resetHeight);
window.addEventListener('orientationchange', resetHeight);
resetHeight(); // Executa no carregamento inicial

// --- 2. Ajustes de Tamanho e Escala (rem / s) com Tratamento Resiliente ---
function adjustVal(type, direction) {
  const current = state[type];
  const limit = limits[type];
  if (!limit) return;
  
  const step = limit.step;
  const target = direction > 0 ? current + step : current - step;

  // Corrige a matemática de ponto flutuante do JS
  const roundedTarget = parseFloat(target.toFixed(2));

  if (roundedTarget >= limit.min && roundedTarget <= limit.max) {
    state[type] = roundedTarget;
    
    // Atualiza a visualização na label correspondente caso exista no DOM
    const label = document.getElementById(`lbl-${type}`);
    if (label) {
      label.textContent = (type === 'speed' || type === 'holdTime') ? `${roundedTarget.toFixed(2)}s` : `${roundedTarget.toFixed(2)}rem`;
    }
    
    // Atualiza a variável CSS correspondente na raiz do documento
    if (type === 'canto') {
      document.documentElement.style.setProperty('--raio-cantos', `${roundedTarget}rem`);
    } else if (type === 'audio') {
      document.documentElement.style.setProperty('--raio-audio', `${roundedTarget}rem`);
    } else if (type === 'padding') {
      document.documentElement.style.setProperty('--padding-vertical-barras', `${roundedTarget}rem`);
    } else if (type === 'speed') {
      document.documentElement.style.setProperty('--tempo-transicao', `${roundedTarget}s`);
    } else if (type === 'holdTime') {
      const lblApp = document.getElementById('lbl-app-hold');
      if (lblApp) lblApp.textContent = `${roundedTarget.toFixed(2)}s`;
    }

    // Salva as novas dimensões e velocidade no localStorage
    saveSettingsToStorage();
  }
}

// --- 3. Controle dos Cards Expandidos (Efeito v2) ---
function toggleCard(side, event) {
  if (event) event.stopPropagation();

  const isSameCard = activeCard === side;
  closeActiveCard();

  if (!isSameCard) {
    const card = document.getElementById(side === 'esquerda' ? 'card-esq' : 'card-dir');
    const btn = document.getElementById(side === 'esquerda' ? 'btn_config' : 'btn_ajuda');
    
    if (card) card.classList.add('active');
    if (btn) btn.classList.add('card-aberto');
    
    activeCard = side;
  }
}

function closeActiveCard() {
  const cardEsq = document.getElementById('card-esq');
  const cardDir = document.getElementById('card-dir');
  const btnEsq = document.getElementById('btn_config');
  const btnDir = document.getElementById('btn_ajuda');

  if (cardEsq) cardEsq.classList.remove('active');
  if (cardDir) cardDir.classList.remove('active');
  if (btnEsq) btnEsq.classList.remove('card-aberto');
  if (btnDir) btnDir.classList.remove('card-aberto');
  
  activeCard = null;
}

// Fechar ao clicar em qualquer lugar fora do card aberto ou botão correspondente
document.addEventListener('click', function(event) {
  if (activeCard) {
    const cardEsq = document.getElementById('card-esq');
    const cardDir = document.getElementById('card-dir');
    const btnEsq = document.getElementById('btn_config');
    const btnDir = document.getElementById('btn_ajuda');

    let insideEsq = false;
    let insideDir = false;

    if (cardEsq && btnEsq) {
      insideEsq = cardEsq.contains(event.target) || btnEsq.contains(event.target);
    }
    if (cardDir && btnDir) {
      insideDir = cardDir.contains(event.target) || btnDir.contains(event.target);
    }

    if (!insideEsq && !insideDir) {
      closeActiveCard();
    }
  }

  // Fechar banner de notificação (v5) ao clicar fora dele
  const banner = document.getElementById('notification-banner');
  if (banner && banner.classList.contains('show')) {
    const isClickInsideBanner = banner.contains(event.target);
    const isClickOnSimBtn = event.target.closest('.sim-btn');
    if (!isClickInsideBanner && !isClickOnSimBtn) {
      banner.classList.remove('show');
      if (typeof notificationTimer !== 'undefined' && notificationTimer) {
        clearTimeout(notificationTimer);
        notificationTimer = null;
      }
      if (typeof synth !== 'undefined' && synth && synth.speaking) {
        synth.cancel();
      }
    }
  }
});

// --- 4. Alternador de Tema (Modo Claro/Escuro Dinâmico) ---
function toggleTheme(theme) {
  if (theme === 'claro') {
    document.documentElement.style.setProperty('--cor-fundo', '#ffffff');
    document.documentElement.style.setProperty('--cor-card-bg', '#e9ecef');
    document.documentElement.style.setProperty('--cor-card-texto', '#0b0f19');
    document.documentElement.style.setProperty('--cor-card-subtexto', '#4b5563');
    activeColors.fundo = '#ffffff';
  } else {
    document.documentElement.style.setProperty('--cor-fundo', '#0b0f19');
    document.documentElement.style.setProperty('--cor-card-bg', '#151c2c');
    document.documentElement.style.setProperty('--cor-card-texto', '#ffffff');
    document.documentElement.style.setProperty('--cor-card-subtexto', '#9ca3af');
    activeColors.fundo = '#0b0f19';
  }
  highlightSelectedColor();
}

// --- 5. Painel de Cores Dinâmico com Números ---
function initColorPalette() {
  const palette = document.getElementById('color-palette');
  if (!palette) return;
  palette.innerHTML = '';

  ssvpColors.forEach(color => {
    const item = document.createElement('div');
    item.className = 'color-item';
    item.onclick = () => selectColorForTarget(color.hex);

    const dot = document.createElement('div');
    dot.className = `color-dot ${color.isLight ? 'light-color' : ''}`;
    dot.style.backgroundColor = color.hex;
    dot.title = color.name;

    const num = document.createElement('span');
    num.className = 'color-number';
    num.textContent = color.id;

    item.appendChild(dot);
    item.appendChild(num);
    palette.appendChild(item);
  });

  highlightSelectedColor();
}

function selectColorForTarget(hex) {
  const targetSelect = document.getElementById('color-target');
  if (!targetSelect) return;
  
  const target = targetSelect.value;
  activeColors[target] = hex;

  document.documentElement.style.setProperty(`--cor-${target}`, hex);
  
  // Sincroniza o select de modo claro/escuro se o alvo for o fundo
  if (target === 'fundo') {
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) {
      if (hex.toLowerCase() === '#ffffff') {
        themeSelect.value = 'claro';
        toggleTheme('claro');
      } else if (hex.toLowerCase() === '#0b0f19') {
        themeSelect.value = 'escuro';
        toggleTheme('escuro');
      }
    }
  }
  
  highlightSelectedColor();
}

function highlightSelectedColor() {
  const targetSelect = document.getElementById('color-target');
  if (!targetSelect) return;

  const target = targetSelect.value;
  const currentHex = activeColors[target].toLowerCase();

  const dots = document.querySelectorAll('.color-dot');
  dots.forEach(dot => {
    const bg = rgb2hex(dot.style.backgroundColor).toLowerCase();
    if (bg === currentHex) {
      dot.classList.add('selected');
    } else {
      dot.classList.remove('selected');
    }
  });
}

// Converte rgb(r, g, b) para #hexadecimal
function rgb2hex(rgb) {
  if (/^#[0-9A-F]{6}$/i.test(rgb)) return rgb;
  rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (rgb === null) return '#000000';
  function hex(x) {
    return ("0" + parseInt(x).toString(16)).slice(-2);
  }
  return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
}

// --- 6. Controle de Colapso do Painel ---
function togglePanel() {
  const panel = document.getElementById('panel-config');
  const icon = document.getElementById('panel-toggle-icon');
  if (!panel || !icon) return;
  
  panel.classList.toggle('collapsed');
  icon.textContent = panel.classList.contains('collapsed') ? '+' : '−';
}

// --- 7. Controles Exclusivos do Card de Configurações (v3) ---
function setAppTheme(theme) {
  toggleTheme(theme);
  
  const cardEsq = document.getElementById('card-esq');
  const cardDir = document.getElementById('card-dir');
  const btnClaro = document.getElementById('btn-theme-claro');
  const btnEscuro = document.getElementById('btn-theme-escuro');
  const themeSelect = document.getElementById('theme-select');

  // Sincroniza o select oculto/secundário se existir
  if (themeSelect) {
    themeSelect.value = theme;
  }

  // Adiciona a classe light-theme-card para ajustes internos de contraste de botões
  if (theme === 'claro') {
    if (cardEsq) cardEsq.classList.add('light-theme-card');
    if (cardDir) cardDir.classList.add('light-theme-card');
    if (btnClaro) btnClaro.classList.add('active');
    if (btnEscuro) btnEscuro.classList.remove('active');
  } else {
    if (cardEsq) cardEsq.classList.remove('light-theme-card');
    if (cardDir) cardDir.classList.remove('light-theme-card');
    if (btnClaro) btnClaro.classList.remove('active');
    if (btnEscuro) btnEscuro.classList.add('active');
  }

  // Salva a alteração de tema no localStorage
  saveSettingsToStorage();
}

function setAppFontSize(size) {
  const btnP = document.getElementById('btn-font-p');
  const btnM = document.getElementById('btn-font-m');
  const btnG = document.getElementById('btn-font-g');
  
  if (btnP) btnP.classList.remove('active');
  if (btnM) btnM.classList.remove('active');
  if (btnG) btnG.classList.remove('active');
  
  const targetBtn = document.getElementById(`btn-font-${size.toLowerCase()}`);
  if (targetBtn) targetBtn.classList.add('active');
  
  // Altera a escala da fonte raiz do HTML (1rem = escala base)
  if (size === 'P') {
    document.documentElement.style.fontSize = '14px'; // 87.5%
  } else if (size === 'M') {
    document.documentElement.style.fontSize = '16px'; // 100%
  } else if (size === 'G') {
    document.documentElement.style.fontSize = '20px'; // 125%
  }

  // Salva o novo tamanho de fonte de acessibilidade no localStorage
  saveSettingsToStorage();
}

function adjustAppSpeed(direction) {
  // Ajusta o valor no estado global
  adjustVal('speed', direction);
  
  // Sincroniza o valor textual da velocidade nos dois visores possíveis
  const appSpeedLabel = document.getElementById('lbl-app-speed');
  if (appSpeedLabel) {
    appSpeedLabel.textContent = `${state.speed.toFixed(2)}s`;
  }
}

// --- 8. Persistência de Configurações (localStorage) ---
function saveSettingsToStorage() {
  localStorage.setItem('ssvp_theme', activeColors.fundo === '#ffffff' ? 'claro' : 'escuro');
  
  let activeFont = 'M';
  if (document.getElementById('btn-font-p')?.classList.contains('active')) activeFont = 'P';
  if (document.getElementById('btn-font-g')?.classList.contains('active')) activeFont = 'G';
  localStorage.setItem('ssvp_font_size', activeFont);
  
  localStorage.setItem('ssvp_speed', state.speed);
  localStorage.setItem('ssvp_hold_time', state.holdTime);
  localStorage.setItem('ssvp_canto', state.canto);
  localStorage.setItem('ssvp_audio', state.audio);
  localStorage.setItem('ssvp_padding', state.padding);
  localStorage.setItem('ssvp_speak_messages', state.speakMessages ? 'true' : 'false');
}

function loadSettingsFromStorage() {
  const savedTheme = localStorage.getItem('ssvp_theme');
  const savedFont = localStorage.getItem('ssvp_font_size');
  const savedSpeed = localStorage.getItem('ssvp_speed');
  const savedHold = localStorage.getItem('ssvp_hold_time');
  const savedCanto = localStorage.getItem('ssvp_canto');
  const savedAudio = localStorage.getItem('ssvp_audio');
  const savedPadding = localStorage.getItem('ssvp_padding');
  const savedSpeak = localStorage.getItem('ssvp_speak_messages');

  // 1. Carrega e aplica dimensões customizadas
  if (savedCanto) {
    state.canto = parseFloat(savedCanto);
    document.documentElement.style.setProperty('--raio-cantos', `${state.canto}rem`);
    const lbl = document.getElementById('lbl-canto');
    if (lbl) lbl.textContent = `${state.canto.toFixed(2)}rem`;
  }
  if (savedAudio) {
    state.audio = parseFloat(savedAudio);
    document.documentElement.style.setProperty('--raio-audio', `${state.audio}rem`);
    const lbl = document.getElementById('lbl-audio');
    if (lbl) lbl.textContent = `${state.audio.toFixed(2)}rem`;
  }
  if (savedPadding) {
    state.padding = parseFloat(savedPadding);
    document.documentElement.style.setProperty('--padding-vertical-barras', `${state.padding}rem`);
    const lbl = document.getElementById('lbl-padding');
    if (lbl) lbl.textContent = `${state.padding.toFixed(2)}rem`;
  }
  
  // 2. Carrega e aplica velocidade de abertura e tempo de segurar
  if (savedSpeed) {
    state.speed = parseFloat(savedSpeed);
    document.documentElement.style.setProperty('--tempo-transicao', `${state.speed}s`);
    const lblApp = document.getElementById('lbl-app-speed');
    if (lblApp) lblApp.textContent = `${state.speed.toFixed(2)}s`;
    const lblDev = document.getElementById('lbl-speed');
    if (lblDev) lblDev.textContent = `${state.speed.toFixed(2)}s`;
  }
  if (savedHold) {
    state.holdTime = parseFloat(savedHold);
    const lblHold = document.getElementById('lbl-app-hold');
    if (lblHold) lblHold.textContent = `${state.holdTime.toFixed(2)}s`;
  }

  // 3. Carrega e aplica tema visual (Claro/Escuro)
  if (savedTheme) {
    setAppTheme(savedTheme);
  }

  // 4. Carrega e aplica tamanho de fonte
  if (savedFont) {
    setAppFontSize(savedFont);
  }

  // 5. Carrega e aplica configuração de ditação de mensagens por voz (v5)
  if (savedSpeak !== null) {
    state.speakMessages = savedSpeak === 'true';
  } else {
    state.speakMessages = true; // Valor padrão inicial
  }
  const chk = document.getElementById('chk-speak-messages');
  if (chk) {
    chk.checked = state.speakMessages;
  }
}

// --- 9. Recursos de Voz e Alternador de Entrada Voz vs Teclado (v4) ---
let lastFocusedInput = null;
let recognition = null;
let longPressTimer = null;
let isLongPressAction = false;
let appInputMode = 'voice'; // 'voice' (microfone de ditado) ou 'keyboard' (digitação)

// Captura dinamicamente qual input ou textarea recebeu o foco
document.addEventListener('focusin', (event) => {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    lastFocusedInput = event.target;
    updateMicrophonePulse();
  }
});

document.addEventListener('focusout', (event) => {
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    // Timeout pequeno para capturar a transição do foco
    setTimeout(() => {
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        updateMicrophonePulse();
      }
    }, 50);
  }
});

function adjustAppHoldTime(direction) {
  adjustVal('holdTime', direction);
}

function applyInputModeSettings() {
  const textFields = document.querySelectorAll('.display-area input, .display-area textarea');
  const displayArea = document.querySelector('.display-area');

  textFields.forEach(field => {
    if (appInputMode === 'voice') {
      field.setAttribute('inputmode', 'none');
    } else {
      field.removeAttribute('inputmode');
    }
  });

  if (displayArea) {
    if (appInputMode === 'voice') {
      displayArea.classList.add('modo-voz-ativo');
    } else {
      displayArea.classList.remove('modo-voz-ativo');
    }
  }

  updateMicrophonePulse();
}

// Alterna entre Modo Voz e Modo Teclado
function toggleInputModeMode() {
  appInputMode = (appInputMode === 'voice') ? 'keyboard' : 'voice';
  
  applyInputModeSettings();

  // Se mudou para teclado e há um campo focado, abre o teclado virtual
  if (appInputMode === 'keyboard' && lastFocusedInput) {
    lastFocusedInput.focus();
  }

  showTemporaryNotification(appInputMode === 'voice' ? '🎤 Modo Voz Ativo' : '⌨️ Modo Teclado Ativo');
}

function updateMicrophonePulse() {
  const btnVoz = document.getElementById('btn_voz');
  if (!btnVoz) return;

  btnVoz.classList.remove('pulsar-convite');
  btnVoz.classList.remove('modo-teclado-ativo');

  if (appInputMode === 'keyboard') {
    btnVoz.classList.add('modo-teclado-ativo');
  } else if (appInputMode === 'voice') {
    const hasFocus = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA';
    if (hasFocus) {
      btnVoz.classList.add('pulsar-convite');
    }
  }
}

// Exibe um toast temporário de aviso na tela
function showTemporaryNotification(text) {
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = 'toast-notification';
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add('show');
  
  // Esconde após 1.5 segundos
  setTimeout(() => {
    toast.classList.remove('show');
  }, 1500);
}

function initVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  recognition = new SpeechRecognition();
  recognition.lang = 'pt-BR';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    const btnVoz = document.getElementById('btn_voz');
    if (btnVoz) btnVoz.classList.add('listening');

    const indicator = document.getElementById('voice-indicator');
    const indText = document.getElementById('voice-text');
    if (indicator) indicator.classList.remove('hidden');
    if (indText) indText.textContent = "Ouvindo... Dite o texto";
  };

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    if (lastFocusedInput) {
      const currVal = lastFocusedInput.value;
      if (currVal && !currVal.endsWith(' ')) {
        lastFocusedInput.value = currVal + ' ' + text;
      } else {
        lastFocusedInput.value = (currVal || '') + text;
      }
      lastFocusedInput.dispatchEvent(new Event('input'));
    }
  };

  recognition.onend = () => {
    const btnVoz = document.getElementById('btn_voz');
    if (btnVoz) btnVoz.classList.remove('listening');

    const indicator = document.getElementById('voice-indicator');
    if (indicator) indicator.classList.add('hidden');
  };

  recognition.onerror = (event) => {
    console.error("Erro reconhecimento voz: ", event.error);
    const indText = document.getElementById('voice-text');
    if (indText) {
      if (event.error === 'not-allowed') {
        indText.textContent = "Permissão de microfone negada.";
      } else {
        indText.textContent = "Erro ao ouvir. Tente novamente.";
      }
    }
    setTimeout(() => {
      const indicator = document.getElementById('voice-indicator');
      if (indicator) indicator.classList.add('hidden');
    }, 1800);
  };
}

function toggleVoiceRecognition(event) {
  if (event) event.stopPropagation();

  if (!recognition) {
    alert("O reconhecimento de voz não é suportado ou ativado neste navegador. Use o Chrome ou Safari.");
    return;
  }

  if (!lastFocusedInput) {
    const indicator = document.getElementById('voice-indicator');
    const indText = document.getElementById('voice-text');
    if (indicator && indText) {
      indicator.classList.remove('hidden');
      indText.textContent = "Toque em um campo de texto primeiro!";
      setTimeout(() => {
        indicator.classList.add('hidden');
      }, 2000);
    } else {
      alert("Por favor, toque em um campo de texto antes de falar.");
    }
    return;
  }

  try {
    recognition.start();
  } catch (err) {
    recognition.stop();
  }
}

// Configura os ouvintes de toque longo e curto no botão de voz
function setupVoiceButtonTouchEvents() {
  const btnVoz = document.getElementById('btn_voz');
  if (!btnVoz) return;

  let startX = 0;
  let startY = 0;

  const handleStart = (e) => {
    if (e.touches && e.touches[0]) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
    isLongPressAction = false;

    // Configura o timer com base na velocidade cadastrada no state.holdTime
    longPressTimer = setTimeout(() => {
      isLongPressAction = true;
      toggleInputModeMode();
      if (navigator.vibrate) navigator.vibrate(60);
    }, state.holdTime * 1000);
  };

  const handleEnd = (e) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    if (!isLongPressAction) {
      if (appInputMode === 'voice') {
        toggleVoiceRecognition(e);
      } else {
        showTemporaryNotification("🎤 Toque longo para usar Voz");
      }
    }
    isLongPressAction = false;
  };

  const handleCancel = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    isLongPressAction = false;
  };

  const handleMove = (e) => {
    if (e.touches && e.touches[0]) {
      const moveX = e.touches[0].clientX;
      const moveY = e.touches[0].clientY;
      if (Math.abs(moveX - startX) > 30 || Math.abs(moveY - startY) > 30) {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
    }
  };

  // Eventos de Mouse (Desktop)
  btnVoz.addEventListener('mousedown', handleStart);
  btnVoz.addEventListener('mouseup', handleEnd);
  btnVoz.addEventListener('mouseleave', handleCancel);

  // Eventos de Toque (Smartphone)
  btnVoz.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleStart(e);
  });
  btnVoz.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleEnd(e);
  });
  btnVoz.addEventListener('touchmove', handleMove);
  btnVoz.addEventListener('touchcancel', handleCancel);
}

// Inicialização Automática caso o script seja carregado no final do DOM
document.addEventListener('DOMContentLoaded', () => {
  initColorPalette();
  
  // Carrega as configurações persistidas no localStorage do navegador
  loadSettingsFromStorage();

  // Inicializa o módulo SpeechRecognition
  initVoiceRecognition();

  // Configura os gatilhos de toque e pressionamento longo do microfone
  setupVoiceButtonTouchEvents();

  // Garante que o inputmode esteja inicialmente alinhado ao modo voz nos inputs
  applyInputModeSettings();

  // Valida o estado do login/sessão (v6)
  checkActiveSession();
});

// ==========================================================================
// Módulo de Notificações Inteligentes Deslizantes (v5)
// ==========================================================================
let notificationTimer = null;
const synth = window.speechSynthesis;

function toggleSpeakMessages(event) {
  state.speakMessages = event.target.checked;
  localStorage.setItem('ssvp_speak_messages', state.speakMessages ? 'true' : 'false');
  showTemporaryNotification(state.speakMessages ? "🔊 Leitura por voz ativada" : "🔇 Leitura por voz desativada");
}

function triggerSimulatedEvent(type, event) {
  if (event) event.stopPropagation();

  let text = "";
  if (type === 'wifi') {
    text = "Sincronização Concluída: Histórico de visitas da Família Silva baixado com sucesso para uso offline.";
  } else if (type === 'transito') {
    text = "Atenção: Você está a 5 minutos do destino cadastrado, UBS Indianópolis.";
  } else if (type === 'chegada') {
    text = "Alerta de Chegada: Você está na casa da Família Silva. Lembrete: Levar cesta básica.";
  }

  showNotificationBanner(text);

  // Se a opção de fala estiver habilitada, lê a mensagem
  if (state.speakMessages) {
    speakNotification(text);
  }
}

function showNotificationBanner(text) {
  const banner = document.getElementById('notification-banner');
  const bannerText = document.getElementById('notification-text');
  if (!banner || !bannerText) return;

  if (notificationTimer) {
    clearTimeout(notificationTimer);
  }

  bannerText.textContent = text;
  banner.classList.add('show');

  // Adiciona efeito de vibração se disponível (feedback tátil de trânsito)
  if (navigator.vibrate) {
    navigator.vibrate([80, 50, 80]);
  }
}

function speakNotification(text) {
  if (!synth) return;

  // Cancela qualquer fala em andamento
  if (synth.speaking) {
    synth.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'pt-BR';
  utterance.rate = 1.0; // Velocidade natural
  synth.speak(utterance);
}

// ==========================================================================
// Módulo de Login Seguro e Teclado Numérico (v6)
// ==========================================================================
let typedPin = '';

function checkActiveSession() {
  const sessionStatus = document.getElementById('session-status');
  const loginFields = document.getElementById('login-fields');
  if (!sessionStatus || !loginFields) return;

  const session = localStorage.getItem('ssvp_session');
  if (session === 'active') {
    sessionStatus.classList.remove('hidden');
    loginFields.style.display = 'none';
  } else {
    sessionStatus.classList.add('hidden');
    loginFields.style.display = 'block';
  }
}

function pressKey(key, event) {
  if (event) event.stopPropagation();

  // Ignora teclas se a sessão já estiver ativa
  if (localStorage.getItem('ssvp_session') === 'active') return;

  if (key === 'C') {
    typedPin = '';
  } else if (key === 'B') {
    typedPin = typedPin.slice(0, -1);
  } else if (typedPin.length < 4) {
    typedPin += key;
  }

  updatePinDots();

  // Inicia validação assim que o PIN alcança 4 dígitos
  if (typedPin.length === 4) {
    setTimeout(validatePin, 200); // Pequeno atraso para o preenchimento visual do último círculo
  }
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    if (dot) {
      if (i < typedPin.length) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    }
  }
}

function validatePin() {
  const loginCard = document.getElementById('login-card');
  if (!loginCard) return;

  if (typedPin === '1904') {
    // Caso de Sucesso
    loginCard.classList.add('login-success');
    localStorage.setItem('ssvp_session', 'active');
    
    const textSuccess = "Login realizado com sucesso! Acessando o painel de visitas.";
    showTemporaryNotification("✓ Acesso Concedido");

    if (state.speakMessages) {
      speakNotification(textSuccess);
    }

    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    setTimeout(() => {
      loginCard.classList.remove('login-success');
      checkActiveSession();
    }, 1500);

  } else {
    // Caso de Falha
    loginCard.classList.add('login-error');
    typedPin = '';
    updatePinDots();

    const textError = "PIN incorreto. Tente novamente.";
    showTemporaryNotification("❌ Código PIN Incorreto");

    if (state.speakMessages) {
      speakNotification(textError);
    }

    if (navigator.vibrate) {
      navigator.vibrate(150);
    }

    setTimeout(() => {
      loginCard.classList.remove('login-error');
    }, 550);
  }
}

function directAccess(event) {
  if (event) event.stopPropagation();
  showTemporaryNotification("✓ Painel de visitas acessado");
}

function simulatedLogout(event) {
  if (event) event.stopPropagation();
  localStorage.removeItem('ssvp_session');
  showTemporaryNotification("⚙️ Logout efetuado com sucesso");
  checkActiveSession();
}
