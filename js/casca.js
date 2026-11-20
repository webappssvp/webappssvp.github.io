/**
 * @fileoverview Casca do app: menu ⋮, gaveta superior (Sincronização, Configurações, Ajuda),
 * gaveta de telas (Menu), botão Sair e avisos. O modo "O que é isso?" saiu em 20/11/2026: a Ajuda de cada tela está
 * em js/componentes/tutorial.js.
 * Origem: testes/app/t3_casca.html. Decisões: mvp/telas/00_casca.md
 */

import {prefs, definirPreferencia, eventosPreferencias, vibrar, bipar, tipoDeRede} from './core/preferencias.js';
import {pararLeitura} from './core/voz.js';
import {mostrarAvisosDeNovo} from './componentes/tutorial.js';

const estado = {
  timerAviso: null,
  aoSair: async () => {},
  aoSincronizar: async () => {},
  aoAbrirSincronizacao: () => {},
};

const $ = (id) => document.getElementById(id);

/**
 * @param {{aoSair: function(): !Promise<void>, aoSincronizar: function(): !Promise<void>,
 *     aoAbrirSincronizacao: function(): void}} opcoes
 */
export function iniciarCasca(opcoes) {
  estado.aoSair = opcoes.aoSair;
  estado.aoSincronizar = opcoes.aoSincronizar;
  estado.aoAbrirSincronizacao = opcoes.aoAbrirSincronizacao || (() => {});
  ligarMenuOverflow();
  ligarGavetaSuperior();
  ligarConfiguracoes();
  ligarAjuda();
  ligarGavetaTelas();
  $('btnFooterSair').addEventListener('click', sair);
  window.addEventListener('online', mostrarRede);
  window.addEventListener('offline', mostrarRede);
  mostrarRede();
}

/** Aviso curto no rodapé da tela. @param {string} texto */
export function avisar(texto) {
  const t = $('toastMsg');
  t.textContent = texto;
  t.classList.add('visivel');
  clearTimeout(estado.timerAviso);
  estado.timerAviso = setTimeout(() => t.classList.remove('visivel'), 2600);
}

// ---------------------------------------------------------------------------
// Menu ⋮ e gaveta superior
// ---------------------------------------------------------------------------

function ligarMenuOverflow() {
  const overlay = $('popupOverlay');
  $('btnOverflow').addEventListener('click', (e) => {
    e.stopPropagation();
    vibrar(25);
    overlay.classList.toggle('visivel');
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('visivel');
    }
  });
  overlay.querySelectorAll('[data-modulo]').forEach((b) => b.addEventListener('click', () => {
    overlay.classList.remove('visivel');
    abrirGaveta(b.dataset.modulo);
  }));
}

/**
 * Abre a gaveta superior numa aba (o botão Nuvem abre a de Sincronização).
 * @param {string} modulo sincronizacao, configuracoes ou ajuda
 */
export function abrirGaveta(modulo) {
  mudarAba(modulo);
  $('scrimTop').classList.add('aberto');
  vibrar(30);
}

export function fecharGaveta() {
  $('scrimTop').classList.remove('aberto');
}

/** @param {string} modulo */
function mudarAba(modulo) {
  document.querySelectorAll('#topSheet [data-aba]').forEach((b) => {
    const ativo = b.dataset.aba === modulo;
    b.classList.toggle('ativo', ativo);
    b.setAttribute('aria-selected', String(ativo));
    $(b.getAttribute('aria-controls')).classList.toggle('ativo', ativo);
  });
  if (modulo === 'sincronizacao') {
    mostrarRede();
    estado.aoAbrirSincronizacao();
  }
}

function ligarGavetaSuperior() {
  const scrim = $('scrimTop');
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim) {
      fecharGaveta();
    }
  });
  document.querySelectorAll('#topSheet [data-aba]').forEach((b) => b.addEventListener('click', () => mudarAba(b.dataset.aba)));
  document.querySelectorAll('[data-acao="fechar-gaveta"]').forEach((b) => b.addEventListener('click', fecharGaveta));
  $('btnSincronizar').addEventListener('click', sincronizar);
}

// ---------------------------------------------------------------------------
// Sincronização
// ---------------------------------------------------------------------------

