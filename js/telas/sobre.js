/**
 * @fileoverview Apresentação do app (#sobre, 22/11/2026), para quem ainda não usa: abre sem login.
 *
 * Abre sozinha na primeira vez neste aparelho (app.js), menos para quem já escolheu uma conferência, já entrou ou chegou
 * por um link compartilhado. Depois, pelo link "O que é este app?" do login e pelo Menu.
 * Não fala em nome da SSVP: é um projeto em teste. Perguntas em <details>: abrem com um toque, sem programa.
 */

import {esc} from './comum.js';
import {definirBarra} from '../componentes/barra_tela.js';
import {vibrar} from '../core/preferencias.js';
import {lerEmVozAlta, pararLeitura} from '../core/voz.js';
import * as db from '../core/db.js';

/** Config: a apresentação já abriu neste aparelho. */
export const CHAVE_VIU = 'viu_apresentacao';

/** O nome do app nesta tela: na barra do alto (sem login) ou na barra da tela (com login). */
export const TITULO = 'WebApp para visitas';

const PERGUNTAS = [
  {titulo: 'Por que um webapp?', html: `
    <p>Porque abre pelo navegador, em qualquer celular ou computador, sem passar por loja de aplicativos. As melhorias
      chegam sozinhas: basta um toque para atualizar.</p>`,
  fala: 'Porque abre pelo navegador, em qualquer celular ou computador, sem passar por loja de aplicativos. As ' +
    'melhorias chegam sozinhas: basta um toque para atualizar.'},
  {titulo: 'O que é um PWA?', html: `
    <p>É um site que funciona como aplicativo (<em lang="en">Progressive Web Application</em>). Você pode instalar como
      se fosse um aplicativo nativo, mas ele ocupa só cerca de <strong>1 MB</strong>, mais os dados da sua
      conferência.</p>
    <p>Na casa da família, <strong>funciona sem internet</strong>: o que você registrar fica guardado no celular e é
      enviado quando a conexão voltar. Antes de sair, guarde as famílias que vai visitar.</p>`,
  fala: 'É um site que funciona como aplicativo, em inglês Progressive Web Application. Você pode instalar como se ' +
    'fosse um aplicativo nativo, mas ele ocupa só cerca de um mega, mais os dados da sua conferência. Na casa da ' +
    'família, funciona sem internet: o que você registrar fica guardado no celular e é enviado quando a conexão ' +
    'voltar. Antes de sair, guarde as famílias que vai visitar.'},
  {titulo: 'Onde os dados ficam gravados?', html: `
    <p>Em dois lugares:</p>
    <ul>
      <li><strong>Na planilha da conferência</strong>, na conta Google do Conselho Central.</li>
      <li><strong>No seu celular</strong>, para a visita funcionar sem internet. Um desenho ou PIN tranca o app e, ao
        tocar em Sair, os dados da conferência saem do aparelho.</li>
    </ul>
    <p>Nome completo, celular, e-mail, endereço e relatos das visitas ficam <strong>criptografados</strong>. No app, só
      quem tem permissão na conferência consegue abri-los. O nome curto, o bairro e a cidade ficam abertos, para as
      listas funcionarem.</p>`,
  fala: 'Em dois lugares. Na planilha da conferência, na conta Google do Conselho Central. E no seu celular, para a ' +
    'visita funcionar sem internet. Um desenho ou PIN tranca o app e, ao tocar em Sair, os dados da conferência saem ' +
    'do aparelho. Nome completo, celular, e-mail, endereço e relatos das visitas ficam criptografados. No app, só quem ' +
    'tem permissão na conferência consegue abri-los. O nome curto, o bairro e a cidade ficam abertos, para as listas ' +
    'funcionarem.'},
  {titulo: 'Vou gastar usando?', html: `
    <p>Não há cobrança para usar. Você gasta apenas um pouco do seu pacote de dados:</p>
    <ul>
      <li><strong>Na primeira abertura:</strong> cerca de 250 KB, menos que uma foto de WhatsApp.</li>
      <li><strong>Nas seguintes:</strong> o app abre do próprio celular e só envia ou recebe o que mudou.</li>
      <li><strong>Para gastar menos:</strong> ligue "Sincronizar só em Wi-Fi" nas Configurações.</li>
    </ul>`,
  fala: 'Não há cobrança para usar. Você gasta apenas um pouco do seu pacote de dados. Na primeira abertura, cerca de ' +
    '250 quilobytes, menos que uma foto de WhatsApp. Nas seguintes, o app abre do próprio celular e só envia ou recebe ' +
    'o que mudou. Para gastar menos, ligue Sincronizar só em Wi-Fi nas Configurações.'},
];

const INTRO = 'Ajuda os vicentinos a preparar, registrar e acompanhar as visitas às famílias, mesmo sem internet. É um ' +
  'projeto em teste, ainda não é um serviço oficial.';

const TEXTO_FALADO = [TITULO + '.', INTRO].concat(PERGUNTAS.map((p) => p.titulo + ' ' + p.fala)).join(' ');

/**
 * @param {!HTMLElement} area
 * @param {?Object} sessao
 * @return {string} Texto para o modo Ouvir.
 */
export function renderizar(area, sessao) {
  definirBarra({titulo: TITULO});
  db.salvarConfig(CHAVE_VIU, new Date().toISOString());
  area.innerHTML = `
    <div class="tela-sobre">
      <p class="sobre-intro">${esc(INTRO)}</p>
      <a class="btn-submit btn-link sobre-entrar" href="#pessoas">${sessao ? 'Ir para o app' : 'Já uso, quero entrar'}</a>
      <button type="button" class="btn-secundario sobre-ouvir" data-sobre="ouvir">🔊 Ouvir</button>
      <div class="sobre-perguntas">
        ${PERGUNTAS.map((p) => `
        <details class="sobre-pergunta">
          <summary>${esc(p.titulo)}</summary>
          <div class="sobre-resposta">${p.html}</div>
        </details>`).join('')}
      </div>
    </div>`;
  area.querySelector('.tela-sobre').addEventListener('click', (e) => {
    if (e.target.closest('[data-sobre="ouvir"]')) {
      vibrar();
      lerEmVozAlta(TEXTO_FALADO);
    } else if (e.target.closest('.sobre-entrar')) {
      pararLeitura();
    }
  });
  return TEXTO_FALADO;
}
