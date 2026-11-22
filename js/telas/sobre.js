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

const TITULO = 'Web App para vicentinos';

const PERGUNTAS = [
  {titulo: 'Por que um webapp?', html: `
    <p>Abre pelo navegador, em qualquer celular ou computador, sem loja de aplicativos. Quando sai uma melhoria, ela
      chega sozinha.</p>`,
  fala: 'Abre pelo navegador, em qualquer celular ou computador, sem loja de aplicativos. Quando sai uma melhoria, ' +
    'ela chega sozinha.'},
  {titulo: 'O que é um PWA?', html: `
    <p>É um site que funciona como aplicativo (<em lang="en">Progressive Web Application</em>): você pode instalar como
      se fosse um aplicativo nativo, mas o app ocupa só cerca de <strong>1 MB</strong>, mais os dados da sua
      conferência.</p>
    <p>Ele ganha um ícone na tela do celular, abre em tela cheia e <strong>funciona sem internet</strong>. O que você
      registrar na visita fica guardado e é enviado quando a conexão voltar.</p>`,
  fala: 'É um site que funciona como aplicativo, em inglês Progressive Web Application. Você pode instalar como se ' +
    'fosse um aplicativo nativo, mas o app ocupa só cerca de um mega, mais os dados da sua conferência. Ele ganha um ' +
    'ícone na tela do celular, abre em tela cheia e funciona sem internet. O que você registrar na visita fica ' +
    'guardado e é enviado quando a conexão voltar.'},
  {titulo: 'Onde os dados ficam gravados?', html: `
    <p>Em dois lugares:</p>
    <ul>
      <li><strong>Na planilha da conferência</strong>, na conta Google do Conselho Central.</li>
      <li><strong>No seu celular</strong>, para usar sem internet. Um desenho ou PIN tranca o app, e ao tocar em Sair
        os dados da conferência saem do aparelho.</li>
    </ul>
    <p>Nome completo, celular, e-mail, endereço e relatos ficam <strong>criptografados</strong>, e no app só quem tem
      permissão na conferência consegue abri-los. O nome de exibição, o bairro e a cidade ficam abertos, para as listas
      funcionarem.</p>`,
  fala: 'Em dois lugares. Na planilha da conferência, na conta Google do Conselho Central. E no seu celular, para usar ' +
    'sem internet. Um desenho ou PIN tranca o app, e ao tocar em Sair os dados da conferência saem do aparelho. Nome ' +
    'completo, celular, e-mail, endereço e relatos ficam criptografados, e no app só quem tem permissão na conferência ' +
    'consegue abri-los. O nome de exibição, o bairro e a cidade ficam abertos, para as listas funcionarem.'},
  {titulo: 'Vou gastar usando?', html: `
    <p>Não há cobrança para usar. O único consumo é o do seu pacote de dados:</p>
    <ul>
      <li><strong>Primeira abertura:</strong> cerca de 250 KB, menos que uma foto de WhatsApp.</li>
      <li><strong>Depois:</strong> o app abre do próprio celular, e só trafegam as mudanças, normalmente poucos KB.</li>
      <li><strong>Quer gastar ainda menos?</strong> Ligue "Sincronizar só em Wi-Fi" nas Configurações.</li>
    </ul>`,
  fala: 'Não há cobrança para usar. O único consumo é o do seu pacote de dados. Na primeira abertura, cerca de 250 ' +
    'quilobytes, menos que uma foto de WhatsApp. Depois, o app abre do próprio celular, e só trafegam as mudanças, ' +
    'normalmente poucos quilobytes. Para gastar ainda menos, ligue Sincronizar só em Wi-Fi nas Configurações.'},
];

const INTRO = 'Um aplicativo para ajudar as conferências no dia a dia: pessoas, famílias e visitas. É um projeto em ' +
  'teste, ainda não é um serviço oficial.';

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
      ${sessao ? '' : `<h1 class="sobre-titulo">${esc(TITULO)}</h1>`}
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
