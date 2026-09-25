/**
 * @fileoverview Gerenciador de Sessão e Semáforo Vicentino para as Views de Teste.
 * Módulo: testes/app/js/auth.js
 * Conformidade com: dev/padroes/02_javascript_google.md
 */

import * as db from './db.js';

export const EstadosSemaforo = {
  NAO_CONECTADO: 'NAO_CONECTADO',
  NAO_LOGADO: 'NAO_LOGADO',
  LOGADO: 'LOGADO'
};

let sessaoAtiva = {
  conectado: false,
  conselho_metropolitano: 'São Paulo',
  id_cc: null,
  nome_cc: null,
  id_cp: null,
  nome_cp: null,
  id_ssvp: null,
  nome_cf: null,
  nome_pessoa: null,
  email_pessoa: null
};

/**
 * Retorna uma cópia da sessão ativa.
 * @return {Object}
 */
export function obterSessaoAtiva() {
  return { ...sessaoAtiva };
}

/**
 * Atualiza o Semáforo visual na Barra Superior.
 * @param {string} estado
 * @param {{nome_cf?: string, nome_pessoa?: string}} [detalhes={}]
 * @return {void}
 */
export function atualizarSemaforo(estado, detalhes = {}) {
  const barra = document.getElementById('barraSuperior');
  const txtPrincipal = document.getElementById('txtStatusPrincipal');
  const txtSub = document.getElementById('txtStatusSub');

  if (!barra || !txtPrincipal || !txtSub) {
    return;
  }

  txtPrincipal.classList.remove('pulsar');

  switch (estado) {
    case EstadosSemaforo.NAO_CONECTADO:
      barra.style.backgroundColor = 'var(--ssvp-red)';
      txtPrincipal.textContent = 'Não conectado';
      txtPrincipal.classList.add('pulsar');
      txtSub.textContent = 'Toque para conectar';
      break;

    case EstadosSemaforo.NAO_LOGADO:
      barra.style.backgroundColor = 'var(--ssvp-red)';
      txtPrincipal.textContent = 'Não logado';
      txtSub.textContent = detalhes.nome_cf || 'Toque para entrar';
      break;

    case EstadosSemaforo.LOGADO:
      barra.style.backgroundColor = 'var(--ssvp-navy)';
      txtPrincipal.textContent = detalhes.nome_cf || 'Conferência Ativa';
      txtSub.textContent = detalhes.nome_pessoa ? `Olá, ${detalhes.nome_pessoa}` : 'Conectado';
      break;

    default:
      break;
  }
}

/**
 * Restaura a sessão salva do IndexedDB e atualiza o Semáforo.
 * @return {Promise<Object>}
 */
export async function restaurarSessao() {
  const registro = await db.lerSessao();
  if (registro && registro.id_ssvp) {
    sessaoAtiva = { ...sessaoAtiva, ...registro };
    if (sessaoAtiva.conectado) {
      atualizarSemaforo(EstadosSemaforo.LOGADO, sessaoAtiva);
    } else {
      atualizarSemaforo(EstadosSemaforo.NAO_LOGADO, sessaoAtiva);
    }
  } else {
    atualizarSemaforo(EstadosSemaforo.NAO_CONECTADO);
  }
  return { ...sessaoAtiva };
}

/**
 * Grava a sessão autenticada no IndexedDB e atualiza o estado da aplicação.
 * @param {Object} novosDados
 * @return {Promise<void>}
 */
export async function salvarSessaoAutenticada(novosDados) {
  sessaoAtiva = { ...sessaoAtiva, ...novosDados };
  await db.salvarSessao(sessaoAtiva);
  atualizarSemaforo(sessaoAtiva.conectado ? EstadosSemaforo.LOGADO : EstadosSemaforo.NAO_LOGADO, sessaoAtiva);
}

/**
 * Desconecta a conferência ativa.
 * @return {Promise<void>}
 */
export async function desconectarSessao() {
  await db.limparSessao();
  sessaoAtiva = {
    conectado: false,
    conselho_metropolitano: 'São Paulo',
    id_cc: null,
    nome_cc: null,
    id_cp: null,
    nome_cp: null,
    id_ssvp: null,
    nome_cf: null,
    nome_pessoa: null,
    email_pessoa: null
  };
  atualizarSemaforo(EstadosSemaforo.NAO_CONECTADO);
}
