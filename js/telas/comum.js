/**
 * @fileoverview Peças comuns às telas.
 * Cada tela exporta renderizar(area, sessao) e devolve o texto que o modo Ouvir lê.
 */

import {definirBarra} from '../componentes/barra_tela.js';
import {abrirPainelConexao} from '../componentes/barra_conexao.js';

/**
 * Escapa texto para colocar em HTML.
 * @param {string} texto
 * @return {string}
 */
export function esc(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;'}[c]));
}

/** Endereço (#hash) da tela anterior, para o Voltar agir como o do celular. */
let hashAnterior = '';
window.addEventListener('hashchange', (e) => {
  hashAnterior = new URL(e.oldURL).hash;
});

/**
 * Volta para a lista como o Voltar do celular: se a tela anterior era ela, recua no histórico
 * (o Voltar seguinte não reabre os detalhes). Se a pessoa chegou por outro caminho
 * (link direto, depois de um cadastro), abre a lista.
 * @param {string} destino Endereço da lista, ex.: '#pessoas'.
 */
export function voltar(destino) {
  if (hashAnterior === destino && history.length > 1) {
    history.back();
  } else {
    location.hash = destino;
  }
}

/**
 * Botão "Voltar para ..." no alto das telas de detalhe e de cadastro.
 * Padrão de todas as telas de detalhe: fica antes do título.
 * O toque é tratado em app.js (data-voltar), que chama voltar().
 * @param {string} destino Endereço da lista, ex.: '#pessoas'.
 * @param {string} nomeLista Nome da lista em minúsculas, ex.: 'pessoas'.
 * @return {string} HTML
 */
export function botaoVoltar(destino, nomeLista) {
  return `
    <a class="btn-secundario btn-link btn-voltar" href="${esc(destino)}" data-voltar>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z"/></svg>
      Voltar para ${esc(nomeLista)}
    </a>`;
}

/**
 * Tela ainda em construção.
 * @param {!HTMLElement} area
 * @param {{titulo: string, texto: string, itens: !Array<string>, arquivo: string}} t
 * @return {string} Texto para o modo Ouvir.
 */
export function telaEmConstrucao(area, t) {
  definirBarra({titulo: t.titulo});
  area.innerHTML = `
    <article class="md-card">
      <span class="selo-construcao">Em construção</span>
      <p class="tela-texto">${esc(t.texto)}</p>
      <ul class="tela-texto tela-lista">${t.itens.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <p class="tela-texto tela-rodape">Decisões: <code>${esc(t.arquivo)}</code></p>
    </article>`;
  return t.titulo + '. Esta tela ainda está em construção. ' + t.texto;
}

/**
 * Convite para entrar, quando a tela precisa de sessão.
 * @param {!HTMLElement} area
 * @param {string} titulo
 * @return {string} Texto para o modo Ouvir.
 */
export function pedirConexao(area, titulo) { // eslint-disable-line no-unused-vars
  // Sem sessão, nenhuma tela tem conteúdo: sem o título dela (ex.: "Pessoas" embaixo do painel de login, logo
  // depois do Sair; 14/11/2026). Sem o card "Escolha a sua conferência" (19/11/2026): o painel de entrar fica aberto
  // em cima (barra_conexao.js), e as cores dos campos mostram o que falta escolher.
  area.innerHTML = '';
  abrirPainelConexao();
  return 'Escolha a sua conferência e entre com o seu e-mail e senha para começar.';
}

/**
 * Campo de senha com o botão de olho (mostrar/esconder), como na barra de conexão.
 * O toque no olho é tratado aqui mesmo (um ouvinte para todas as telas).
 * @param {string} id
 * @param {string} rotulo
 * @return {string} HTML do grupo (rótulo, campo e botão).
 */
export function campoSenha(id, rotulo) {
  return `
    <div class="form-grupo"><label class="form-label" for="${id}">${esc(rotulo)}</label>
      <div class="campo-senha">
        <input id="${id}" class="form-input" type="password" autocomplete="current-password" required>
        <button type="button" class="btn-olho" data-olho-para="${id}" aria-pressed="false" aria-label="Mostrar a senha">
          <svg viewBox="0 0 24 24" aria-hidden="true" data-olho="aberto"><path d="M12 5C6.5 5 2.3 8.6 1 12c1.3 3.4 5.5 7 11 7s9.7-3.6 11-7c-1.3-3.4-5.5-7-11-7zm0 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-2.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>
          <svg viewBox="0 0 24 24" aria-hidden="true" data-olho="fechado" hidden><path d="M2.3 3.7 3.7 2.3l18 18-1.4 1.4-3.4-3.4A12 12 0 0 1 12 19C6.5 19 2.3 15.4 1 12a12.6 12.6 0 0 1 4-5.3zM12 5c5.5 0 9.7 3.6 11 7a12.4 12.4 0 0 1-3 4.5l-3.3-3.3A4.5 4.5 0 0 0 10.8 7.3L8.4 4.9A12 12 0 0 1 12 5zm-4.4 5.4a4.5 4.5 0 0 0 6 6z"/></svg>
        </button>
      </div></div>`;
}

document.addEventListener('click', (e) => {
  const botao = e.target.closest('.btn-olho[data-olho-para]');
  if (!botao) {
    return;
  }
  const campo = document.getElementById(botao.dataset.olhoPara);
  if (!campo) {
    return;
  }
  const ver = botao.getAttribute('aria-pressed') !== 'true';
  campo.type = ver ? 'text' : 'password';
  botao.setAttribute('aria-pressed', String(ver));
  botao.setAttribute('aria-label', ver ? 'Esconder a senha' : 'Mostrar a senha');
  botao.querySelector('[data-olho="aberto"]').toggleAttribute('hidden', ver);
  botao.querySelector('[data-olho="fechado"]').toggleAttribute('hidden', !ver);
  campo.focus();
});
