/**
 * @fileoverview Botão "Compartilhar" (18/11/2026): manda por WhatsApp, e-mail etc. o link de uma tela do app.
 *
 * - O link leva a conferência (?cm=SP&cc=SUD&cf=SP_SUD_TES_TEA): cada conferência tem a sua numeração, e o mesmo
 *   código (PES_000002) existe em todas. Quem recebe cai na conferência certa (barra_conexao.js, aplicarLink) e,
 *   se não estiver logado nela, entra primeiro; a tela abre depois.
 * - O texto da mensagem não leva nome nem dado nenhum de quem é atendido: só o link, que traz o código. Quem abre
 *   vê o que o papel e o cargo dele permitem (a planilha decide).
 * - Cadastro ainda no celular (id "tmp-…"): sem botão, porque o código só existe neste celular.
 * - Com o menu de compartilhar do celular (navigator.share); sem ele (computador), copia o link.
 */

import {avisar} from '../casca.js';

/** @param {*} t @return {string} */
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  '\'': '&#39;'}[c]));

/**
 * @param {string} rota "#pessoas/PES_000002"
 * @param {string=} cf Conferência (sem ela, o link abre para qualquer um: "Como o app guarda e envia").
 * @return {string}
 */
export function linkDaTela(rota, cf) {
  const base = location.origin + location.pathname;
  if (!cf) {
    return base + rota;
  }
  const [cm, cc] = cf.split('_');
  return base + '?cm=' + encodeURIComponent(cm) + '&cc=' + encodeURIComponent(cc) + '&cf=' +
    encodeURIComponent(cf) + rota;
}

/**
 * @param {string} rota
 * @param {string=} cf
 * @param {string=} oQue Para a mensagem, sem dados de ninguém: "uma família", "uma pessoa", "uma visita".
 * @return {string} HTML ('' se o código ainda é provisório)
 */
export function botaoCompartilhar(rota, cf, oQue) {
  if (/tmp-/.test(rota)) {
    return '';
  }
  return `<button type="button" class="btn-secundario btn-compartilhar" data-compartilhar="${esc(rota)}"
    data-compartilhar-cf="${esc(cf || '')}" data-compartilhar-oque="${esc(oQue || '')}">🔗 Compartilhar</button>`;
}

/** @param {!HTMLElement} botao */
async function compartilhar(botao) {
  const url = linkDaTela(botao.dataset.compartilhar, botao.dataset.compartilharCf);
  const oQue = botao.dataset.compartilharOque;
  const texto = oQue ? 'Veja ' + oQue + ' no app da SSVP:' : 'Veja como o app da SSVP guarda e envia os dados:';
  if (navigator.share) {
    try {
      await navigator.share({title: 'SSVP', text: texto, url});
      return;
    } catch (erro) {
      if (erro && erro.name === 'AbortError') {
        return; // a pessoa fechou o menu
      }
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    avisar('Link copiado. Cole no WhatsApp ou no e-mail.');
  } catch (erro) {
    window.prompt('Copie o link:', url);
  }
}

/** Um ouvinte só, na página inteira: as telas só desenham o botão. */
export function ligarCompartilhar() {
  document.addEventListener('click', (e) => {
    const botao = e.target.closest('[data-compartilhar]');
    if (botao) {
      e.preventDefault();
      compartilhar(botao);
    }
  });
}
