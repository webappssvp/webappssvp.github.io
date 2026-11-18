/**
 * @fileoverview Completar uma visita já salva (#visita/<id_familia>/<id_visita>). Decisões de 16/11/2026
 * (mvp/telas/06_visitas.md): só quem foi à visita; o relato **não muda**, recebe um acréscimo no fim, com a data e
 * quem acrescentou (o servidor junta ao que está na planilha, para dois da dupla não se apagarem); "O que
 * combinamos" pode mudar; auxílios: incluir o esquecido ou tirar o lançado por engano.
 */

import {esc, voltar} from './comum.js';
import {avisar} from '../casca.js';
import {definirBarra} from '../componentes/barra_tela.js';
import {CARD_BAIXANDO} from '../componentes/carregando.js';
import {chamarComSessao} from '../componentes/barra_conexao.js';
import * as cofre from '../core/cofre.js';
import * as db from '../core/db.js';
import * as sync from '../core/sync.js';
import {vibrar} from '../core/preferencias.js';
import {buscarDetalheFamilia, guardarFamilia, lerFamiliaGuardada} from './familia_dados.js';

const estado = {
  cf: '',
  id: '',
  idVisita: '',
  sessao: null,
  d: null,
  visita: null,
  nomes: {},
  auxilios: [], // siglas_auxilios.json
  novos: [], // auxílios a incluir [{tipo, quantidade}]
  tirar: new Set(), // ids dos auxílios a tirar
  carregando: false,
  erro: '',
};

/** @type {?HTMLElement} */
let areaAtual = null;

/** @param {string} data @return {string} "09/11" */
const diaCurto = (data) => new Date(data + 'T12:00').toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'});

/**
 * As visitas da família com as da fila por cima: a versão mais nova de cada uma (por id) vale.
 * @param {!Object} d Detalhes da família.
 * @param {!Array<!Object>} fila sync.itens()
 * @param {string} cf
 * @param {string} idFamilia
 * @return {!Array<!Object>} A mais recente primeiro.
 */
export function visitasComFila(d, fila, cf, idFamilia) {
  const porId = new Map((d.visitas || []).map((v) => [v.id, v]));
  fila.filter((i) => i.conferencia === cf && i.efeito_visita && i.id_pessoa === idFamilia)
      .forEach((i) => porId.set(i.efeito_visita.id, i.efeito_visita));
  return [...porId.values()].filter((v) => v.situacao === 'REA').sort((a, b) => b.data.localeCompare(a.data));
}

/**
 * @param {!HTMLElement} area
 * @param {!Object} sessao
 * @param {string} idFamilia
 * @param {string} idVisita
 * @return {function(): string}
 */
export function renderizar(area, sessao, idFamilia, idVisita) {
  areaAtual = area;
  Object.assign(estado, {cf: sessao.id_conferencia, id: idFamilia, idVisita, sessao, d: null, visita: null, erro: '',
    carregando: true, novos: [], tirar: new Set()});
  carregar();
  return () => (estado.visita ? 'Completar a visita de ' + diaCurto(estado.visita.data) + '.' : 'Completar a visita.');
}

async function carregar() {
  const {cf, id} = estado;
  desenhar();
  try {
    const [pessoas, fila, auxilios] = await Promise.all([db.listar(db.STORES.PESSOAS, cf), sync.itens(),
      estado.auxilios.length ? estado.auxilios : fetch('siglas/siglas_auxilios.json').then((r) => r.json()).catch(() => [])]);
    estado.auxilios = auxilios;
    estado.nomes = Object.fromEntries(pessoas.map((p) => [p.id, p.nome]));
    const aberto = await cofre.restaurar(cf);
    estado.d = aberto ? await lerFamiliaGuardada(cf, id) : null;
    if (!estado.d) {
      if (!navigator.onLine) {
        throw new Error('Sem internet: abra a família e digite a sua senha para usar os dados guardados no celular.');
      }
      estado.d = await buscarDetalheFamilia(id, (acao, dados) => chamarComSessao(acao, dados), true);
    }
    estado.visita = visitasComFila(estado.d, fila, cf, id).find((v) => v.id === estado.idVisita) || null;
    const eu = estado.sessao.perfil.id_pessoa;
    if (!estado.visita) {
      throw new Error('Esta visita não está no celular (o celular guarda as dos últimos 2 meses).');
    }
    if (!estado.visita.participantes.some((p) => p.id_pessoa === eu)) {
      throw new Error('Só quem foi à visita pode completar o que foi registrado.');
    }
  } catch (erro) {
    estado.erro = erro.message;
  } finally {
    estado.carregando = false;
    desenhar();
  }
}

