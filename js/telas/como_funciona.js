/**
 * @fileoverview Tela "Como o app guarda e envia" (#como-funciona), o primeiro item do menu de telas.
 * Decisões: mvp/telas/05_sincronizacao.md (17/11/2026).
 *
 * Explica, em passos curtos e com os mesmos desenhos do app, o caminho de cada mudança: o celular (banco de
 * dados) e a planilha da conferência (nuvem), o "guardar para abrir sem internet", o toque nos ícones, o botão
 * Nuvem e a escolha "Enviar: na hora | quando eu mandar". Abre sozinha uma vez, na primeira entrada numa
 * conferência (e uma vez para quem já usava o app); depois, pelo menu e pelos links "O que são esses ícones?".
 * Uma página só, rolando, com Ouvir: passos de deslizar confundem quem usa pouco o celular.
 */

import {esc} from './comum.js';
import {definirBarra} from '../componentes/barra_tela.js';
import {botaoCompartilhar} from '../componentes/compartilhar.js';
import {iconeCelular, iconeSync} from '../componentes/icone_sync.js';
import {definirPreferencia, prefs, vibrar} from '../core/preferencias.js';
import {lerEmVozAlta, pararLeitura} from '../core/voz.js';
import * as db from '../core/db.js';

/** Config: a tela já abriu sozinha neste celular. */
export const CHAVE_VIU = 'viu_como_funciona';

/** O que o Ouvir lê (o mesmo texto da tela, sem os desenhos). */
const TEXTO_FALADO = [
  'Como o app guarda e envia.',
  'Um. Dois lugares: o seu celular e a planilha da conferência.',
  'Dois. O que você grava fica primeiro no celular. Funciona mesmo sem internet. ' +
    'A nuvem azul, só o contorno com uma seta, quer dizer: falta enviar.',
  'Três. Depois vai para a planilha. Nuvem amarela: enviando ou esperando resposta. ' +
    'Nuvem verde com um sinal de certo: enviado, não precisa fazer nada. ' +
    'Nuvem vermelha com exclamação: não foi aceito, precisa de você.',
  'Quatro. Para abrir sem internet, guarde antes. Guardar é copiar os dados para um banco de dados que fica ' +
    'dentro do navegador deste celular. A cópia vale só neste aparelho: em outro celular, é preciso guardar de novo. ' +
    'Banco de dados verde: guardado, abre na casa da família. ' +
    'Banco de dados riscado: não guardado, sem internet não abre. ' +
    'Antes de sair para as visitas, confira o banco verde. O que fica no celular é trancado com a sua senha.',
  'Cinco. Toque nos ícones de qualquer pessoa ou família. Abre uma janelinha para guardar ou enviar só aquele.',
  'Seis. A Nuvem da barra de baixo mostra quantas mudanças faltam enviar. Feche o app quando ela estiver verde.',
  'Sete. Como você prefere enviar? Na hora: assim que salvar, com internet. ' +
    'Ou quando eu mandar: você junta as mudanças e envia tudo pela Nuvem. O relato de visita vai sempre na hora. ' +
    'Dá para mudar depois nas Configurações, nos três pontinhos no alto da tela.',
  'Oito. O app tranca quando fica parado e pede o seu desenho ou PIN. Se o celular for perdido, ninguém abre a ' +
    'conferência sem ele. Use um desenho diferente do que desbloqueia o celular, com cinco pontos ou mais, e evite ' +
    'as formas que todo mundo usa: L, Z, quadrado e linha reta. No PIN, seis números, sem data de nascimento, ' +
    'sequência ou números repetidos. Na visita, desenhe de costas para quem está por perto. Esqueceu? Entre com o ' +
    'e-mail e a senha e crie outro. Cinco erros seguidos tiram a conferência deste celular.',
].join(' ');

/** @param {string} numero @param {string} titulo @param {string} corpo @return {string} HTML de um passo. */
const passo = (numero, titulo, corpo) => `
  <section class="cf-passo">
    <h2 class="cf-passo-titulo"><span class="cf-numero" aria-hidden="true">${numero}</span>${esc(titulo)}</h2>
    ${corpo}
  </section>`;

/** @param {string} icone HTML @param {string} texto @return {string} Uma linha "ícone: o que quer dizer". */
const legenda = (icone, texto) => `<li class="cf-legenda">${icone}<span>${texto}</span></li>`;

/**
 * @param {!HTMLElement} area
 * @return {string} Texto para o modo Ouvir.
 */