function mostrarRede() {
  const badge = $('badgeRedeStatus');
  if (!badge) {
    return;
  }
  const rede = tipoDeRede();
  if (!navigator.onLine) {
    badge.textContent = '🔴 Sem internet';
  } else if (rede === 'wifi' || rede === 'ethernet') {
    badge.textContent = '🟢 Wi-Fi';
  } else if (rede === 'cellular') {
    badge.textContent = '🟡 Dados móveis';
  } else {
    badge.textContent = '🟢 Com internet';
  }
}

/** "Sincronizar agora": quem chama decide sobre a internet e os dados móveis (js/componentes/painel_sync.js). */
async function sincronizar() {
  vibrar(35);
  await estado.aoSincronizar();
}

// ---------------------------------------------------------------------------
// Configurações (cada controle tem data-pref com a chave da preferência)
// ---------------------------------------------------------------------------

function ligarConfiguracoes() {
  document.querySelectorAll('[data-pref]').forEach((controle) => {
    const chave = controle.dataset.pref;
    if (controle instanceof HTMLInputElement) {
      controle.checked = Boolean(prefs[chave]);
      controle.addEventListener('change', async () => {
        await definirPreferencia(chave, controle.checked);
        vibrar(25);
        bipar(600);
        if (chave === 'ajudarApp') {
          avisar(controle.checked ? 'Obrigado! O app vai mandar como está sendo usado, nunca o que você escreve.' :
            'Desligado: o app não manda mais como está sendo usado.');
        }
        if (chave === 'somenteWifi') {
          avisar(controle.checked ? '📶 Vai sincronizar só no Wi-Fi' : '📶 Vai sincronizar no Wi-Fi e nos dados móveis');
        }
      });
    } else if (controle instanceof HTMLSelectElement) {
      controle.value = String(prefs[chave]);
      controle.addEventListener('change', async () => {
        await definirPreferencia(chave, controle.value);
        vibrar(25);
        if (chave === 'trancar') {
          avisar('O app tranca depois de ' + (controle.value === '1' ? '1 minuto' : controle.value + ' minutos') +
            ' parado.');
        }
        if (chave === 'envio') {
          avisar(controle.value === 'quando_mandar' ? 'Vai juntar as mudanças: envie pela Nuvem quando quiser.' :
            'Vai enviar cada mudança assim que salvar.');
        }
      });
    }
  });
  // Mudou em outro lugar (ex.: a tela "Como o app guarda e envia"): o controle mostra o valor novo.
  eventosPreferencias.addEventListener('mudou', (e) => {
    document.querySelectorAll(`[data-pref="${e.detail.chave}"]`).forEach((controle) => {
      if (controle instanceof HTMLInputElement) {
        controle.checked = Boolean(e.detail.valor);
      } else {
        controle.value = String(e.detail.valor);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Ajuda (gaveta do alto)
// ---------------------------------------------------------------------------

function ligarAjuda() {
  $('btnAvisosAjuda').addEventListener('click', async () => {
    await mostrarAvisosDeNovo();
    vibrar(25);
    fecharGaveta();
    avisar('Os avisos de primeira vez voltam a aparecer em cada tela.');
    window.dispatchEvent(new HashChangeEvent('hashchange')); // a tela aberta redesenha a barra, com o aviso
  });
}

// ---------------------------------------------------------------------------
// Gaveta de telas (botão Menu) e Sair
// ---------------------------------------------------------------------------

function ligarGavetaTelas() {
  const scrim = $('scrimBottom');
  $('btnFooterMenu').addEventListener('click', () => {
    vibrar(25);
    scrim.classList.add('aberto');
  });
  scrim.addEventListener('click', (e) => {
    if (e.target === scrim || e.target.closest('.nav-item-btn') || e.target.closest('[data-acao="fechar-telas"]')) {
      scrim.classList.remove('aberto');
    }
  });
}

/** Marca na gaveta de telas a tela atual. @param {string} hash Ex.: '#pessoas' */
export function marcarTelaAtual(hash) {
  document.querySelectorAll('#bottomSheet .nav-item-btn').forEach((a) => {
    const atual = a.getAttribute('href') === hash;
    a.classList.toggle('ativo', atual);
    if (atual) {
      a.setAttribute('aria-current', 'page');
    } else {
      a.removeAttribute('aria-current');
    }
  });
}

async function sair() {
  pararLeitura();
  vibrar(50);
  bipar(440);
  await estado.aoSair();
}
