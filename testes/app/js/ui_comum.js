/**
 * @fileoverview Utilitários de Interface Compartilhados entre as Views de Teste.
 * Ajuste dinâmico de viewport (--vh), amarração de eventos da barra e áudio.
 * Módulo: testes/app/js/ui_comum.js
 * Conformidade com: dev/padroes/02_javascript_google.md e dev/padroes/05_acessibilidade_ergonomia.md
 */

import { restaurarSessao } from './auth.js';
import { alternarDitadoVoz } from './voz.js';

/**
 * Ajusta dinamicamente a altura útil do viewport (--vh) para navegadores móveis.
 * @return {void}
 */
export function ajustarViewport() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

/**
 * Inicializa os componentes visuais comuns da tela de teste.
 * @param {string} nomeVersao Identificador da view de teste (ex: 't1_login v1.0').
 * @return {Promise<void>}
 */
export async function inicializarShellComum(nomeVersao) {
  ajustarViewport();
  window.addEventListener('resize', ajustarViewport);
  window.addEventListener('orientationchange', () => setTimeout(ajustarViewport, 150));

  // Aplica a identificação de versão discreta no topo
  const badgeVersao = document.getElementById('lblVersaoTopo');
  if (badgeVersao && nomeVersao) {
    badgeVersao.textContent = nomeVersao;
  }

  // Inicializa botões da barra inferior
  const btnFalar = document.getElementById('btnCapsulaFalar');
  if (btnFalar) {
    btnFalar.addEventListener('click', () => {
      alternarDitadoVoz();
    });
  }

  const btnTeclado = document.getElementById('btnCapsulaTeclado');
  if (btnTeclado) {
    btnTeclado.addEventListener('click', () => {
      const campo = document.activeElement;
      if (campo && (campo.tagName === 'INPUT' || campo.tagName === 'TEXTAREA')) {
        campo.blur();
      }
    });
  }

  // Restaura o estado da sessão e Semáforo a partir do IndexedDB
  await restaurarSessao();
}
