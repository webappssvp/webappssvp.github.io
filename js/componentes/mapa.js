/**
 * @fileoverview Botão "Abrir no mapa" ao lado de um endereço (detalhes da pessoa e da família; 17/11/2026).
 *
 * Só aparece onde o endereço completo já aparece (quem vê contatos) e quando há rua. O endereço só vai para o
 * Google Maps quando a pessoa toca no botão: o link é montado aqui, sem chamar nada antes.
 */

/** @param {*} t @return {string} */
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  '\'': '&#39;'}[c]));

/**
 * @param {?Object} e Endereço (logradouro, numero, bairro, cidade, estado_uf, cep).
 * @return {string} Link de busca do Google Maps.
 */
export function linkDoMapa(e) {
  const texto = [e.logradouro, e.numero, e.bairro, e.cidade, e.estado_uf, e.cep].filter(Boolean).join(', ');
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(texto);
}

/**
 * @param {?Object} e
 * @return {string} HTML do botão ('' sem rua).
 */
export function botaoDoMapa(e) {
  if (!e || !e.logradouro) {
    return '';
  }
  return `<a class="btn-secundario btn-link botao-mapa" href="${esc(linkDoMapa(e))}" target="_blank" rel="noopener"
    aria-label="Abrir o endereço no Google Maps">📍 Abrir no mapa</a>`;
}

/**
 * O texto do endereço com o botão ao lado (em tela estreita, o botão desce).
 * @param {string} textoHtml O endereço já pronto em HTML (escapado).
 * @param {?Object} e
 * @return {string} HTML
 */
export function enderecoComMapa(textoHtml, e) {
  return `<div class="endereco-com-mapa"><p class="tela-texto detalhe-endereco">${textoHtml}</p>${botaoDoMapa(e)}</div>`;
}
