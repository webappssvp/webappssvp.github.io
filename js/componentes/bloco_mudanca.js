/**
 * @fileoverview "Você mudou e ainda não enviou": o bloco que compara a sua mudança (no celular) com o que está na
 * planilha agora, e deixa escolher qual vale (decisão de 17/11/2026, mvp/telas/05_sincronizacao.md).
 * Usado na folhinha do item (js/componentes/folha_item.js) e nos detalhes da pessoa e da família.
 *
 * - Só os campos que você mudou, com nomes que o vicentino entende, lado a lado: "No celular" e "Na planilha agora"
 *   (buscado ao abrir, com internet; os cifrados, só para quem vê contatos).
 * - Se a planilha mudou depois da sua mudança, avisa quem foi, pelo nome de exibição (coluna atualizado_por,
 *   script 0.5.0): "Maria Lima mudou na planilha depois de você". Sem o nome: mudado direto na planilha.
 * - "Enviar a minha" (a fila envia) ou "Ficar com a da planilha" (desfaz a sua no celular, com confirmação, e
 *   baixa a versão da planilha). Cadastro feito no celular: "Enviar" ou "Desfazer o cadastro". Não aceita:
 *   "Tentar de novo" ou "Ficar com a da planilha".
 */

import {iconeSync, textoDoEstado} from './icone_sync.js';
import {chamarComSessao, sessaoAtual} from './barra_conexao.js';
import {avisar} from '../casca.js';
import {vibrar} from '../core/preferencias.js';
import * as sync from '../core/sync.js';
import * as cofre from '../core/cofre.js';
import * as db from '../core/db.js';
import {avisarGuardados, buscarDetalhe, guardar} from '../telas/pessoa_dados.js';
import {NOME_DA_SITUACAO, buscarDetalheFamilia, guardarFamilia} from '../telas/familia_dados.js';

/** Nomes dos campos, como o vicentino os conhece. */
const NOMES_DOS_CAMPOS = {
  nome_exibicao: 'Nome na lista',
  nome: 'Nome completo',
  email: 'E-mail',
  celular: 'Celular',
  data_nascimento: 'Nascimento',
  cpf: 'CPF',
  ativa: 'Ativa',
  motivo_termino: 'Motivo',
  nome_referencia: 'Nome da família',
  id_status_familia: 'Situação',
  data_inicio: 'Desde',
  data_termino: 'Encerrada em',
  ultima_visita: 'Última visita',
};

/** Campos cifrados na planilha (decifrados só para quem vê contatos). */
const CIFRADOS = {pessoas: ['nome', 'email', 'celular', 'data_nascimento', 'cpf'], familias: []};

/** Gravidade do estado (o pior manda). */
const GRAVIDADE = {confirmado: 0, enviando: 1, local: 2, sem_confirmacao: 3, recusado: 4};

/** A versão da planilha, por item, por um minuto (cada redesenho da fila não busca de novo). */
const naPlanilha = new Map();
const VALIDADE_MS = 60 * 1000;

/** @param {*} t @return {string} */
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  '\'': '&#39;'}[c]));

/** @param {string} iso @return {string} "hoje às 14:10" ou "em 12/11 às 08:00". */
function quando(iso) {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
  return (new Date().toDateString() === d.toDateString() ? 'hoje' :
    'em ' + d.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})) + ' às ' + hora;
}

/** @param {string} campo @param {*} valor @return {string} Como mostrar o valor. */
function mostrarValor(campo, valor) {
  if (valor === undefined || valor === null || valor === '') {
    return '—';
  }
  const texto = String(valor);
  if (campo === 'id_status_familia') {
    return NOME_DA_SITUACAO[texto.toUpperCase()] || texto;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(texto) && /data|visita/.test(campo)) {
    return new Date(texto.slice(0, 10) + 'T12:00').toLocaleDateString('pt-BR');
  }
  return texto;
}

/**
 * @param {!Object} item {tipo, id, cf}
 * @return {!Promise<!Array<!Object>>} Os itens da fila deste item, em ordem.
 */
