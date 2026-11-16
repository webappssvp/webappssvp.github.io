/**
 * @fileoverview Visitas (#visitas): primeira versão, antes da agenda (etapa 2 de mvp/telas/06_visitas.md).
 *
 * As famílias atendidas em três grupos: visitas em andamento (guardadas no celular), as que precisam de visita
 * (mais de 7 dias sem visita, ou nenhuma: Art. 26, visita semanal) e as visitadas nos últimos 7 dias. Cada uma
 * abre a família ou vai direto para "Registrar visita" (#visita/<id>).
 */

import {esc, pedirConexao} from './comum.js';
import {definirBarra, barraOcupada} from '../componentes/barra_tela.js';
import {botaoRegra} from '../componentes/de_onde_vem.js';
import {CARD_BAIXANDO} from '../componentes/carregando.js';
import {chamarComSessao} from '../componentes/barra_conexao.js';
import * as db from '../core/db.js';
import * as sync from '../core/sync.js';
import {NOME_DA_SITUACAO, SITUACOES, atualizarLista} from './familia_dados.js';
import {chaveRascunho} from './visita.js';

const estado = {
  conferencia: '',
  familias: null,
  emAndamento: new Set(),
  carregando: false,
  erro: '',
};

/** @type {?HTMLElement} */
let areaAtual = null;
let sessaoAtual = null;

sync.eventos.addEventListener('mudou', () => {
  if (estado.conferencia) {
    lerGuardadas().then(desenhar);
  }
});

/**
 * @param {!HTMLElement} area
 * @param {?Object} sessao
 * @return {function(): string}
 */
export function renderizar(area, sessao) {
  if (!sessao) {
    return pedirConexao(area, 'Visitas');
  }
  areaAtual = area;
  sessaoAtual = sessao;
  if (estado.conferencia !== sessao.id_conferencia) {
    Object.assign(estado, {conferencia: sessao.id_conferencia, familias: null, erro: ''});
  }
  definirBarra({titulo: 'Visitas'});
  area.innerHTML = '<div class="tela-pessoas tela-visitas" id="telaVisitas"></div>';
  desenhar();
  carregar();
  return textoParaOuvir;
}

/** A lista guardada, com a fila por cima (a visita salva no celular já conta). */
async function lerGuardadas() {
  const cf = estado.conferencia;
  const [guardadas, fila] = await Promise.all([db.listar(db.STORES.FAMILIAS, cf), sync.itens()]);
  const porId = Object.fromEntries(guardadas.map((f) => [f.id, f]));
  fila.filter((i) => i.conferencia === cf && i.efeito_familia).forEach((i) => {
    if (porId[i.efeito_familia.id]) {
      porId[i.efeito_familia.id] = {...porId[i.efeito_familia.id], ...i.efeito_familia};
    }
  });
  const ids = Object.keys(porId);
  const andamento = await Promise.all(ids.map((id) => db.lerConfig(chaveRascunho(cf, id))));
  if (estado.conferencia !== cf) {
    return;
  }
  estado.emAndamento = new Set(ids.filter((id, i) => andamento[i]));
  estado.familias = guardadas.length || estado.familias ? Object.values(porId) : null;
}

async function carregar() {
  const cf = estado.conferencia;
  await lerGuardadas();
  desenhar();
  if (!navigator.onLine || estado.carregando) {
    return;
  }
  estado.carregando = true;
  barraOcupada(true);
  try {
    await atualizarLista(cf, (acao, dados) => chamarComSessao(acao, dados), false);
    estado.erro = '';
    await lerGuardadas();
  } catch (erro) {
    estado.erro = erro.message;
  } finally {
    estado.carregando = false;
    barraOcupada(false);
    desenhar();
  }
}

/** @param {string} data "AAAA-MM-DD" @return {number} Dias desde a data (Infinity sem data). */
function diasDesde(data) {
  if (!data) {
    return Infinity;
  }
  const [a, m, d] = data.split('-').map(Number);
  const hoje = new Date();
  return Math.floor((Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()) - Date.UTC(a, m - 1, d)) / 86400000);
}

/** @param {!Object} f @return {boolean} Atendida hoje (assistida, socorrida ou em sindicância). */
function atendida(f) {
  const s = SITUACOES.find((x) => x.sigla === f.situacao);
  return Boolean(s && s.ativa) && !f.encerrada;
}

