/**
 * @fileoverview Ícone de sincronização de cada item das listas. Decisões: mvp/telas/05_sincronizacao.md.
 *
 * Responde "a planilha já tem a minha versão deste item?". Cada estado tem um desenho próprio (WCAG 1.4.1);
 * a cor só reforça:
 * - local: banco de dados, azul (guardado no celular, falta enviar);
 * - enviando: nuvem com seta subindo, amarela;
 * - sem_confirmacao: nuvem com relógio, amarela;
 * - confirmado: nuvem com ✓, verde (também o que veio da planilha e não foi mexido);
 * - recusado: nuvem com !, vermelha.
 */

/** Nuvem cheia (Material Symbols "cloud"). */
const NUVEM = 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 ' +
  '2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z';

/** Banco de dados (Material Symbols "database"). */
const BANCO = 'M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.59 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm6 14c0 .5-2.13 2-6 ' +
  '2s-6-1.5-6-2v-2.23c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V17zm0-4.55c-1.3.95-3.58 1.55-6 1.55s-4.7-.6-6-1.55' +
  'V9.64c1.47.83 3.61 1.36 6 1.36s4.53-.53 6-1.36v2.81zM12 9C8.13 9 6 7.5 6 7s2.13-2 6-2 6 1.5 6 2-2.13 2-6 2z';

/** Marca dentro da nuvem, desenhada com a cor do fundo do cartão. */
const MARCAS = {
  enviando: '<path class="icone-sync-seta" d="M11 17v-4.5H8.5L12 9l3.5 3.5H13V17z"/>',
  sem_confirmacao: '<circle class="icone-sync-traco" cx="12" cy="13.5" r="3.6"/>' +
    '<path class="icone-sync-traco" d="M12 11.6v2.1l1.4 1"/>',
  confirmado: '<path class="icone-sync-traco" d="M8.6 13.6l2.3 2.3 4.5-4.6"/>',
  recusado: '<path class="icone-sync-marca" d="M11 9.5h2v4.5h-2zm0 5.5h2v2h-2z"/>',
};

/** Texto para o leitor de tela e o modo Ouvir. */
const TEXTOS = {
  local: 'Guardado no celular, falta enviar',
  enviando: 'Enviando',
  sem_confirmacao: 'Enviado, esperando confirmação',
  confirmado: 'Enviado e confirmado',
  recusado: 'Recusado',
};

/**
 * @param {string} estado local, enviando, sem_confirmacao, confirmado ou recusado.
 * @param {string=} motivo Mensagem do servidor (recusado).
 * @return {string} Texto do estado.
 */
export function textoDoEstado(estado, motivo = '') {
  const texto = TEXTOS[estado] || TEXTOS.confirmado;
  return estado === 'recusado' && motivo ? texto + ': ' + motivo : texto;
}

/**
 * @param {string} estado
 * @param {string=} motivo
 * @return {string} HTML do ícone, com o texto para o leitor de tela.
 */
export function iconeSync(estado, motivo = '') {
  const e = TEXTOS[estado] ? estado : 'confirmado';
  const desenho = e === 'local' ? `<path d="${BANCO}"/>` : `<path d="${NUVEM}"/>${MARCAS[e]}`;
  const texto = textoDoEstado(e, motivo).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  return `<span class="icone-sync icone-sync-${e}" role="img" aria-label="${texto}" title="${texto}">` +
    `<svg viewBox="0 0 24 24" aria-hidden="true">${desenho}</svg></span>`;
}