async function daFila(item) {
  return (await sync.itens()).filter((i) => i.conferencia === item.cf && i.id_pessoa === item.id);
}

/**
 * Os campos que as mudanças da fila mudam neste registro (a última vale).
 * @param {!Object} item
 * @param {!Array<!Object>} fila
 * @return {{aba: string, campos: !Object<string, *>, outras: !Array<string>}}
 */
function oQueMudou(item, fila) {
  const aba = item.tipo === 'familia' ? 'familias' : 'pessoas';
  const campos = {};
  const outras = [];
  fila.forEach((i) => {
    let mexeuNoRegistro = false;
    i.operacoes.forEach((op) => {
      if (op.aba === aba && op.id_registro === item.id && op.acao === 'atualizar') {
        Object.assign(campos, op.dados || {});
        mexeuNoRegistro = true;
      }
    });
    if (!mexeuNoRegistro) {
      outras.push(i.descricao || 'Mudança');
    }
  });
  delete campos.relato_acrescimo;
  return {aba, campos, outras};
}

/** @param {!Object} item @return {boolean} Pode ver contatos (decifra os campos protegidos). */
function veContatos(item) {
  const s = sessaoAtual();
  const perfil = (s && s.perfil) || {};
  return (perfil.permissoes || []).includes('CONTATOS_VER') || (item.tipo === 'pessoa' && perfil.id_pessoa === item.id);
}

/**
 * A versão da planilha agora (com internet), com o nome de quem mudou por último.
 * @param {!Object} item
 * @param {string} aba
 * @param {!Array<string>} campos Os campos que interessam.
 * @return {!Promise<?{registro: !Object, quem: string, eu: boolean}>} null sem internet ou se não deu.
 */
async function buscarNaPlanilha(item, aba, campos) {
  const chave = item.cf + '|' + item.id;
  const guardada = naPlanilha.get(chave);
  if (guardada && Date.now() - guardada.em < VALIDADE_MS) {
    return guardada.valor;
  }
  if (!navigator.onLine) {
    return null;
  }
  try {
    const decifrar = veContatos(item) ? campos.filter((c) => CIFRADOS[aba].includes(c)) : [];
    const r = await chamarComSessao('obter', {aba, id_registro: item.id, decifrar});
    const registro = r.registro || {};
    const s = sessaoAtual();
    const eu = Boolean(registro.atualizado_por && s && s.perfil && registro.atualizado_por === s.perfil.id_pessoa);
    let quem = '';
    if (registro.atualizado_por && !eu) {
      const p = await db.ler(db.STORES.PESSOAS, item.cf + '|' + registro.atualizado_por);
      quem = p && p.nome ? p.nome : 'Alguém da conferência';
    }
    const valor = {registro, quem, eu};
    naPlanilha.set(chave, {em: Date.now(), valor});
    return valor;
  } catch (erro) {
    return null;
  }
}

/**
 * Desenha o bloco no lugar. Sem nada na fila deste item, o lugar fica vazio.
 * @param {!HTMLElement} lugar
 * @param {{tipo: string, id: string, nome: string, cf: string}} item tipo: "pessoa" ou "familia".
 * @return {!Promise<boolean>} Se há mudança sua esperando (o bloco apareceu).
 */
export async function montarBlocoMudanca(lugar, item) {
  lugar.dataset.blocoId = item.id;
  const fila = await daFila(item);
  if (!fila.length) {
    lugar.innerHTML = '';
    return false;
  }
  const pior = fila.reduce((p, i) => (GRAVIDADE[i.estado] > GRAVIDADE[p] ? i.estado : p), 'confirmado');
  const recusado = fila.find((i) => i.estado === 'recusado');
  const desde = fila[0].criado_em;
  const provisorio = sync.ehProvisorio(item.id);
  const {aba, campos, outras} = oQueMudou(item, fila);
  const nomes = Object.keys(campos);
  lugar.innerHTML = desenho({item, pior, recusado, desde, provisorio, campos, outras, planilha: undefined});
  ligar(lugar, item);
  if (provisorio || !nomes.length && !outras.length) {
    return true;
  }
  const planilha = await buscarNaPlanilha(item, aba, nomes);
  if (lugar.dataset.blocoId === item.id && document.contains(lugar)) {
    lugar.innerHTML = desenho({item, pior, recusado, desde, provisorio, campos, outras, planilha});
  }
  return true;
}