export function renderizar(area) {
  definirBarra({titulo: 'Como o app guarda e envia'});
  db.salvarConfig(CHAVE_VIU, new Date().toISOString()); // abriu: não abre mais sozinha
  const opcao = (valor, titulo, desc) => `
    <label class="cf-opcao">
      <input type="radio" name="cfEnvio" value="${valor}"${prefs.envio === valor ? ' checked' : ''}>
      <span><strong>${esc(titulo)}</strong><br>${esc(desc)}</span>
    </label>`;
  area.innerHTML = `
    <div class="tela-como-funciona">
      <p class="cf-intro">O caminho de tudo o que você grava no app, e o que quer dizer cada ícone.</p>
      <div class="cf-botoes">
        <button type="button" class="btn-secundario cf-ouvir" data-cf="ouvir">🔊 Ouvir</button>
        ${botaoCompartilhar('#como-funciona')}
      </div>

      ${passo('1', 'Dois lugares', `
        <p class="cf-dois-lugares">
          <span class="cf-lugar">${iconeCelular('guardado')}<span>o seu celular</span></span>
          <span class="cf-seta" aria-hidden="true">⇄</span>
          <span class="cf-lugar">${iconeSync('confirmado')}<span>a planilha da conferência</span></span>
        </p>`)}

      ${passo('2', 'O que você grava fica primeiro no celular', `
        <p>Funciona mesmo sem internet.</p>
        <ul class="cf-legendas">${legenda(iconeSync('local'), '<strong>falta enviar</strong>')}</ul>`)}

      ${passo('3', 'Depois vai para a planilha', `
        <ul class="cf-legendas">
          ${legenda(iconeSync('enviando'), 'enviando ou esperando resposta')}
          ${legenda(iconeSync('confirmado'), '<strong>enviado</strong>: não precisa fazer nada')}
          ${legenda(iconeSync('recusado'), '<strong>não foi aceito</strong>: precisa de você')}
        </ul>`)}

      ${passo('4', 'Para abrir sem internet, guarde antes', `
        <p>Guardar é copiar os dados para um banco de dados que fica dentro do navegador deste celular. A cópia vale
          só neste aparelho: em outro celular, é preciso guardar de novo.</p>
        <ul class="cf-legendas">
          ${legenda(iconeCelular('guardado'), '<strong>guardado</strong>: abre na casa da família')}
          ${legenda(iconeCelular(''), '<strong>não guardado</strong>: sem internet, não abre')}
        </ul>
        <p class="cf-dica">Antes de sair para as visitas, confira o banco verde.</p>
        <p class="detalhe-nota">O que fica no celular é trancado com a sua senha.</p>`)}

      ${passo('5', 'Toque nos ícones de qualquer item', `
        <div class="cf-exemplo" aria-hidden="true">
          <span class="avatar-pessoa avatar-vic">AS</span>
          <span class="cf-exemplo-nome">Ana Souza</span>
          <span class="cf-exemplo-icones">${iconeCelular('guardado')}${iconeSync('local')}</span>
          <span class="cartao-pessoa-seta">›</span>
        </div>
        <p>Abre uma janelinha para guardar ou enviar só aquele.</p>`)}

      ${passo('6', 'A Nuvem da barra de baixo', `
        <p>Mostra quantas mudanças faltam enviar. <strong>Feche o app quando ela estiver verde.</strong></p>`)}

      ${passo('7', 'Como você prefere enviar?', `
        <fieldset class="cf-opcoes">
          <legend class="visually-hidden">Enviar as mudanças</legend>
          ${opcao('na_hora', 'Na hora', 'Assim que salvar, com internet.')}
          ${opcao('quando_mandar', 'Quando eu mandar', 'Você junta as mudanças e envia tudo pela Nuvem. ' +
            'O relato de visita vai sempre na hora.')}
        </fieldset>
        <p class="detalhe-nota">Dá para mudar depois nas Configurações (os três pontinhos, no alto da tela).</p>`)}

      ${passo('8', 'O app tranca com o seu desenho', `
        <p>Parado por um tempo, o app pede o seu desenho ou PIN. Se o celular for perdido, ninguém abre a conferência
          sem ele.</p>
        <ul class="cf-dicas">
          <li><strong>Diferente</strong> do desenho que desbloqueia o celular.</li>
          <li><strong>5 pontos ou mais</strong>, sem as formas que todo mundo usa: L, Z, quadrado, linha reta.</li>
          <li>No PIN, <strong>6 números</strong>: sem data de nascimento, sequência (123456) ou repetidos (111111).</li>
          <li>Na visita, desenhe de costas para quem está por perto.</li>
        </ul>
        <p class="detalhe-nota">Esqueceu? Entre com o e-mail e a senha e crie outro. 5 erros seguidos tiram a
          conferência deste celular. O tempo até trancar fica nas Configurações.</p>`)}

      ${passo('9', 'O app está em teste', `
        <p>Junto com o que você envia, o app manda ao Conselho Central como está sendo usado: quais telas, quanto
          tempo leva, onde aparecem avisos e erros. Nunca o que você escreve, nem dados das famílias.</p>
        <p class="detalhe-nota">Para não mandar, desligue "Ajudar a melhorar o app" nas Configurações. Para contar algo,
          use "Sugestões e opiniões" no Menu.</p>`)}

      <a class="btn-submit btn-link cf-entendi" href="#pessoas">Entendi</a>
    </div>`;
  const tela = area.querySelector('.tela-como-funciona');
  tela.addEventListener('click', (e) => {
    if (e.target.closest('[data-cf="ouvir"]')) {
      vibrar();
      lerEmVozAlta(TEXTO_FALADO);
    } else if (e.target.closest('.cf-entendi')) {
      pararLeitura();
    }
  });
  tela.addEventListener('change', (e) => {
    if (e.target.name === 'cfEnvio') {
      vibrar();
      definirPreferencia('envio', e.target.value);
    }
  });
  return TEXTO_FALADO;
}