/** @param {string} id @return {string} */
const nomeDe = (id) => (id === estado.sessao.perfil.id_pessoa ? estado.sessao.perfil.nome_exibicao :
  estado.nomes[id] || 'Vicentino');

/** @param {string} sigla @return {!Object} */
const tipoDe = (sigla) => estado.auxilios.find((s) => s.sigla === sigla) || {significado: sigla, unidade_padrao: ''};

function desenhar() {
  const area = areaAtual;
  const partes = location.hash.split('/').map(decodeURIComponent);
  if (!area || partes[0] !== '#visita' || partes[1] !== estado.id || partes[2] !== estado.idVisita) {
    return;
  }
  const voltarPara = '#familias/' + encodeURIComponent(estado.id);
  definirBarra({titulo: 'Completar a visita', voltar: voltarPara, compartilhar: {rota: '#visita/' +
    encodeURIComponent(estado.id) + '/' + encodeURIComponent(estado.idVisita), cf: estado.cf, oQue: 'uma visita'}});
  let corpo;
  if (estado.carregando) {
    corpo = `<p class="tela-texto">Buscando a visita${CARD_BAIXANDO}</p>`;
  } else if (estado.erro) {
    corpo = `<p class="feedback-msg erro">${esc(estado.erro)}</p>
      <a class="btn-secundario btn-link" href="${voltarPara}">Voltar para a família</a>`;
  } else {
    corpo = formulario();
  }
  area.innerHTML = `<div class="tela-pessoas tela-detalhe tela-visita">${corpo}</div>`;
  ligarEventos(area);
}

/** @return {string} HTML */
function formulario() {
  const v = estado.visita;
  const quem = v.participantes.map((p) => nomeDe(p.id_pessoa)).join(' e ');
  return `
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Visita de ${esc(diaCurto(v.data))} à ${esc(estado.d.familia.nome_referencia)}</h2>
      <p class="detalhe-nota">${esc(quem)}</p>
      <p class="tela-texto visita-relato-salvo">${esc(v.relato || '(sem relato)')}</p>
      <p class="detalhe-nota">O relato salvo não muda: o que você escrever abaixo entra no fim, com a data e o seu nome.</p>
    </section>
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo"><label for="vis_acrescimo">O que faltou contar</label></h2>
      <textarea id="vis_acrescimo" class="form-input form-textarea" rows="4" maxlength="2000"
        placeholder="Toque aqui e depois em Falar para ditar"></textarea>
      <div class="form-grupo"><label class="form-label" for="vis_combinados">O que combinamos</label>
        <input id="vis_combinados" class="form-input" maxlength="500" autocomplete="off" value="${esc(v.combinados)}"></div>
    </section>
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Auxílios entregues</h2>
      ${v.auxilios.length ? `<ul class="visita-lista">${v.auxilios.map((a, i) => {
    const saindo = a.id && estado.tirar.has(a.id);
    return `<li class="visita-auxilio-salvo${saindo ? ' saindo' : ''}">
          <span>${esc((tipoDe(a.tipo).icone || '') + ' ' + tipoDe(a.tipo).significado)} · ${esc(a.quantidade)} ${
  esc(a.unidade || tipoDe(a.tipo).unidade_padrao || '')}${saindo ? ' <strong>(vai sair)</strong>' : ''}</span>
          ${a.id ? `<button type="button" class="btn-secundario" data-tirar="${esc(a.id)}">${saindo ? 'Desfazer' : 'Tirar'}</button>` :
    '<span class="detalhe-nota">ainda no celular</span>'}
        </li>`;
  }).join('')}</ul>` : '<p class="detalhe-nota">Nenhum auxílio registrado nesta visita.</p>'}
      ${estado.novos.map((a, i) => `
        <div class="visita-auxilio">
          <label class="visualmente-oculto" for="vis_aux_tipo_${i}">Auxílio</label>
          <select id="vis_aux_tipo_${i}" class="form-select" data-aux-tipo="${i}">
            ${estado.auxilios.map((s) => `<option value="${esc(s.sigla)}"${s.sigla === a.tipo ? ' selected' : ''}>${
  esc((s.icone ? s.icone + ' ' : '') + s.significado)}</option>`).join('')}
          </select>
          <label class="visualmente-oculto" for="vis_aux_qtd_${i}">Quantidade</label>
          <input id="vis_aux_qtd_${i}" class="form-input visita-qtd" type="number" inputmode="numeric" min="1" max="99"
            value="${esc(a.quantidade)}" data-aux-qtd="${i}">
          <span class="detalhe-nota">${esc(tipoDe(a.tipo).unidade_padrao || '')}</span>
          <button type="button" class="btn-secundario" data-aux-remover="${i}" aria-label="Tirar este auxílio">✕</button>
        </div>`).join('')}
      <button type="button" class="btn-secundario" data-completar="auxilio">+ Incluir um auxílio esquecido</button>
    </section>
    <p class="feedback-msg" id="msgCompletar" role="status"></p>
    <div class="detalhe-acoes visita-salvar">
      <button type="button" class="btn-submit" data-completar="salvar">Salvar</button>
      <a class="btn-secundario btn-link" href="#familias/${encodeURIComponent(estado.id)}">Cancelar</a>
    </div>`;
}

