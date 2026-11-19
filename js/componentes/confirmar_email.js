/**
 * @fileoverview "Confirme o novo e-mail" (19/11/2026): é com o e-mail que a pessoa entra no app e recebe o código de
 * acesso, e um erro de digitação a deixa de fora. Ao mudar o e-mail (editar a pessoa) ou escrever um (pessoa nova),
 * aparece logo abaixo um campo para digitá-lo de novo; salvar só passa com os dois iguais.
 */

/** @param {*} t @return {string} */
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  '\'': '&#39;'}[c]));

/** @param {string} v @return {string} */
const normal = (v) => String(v || '').trim().toLowerCase();

/**
 * O campo, escondido até o e-mail mudar. Vai logo depois do campo do e-mail.
 * @param {string} id
 * @return {string} HTML
 */
export function campoConfirmarEmail(id) {
  return `
    <div class="form-grupo" data-campo="${esc(id)}" hidden>
      <label class="form-label" for="${esc(id)}">Confirme o novo e-mail</label>
      <input id="${esc(id)}" class="form-input" type="email" inputmode="email" autocomplete="off" autocapitalize="none"
        maxlength="200" aria-describedby="${esc(id)}_erro">
      <p class="campo-erro" id="${esc(id)}_erro" role="alert" hidden>Os dois e-mails não são iguais. Escreva o mesmo
        e-mail nos dois campos.</p>
    </div>`;
}

/**
 * @param {!HTMLElement} raiz O formulário.
 * @param {string} idEmail
 * @param {string} idConfirmar
 * @param {string=} original O e-mail que a pessoa já tem ('' na pessoa nova).
 * @return {{conferir: function(): string}} conferir: '' se pode salvar; senão, a mensagem (e põe o foco no campo).
 */
export function ligarConfirmarEmail(raiz, idEmail, idConfirmar, original = '') {
  const email = raiz.querySelector('#' + idEmail);
  const confirmar = raiz.querySelector('#' + idConfirmar);
  if (!email || !confirmar) {
    return {conferir: () => ''};
  }
  const grupo = confirmar.closest('[data-campo]');
  const erro = raiz.querySelector('#' + idConfirmar + '_erro');
  const precisa = () => Boolean(normal(email.value)) && normal(email.value) !== normal(original) &&
    !(email.closest('[data-campo]') || {}).hidden;
  const mostrarErro = (sim) => {
    erro.hidden = !sim;
    if (sim) {
      confirmar.setAttribute('aria-invalid', 'true'); // borda vermelha (.form-input[aria-invalid])
    } else {
      confirmar.removeAttribute('aria-invalid');
    }
  };
  const ajustar = () => {
    const mostrar = precisa();
    if (grupo.hidden === mostrar) {
      grupo.hidden = !mostrar;
      if (!mostrar) {
        confirmar.value = '';
        mostrarErro(false);
      }
    }
    // Com o aviso na tela, ele some assim que os dois ficarem iguais.
    if (!erro.hidden && normal(confirmar.value) === normal(email.value)) {
      mostrarErro(false);
    }
  };
  email.addEventListener('input', ajustar);
  raiz.addEventListener('change', ajustar); // ex.: o papel mudou e o campo do e-mail sumiu
  confirmar.addEventListener('input', ajustar);
  confirmar.addEventListener('blur', () => {
    if (precisa() && confirmar.value && normal(confirmar.value) !== normal(email.value)) {
      mostrarErro(true);
    }
  });
  ajustar();
  return {
    conferir: () => {
      ajustar();
      if (!precisa() || normal(confirmar.value) === normal(email.value)) {
        return '';
      }
      mostrarErro(Boolean(confirmar.value));
      confirmar.focus();
      return confirmar.value ? 'Os dois e-mails não são iguais.' : 'Confirme o novo e-mail no campo logo abaixo dele.';
    },
  };
}