/**
 * @param {!Object} p
 * @return {string} HTML do bloco.
 */
function desenho(p) {
  const {item, pior, recusado, desde, provisorio, campos, outras, planilha} = p;
  const nomes = Object.keys(campos);
  let comparacao = '';
  if (!provisorio && nomes.length) {
    const reg = planilha ? planilha.registro : null;
    const contatos = veContatos(item);
    const cifrados = CIFRADOS[item.tipo === 'familia' ? 'familias' : 'pessoas'];
    const linhas = nomes.map((c) => {
      const meu = mostrarValor(c, campos[c]);
      const daPlanilha = !reg ? (planilha === undefined ? '…' : '?') :
        cifrados.includes(c) && !contatos ? 'protegido' : mostrarValor(c, reg[c]);
      const igual = reg && meu === daPlanilha;
      return `<tr${igual ? ' class="mudanca-igual"' : ''}><th scope="row">${esc(NOMES_DOS_CAMPOS[c] || c)}</th>
        <td>${esc(meu)}</td><td>${esc(daPlanilha)}${igual ? ' <span class="mudanca-nota">(igual)</span>' : ''}</td></tr>`;
    }).join('');
    comparacao = `
      <table class="mudanca-tabela">
        <thead><tr><th></th><th scope="col">No celular</th><th scope="col">Na planilha agora</th></tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      ${planilha === null ? '<p class="detalhe-nota">Sem internet: dá para comparar com a planilha depois.</p>' : ''}`;
  }
  let aviso = '';
  const reg = planilha && planilha.registro;
  if (reg && reg.atualizado_em && new Date(reg.atualizado_em) > new Date(desde)) {
    const hora = quando(reg.atualizado_em);
    aviso = planilha.eu ? `<p class="mudanca-aviso">A planilha já tem uma mudança sua de ${esc(hora)}.</p>` :
      planilha.quem ? `<p class="mudanca-aviso">⚠ <strong>${esc(planilha.quem)}</strong> mudou na planilha depois de você (${esc(hora)}).</p>` :
        `<p class="mudanca-aviso">⚠ Mudado na planilha depois de você (${esc(hora)}).</p>`;
  }
  const outrasTexto = outras.length ? `<p class="detalhe-nota">${nomes.length ? 'Também' : 'Mudanças'}: ${
    esc(outras.join('; '))}.</p>` : '';
  let botoes;
  if (pior === 'enviando') {
    botoes = '<p class="detalhe-nota">Enviando…</p>';
  } else if (provisorio) {
    botoes = `
      <button type="button" class="btn-submit" data-mudanca="enviar">Enviar</button>
      <button type="button" class="btn-perigo" data-mudanca="planilha">Desfazer o cadastro</button>`;
  } else {
    botoes = `
      <button type="button" class="btn-submit" data-mudanca="${recusado ? 'tentar' : 'enviar'}">${
  recusado ? 'Tentar de novo' : 'Enviar a minha'}</button>
      <button type="button" class="btn-secundario" data-mudanca="planilha">Ficar com a da planilha</button>`;
  }
  return `
    <section class="md-card detalhe-secao bloco-mudanca${recusado ? ' bloco-mudanca-recusado' : ''}">
      <h2 class="detalhe-titulo bloco-mudanca-titulo">${iconeSync(pior, recusado ? recusado.ultimo_erro : '')}<span>${
  provisorio ? 'Cadastro feito no celular, ainda não está na planilha' : 'Você mudou e ainda não enviou'}</span></h2>
      <p class="detalhe-nota">${esc(textoDoEstado(pior))} · ${esc(quando(desde))}</p>
      ${recusado ? `<p class="feedback-msg erro">Não foi aceito: ${esc(recusado.ultimo_erro || 'sem motivo informado.')}</p>` : ''}
      ${comparacao}
      ${aviso}
      ${outrasTexto}
      <div class="detalhe-acoes bloco-mudanca-acoes">${botoes}</div>
    </section>`;
}

