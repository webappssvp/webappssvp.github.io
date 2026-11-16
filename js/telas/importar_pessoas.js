/**
 * @fileoverview Tela Importar pessoas (#importar). Decisões: mvp/telas/04_importar_pessoas.md
 */

import {telaEmConstrucao, pedirConexao} from './comum.js';

/**
 * @param {!HTMLElement} area
 * @param {?Object} sessao sessaoAtual() do barra_conexao.js
 * @return {string} Texto para o modo Ouvir.
 */
export function renderizar(area, sessao) {
  if (!sessao) {
    return pedirConexao(area, 'Importar pessoas');
  }
  return telaEmConstrucao(area, {
    titulo: 'Importar pessoas',
    texto: 'Aqui o presidente vai trazer a planilha de vicentinos que a conferência já tem.',
    itens: ['Arquivo .xlsx ou .csv, lido no próprio celular', 'Escolher qual coluna é nome, e-mail, celular…',
      'Ver a prévia antes de enviar'],
    arquivo: 'mvp/telas/04_importar_pessoas.md',
  });
}