/** @param {!HTMLElement} area */
function lerNovos(area) {
  estado.novos.forEach((a, i) => {
    const tipo = area.querySelector('#vis_aux_tipo_' + i);
    const qtd = area.querySelector('#vis_aux_qtd_' + i);
    if (tipo) {
      a.tipo = tipo.value;
    }
    if (qtd) {
      a.quantidade = qtd.value;
    }
  });
}

/** Redesenha guardando o que foi escrito. @param {!HTMLElement} area */
function redesenhar(area) {
  const acrescimo = area.querySelector('#vis_acrescimo').value;
  const combinados = area.querySelector('#vis_combinados').value;
  const ditado = area.querySelector('#vis_acrescimo').dataset.ditado;
  lerNovos(area);
  const topo = area.scrollTop;
  desenhar();
  area.querySelector('#vis_acrescimo').value = acrescimo;
  if (ditado) {
    area.querySelector('#vis_acrescimo').dataset.ditado = ditado;
  }
  area.querySelector('#vis_combinados').value = combinados;
  area.scrollTop = topo;
}

/** @param {!HTMLElement} area */
function ligarEventos(area) {
  if (!estado.visita || estado.erro) {
    return;
  }
  const tela = area.querySelector('.tela-visita');
  tela.addEventListener('change', (e) => {
    if (e.target.matches('[data-aux-tipo]')) {
      redesenhar(area);
    }
  });
  area.querySelectorAll('[data-tirar]').forEach((b) => b.addEventListener('click', () => {
    vibrar();
    const id = b.dataset.tirar;
    if (estado.tirar.has(id)) {
      estado.tirar.delete(id);
    } else {
      estado.tirar.add(id);
    }
    redesenhar(area);
  }));
  area.querySelectorAll('[data-aux-remover]').forEach((b) => b.addEventListener('click', () => {
    vibrar();
    lerNovos(area);
    estado.novos.splice(Number(b.dataset.auxRemover), 1);
    redesenhar(area);
  }));
  area.querySelector('[data-completar="auxilio"]').addEventListener('click', () => {
    vibrar();
    lerNovos(area);
    estado.novos.push({tipo: (estado.auxilios[0] || {}).sigla || '', quantidade: 1});
    redesenhar(area);
  });
  area.querySelector('[data-completar="salvar"]').addEventListener('click', () => salvar(area));
}

/**
 * As operações do complemento.
 * @param {!Object} v A visita como está.
 * @param {{acrescimo: string, combinados: string, novos: !Array, tirar: !Array<string>, nome: string, hoje: string,
 *     id_familia: string, unidade: function(string): string}} m
 * @return {{operacoes: !Array<!Object>, visita: !Object}} Lança com a mensagem se não há o que salvar.
 */
