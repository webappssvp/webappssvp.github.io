/**
 * @fileoverview Ícones de cada item das listas. Decisões: mvp/telas/05_sincronizacao.md.
 *
 * Dois ícones lado a lado, cada um responde a uma pergunta (17/11/2026):
 * - banco de dados (o celular): "dá para abrir sem internet?" Cheio, verde: guardado; riscado, cinza: não guardado.
 * - nuvem (a planilha): "a planilha já tem a minha versão deste item?" Cada estado tem um desenho próprio
 *   (WCAG 1.4.1); a cor só reforça:
 *   - local: contorno de nuvem com seta parada, azul (gravado no celular, falta enviar);
 *   - enviando: nuvem com seta subindo, amarela;
 *   - sem_confirmacao: nuvem com relógio, amarela;
 *   - confirmado: nuvem com ✓, verde (também o que veio da planilha e não foi mexido);
 *   - recusado: nuvem com !, vermelha.
 * Tocar no par abre a folhinha do item (js/componentes/folha_item.js): enviar agora, guardar ou atualizar.
 */

/** Nuvem cheia (Material Symbols "cloud"). */
const NUVEM = 'M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 ' +
  '2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z';

/** Banco de dados (Material Symbols "database"). */
const BANCO = 'M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.59 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm6 14c0 .5-2.13 2-6 ' +
  '2s-6-1.5-6-2v-2.23c1.61.78 3.72 1.23 6 1.23s4.39-.45 6-1.23V17zm0-4.55c-1.3.95-3.58 1.55-6 1.55s-4.7-.6-6-1.55' +
  'V9.64c1.47.83 3.61 1.36 6 1.36s4.53-.53 6-1.36v2.81zM12 9C8.13 9 6 7.5 6 7s2.13-2 6-2 6 1.5 6 2-2.13 2-6 2z';

/** Seta para cima, dentro da nuvem. */
const SETA = 'M11 17v-4.5H8.5L12 9l3.5 3.5H13V17z';

/** Marca dentro da nuvem, desenhada com a cor do fundo do cartão. */
const MARCAS = {
  enviando: `<path class="icone-sync-seta" d="${SETA}"/>`,
  sem_confirmacao: '<circle class="icone-sync-traco" cx="12" cy="13.5" r="3.6"/>' +
    '<path class="icone-sync-traco" d="M12 11.6v2.1l1.4 1"/>',
  confirmado: '<path class="icone-sync-traco" d="M8.6 13.6l2.3 2.3 4.5-4.6"/>',
  recusado: '<path class="icone-sync-marca" d="M11 9.5h2v4.5h-2zm0 5.5h2v2h-2z"/>',
};

/** Texto para o leitor de tela e o modo Ouvir. */
const TEXTOS = {
  local: 'Gravado no celular, falta enviar',
  enviando: 'Enviando',
  sem_confirmacao: 'Enviado, esperando confirmação',
  confirmado: 'Enviado e confirmado',
  recusado: 'Recusado',
};

/** @param {*} t @return {string} */
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

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
 * @return {string} HTML do ícone da nuvem, com o texto para o leitor de tela.
 */
export function iconeSync(estado, motivo = '') {
  const e = TEXTOS[estado] ? estado : 'confirmado';
  // "Falta enviar": só o contorno da nuvem (forma diferente da nuvem cheia dos outros estados) e a seta parada.
  const desenho = e === 'local' ?
    `<path class="icone-sync-contorno" transform="translate(1.6 1.6) scale(0.867)" d="${NUVEM}"/><path d="${SETA}"/>` :
    `<path d="${NUVEM}"/>${MARCAS[e]}`;
  const texto = esc(textoDoEstado(e, motivo));
  return `<span class="icone-sync icone-sync-${e}" role="img" aria-label="${texto}" title="${texto}">` +
    `<svg viewBox="0 0 24 24" aria-hidden="true">${desenho}</svg></span>`;
}

/**
 * @param {string} guardadoEm Hora (ISO) em que o item foi guardado no celular; '' se não foi.
 * @return {string} "Guardado no celular hoje às 14:32" ou "Não guardado no celular".
 */
export function textoDoCelular(guardadoEm) {
  if (!guardadoEm) {
    return 'Não guardado no celular';
  }
  const d = new Date(guardadoEm);
  const hoje = new Date().toDateString() === d.toDateString();
  return 'Guardado no celular ' + (hoje ? 'hoje' : 'em ' + d.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})) +
    ' às ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
}

/**
 * @param {string} guardadoEm '' se não foi guardado.
 * @return {string} HTML do ícone do banco de dados (riscado quando não está guardado).
 */
export function iconeCelular(guardadoEm) {
  const texto = esc(textoDoCelular(guardadoEm));
  // O risco tem uma borda da cor do fundo, para se destacar do desenho do banco.
  const risco = guardadoEm ? '' : '<path class="icone-celular-borda" d="M3.5 3.5l17 17"/>' +
    '<path class="icone-celular-risco" d="M3.5 3.5l17 17"/>';
  return `<span class="icone-sync icone-celular icone-celular-${guardadoEm ? 'sim' : 'nao'}" role="img" ` +
    `aria-label="${texto}" title="${texto}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${BANCO}"/>${risco}</svg></span>`;
}

/**
 * O par de ícones de um item da lista, num botão que abre a folhinha do item (fica fora do link do cartão).
 * @param {{tipo: string, id: string, nome: string, estado: string, motivo: (string|undefined),
 *     guardadoEm: string}} item tipo: "pessoa" ou "familia".
 * @return {string} HTML
 */
export function botaoDoItem(item) {
  const rotulo = esc(item.nome + ': ' + textoDoCelular(item.guardadoEm) + '. ' + textoDoEstado(item.estado, item.motivo) +
    '. Toque para ver e sincronizar');
  return `<button type="button" class="botao-item" data-item-tipo="${esc(item.tipo)}" data-item-id="${esc(item.id)}" ` +
    `data-item-nome="${esc(item.nome)}" aria-label="${rotulo}">${iconeCelular(item.guardadoEm)}` +
    `${iconeSync(item.estado, item.motivo)}</button>`;
}
