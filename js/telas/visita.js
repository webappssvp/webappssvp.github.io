/**
 * @fileoverview Registrar uma visita (#visita/<id_familia>). Etapa 1 de mvp/telas/06_visitas.md (16/11/2026).
 *
 * Antes de bater na porta: a oração (Regulamento, Orações 2.7) e "Ouvir a última visita" (combinados e relato).
 * Deslocamento: o botão grande dos 4 toques ("Estou saindo" → "Cheguei à casa da família" → "Saí da casa da
 * família" → "Cheguei de volta"). Dupla, relato (ditado pelo Falar), "O que combinamos", auxílios, fé (duas
 * perguntas sim/não) e a avaliação OMS (opcional, 5 rostinhos).
 *
 * Tudo fica guardado no celular a cada passo (cifrado no cofre), sem internet: dá para fechar o app no caminho e
 * continuar. "Registrar uma visita que já aconteceu" troca os toques por data e duração.
 * Salvar põe na fila um item só (visita, dupla e auxílios) com ids provisórios, como os cadastros.
 */

import {esc, voltar} from './comum.js';
import {avisar} from '../casca.js';
import {definirBarra} from '../componentes/barra_tela.js';
import {botaoCombinado, botaoRegra} from '../componentes/de_onde_vem.js';
import {CARD_BAIXANDO} from '../componentes/carregando.js';
import {chamarComSessao} from '../componentes/barra_conexao.js';
import * as cofre from '../core/cofre.js';
import * as db from '../core/db.js';
import * as sync from '../core/sync.js';
import {lerEmVozAlta} from '../core/voz.js';
import {vibrar} from '../core/preferencias.js';
import {DOMINIOS_OMS, buscarDetalheFamilia, guardarFamilia, lerFamiliaGuardada} from './familia_dados.js';
import * as completar from './visita_completar.js';

/** Os 4 toques (indicadores_presidentes.md §4.7). */
export const TOQUES = ['Estou saindo', 'Cheguei à casa da família', 'Saí da casa da família', 'Cheguei de volta'];
const TOQUES_CURTOS = ['Saí', 'Cheguei à casa', 'Saí da casa', 'Voltei'];
/** Colunas de visitas_participantes de cada toque. */
const COLUNAS_TOQUES = ['hora_saida_ida', 'hora_chegada_familia', 'hora_saida_familia', 'hora_chegada_volta'];

/** Domínios da OMS como o vicentino entende. */
const NOMES_OMS = {
  fisico: 'Saúde do corpo',
  psicologico: 'Ânimo e emoções',
  independencia: 'Independência no dia a dia',
  relacoes: 'Relações (família, amigos, vizinhos)',
  ambiente: 'Casa e bairro',
  espiritual: 'Fé e esperança',
};
const ROSTOS = [['😣', 'muito mal'], ['🙁', 'mal'], ['😐', 'mais ou menos'], ['🙂', 'bem'], ['😄', 'muito bem']];

/** Esqueceu de tocar: passadas 3 horas do último toque, o app pergunta a hora do próximo. */
const HORAS_PARA_PERGUNTAR = 3;

const estado = {
  cf: '',
  id: '',
  sessao: null,
  d: null, // detalhes da família (com visitas)
  membros: [], // vicentinos e aspirantes [{id, nome}]
  rascunho: null,
  carregando: false,
  erro: '',
  meios: [], // siglas_meios_transporte.json
  auxilios: [], // siglas_auxilios.json
  salvando: false,
};

/** @type {?HTMLElement} */
let areaAtual = null;
let esperaGravar = 0;

/** @param {string} cf @param {string} id @return {string} Chave (store config) da visita em andamento. */
export const chaveRascunho = (cf, id) => 'visita_andamento:' + cf + '|' + id;

/**
 * Há uma visita em andamento (guardada) para esta família?
 * @param {string} cf
 * @param {string} id
 * @return {!Promise<boolean>}
 */
export async function temRascunho(cf, id) {
  return Boolean(await db.lerConfig(chaveRascunho(cf, id)));
}

/** @return {string} Hoje no fuso do celular, "AAAA-MM-DD". */
function hojeLocal() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** @param {?string} iso @return {string} "14:05" */
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}) : '');