export function montarComplemento(v, m) {
  const acrescimo = String(m.acrescimo || '').trim();
  const combinados = String(m.combinados || '').trim();
  const mudouCombinado = combinados !== String(v.combinados || '').trim();
  const novos = m.novos.filter((a) => a.tipo);
  novos.forEach((a) => {
    const q = Number(a.quantidade) || 0;
    if (q < 1 || q > 99) {
      throw new Error('A quantidade do auxílio vai de 1 a 99.');
    }
  });
  if (!acrescimo && !mudouCombinado && !novos.length && !m.tirar.length) {
    throw new Error('Escreva o que faltou contar, mude o combinado ou acerte os auxílios.');
  }
  const [a, mes, d] = m.hoje.split('-');
  const marca = 'Acrescentado em ' + d + '/' + mes + (a !== v.data.slice(0, 4) ? '/' + a : '') + ' por ' + m.nome + ': ';
  const operacoes = [];
  const dados = {};
  if (acrescimo) {
    dados.relato_acrescimo = marca + acrescimo;
  }
  if (mudouCombinado) {
    dados.combinados = combinados;
  }
  if (Object.keys(dados).length) {
    operacoes.push({acao: 'atualizar', aba: 'visitas', id_registro: v.id, dados});
  }
  novos.forEach((x) => operacoes.push({acao: 'inserir', aba: 'visitas_auxilios', dados: {id_visita: v.id,
    id_familia: m.id_familia, id_tipo_auxilio: x.tipo, quantidade: Number(x.quantidade), unidade_medida: m.unidade(x.tipo),
    data_entrega: v.data}}));
  m.tirar.forEach((id) => operacoes.push({acao: 'desativar', aba: 'visitas_auxilios', id_registro: id,
    motivo: 'Lançado por engano'}));
  const visita = {...v, relato: acrescimo ? (v.relato ? v.relato + '\n\n' : '') + marca + acrescimo : v.relato,
    combinados: mudouCombinado ? combinados : v.combinados,
    auxilios: v.auxilios.filter((x) => !x.id || !m.tirar.includes(x.id)).concat(novos.map((x) => ({tipo: x.tipo,
      quantidade: Number(x.quantidade), unidade: m.unidade(x.tipo)})))};
  return {operacoes, visita};
}

/** @param {!HTMLElement} area */
async function salvar(area) {
  const msg = area.querySelector('#msgCompletar');
  lerNovos(area);
  const hoje = new Date();
  let montado;
  try {
    montado = montarComplemento(estado.visita, {acrescimo: area.querySelector('#vis_acrescimo').value,
      combinados: area.querySelector('#vis_combinados').value, novos: estado.novos, tirar: [...estado.tirar],
      nome: estado.sessao.perfil.nome_exibicao, id_familia: estado.id,
      hoje: hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0'),
      unidade: (s) => tipoDe(s).unidade_padrao || ''});
  } catch (falta) {
    msg.textContent = falta.message;
    msg.className = 'feedback-msg erro';
    msg.scrollIntoView({block: 'center'});
    return;
  }
  const nome = estado.d.familia.nome_referencia;
  try {
    await sync.enfileirar({conferencia: estado.cf, url_api: estado.sessao.url_api, tipo: 'visita', id_pessoa: estado.id,
      descricao: 'Complemento da visita de ' + diaCurto(estado.visita.data) + ' à ' + nome, operacoes: montado.operacoes,
      efeito_visita: montado.visita});
  } catch (falha) {
    msg.textContent = 'Não deu para guardar no celular: ' + falha.message;
    msg.className = 'feedback-msg erro';
    return;
  }
  if (estado.d.visitas && estado.d.visitas.some((x) => x.id === montado.visita.id)) {
    const d = {...estado.d, visitas: estado.d.visitas.map((x) => (x.id === montado.visita.id ? montado.visita : x))};
    await guardarFamilia(estado.cf, estado.id, d).catch(() => {});
  }
  avisar('✓ Visita completada.' + (navigator.onLine ? '' : ' Guardado no celular: vai para a nuvem quando houver internet.'));
  voltar('#familias/' + encodeURIComponent(estado.id));
}
