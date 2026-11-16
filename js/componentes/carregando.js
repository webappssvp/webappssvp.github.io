/**
 * @fileoverview Card de espera: nuvem branca sobre fundo vermelho, com a seta andando dentro dela,
 * colocado depois do texto das mensagens de espera, no lugar das reticências.
 * - Baixando ("Buscando os dados", atualizar a lista): a seta desce da nuvem para o celular.
 * - Enviando ("Salvando", "Cadastrando", entrar): a seta sobe do celular para a nuvem.
 * Substituiu a seta girando em 14/11/2026: em campo, sem internet boa, o vicentino vê para que lado
 * os dados estão indo. Com as animações desligadas, a seta para no meio da nuvem e o card fica.
 */

/** Nuvem cheia (Material Symbols "cloud"). */
const NUVEM = 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 ' +
  '2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z';

/** Seta para baixo e para cima, centradas na nuvem (o CSS faz a seta andar). */
const SETA_DESCE = 'M11 8h2v5h3l-4 4-4-4h3z';
const SETA_SOBE = 'M11 16v-5H8l4-4 4 4h-3v5z';

/**
 * @param {string} seta Caminho da seta.
 * @return {string} SVG
 */
const svgNuvem = (seta) => '<svg viewBox="0 0 24 24" aria-hidden="true">' +
  `<path class="nuvem-corpo" d="${NUVEM}"/><path class="nuvem-seta" d="${seta}"/></svg>`;

/** SVG da nuvem com a seta descendo (também usado no botão de atualizar a lista). */
export const SVG_BAIXANDO = svgNuvem(SETA_DESCE);

/** SVG da nuvem com a seta subindo. */
export const SVG_ENVIANDO = svgNuvem(SETA_SOBE);

/** HTML do card "baixando", para juntar a um texto já escapado. */
export const CARD_BAIXANDO = `<span class="card-carregando baixando" aria-hidden="true">${SVG_BAIXANDO}</span>`;

/** HTML do card "enviando", para juntar a um texto já escapado. */
export const CARD_ENVIANDO = `<span class="card-carregando enviando" aria-hidden="true">${SVG_ENVIANDO}</span>`;

/**
 * Escreve o texto num elemento, seguido do card.
 * @param {!Element} elemento
 * @param {string} texto Texto puro (não é HTML).
 * @param {string=} sentido 'baixar' (padrão) ou 'enviar'.
 */
export function mostrarCarregando(elemento, texto, sentido = 'baixar') {
  elemento.textContent = texto;
  elemento.insertAdjacentHTML('beforeend', sentido === 'enviar' ? CARD_ENVIANDO : CARD_BAIXANDO);
}