/** @param {string} data "AAAA-MM-DD" @return {string} "12/11" */
const diaCurto = (data) => (data ? new Date(data + 'T12:00').toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'}) : '');

/** @return {!Object} Rascunho vazio. */
function rascunhoNovo() {
  return {modo: 'agora', toques: [null, null, null, null], meio: '', parceiros: [], relato: '', relato_voz: false,
    combinados: '', auxilios: [], rezou: '', falou_de_fe: '', oms: {}, data: hojeLocal(), chegada: '', duracao: '',
    criado_em: new Date().toISOString()};
}

/** @return {boolean} */
const podeRegistrar = () => (estado.sessao.perfil.permissoes || []).includes('VISITAS_REGISTRAR');
/** @return {boolean} */
const veRelato = () => (estado.sessao.perfil.permissoes || []).includes('CONTATOS_VER');

/**
 * @param {!HTMLElement} area
 * @param {?Object} sessao
 * @param {string} id
 * @return {function(): string}
 */
export function renderizar(area, sessao, id) {
  areaAtual = area;
  if (!sessao || !id) {
    voltar('#familias');
    return () => '';
  }
  const [idFamilia, idVisita] = id.split('/');
  if (idVisita) {
    estado.id = ''; // a tela de registrar não redesenha por cima
    return completar.renderizar(area, sessao, idFamilia, idVisita);
  }
  Object.assign(estado, {cf: sessao.id_conferencia, id, sessao, d: null, rascunho: null, erro: '', carregando: true,
    salvando: false});
  carregar();
  return textoParaOuvir;
}

/** @param {string} arquivo @return {!Promise<!Array>} */
async function catalogo(arquivo) {
  try {
    return await (await fetch('siglas/' + arquivo)).json();
  } catch (erro) {
    return [];
  }
}

async function carregar() {
  const {cf, id} = estado;
  desenhar();
  const [guardadas, fila, meios, auxilios] = await Promise.all([db.listar(db.STORES.PESSOAS, cf), sync.itens(),
    estado.meios.length ? estado.meios : catalogo('siglas_meios_transporte.json'),
    estado.auxilios.length ? estado.auxilios : catalogo('siglas_auxilios.json')]);
  estado.meios = meios.slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  estado.auxilios = auxilios.slice().sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
  const eu = estado.sessao.perfil.id_pessoa;
  estado.membros = sync.aplicarFila(guardadas, fila, cf)
      .filter((p) => p.id !== eu && (p.papeis || []).some((s) => s === 'VIC' || s === 'ASP'))
      .map((p) => ({id: p.id, nome: p.nome}))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  try {
    const aberto = await cofre.restaurar(cf);
    estado.d = aberto ? await lerFamiliaGuardada(cf, id) : null;
    if (!estado.d) {
      if (!navigator.onLine) {
        throw new Error(aberto ? 'Esta família ainda não foi guardada no celular. Com internet, abra a família uma vez.' :
          'Sem internet: abra a família e digite a sua senha para usar os dados guardados no celular.');
      }
      estado.d = await buscarDetalheFamilia(id, (acao, dados) => chamarComSessao(acao, dados), veRelato());
      guardarFamilia(cf, id, estado.d).catch(() => {});
    }
    estado.rascunho = await lerRascunho() || rascunhoNovo();
    if (!estado.rascunho.meio) {
      estado.rascunho.meio = meioDaUltimaVisita();
    }
  } catch (erro) {
    estado.erro = erro.message;
  } finally {
    estado.carregando = false;
    desenhar();
  }
}

/** @return {!Promise<?Object>} */
async function lerRascunho() {
  const reg = await db.lerConfig(chaveRascunho(estado.cf, estado.id));
  if (!reg || !cofre.aberto(estado.cf)) {
    return null;
  }
  try {
    return {...rascunhoNovo(), ...(await cofre.decifrar(estado.cf, reg))};
  } catch (erro) {
    return null;
  }
}

/** Guarda o rascunho cifrado (sem o cofre aberto, fica só na memória até salvar). */
async function gravarRascunho() {
  clearTimeout(esperaGravar);
  if (!estado.rascunho || !cofre.aberto(estado.cf)) {
    return;
  }
  await db.salvarConfig(chaveRascunho(estado.cf, estado.id), await cofre.cifrar(estado.cf, estado.rascunho));
}

const gravarDepois = () => {
  clearTimeout(esperaGravar);
  esperaGravar = setTimeout(() => gravarRascunho().catch(() => {}), 600);
};

/** @return {?Object} A última visita realizada. */
const ultimaVisita = () => ((estado.d && estado.d.visitas) || []).find((v) => v.situacao === 'REA') || null;

/** @return {string} Meio de transporte que eu usei na última visita a esta família. */
function meioDaUltimaVisita() {
  const v = ultimaVisita();
  const eu = v && v.participantes.find((p) => p.id_pessoa === estado.sessao.perfil.id_pessoa);
  return eu ? eu.meio_transporte : '';
}

/** @param {string} id @return {string} */
const nomeDe = (id) => (id === estado.sessao.perfil.id_pessoa ? estado.sessao.perfil.nome_exibicao :
  ((estado.membros.find((m) => m.id === id) || {}).nome || 'Vicentino'));

/**
 * Texto de "Ouvir a última visita": combinados primeiro, depois o relato (decisão de 16/11/2026).
 * @param {!Object} v
 * @param {function(string): string} nome
 * @return {string}
 */
export function textoDaVisita(v, nome) {
  const quando = new Date(v.data + 'T12:00').toLocaleDateString('pt-BR', {day: 'numeric', month: 'long'});
  const quem = v.participantes.map((p) => nome(p.id_pessoa)).join(' e ');
  return ['Última visita, em ' + quando + (quem ? ', com ' + quem : '') + '.',
    v.combinados ? 'O que combinamos: ' + v.combinados + '.' : 'Nada anotado como combinado.',
    v.relato ? 'Relato: ' + v.relato : ''].filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

function desenhar() {
  const area = areaAtual;
  const [base, idNaRota, outro] = location.hash.split('/');
  if (!area || base !== '#visita' || outro !== undefined || decodeURIComponent(idNaRota || '') !== estado.id) {
    return;
  }
  const nome = estado.d ? estado.d.familia.nome_referencia : 'Família';
  definirBarra({titulo: 'Visita · ' + nome, voltar: '#familias/' + encodeURIComponent(estado.id)});
  let corpo;
  if (estado.carregando) {
    corpo = `<p class="tela-texto">Buscando os dados${CARD_BAIXANDO}</p>`;
  } else if (estado.erro) {
    corpo = `<p class="feedback-msg erro">${esc(estado.erro)}</p>
      <a class="btn-secundario btn-link" href="#familias/${encodeURIComponent(estado.id)}">Voltar para a família</a>`;
  } else if (!podeRegistrar()) {
    corpo = '<p class="tela-texto">Seu papel na conferência não registra visitas.</p>';
  } else {
    corpo = formulario();
  }
  area.innerHTML = `<div class="tela-pessoas tela-detalhe tela-visita">${corpo}</div>`;
  ligarEventos(area);
}

/** @return {string} HTML */
function formulario() {
  const r = estado.rascunho;
  const ultima = ultimaVisita();
  return `
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Antes de bater na porta</h2>
      <div class="visita-antes">
        ${botaoRegra('oracao_visita', 'Oração antes da visita', {titulo: 'Oração antes da visita', classe: 'origem-grande'})}
        ${ultima && veRelato() ? `<button type="button" class="btn-secundario btn-ouvir-visita" data-visita="ouvir">
          🔊 Ouvir a última visita (${esc(diaCurto(ultima.data))})</button>` : `<p class="detalhe-nota">${ultima ?
  'Última visita em ' + esc(diaCurto(ultima.data)) + '.' : 'Primeira visita registrada no app para esta família.'}</p>`}
      </div>
      <p class="origens">${botaoRegra('oracao_antes')}</p>
    </section>
    ${r.modo === 'agora' ? cartaoToques() : cartaoPassada()}
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Dupla</h2>
      <p class="tela-texto">${esc(estado.sessao.perfil.nome_exibicao)} (você) registra. Com quem você foi?</p>
      ${estado.membros.length ? `<div class="visita-chips" role="group" aria-label="Quem foi junto">
        ${estado.membros.map((m) => `<button type="button" class="chip-escolha" data-parceiro="${esc(m.id)}"
          aria-pressed="${r.parceiros.includes(m.id)}">${r.parceiros.includes(m.id) ? '✓ ' : ''}${esc(m.nome)}</button>`).join('')}
      </div>` : '<p class="detalhe-nota">Nenhum outro vicentino ou aspirante na lista desta conferência.</p>'}
      ${r.parceiros.length ? '' : '<p class="detalhe-nota">A Regra pede a visita de preferência em dupla.</p>'}
      <p class="origens">${botaoRegra('visita_semanal')}${botaoCombinado('dupla_registra')}</p>
    </section>
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo"><label for="vis_relato">Relato</label></h2>
      <p class="detalhe-nota">Toque no campo e depois em Falar para ditar. Fica protegido: só os vicentinos da
        conferência leem.</p>
      <textarea id="vis_relato" class="form-input form-textarea" rows="6" maxlength="5000"
        placeholder="Como foi a visita? O que a família contou?">${esc(r.relato)}</textarea>
      <div class="form-grupo"><label class="form-label" for="vis_combinados">O que combinamos</label>
        <input id="vis_combinados" class="form-input" maxlength="500" autocomplete="off" value="${esc(r.combinados)}"
          placeholder="Ex.: levar a lista de vagas na próxima visita">
        <p class="detalhe-nota">Na próxima visita, "Ouvir a última visita" lê isto primeiro.</p></div>
      <p class="origens">${botaoRegra('sigilo')}</p>
    </section>
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Auxílios entregues</h2>
      ${r.auxilios.map((a, i) => linhaAuxilio(a, i)).join('')}
      <button type="button" class="btn-secundario" data-visita="auxilio">+ Adicionar auxílio</button>
    </section>
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Fé</h2>
      ${simNao('rezou', 'Rezamos juntos?', r.rezou)}
      ${simNao('falou_de_fe', 'Falamos de fé?', r.falou_de_fe)}
      <p class="origens">${botaoRegra('visita_espiritual')}</p>
    </section>
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Como a família está <span class="detalhe-nota">(opcional)</span></h2>
      ${DOMINIOS_OMS.map((c) => `
        <fieldset class="form-conjunto visita-oms"><legend class="form-label">${esc(NOMES_OMS[c])}</legend>
          <div class="visita-rostos">${ROSTOS.map(([rosto, texto], i) => `
            <label class="visita-rosto"><input type="radio" name="oms_${c}" value="${i + 1}"${r.oms[c] === i + 1 ? ' checked' : ''}>
              <span aria-hidden="true">${rosto}</span><span class="visualmente-oculto">${esc(texto)}</span></label>`).join('')}
          </div></fieldset>`).join('')}
      ${Object.keys(r.oms).length ? '<button type="button" class="btn-secundario" data-visita="limpar-oms">Limpar a avaliação</button>' :
    '<p class="detalhe-nota">Pode pular: a visita fica "sem avaliação".</p>'}
    </section>
    <p class="feedback-msg" id="msgVisita" role="status"></p>
    <div class="detalhe-acoes visita-salvar">
      <button type="button" class="btn-submit" data-visita="salvar"${estado.salvando ? ' disabled' : ''}>Salvar a visita</button>
      <button type="button" class="btn-secundario" data-visita="descartar">Descartar esta visita</button>
    </div>`;
}

/** @return {string} HTML do cartão dos 4 toques. */
function cartaoToques() {
  const r = estado.rascunho;
  const n = r.toques.filter(Boolean).length;
  const proximo = r.toques.findIndex((t) => !t);
  const ultimo = proximo > 0 ? r.toques[proximo - 1] : null;
  const esqueceu = proximo > 0 && ultimo && Date.now() - new Date(ultimo).getTime() > HORAS_PARA_PERGUNTAR * 3600000;
  return `
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Deslocamento</h2>
      ${esqueceu ? `<div class="visita-esqueceu" role="alert">
        <p class="tela-texto">O último toque foi "${esc(TOQUES[proximo - 1])}", às ${esc(hora(ultimo))}. Esqueceu de
          tocar "${esc(TOQUES[proximo])}"? Que horas foi, mais ou menos?</p>
        <div class="form-grupo"><label class="form-label" for="vis_hora_esquecida">Hora aproximada</label>
          <input id="vis_hora_esquecida" class="form-input" type="time"></div>
        <button type="button" class="btn-secundario" data-visita="hora-esquecida">Guardar esta hora</button>
      </div>` : ''}
      <button type="button" class="btn-toque${n === 4 ? ' completo' : ''}" data-visita="toque"${n === 4 ? ' disabled' : ''}>
        ${n === 4 ? '✓ Deslocamento completo' : esc(TOQUES[proximo])}</button>
      <ol class="visita-horarios">${TOQUES_CURTOS.map((t, i) => `
        <li class="${r.toques[i] ? 'feito' : ''}"><span>${esc(t)}</span> <strong>${r.toques[i] ? esc(hora(r.toques[i])) : '—'}</strong></li>`).join('')}
      </ol>
      ${n ? '<button type="button" class="btn-link-texto" data-visita="desfazer-toque">Desfazer o último toque</button>' : ''}
      <fieldset class="form-conjunto"><legend class="form-label">Vou de</legend>
        <div class="visita-chips">${estado.meios.map((m) => `
          <button type="button" class="chip-escolha" data-meio="${esc(m.sigla)}" aria-pressed="${r.meio === m.sigla}">
            <span aria-hidden="true">${esc(m.icone || '')}</span> ${esc(m.significado)}</button>`).join('')}
        </div></fieldset>
      <button type="button" class="btn-link-texto" data-visita="passada">Registrar uma visita que já aconteceu</button>
    </section>`;
}

/** @return {string} HTML do cartão da visita já feita (sem os toques). */
function cartaoPassada() {
  const r = estado.rascunho;
  return `
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Quando foi</h2>
      <div class="form-grupo"><label class="form-label" for="vis_data">Data da visita</label>
        <input id="vis_data" class="form-input" type="date" max="${hojeLocal()}" value="${esc(r.data)}"></div>
      <div class="form-grupo"><label class="form-label" for="vis_chegada">Hora em que chegou (opcional)</label>
        <input id="vis_chegada" class="form-input" type="time" value="${esc(r.chegada)}"></div>
      <div class="form-grupo"><label class="form-label" for="vis_duracao">Quanto tempo ficou, em minutos (opcional)</label>
        <input id="vis_duracao" class="form-input" type="number" inputmode="numeric" min="1" max="600" value="${esc(r.duracao)}"></div>
      <button type="button" class="btn-link-texto" data-visita="agora">Voltar para os toques (visita de agora)</button>
    </section>`;
}

/** @param {!Object} a @param {number} i @return {string} HTML */
function linhaAuxilio(a, i) {
  return `
    <div class="visita-auxilio">
      <label class="visualmente-oculto" for="vis_aux_tipo_${i}">Auxílio</label>
      <select id="vis_aux_tipo_${i}" class="form-select" data-aux-tipo="${i}">
        ${estado.auxilios.map((s) => `<option value="${esc(s.sigla)}"${s.sigla === a.tipo ? ' selected' : ''}>${
  esc((s.icone ? s.icone + ' ' : '') + s.significado)}</option>`).join('')}
      </select>
      <label class="visualmente-oculto" for="vis_aux_qtd_${i}">Quantidade</label>
      <input id="vis_aux_qtd_${i}" class="form-input visita-qtd" type="number" inputmode="numeric" min="1" max="99"
        value="${esc(a.quantidade)}" data-aux-qtd="${i}">
      <span class="detalhe-nota">${esc(unidadeDe(a.tipo))}</span>
      <button type="button" class="btn-secundario" data-aux-remover="${i}" aria-label="Tirar este auxílio">✕</button>
    </div>`;
}

/** @param {string} sigla @return {string} */
const unidadeDe = (sigla) => ((estado.auxilios.find((s) => s.sigla === sigla) || {}).unidade_padrao || '');

/** @param {string} campo @param {string} pergunta @param {string} valor @return {string} HTML */
function simNao(campo, pergunta, valor) {
  return `
    <fieldset class="form-conjunto visita-simnao"><legend class="form-label">${esc(pergunta)}</legend>
      <div class="visita-chips">
        ${['SIM', 'NÃO'].map((v) => `<button type="button" class="chip-escolha" data-simnao="${campo}" data-valor="${v}"
          aria-pressed="${valor === v}">${valor === v ? '✓ ' : ''}${v === 'SIM' ? 'Sim' : 'Não'}</button>`).join('')}
      </div></fieldset>`;
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

/** Lê os campos de texto para o rascunho (sem redesenhar). @param {!HTMLElement} area */
function lerCampos(area) {
  const r = estado.rascunho;
  const v = (id) => {
    const c = area.querySelector('#' + id);
    return c ? c.value : undefined;
  };
  const relato = area.querySelector('#vis_relato');
  if (relato) {
    r.relato = relato.value;
    r.relato_voz = r.relato_voz || relato.dataset.ditado === 'sim';
  }
  ['combinados', 'data', 'chegada', 'duracao'].forEach((c) => {
    const valor = v('vis_' + c);
    if (valor !== undefined) {
      r[c] = valor;
    }
  });
  r.auxilios.forEach((a, i) => {
    const tipo = v('vis_aux_tipo_' + i);
    const qtd = v('vis_aux_qtd_' + i);
    if (tipo !== undefined) {
      a.tipo = tipo;
    }
    if (qtd !== undefined) {
      a.quantidade = qtd;
    }
  });
  DOMINIOS_OMS.forEach((c) => {
    const marcado = area.querySelector(`input[name="oms_${c}"]:checked`);
    if (marcado) {
      r.oms[c] = Number(marcado.value);
    }
  });
}

/** Lê os campos, guarda e redesenha, sem perder a posição da tela. @param {!HTMLElement} area */
function mudar(area) {
  lerCampos(area);
  gravarDepois();
  const topo = area.scrollTop;
  desenhar();
  area.scrollTop = topo;
}

/** @param {!HTMLElement} area */
function ligarEventos(area) {
  if (!estado.rascunho) {
    return;
  }
  const r = estado.rascunho;
  // No contêiner da tela (refeito a cada desenho): os ouvintes não se acumulam nem pegam outras telas.
  const tela = area.querySelector('.tela-visita');
  tela.addEventListener('input', () => {
    lerCampos(area);
    gravarDepois();
  });
  tela.addEventListener('change', (e) => {
    lerCampos(area);
    gravarDepois();
    if (e.target.matches('[data-aux-tipo]')) {
      mudar(area); // a unidade muda com o tipo
    }
  });
  area.querySelectorAll('[data-parceiro]').forEach((b) => b.addEventListener('click', () => {
    vibrar();
    const id = b.dataset.parceiro;
    r.parceiros = r.parceiros.includes(id) ? r.parceiros.filter((x) => x !== id) : r.parceiros.concat(id);
    mudar(area);
  }));
  area.querySelectorAll('[data-meio]').forEach((b) => b.addEventListener('click', () => {
    vibrar();
    r.meio = r.meio === b.dataset.meio ? '' : b.dataset.meio;
    mudar(area);
  }));
  area.querySelectorAll('[data-simnao]').forEach((b) => b.addEventListener('click', () => {
    vibrar();
    const campo = b.dataset.simnao;
    r[campo] = r[campo] === b.dataset.valor ? '' : b.dataset.valor;
    mudar(area);
  }));
  area.querySelectorAll('[data-aux-remover]').forEach((b) => b.addEventListener('click', () => {
    vibrar();
    lerCampos(area);
    r.auxilios.splice(Number(b.dataset.auxRemover), 1);
    mudar(area);
  }));
  area.querySelectorAll('[data-visita]').forEach((b) => b.addEventListener('click', () => acao(area, b.dataset.visita)));
}

/** @param {!HTMLElement} area @param {string} qual */
async function acao(area, qual) {
  const r = estado.rascunho;
  vibrar();
  lerCampos(area);
  if (qual === 'toque') {
    const i = r.toques.findIndex((t) => !t);
    if (i < 0) {
      return;
    }
    r.toques[i] = new Date().toISOString();
    vibrar(80);
    await gravarRascunho().catch(() => {});
    avisar('✓ ' + TOQUES[i] + ', às ' + hora(r.toques[i]) + '.');
    mudar(area);
    return;
  }
  if (qual === 'desfazer-toque') {
    const i = r.toques.findIndex((t) => !t);
    r.toques[(i < 0 ? 4 : i) - 1] = null;
    mudar(area);
    return;
  }
  if (qual === 'hora-esquecida') {
    const campo = area.querySelector('#vis_hora_esquecida');
    const i = r.toques.findIndex((t) => !t);
    if (!campo.value || i < 1) {
      campo.focus();
      return;
    }
    const [h, m] = campo.value.split(':').map(Number);
    const base = new Date(r.toques[i - 1]);
    const quando = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
    if (quando < base) {
      quando.setDate(quando.getDate() + 1); // passou da meia-noite
    }
    r.toques[i] = quando.toISOString();
    mudar(area);
    return;
  }
  if (qual === 'passada' || qual === 'agora') {
    r.modo = qual;
    mudar(area);
    return;
  }
  if (qual === 'auxilio') {
    r.auxilios.push({tipo: (estado.auxilios[0] || {}).sigla || '', quantidade: 1});
    mudar(area);
    return;
  }
  if (qual === 'limpar-oms') {
    r.oms = {};
    mudar(area);
    return;
  }
  if (qual === 'ouvir') {
    const v = ultimaVisita();
    if (v) {
      lerEmVozAlta(textoDaVisita(v, nomeDe));
    }
    return;
  }
  if (qual === 'descartar') {
    if (!confirm('Descartar esta visita? O que foi preenchido aqui se perde.')) {
      return;
    }
    clearTimeout(esperaGravar);
    await db.apagarConfig(chaveRascunho(estado.cf, estado.id));
    estado.rascunho = null;
    voltar('#familias/' + encodeURIComponent(estado.id));
    return;
  }
  if (qual === 'salvar') {
    salvar(area);
  }
}

// ---------------------------------------------------------------------------
// Salvar
// ---------------------------------------------------------------------------

/**
 * Monta as operações da visita (um item só na fila).
 * @param {!Object} r Rascunho.
 * @param {{id_familia: string, eu: string, tmp: string}} ctx
 * @return {{operacoes: !Array<!Object>, visita: !Object}} Rejeita (lança) com a mensagem do que falta.
 */
export function montarOperacoes(r, ctx) {
  const falta = (texto) => {
    throw new Error(texto);
  };
  if (!String(r.relato || '').trim()) {
    falta('Escreva ou dite o relato da visita.');
  }
  let data;
  let horas = ['', '', '', ''];
  let chegada;
  let duracao;
  const hhmm = (iso) => {
    if (!iso) {
      return '';
    }
    const d = new Date(iso);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };
  if (r.modo === 'agora') {
    if (!r.toques[1] || !r.toques[2]) {
      falta('Toque em "' + (r.toques[1] ? TOQUES[2] : TOQUES[1]) + '", ou use "Registrar uma visita que já aconteceu".');
    }
    const t = r.toques.map((x) => (x ? new Date(x) : null));
    const d = t[1];
    data = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    horas = r.toques.map(hhmm);
    chegada = horas[1];
    duracao = Math.max(1, Math.round((t[2] - t[1]) / 60000));
  } else {
    data = String(r.data || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      falta('Escolha a data da visita.');
    }
    if (data > hojeLocal()) {
      falta('A data da visita não pode ser depois de hoje.');
    }
    chegada = String(r.chegada || '');
    duracao = Number(r.duracao) || '';
    if (duracao !== '' && (duracao < 1 || duracao > 600)) {
      falta('O tempo da visita vai de 1 a 600 minutos.');
    }
  }
  const dados = {id_familia: ctx.id_familia, id_status_visita: 'REA', data_visita: data,
    relato: String(r.relato).trim(), relato_origem: r.relato_voz ? 'VOZ' : 'TECLADO'};
  if (chegada) {
    dados.hora_visita = chegada;
  }
  if (duracao) {
    dados.duracao_minutos = duracao;
  }
  if (String(r.combinados || '').trim()) {
    dados.combinados = String(r.combinados).trim();
  }
  ['rezou', 'falou_de_fe'].forEach((c) => {
    if (r[c]) {
      dados[c] = r[c];
    }
  });
  Object.keys(r.oms || {}).forEach((c) => {
    dados['oms_' + c] = r.oms[c];
  });
  const dupla = [ctx.eu].concat(r.parceiros || []);
  const operacoes = [{acao: 'inserir', aba: 'visitas', temp_uuid: ctx.tmp, dados}];
  dupla.forEach((id) => {
    const p = {id_visita: ctx.tmp, id_pessoa: id};
    // Um registra pelos dois: os horários e o meio do parceiro vêm iguais (decisão de 14/11/2026).
    COLUNAS_TOQUES.forEach((c, i) => {
      if (horas[i]) {
        p[c] = horas[i];
      }
    });
    if (r.modo === 'agora' && r.meio) {
      p.meio_transporte = r.meio;
    }
    operacoes.push({acao: 'inserir', aba: 'visitas_participantes', dados: p});
  });
  const auxilios = (r.auxilios || []).filter((a) => a.tipo);
  auxilios.forEach((a) => {
    const q = Number(a.quantidade) || 1;
    if (q < 1 || q > 99) {
      falta('A quantidade do auxílio vai de 1 a 99.');
    }
    operacoes.push({acao: 'inserir', aba: 'visitas_auxilios', dados: {id_visita: ctx.tmp, id_familia: ctx.id_familia,
      id_tipo_auxilio: a.tipo, quantidade: q, unidade_medida: a.unidade || '', data_entrega: data}});
  });
  const visita = {id: ctx.tmp, data, situacao: 'REA', duracao: Number(duracao) || 0, relato: dados.relato,
    combinados: dados.combinados || '', rezou: r.rezou || '', falou_de_fe: r.falou_de_fe || '', oms: {...(r.oms || {})},
    participantes: dupla.map((id) => ({id_pessoa: id, meio_transporte: r.modo === 'agora' ? r.meio || '' : ''})),
    auxilios: auxilios.map((a) => ({tipo: a.tipo, quantidade: Number(a.quantidade) || 1, unidade: a.unidade || ''}))};
  return {operacoes, visita};
}

/** @param {!HTMLElement} area */
async function salvar(area) {
  const msg = area.querySelector('#msgVisita');
  const r = estado.rascunho;
  r.auxilios.forEach((a) => {
    a.unidade = unidadeDe(a.tipo);
  });
  let montado;
  try {
    montado = montarOperacoes(r, {id_familia: estado.id, eu: estado.sessao.perfil.id_pessoa, tmp: sync.novoProvisorio()});
  } catch (falta) {
    msg.textContent = falta.message;
    msg.className = 'feedback-msg erro';
    msg.scrollIntoView({block: 'center'});
    return;
  }
  estado.salvando = true;
  const nome = estado.d.familia.nome_referencia;
  try {
    await sync.enfileirar({conferencia: estado.cf, url_api: estado.sessao.url_api, tipo: 'visita', id_pessoa: estado.id,
      descricao: 'Visita à ' + nome + ' (' + diaCurto(montado.visita.data) + ')', operacoes: montado.operacoes,
      efeito_familia: {id: estado.id, ultima_visita: montado.visita.data}, efeito_visita: montado.visita});
  } catch (falha) {
    estado.salvando = false;
    msg.textContent = 'Não deu para guardar no celular: ' + falha.message;
    msg.className = 'feedback-msg erro';
    return;
  }
  clearTimeout(esperaGravar);
  await db.apagarConfig(chaveRascunho(estado.cf, estado.id)).catch(() => {});
  const d = {...estado.d, visitas: [montado.visita].concat(estado.d.visitas || [])};
  await guardarFamilia(estado.cf, estado.id, d).catch(() => {});
  estado.rascunho = null;
  avisar('✓ Visita à ' + nome + ' salva.' + (navigator.onLine ? '' :
    ' Guardada no celular: vai para a nuvem quando houver internet.'));
  voltar('#familias/' + encodeURIComponent(estado.id));
}

/** @return {string} */
function textoParaOuvir() {
  if (!estado.rascunho || !estado.d) {
    return 'Visita. Buscando os dados da família.';
  }
  const r = estado.rascunho;
  const i = r.toques.findIndex((t) => !t);
  return 'Visita à ' + estado.d.familia.nome_referencia + '. ' + (r.modo === 'agora' ? (i < 0 ?
    'Deslocamento completo.' : 'Próximo toque: ' + TOQUES[i] + '.') : 'Visita que já aconteceu.');
}
