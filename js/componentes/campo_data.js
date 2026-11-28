/**
 * @fileoverview Campo de data dd/mm/aaaa (data de nascimento, 28/11/2026): as barras entram sozinhas e o cursor fica
 * onde a pessoa está digitando.
 * - Digitar no meio de uma data completa troca o algarismo seguinte (como sobrescrever): mudar o dia de 28 para 29
 *   não empurra o ano para fora.
 * - Apagar no meio só volta o cursor (pulando a barra), sem desarrumar a data: depois, digita-se por cima. No fim do
 *   campo, apaga normalmente. Pelo "beforeinput": no teclado do Android, a tecla Apagar nem sempre chega como tecla.
 */

/** @param {string} digitos Até 8 algarismos. @return {string} "dd/mm/aaaa" (parcial enquanto digita). */
function formatar(digitos) {
  if (digitos.length > 4) {
    return digitos.slice(0, 2) + '/' + digitos.slice(2, 4) + '/' + digitos.slice(4);
  }
  return digitos.length > 2 ? digitos.slice(0, 2) + '/' + digitos.slice(2) : digitos;
}

/**
 * Onde fica o cursor depois de N algarismos no texto formatado.
 * @param {string} texto
 * @param {number} algarismos
 * @return {number}
 */
function posicaoDepoisDe(texto, algarismos) {
  if (algarismos <= 0) {
    return 0;
  }
  let vistos = 0;
  for (let i = 0; i < texto.length; i++) {
    if (/\d/.test(texto[i]) && ++vistos === algarismos) {
      // Logo antes de uma barra, o cursor pula para depois dela (o próximo algarismo já é do mês ou do ano).
      return texto[i + 1] === '/' ? i + 2 : i + 1;
    }
  }
  return texto.length;
}

/**
 * Liga a máscara num campo de texto.
 * @param {?HTMLInputElement} campo
 */
export function ligarCampoData(campo) {
  if (!campo) {
    return;
  }
  campo.addEventListener('beforeinput', (e) => {
    const pos = campo.selectionStart;
    if (e.inputType !== 'deleteContentBackward' || pos !== campo.selectionEnd || pos === 0) {
      return; // com um trecho selecionado, ou no começo, o navegador faz o de sempre
    }
    if (pos < campo.value.length) {
      e.preventDefault(); // no meio: só volta o cursor
      const volta = campo.value[pos - 1] === '/' ? 2 : 1;
      campo.setSelectionRange(Math.max(pos - volta, 0), Math.max(pos - volta, 0));
    } else if (campo.value[pos - 1] === '/') {
      e.preventDefault(); // no fim, logo depois da barra: leva a barra e o algarismo antes dela
      campo.value = campo.value.slice(0, pos - 2);
      campo.setSelectionRange(campo.value.length, campo.value.length);
    }
  });
  campo.addEventListener('input', () => {
    const pos = campo.selectionStart === null ? campo.value.length : campo.selectionStart;
    const antesDoCursor = campo.value.slice(0, pos).replace(/\D/g, '').length;
    let digitos = campo.value.replace(/\D/g, '');
    if (digitos.length > 8) {
      // Data completa e um algarismo a mais no meio: sai o que estava logo depois do cursor.
      digitos = digitos.slice(0, antesDoCursor) + digitos.slice(antesDoCursor + 1);
    }
    digitos = digitos.slice(0, 8);
    const novo = formatar(digitos);
    if (novo !== campo.value) {
      campo.value = novo;
    }
    const cursor = Math.min(posicaoDepoisDe(novo, Math.min(antesDoCursor, digitos.length)), novo.length);
    if (document.activeElement === campo) {
      campo.setSelectionRange(cursor, cursor);
    }
  });
}
