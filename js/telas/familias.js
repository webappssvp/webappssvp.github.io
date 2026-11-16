/**
 * @fileoverview Tela Famílias (#familias e #familias/<id>). Decisões: mvp/telas/03_familias.md (14/11/2026).
 *
 * Lista as famílias da conferência: situação, bairro, moradores e há quantos dias foi a última visita
 * (amarelo acima de 7, vermelho acima de 14: Regra, Art. 26). Abre sem internet: a lista fica no celular
 * (store "familias", sem cifra) e recebe só o que mudou desde a última vez.
 */

import {esc, pedirConexao} from './comum.js';
import {CARD_BAIXANDO} from '../componentes/carregando.js';
import {atualizarOpcoes, barraOcupada, definirBarra} from '../componentes/barra_tela.js';
import {chamarComSessao} from '../componentes/barra_conexao.js';
import {iconeSync} from '../componentes/icone_sync.js';
import * as db from '../core/db.js';
import {vibrar} from '../core/preferencias.js';
import * as sync from '../core/sync.js';
import {NOME_DA_SITUACAO, SITUACOES, atualizarLista, chaveFamiliasAtualizada} from './familia_dados.js';
import {renderizarFamilia} from './familia_detalhe.js';

/**
 * Filtros (decisões de 14/11/2026): Todas (as atendidas hoje) | Assistidas | Socorridas | Promovidas | Encerradas.
 * Promovidas é o mais importante: a conferência existe para aumentar o número delas. Aparece sempre, mesmo com zero.
 * Encerradas: afastadas e transferidas.
 */
const FILTROS = [{id: 'TODAS', plural: 'Todas'}, {id: 'AST', plural: 'Assistidas'}, {id: 'SOC', plural: 'Socorridas'},
  {id: 'PRM', plural: 'Promovidas', sempre: true}, {id: 'ENCERRADAS', plural: 'Encerradas'}];

const estado = {
  conferencia: '',
  lista: null, // {familias: [...], atualizado_em: ISO}
  fila: [],
  carregando: false,
  erro: '',
  filtro: 'TODAS',
  busca: '',
  bairro: '',
};

/** @type {?HTMLElement} */
let areaAtual = null;

/**
 * As famílias com o que está na fila por cima (situação, moradores, endereço), até a nuvem confirmar.
 * @return {!Array<!Object>}
 */
function familiasComFila() {
  if (!estado.lista) {
    return [];
  }
  const porId = Object.fromEntries(estado.lista.familias.map((f) => [f.id, f]));
  estado.fila.filter((i) => i.conferencia === estado.conferencia && i.efeito_familia).forEach((i) => {
    const e = i.efeito_familia;
    if (porId[e.id]) {
      porId[e.id] = {...porId[e.id], ...e};
    }
  });
  return Object.values(porId);
}

sync.eventos.addEventListener('mudou', async () => {
  estado.fila = await sync.itens();
  desenharLista();
});
sync.eventos.addEventListener('confirmado', (e) => {
  if (e.detail.conferencia === estado.conferencia && !estado.carregando) {
    atualizar(false);
  }
});
sync.eventos.addEventListener('baixar', () => {
  if (estado.conferencia && !estado.carregando) {
    atualizar(false);
  }
});

/**
 * @param {!HTMLElement} area
 * @param {?Object} sessao
 * @param {string=} rota O id da família, para abrir o detalhe.
 * @return {string|function(): string} Texto para o modo Ouvir.
 */
export function renderizar(area, sessao, rota = '') {
  if (!sessao) {
    return pedirConexao(area, 'Famílias');
  }
  if (estado.conferencia !== sessao.id_conferencia) {
    Object.assign(estado, {conferencia: sessao.id_conferencia, lista: null, erro: '', filtro: 'TODAS', busca: '',
      bairro: ''});
    abrirConferencia(sessao.id_conferencia);
  }
  if (rota) {
    areaAtual = null;
    const resumo = familiasComFila().find((f) => f.id === rota) || null;
    return renderizarFamilia(area, sessao, rota, {resumo});
  }
  areaAtual = area;
  montar(area);
  return textoParaOuvir;
}

/** @param {string} id */
async function abrirConferencia(id) {
  const [guardadas, quando, fila] = await Promise.all([db.listar(db.STORES.FAMILIAS, id),
    db.lerConfig(chaveFamiliasAtualizada(id)), sync.itens()]);
  if (estado.conferencia !== id) {
    return;
  }
  estado.fila = fila;
  if (guardadas.length && !estado.lista) {
    estado.lista = {familias: guardadas, atualizado_em: quando || ''};
  }
  desenharLista();
  atualizar(false);
}