/** @param {!HTMLElement} lugar @param {!Object} item */
function ligar(lugar, item) {
  if (lugar.dataset.blocoLigado) {
    lugar.blocoItem = item;
    return;
  }
  lugar.dataset.blocoLigado = 'sim';
  lugar.blocoItem = item;
  lugar.addEventListener('click', async (e) => {
    const botao = e.target.closest('[data-mudanca]');
    if (!botao) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    vibrar();
    const atual = lugar.blocoItem;
    const acao = botao.dataset.mudanca;
    if (acao === 'enviar') {
      if (!navigator.onLine) {
        avisar('Sem internet agora: vai quando o celular se conectar.');
        return;
      }
      await sync.enviar({manual: true});
    } else if (acao === 'tentar') {
      for (const i of (await daFila(atual)).filter((x) => x.estado === 'recusado')) {
        await sync.tentarDeNovo(i.id_operacao);
      }
    } else if (acao === 'planilha') {
      await ficarComADaPlanilha(atual);
    }
  });
}

/**
 * Desfaz as mudanças deste item no celular (com as que dependem delas) e baixa a versão da planilha.
 * @param {!Object} item
 */
async function ficarComADaPlanilha(item) {
  const fila = await daFila(item);
  const juntos = new Set();
  for (const i of fila) {
    (await sync.comDependentes(i.id_operacao)).forEach((d) => juntos.add(d.id_operacao));
  }
  const extras = juntos.size - fila.length;
  const provisorio = sync.ehProvisorio(item.id);
  const texto = (provisorio ? 'Desfazer o cadastro? Ele é apagado do celular e não vai para a planilha.' :
    (fila.length === 1 ? 'Sua mudança será apagada do celular' : `Suas ${fila.length} mudanças serão apagadas do celular`) +
      ' e fica valendo o que está na planilha.') +
    (extras > 0 ? ` Também saem ${extras} mudança(s) que dependem desta.` : '');
  if (!window.confirm(texto)) {
    return;
  }
  for (const i of fila) {
    await sync.descartar(i.id_operacao); // os que dependem saem junto
  }
  naPlanilha.delete(item.cf + '|' + item.id);
  if (provisorio) {
    avisar('Cadastro desfeito.');
    location.hash = item.tipo === 'familia' ? '#familias' : '#pessoas';
    return;
  }
  // A versão da planilha volta para o celular: a lista e, com a senha aberta, os detalhes guardados.
  sync.pedirListas();
  if (navigator.onLine && cofre.aberto(item.cf)) {
    try {
      const chamar = (acao, d) => chamarComSessao(acao, d);
      if (item.tipo === 'familia') {
        await guardarFamilia(item.cf, item.id, await buscarDetalheFamilia(item.id, chamar, veContatos(item)));
      } else {
        await guardar(item.cf, item.id, await buscarDetalhe(item.id, chamar, veContatos(item)));
      }
      avisarGuardados(item.cf, [item.id]);
    } catch (erro) {
      // a lista já vem de novo; os detalhes, na próxima vez que abrir com internet
    }
  }
  avisar(navigator.onLine ? 'Ficou valendo o que está na planilha.' :
    'Sua mudança foi desfeita. Com internet, o app busca o que está na planilha.');
}

// A fila mudou: os blocos abertos se redesenham (enviou, confirmou, recusou).
sync.eventos.addEventListener('mudou', () => {
  document.querySelectorAll('[data-bloco-ligado]').forEach((lugar) => {
    if (lugar.blocoItem) {
      montarBlocoMudanca(lugar, lugar.blocoItem);
    }
  });
});
sync.eventos.addEventListener('confirmado', (e) => {
  naPlanilha.forEach((v, chave) => {
    if (chave.startsWith(e.detail.conferencia + '|')) {
      naPlanilha.delete(chave);
    }
  });
});
