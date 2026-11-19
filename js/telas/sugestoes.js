/**
 * @fileoverview Tela "Sugestões e opiniões" (#sugestoes; homologação, pedido de 19/11/2026): o vicentino escreve (ou
 * dita, com o botão Falar) uma sugestão, uma opinião ou algo que não funcionou (sem "Dúvida", 19/11/2026), e o app manda para a aba
 * "sugestoes" da planilha do índice do CC (Sugestoes.gs). O Conselho Central lê e filtra por tipo e por tela.
 *
 * - Só logado: a conferência e a conta vão pelo token.
 * - Vai junto a tela de onde o vicentino veio e a versão do app, para reproduzir o problema.
 * - Sem internet, não guarda na fila: o texto fica na tela e o app pede para enviar quando a internet voltar.
 * - A resposta não volta para o app (fica na planilha).
 */

import {esc, pedirConexao} from './comum.js';
import {definirBarra} from '../componentes/barra_tela.js';
import {chamarComSessao} from '../componentes/barra_conexao.js';
import {vibrar} from '../core/preferencias.js';
import {formularioSalvo} from '../core/uso.js';

const TIPOS = [
  {valor: 'Sugestão', explica: 'uma ideia para o app ficar melhor'},
  {valor: 'Opinião', explica: 'o que achou de usar'},
  {valor: 'Algo não funcionou', explica: 'um erro ou algo estranho'},
];

/** Nome da tela pelo #hash, para a coluna "tela" da planilha. */
const NOME_DA_TELA = {
  '#pessoas': 'Pessoas', '#familias': 'Famílias', '#visitas': 'Visitas', '#visita': 'Registrar visita',
  '#como-funciona': 'Como o app guarda e envia', '#importar': 'Importar pessoas',
};

const estado = {
  tipo: '',
  texto: '', // o rascunho fica enquanto o app está aberto (sem internet, o vicentino envia depois)
  tela: '',
  enviando: false,
};

// A tela de onde o vicentino veio (o #hash anterior).
window.addEventListener('hashchange', (e) => {
  const anterior = new URL(e.oldURL).hash;
  if (!anterior.startsWith('#sugestoes')) {
    const [base, id] = anterior.split('/');
    estado.tela = (NOME_DA_TELA[base] || base.replace('#', '') || 'Pessoas') +
      (id && base !== '#visita' ? (id === 'novo' ? ' (cadastro)' : ' (detalhes)') : '');
  }
});

/**
 * @param {!HTMLElement} area
 * @param {?Object} sessao
 * @return {string} Texto para o modo Ouvir.
 */
export function renderizar(area, sessao) {
  if (!sessao) {
    return pedirConexao(area, 'Sugestões e opiniões');
  }
  definirBarra({titulo: 'Sugestões e opiniões'});
  area.innerHTML = `
    <div class="tela-pessoas tela-detalhe tela-sugestoes">
      <p class="tela-texto">O app está em teste. Conte o que achou, o que pode melhorar ou o que não funcionou: o
        Conselho Central lê todas as mensagens e atende primeiro o que mais aparece.</p>
      <form class="detalhe-form" id="formSugestao" novalidate autocomplete="off">
        <fieldset class="md-card detalhe-secao form-conjunto">
          <legend class="detalhe-titulo">É uma…</legend>
          <div class="opcoes-papel" role="radiogroup" aria-label="Tipo da mensagem">
            ${TIPOS.map((t) => `
            <label class="opcao-papel">
              <input type="radio" name="tipoSugestao" value="${esc(t.valor)}"${estado.tipo === t.valor ? ' checked' : ''}>
              <span>${esc(t.valor)} <span class="detalhe-nota">· ${esc(t.explica)}</span></span>
            </label>`).join('')}
          </div>
        </fieldset>
        <section class="md-card detalhe-secao">
          <h2 class="detalhe-titulo"><label for="textoSugestao">O que você quer contar</label></h2>
          <textarea id="textoSugestao" class="form-input form-textarea" rows="6" maxlength="2000"
            placeholder="Toque aqui e depois em Falar para ditar">${esc(estado.texto)}</textarea>
          <p class="detalhe-nota">🔒 Não escreva nomes nem dados das famílias atendidas: a mensagem vai para o Conselho
            Central, não para a planilha da conferência.</p>
          ${estado.tela ? `<p class="detalhe-nota">Vai junto: você estava na tela ${esc(estado.tela)}.</p>` : ''}
        </section>
        <p class="feedback-msg" id="msgSugestao" role="status"></p>
        <div class="detalhe-acoes">
          <button type="submit" class="btn-submit" id="btnEnviarSugestao">Enviar</button>
        </div>
      </form>
    </div>`;
  const form = area.querySelector('#formSugestao');
  const texto = area.querySelector('#textoSugestao');
  texto.addEventListener('input', () => {
    estado.texto = texto.value;
  });
  form.addEventListener('change', (e) => {
    if (e.target.name === 'tipoSugestao') {
      estado.tipo = e.target.value;
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    enviar(area);
  });
  return 'Sugestões e opiniões. O app está em teste. Escolha se é uma sugestão, uma opinião ou algo que ' +
    'não funcionou, escreva ou dite o que quer contar e toque em Enviar. Não escreva nomes nem dados das famílias ' +
    'atendidas.';
}

/** @param {!HTMLElement} msg @param {string} texto @param {string} tipo */
function mostrar(msg, texto, tipo) {
  msg.textContent = texto;
  msg.className = 'feedback-msg ' + tipo;
}

/** @param {!HTMLElement} area */
async function enviar(area) {
  const msg = area.querySelector('#msgSugestao');
  const botao = area.querySelector('#btnEnviarSugestao');
  const texto = area.querySelector('#textoSugestao').value.trim();
  if (estado.enviando) {
    return;
  }
  if (!estado.tipo) {
    mostrar(msg, 'Escolha se é sugestão, opinião ou algo que não funcionou.', 'erro');
    return;
  }
  if (texto.length < 5) {
    mostrar(msg, 'Escreva um pouco mais, para o Conselho Central entender.', 'erro');
    area.querySelector('#textoSugestao').focus();
    return;
  }
  if (!navigator.onLine) {
    mostrar(msg, 'Sem internet agora. O texto fica aqui: toque em Enviar quando a internet voltar.', 'erro');
    return;
  }
  vibrar();
  estado.enviando = true;
  botao.disabled = true;
  botao.textContent = 'Enviando…';
  try {
    const versao = (document.getElementById('versaoApp') || {}).textContent || '';
    await chamarComSessao('enviar_sugestao', {tipo: estado.tipo, texto, tela: estado.tela,
      versao_app: versao.replace(/^v/, '')});
    formularioSalvo();
    estado.texto = '';
    estado.tipo = '';
    area.querySelector('#textoSugestao').value = '';
    area.querySelectorAll('input[name="tipoSugestao"]').forEach((i) => {
      i.checked = false;
    });
    mostrar(msg, 'Recebido. Obrigado!', 'sucesso');
  } catch (erro) {
    mostrar(msg, erro.message + ' O texto continua aqui.', 'erro');
  } finally {
    estado.enviando = false;
    botao.disabled = false;
    botao.textContent = 'Enviar';
  }
}
