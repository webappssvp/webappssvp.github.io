/**
 * @fileoverview Escolhe a conversão pelo tipo do campo (usado pela página t2 e pelo Node).
 * Tipos: numero, complemento, logradouro (datas por extenso) e logradouro_algarismos (datas em algarismos).
 */
import {paraNumeroDoEndereco, paraComplemento, paraLogradouro} from '../../js/core/numeros_falados.js';

/**
 * @param {string} tipo
 * @param {string} texto
 * @return {string}
 */
export function converter(tipo, texto) {
  if (tipo === 'numero') {
    return paraNumeroDoEndereco(texto);
  }
  if (tipo === 'complemento') {
    return paraComplemento(texto);
  }
  return paraLogradouro(texto, {datas: tipo === 'logradouro_algarismos' ? 'algarismos' : 'extenso'});
}