/** @return {{andamento: !Array, precisam: !Array, visitadas: !Array}} */
function grupos() {
  const lista = (estado.familias || []).filter(atendida)
      .sort((a, b) => diasDesde(b.ultima_visita) - diasDesde(a.ultima_visita) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const andamento = lista.filter((f) => estado.emAndamento.has(f.id));
  const resto = lista.filter((f) => !estado.emAndamento.has(f.id));
  return {andamento, precisam: resto.filter((f) => diasDesde(f.ultima_visita) > 7),
    visitadas: resto.filter((f) => diasDesde(f.ultima_visita) <= 7)};
}

/** @param {!Object} f @return {{texto: string, nivel: string}} */
function ultimaVisita(f) {
  const dias = diasDesde(f.ultima_visita);
  if (dias === Infinity) {
    return {texto: 'Nenhuma visita registrada', nivel: 'atencao'};
  }
  const texto = dias <= 0 ? 'Última visita hoje' : dias === 1 ? 'Última visita ontem' : `Última visita há ${dias} dias`;
  return {texto, nivel: dias > 14 ? 'alerta' : dias > 7 ? 'atencao' : 'ok'};
}

/** @return {boolean} */
const registra = () => Boolean(sessaoAtual && sessaoAtual.perfil &&
  (sessaoAtual.perfil.permissoes || []).includes('VISITAS_REGISTRAR'));

/** @param {!Object} f @param {boolean} andamento @return {string} HTML */
function cartao(f, andamento) {
  const visita = ultimaVisita(f);
  const id = encodeURIComponent(f.id);
  return `
    <li class="visitas-item">
      <a class="cartao-pessoa cartao-familia" href="#familias/${id}">
        <span class="avatar-pessoa avatar-familia avatar-${esc(f.situacao.toLowerCase())}" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg></span>
        <span class="cartao-pessoa-texto">
          <span class="cartao-pessoa-nome">${esc(f.nome)}</span>
          <span class="cartao-pessoa-selos"><span class="selo-situacao selo-${esc(f.situacao.toLowerCase())}">${
  esc(NOME_DA_SITUACAO[f.situacao] || f.situacao)}</span></span>
          <span class="cartao-pessoa-papel">${esc(f.bairro || '')}</span>
          <span class="familia-visita visita-${visita.nivel}">${esc(visita.texto)}</span>
        </span>
        <span class="cartao-pessoa-seta" aria-hidden="true">›</span>
      </a>
      ${registra() ? `<a class="${andamento ? 'btn-submit' : 'btn-secundario'} btn-link visitas-registrar"
        href="#visita/${id}">${andamento ? '▶ Continuar a visita' : 'Registrar visita'}</a>` : ''}
    </li>`;
}

/** @param {string} titulo @param {!Array} lista @param {boolean} andamento @param {string=} nota @return {string} */
function secao(titulo, lista, andamento, nota = '') {
  if (!lista.length) {
    return '';
  }
  return `
    <section class="visitas-grupo">
      <h2 class="detalhe-titulo">${esc(titulo)} (${lista.length})</h2>
      ${nota}
      <ul class="lista-pessoas">${lista.map((f) => cartao(f, andamento)).join('')}</ul>
    </section>`;
}

function desenhar() {
  const tela = areaAtual && areaAtual.querySelector('#telaVisitas');
  if (!tela || location.hash.split('/')[0] !== '#visitas') {
    return;
  }
  if (!estado.familias) {
    tela.innerHTML = `<p class="pessoas-situacao${estado.erro ? ' com-erro' : ''}" role="status">${estado.erro ? esc(estado.erro) :
      estado.carregando || navigator.onLine ? 'Buscando as famílias da conferência' + CARD_BAIXANDO :
        'Sem internet, e a lista de famílias ainda não foi guardada no celular.'}</p>`;
    return;
  }
  const g = grupos();
  const total = g.andamento.length + g.precisam.length + g.visitadas.length;
  tela.innerHTML = `
    ${estado.erro ? `<p class="pessoas-situacao com-erro" role="status">${esc('Lista guardada no celular. ' + estado.erro)}</p>` : ''}
    ${total ? '' : '<p class="tela-texto">Nenhuma família atendida nesta conferência.</p>'}
    ${secao('Visitas em andamento', g.andamento, true)}
    ${secao('Precisam de visita', g.precisam, false,
      `<p class="detalhe-nota">Mais de 7 dias sem visita, ou nenhuma: em amarelo; mais de 14 dias, em vermelho.</p>
      <p class="origens">${botaoRegra('visita_semanal')}</p>`)}
    ${secao('Visitadas nos últimos 7 dias', g.visitadas, false)}
    <p class="detalhe-nota">A agenda (minhas visitas, agendar e designar as duplas na reunião) chega na próxima etapa.</p>`;
}

/** @return {string} */
function textoParaOuvir() {
  if (!estado.familias) {
    return 'Visitas. Buscando as famílias.';
  }
  const g = grupos();
  const partes = ['Visitas.'];
  if (g.andamento.length) {
    partes.push('Em andamento: ' + g.andamento.map((f) => f.nome).join(', ') + '.');
  }
  partes.push(g.precisam.length ? 'Precisam de visita: ' + g.precisam.slice(0, 10).map((f) => f.nome + ', ' +
    ultimaVisita(f).texto.toLowerCase()).join('; ') + '.' : 'Todas as famílias foram visitadas nos últimos 7 dias.');
  return partes.join(' ');
}