/** @param {boolean} completo O botão de atualizar baixa tudo; senão, só o que mudou. */
async function atualizar(completo) {
  if (estado.carregando || !navigator.onLine) {
    return;
  }
  const id = estado.conferencia;
  estado.carregando = true;
  estado.erro = '';
  desenharLista();
  try {
    const {familias} = await atualizarLista(id, (acao, dados) => chamarComSessao(acao, dados), completo);
    if (estado.conferencia === id) {
      estado.lista = {familias, atualizado_em: new Date().toISOString()};
    }
  } catch (erro) {
    estado.erro = erro.message;
  } finally {
    estado.carregando = false;
    if (estado.conferencia === id) {
      desenharLista();
    }
  }
}

// ---------------------------------------------------------------------------
// Filtros e ordem
// ---------------------------------------------------------------------------

/** @param {string} texto @return {string} */
const simplificar = (texto) => String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * @param {!Object} f
 * @param {string} filtro TODAS, AST, SOC ou ENCERRADAS.
 * @return {boolean}
 */
function passaNoFiltro(f, filtro) {
  const s = SITUACOES.find((x) => x.sigla === f.situacao) || {};
  const ativa = !f.encerrada && Boolean(s.ativa);
  if (filtro === 'PRM') {
    return f.situacao === 'PRM';
  }
  if (filtro === 'ENCERRADAS') {
    return !ativa && f.situacao !== 'PRM';
  }
  if (filtro === 'TODAS') {
    return ativa;
  }
  // Em sindicância (SIN, dados antigos) aparece entre as socorridas.
  return ativa && (f.situacao === filtro || (filtro === 'SOC' && Boolean(s.comoSocorrida)));
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

/** @return {!Array<!Object>} As famílias visíveis: as mais tempo sem visita primeiro, depois por nome. */
function visiveis() {
  if (!estado.lista) {
    return [];
  }
  const busca = simplificar(estado.busca.trim());
  return familiasComFila()
      .filter((f) => passaNoFiltro(f, estado.filtro))
      .filter((f) => !estado.bairro || f.bairro === estado.bairro)
      .filter((f) => !busca || simplificar(f.nome).includes(busca))
      .sort((a, b) => diasDesde(b.ultima_visita) - diasDesde(a.ultima_visita) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

/** @param {!HTMLElement} area */
function montar(area) {
  area.innerHTML = `
    <div class="tela-pessoas tela-familias">
      <p class="pessoas-situacao" id="situacaoFamilias" role="status"></p>
      <ul class="lista-pessoas" id="listaFamilias"></ul>
    </div>`;
  // Título e Opções (buscar, mostrar, bairro e ações) ficam na barra da tela (decisões de 15/11/2026).
  definirBarra({titulo: 'Famílias', opcoes: opcoesDaBarra()});
  desenharLista();
}

/** @return {!Object} Opções da barra da tela: buscar, mostrar (situação e bairro) e ações. */
function opcoesDaBarra() {
  const todas = familiasComFila();
  const filtros = FILTROS.map((f) => ({valor: f.id, texto: f.plural, n: todas.filter((x) => passaNoFiltro(x, f.id)).length,
    sempre: f.sempre})).filter((f) => f.n || f.sempre || f.valor === estado.filtro || f.valor === 'TODAS');
  const bairros = [...new Set(todas.filter((f) => passaNoFiltro(f, estado.filtro)).map((f) => f.bairro).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const grupos = [{titulo: 'Mostrar', valor: estado.filtro, padrao: 'TODAS', itens: filtros, aoEscolher: (v) => {
    estado.filtro = v;
    desenharLista();
  }}];
  if (bairros.length > 1 || estado.bairro) {
    grupos.push({titulo: 'Bairro', tipo: 'select', valor: estado.bairro, padrao: '',
      itens: [{valor: '', texto: 'Todos os bairros'}].concat(bairros.map((b) => ({valor: b, texto: b}))),
      aoEscolher: (v) => {
        estado.bairro = v;
        desenharLista();
      }});
  }
  return {
    busca: {valor: estado.busca, rotulo: 'Buscar pelo nome', aoMudar: (v) => {
      estado.busca = v;
      desenharLista();
    }},
    filtros: grupos,
    // Baixa tudo (pega também o que foi mudado à mão na planilha).
    acoes: [{texto: 'Atualizar a lista', aoTocar: () => atualizar(true)}],
    resultado: visiveis().length,
    aoLimpar: () => {
      estado.busca = '';
      estado.filtro = 'TODAS';
      estado.bairro = '';
      desenharLista();
    },
  };
}

function desenharLista() {
  const area = areaAtual;
  if (!area || !area.querySelector('#listaFamilias')) {
    return;
  }
  atualizarOpcoes(opcoesDaBarra());

  const lista = visiveis();
  const s = area.querySelector('#situacaoFamilias');
  s.innerHTML = situacao(lista.length);
  s.className = 'pessoas-situacao' + (estado.erro ? ' com-erro' : '');
  barraOcupada(estado.carregando);
  const estados = sync.estadosPorPessoa(estado.fila, estado.conferencia);
  area.querySelector('#listaFamilias').innerHTML = lista.map((f) => cartao(f, estados[f.id] || sync.ESTADOS.CONFIRMADO))
      .join('');
}

/** @param {number} n @return {string} HTML */
function situacao(n) {
  if (!estado.lista) {
    if (estado.erro) {
      return esc(estado.erro);
    }
    return estado.carregando ? 'Buscando as famílias da conferência' + CARD_BAIXANDO :
      (navigator.onLine ? '' : esc('Sem internet, e a lista de famílias ainda não foi guardada no celular.'));
  }
  const vazio = n ? '' : (estado.busca ? 'Nenhuma família com esse nome. ' : 'Nenhuma família aqui. ');
  const contagem = vazio + (n === 1 ? '1 família' : n + ' famílias');
  const d = estado.lista.atualizado_em ? new Date(estado.lista.atualizado_em) : null;
  const quando = d ? (new Date().toDateString() === d.toDateString() ? 'hoje' : d.toLocaleDateString('pt-BR')) +
    ' às ' + d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : '';
  if (estado.erro) {
    return esc(contagem + ' · lista guardada no celular' + (quando ? ', de ' + quando : '') + '. ' + estado.erro);
  }
  return esc(contagem + (quando ? ' · atualizada ' + quando : '')) +
    (estado.carregando ? esc(' · atualizando') + CARD_BAIXANDO : '');
}

/**
 * @param {!Object} f
 * @return {{texto: string, nivel: string}} "Última visita há 9 dias" e o nível (ok, atencao, alerta).
 */
function ultimaVisita(f) {
  const dias = diasDesde(f.ultima_visita);
  if (dias === Infinity) {
    return {texto: 'Nenhuma visita registrada', nivel: 'atencao'};
  }
  const texto = dias <= 0 ? 'Última visita hoje' : dias === 1 ? 'Última visita ontem' : `Última visita há ${dias} dias`;
  return {texto, nivel: dias > 14 ? 'alerta' : dias > 7 ? 'atencao' : 'ok'};
}

/** @param {!Object} f @param {string} situacaoSync @return {string} HTML */
function cartao(f, situacaoSync) {
  const ativa = passaNoFiltro(f, 'TODAS');
  const visita = ultimaVisita(f);
  const partes = [f.bairro, f.moradores === 1 ? '1 morador' : f.moradores + ' moradores'].filter(Boolean).join(' · ');
  return `
    <li><a class="cartao-pessoa cartao-familia${f.situacao === 'PRM' ? ' cartao-promovida' : ''}" href="#familias/${
  encodeURIComponent(f.id)}">
      <span class="avatar-pessoa avatar-familia avatar-${esc(f.situacao.toLowerCase())}" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg></span>
      <span class="cartao-pessoa-texto">
        <span class="cartao-pessoa-nome">${esc(f.nome)}</span>
        <span class="cartao-pessoa-selos"><span class="selo-situacao selo-${esc(f.situacao.toLowerCase())}">${
  esc(NOME_DA_SITUACAO[f.situacao] || f.situacao || 'Sem situação')}</span>${f.ficticio ? '<span class="selo-exemplo">EXEMPLO</span>' : ''}</span>
        <span class="cartao-pessoa-papel">${esc(partes)}</span>
        ${ativa ? `<span class="familia-visita visita-${visita.nivel}">${esc(visita.texto)}</span>` : ''}
        ${f.situacao === 'PRM' ? `<span class="familia-promovida">${esc('Promovida' + (f.encerrada_em ? ' em ' +
    new Date(f.encerrada_em + 'T12:00').toLocaleDateString('pt-BR') : ''))}</span>` : ''}
      </span>
      ${iconeSync(situacaoSync)}
      <span class="cartao-pessoa-seta" aria-hidden="true">›</span>
    </a></li>`;
}

/** @return {string} */
function textoParaOuvir() {
  const lista = visiveis();
  if (!lista.length) {
    return 'Famílias. ' + (estado.lista ? 'Nenhuma família aqui.' : 'Buscando a lista.');
  }
  const nomes = lista.slice(0, 10).map((f) => f.nome + ', ' + (NOME_DA_SITUACAO[f.situacao] || '') +
    (passaNoFiltro(f, 'TODAS') ? ', ' + ultimaVisita(f).texto.toLowerCase() : '')).join('; ');
  return 'Famílias. ' + lista.length + (lista.length === 1 ? ' família' : ' famílias') + '. ' + nomes +
    (lista.length > 10 ? '; e mais ' + (lista.length - 10) + '.' : '.');
}
