/**
 * @fileoverview Detalhe de uma família (#familias/<id>). Decisões: mvp/telas/03_familias.md (14/11/2026).
 *
 * Situação, endereço (decifrado para quem tem CONTATOS_VER, com "Abrir no mapa"), moradores com o vínculo
 * e a última visita. Como em Pessoas: com o cofre aberto, abre da cópia guardada e confere as mudanças em
 * segundo plano; sem internet e com o cofre fechado, pede a senha.
 * Ações (endereço, moradores, situação, promover, encerrar): js/telas/familia_acoes.js.
 */

import {campoSenha, esc, voltar} from './comum.js';
import {definirBarra} from '../componentes/barra_tela.js';
import {CARD_BAIXANDO, mostrarCarregando} from '../componentes/carregando.js';
import {chamarComSessao} from '../componentes/barra_conexao.js';
import * as cofre from '../core/cofre.js';
import * as db from '../core/db.js';
import {botaoRegra} from '../componentes/de_onde_vem.js';
import {NOME_DA_SITUACAO, buscarDetalheFamilia, dia, guardarFamilia, lerFamiliaGuardada} from './familia_dados.js';
import {atualizarGuardados, desbloquear, eventosDados, haGuardados} from './pessoa_dados.js';
import * as acoes from './familia_acoes.js';
import * as sync from '../core/sync.js';
import {vibrar} from '../core/preferencias.js';
import {lerEmVozAlta} from '../core/voz.js';
import {temRascunho, textoDaVisita} from './visita.js';
import {visitasComFila as visitasComFilaDe} from './visita_completar.js';
import {montarBlocoMudanca} from '../componentes/bloco_mudanca.js';
import {enderecoComMapa} from '../componentes/mapa.js';

const estado = {
  id: '',
  resumo: null, // a família como está na lista
  dados: null, // {familia, moradores, endereco}
  nomes: {}, // id_pessoa → nome de exibição (da lista de pessoas guardada)
  carregando: false,
  erro: '',
  bloqueado: false,
  doCelular: false,
  modo: 'ver', // ver, endereco, morador, retirar, situacao, promover, encerrar
  alvo: null, // morador a retirar
  pessoas: [], // lista de pessoas (com a fila por cima), para adicionar morador
  emAndamento: false, // há uma visita em andamento guardada no celular
  fila: [], // itens da fila (as visitas salvas que ainda não chegaram à nuvem aparecem no cartão)
};

/** @type {?HTMLElement} */
let areaAtual = null;
/** @type {?Object} */
let sessaoAtual = null;
let ultimaConferencia = 0;

/** Nomes dos vínculos (siglas_vinculos.json), carregados uma vez. @type {?Object<string, string>} */
let vinculos = null;

/** @return {!Promise<!Object<string, string>>} */
async function nomesDosVinculos() {
  if (!vinculos) {
    try {
      const lista = await (await fetch('siglas/siglas_vinculos.json')).json();
      vinculos = Object.fromEntries(lista.map((v) => [v.sigla, v.significado]));
    } catch (erro) {
      vinculos = {};
    }
  }
  return vinculos;
}

eventosDados.addEventListener('guardados', async (e) => {
  const {conferencia, ids} = e.detail;
  if (!estado.id || !sessaoAtual || conferencia !== sessaoAtual.id_conferencia ||
      !(ids.includes('*') || ids.includes(estado.id)) || !estado.dados || estado.modo !== 'ver') {
    return;
  }
  const novo = await lerFamiliaGuardada(conferencia, estado.id);
  if (novo) {
    estado.dados = novo;
    desenhar();
  }
});

/** @return {boolean} */
const veContatos = () => Boolean(sessaoAtual && sessaoAtual.perfil &&
  (sessaoAtual.perfil.permissoes || []).includes('CONTATOS_VER'));

/**
 * @param {!HTMLElement} area
 * @param {!Object} sessao
 * @param {string} id
 * @param {{resumo: ?Object}} opcoes
 * @return {function(): string}
 */
export function renderizarFamilia(area, sessao, id, opcoes) {
  areaAtual = area;
  sessaoAtual = sessao;
  Object.assign(estado, {id, resumo: opcoes.resumo, dados: null, erro: '', bloqueado: false, doCelular: false, modo: 'ver',
    alvo: null});
  carregar();
  return textoParaOuvir;
}

async function carregar() {
  const id = estado.id;
  const cf = sessaoAtual.id_conferencia;
  estado.carregando = true;
  desenhar();
  const [guardadas, fila] = await Promise.all([db.listar(db.STORES.PESSOAS, cf), sync.itens(), nomesDosVinculos()]);
  estado.pessoas = sync.aplicarFila(guardadas, fila, cf);
  estado.nomes = Object.fromEntries(estado.pessoas.map((p) => [p.id, p.nome]));
  estado.emAndamento = await temRascunho(cf, id);
  estado.fila = fila;
  const guardado = (await cofre.restaurar(cf)) ? await lerFamiliaGuardada(cf, id) : null;
  try {
    if (guardado) {
      estado.dados = guardado;
      estado.doCelular = !navigator.onLine;
      if (navigator.onLine && Date.now() - ultimaConferencia > 60 * 1000) {
        ultimaConferencia = Date.now();
        atualizarGuardados(false); // se esta família mudou, o evento "guardados" redesenha
      }
      return;
    }
    if (!navigator.onLine) {
      if (!(await haGuardados(cf))) {
        estado.erro = 'Sem internet, e os dados desta conferência ainda não foram guardados no celular.';
      } else if (!cofre.aberto(cf)) {
        estado.bloqueado = true;
      } else {
        estado.erro = 'A senha está certa, mas esta família ainda não foi guardada no celular. Com internet, abra o app ' +
          'uma vez (ou toque em ↻ na lista de pessoas) para guardar as famílias; depois ela abre sem internet.';
      }
      return;
    }
    const dados = await buscarDetalheFamilia(id, (acao, d) => chamarComSessao(acao, d), veContatos());
    if (estado.id === id) {
      estado.dados = dados;
    }
    guardarFamilia(cf, id, dados);
  } catch (erro) {
    if (estado.id === id) {
      estado.erro = erro.message;
    }
  } finally {
    if (estado.id === id) {
      estado.carregando = false;
      desenhar();
    }
  }
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

/** @param {?Object} e @return {string} Endereço numa linha. */
function textoEndereco(e) {
  if (!e) {
    return '';
  }
  const rua = [e.logradouro, e.numero].filter(Boolean).join(', ');
  const cidade = [e.cidade, e.estado_uf].filter(Boolean).join('/');
  return [rua, e.complemento, e.bairro, cidade].filter(Boolean).join(' · ');
}

function desenhar() {
  const area = areaAtual;
  const [base, idNaRota] = location.hash.split('/');
  if (!area || base !== '#familias' || decodeURIComponent(idNaRota || '') !== estado.id) {
    return;
  }
  const d = estado.dados;
  const nome = d ? d.familia.nome_referencia : (estado.resumo ? estado.resumo.nome : 'Família');
  let corpo;
  if (estado.bloqueado) {
    corpo = formularioDesbloqueio();
  } else if (!d) {
    corpo = estado.erro ? `<p class="feedback-msg erro">${esc(estado.erro)}</p>
      <button type="button" class="btn-submit" data-acao-familia="recarregar">Tentar de novo</button>` :
      `<p class="tela-texto">Buscando os dados${CARD_BAIXANDO}</p>`;
  } else if (estado.modo !== 'ver') {
    corpo = acoes.formulario(estado.modo, contexto(), estado.alvo);
  } else {
    corpo = visualizacao(d);
  }
  definirBarra({titulo: nome, voltar: '#familias'});
  area.innerHTML = `
    <div class="tela-pessoas tela-detalhe">
      ${corpo}
    </div>`;
  ligarEventos(area);
  const lugar = area.querySelector('[data-bloco-mudanca]');
  if (lugar && sessaoAtual) {
    montarBlocoMudanca(lugar, {tipo: 'familia', id: estado.id, nome, cf: sessaoAtual.id_conferencia});
  }
}

/** @param {!Object} d @return {string} HTML */
function visualizacao(d) {
  const f = d.familia;
  const sigla = String(f.id_status_familia || '').toUpperCase();
  const desde = dia(f.data_inicio) ? ' desde ' + new Date(dia(f.data_inicio) + 'T12:00').toLocaleDateString('pt-BR') : '';
  const encerrada = dia(f.data_termino) ? `<p class="tela-texto">Encerrada em ${esc(new Date(dia(f.data_termino) +
    'T12:00').toLocaleDateString('pt-BR'))}${f.motivo_termino ? ': ' + esc(f.motivo_termino) : ''}.</p>` : '';
  const endereco = veContatos() ? (d.endereco ? `
      ${enderecoComMapa(esc(textoEndereco(d.endereco)), d.endereco)}
      ${d.endereco && d.endereco.endereco_conferido === 'NÃO' ? '<p class="endereco-nota endereco-conferir">Endereço a conferir nos Correios: abra Editar e escolha a rua na lista.</p>' : ''}` : '<p class="tela-texto"><span class="detalhe-vazio">não informado</span></p>') :
    `<p class="tela-texto">${esc([d.endereco && d.endereco.bairro, d.endereco && d.endereco.cidade].filter(Boolean)
        .join(' · ') || 'Bairro não informado')}</p>
      <p class="detalhe-nota">O endereço completo é protegido pela LGPD: só os vicentinos da conferência o veem.</p>`;
  const moradores = d.moradores.slice().sort((a, b) => (a.id_vinculo === 'TIT' ? -1 : 0) - (b.id_vinculo === 'TIT' ? -1 : 0));
  const visita = estado.resumo && estado.resumo.ultima_visita ? new Date(estado.resumo.ultima_visita + 'T12:00')
      .toLocaleDateString('pt-BR') : '';
  // Com mudança sua esperando: "Você mudou e ainda não enviou" (js/componentes/bloco_mudanca.js), desenhado depois.
  const cf = sessaoAtual ? sessaoAtual.id_conferencia : '';
  const mudanca = (estado.fila || []).some((i) => i.conferencia === cf && i.id_pessoa === estado.id) ?
    '<div data-bloco-mudanca></div>' : '';
  return `
    ${mudanca}
    <p class="detalhe-papeis"><span class="selo-situacao selo-${esc(sigla.toLowerCase())}">${
  esc(NOME_DA_SITUACAO[sigla] || sigla || 'Sem situação')}</span>${esc(desde)}</p>
    ${sigla === 'SIN' ? `<p class="origens">${botaoRegra('sindicancia', 'Sindicância: o que diz a Regra')}</p>` : ''}
    ${encerrada}
    ${estado.doCelular ? `<p class="detalhe-nota detalhe-guardado" role="status">Sem internet: dados guardados no
      celular.</p>` : ''}
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Endereço</h2>
      ${endereco}
    </section>
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Moradores (${moradores.length})</h2>
      ${moradores.length ? `<ul class="lista-moradores">${moradores.map((m) => `
        <li class="morador-linha"><a class="morador" href="#pessoas/${encodeURIComponent(m.id_pessoa)}">
          <span class="morador-nome">${esc(estado.nomes[m.id_pessoa] || m.nome || 'Pessoa ' + m.id_pessoa)}</span>
          <span class="morador-vinculo">${esc((vinculos && vinculos[m.id_vinculo]) || m.id_vinculo || 'Vínculo não informado')}${
  m.detalhes_vinculo ? ' · ' + esc(m.detalhes_vinculo) : ''}</span>
        </a>${acoes.podeRetirar(contexto()) ? `<button type="button" class="btn-secundario btn-retirar" data-acao-familia="retirar"
          data-morador="${esc(m.id_pessoa_familia)}" aria-label="Retirar ${esc(estado.nomes[m.id_pessoa] || m.nome || '')} da família">Retirar</button>` : ''}</li>`).join('')}</ul>` : '<p class="tela-texto">Nenhum morador ligado a esta família.</p>'}
      ${acoes.podeRetirar(contexto()) ? `<button type="button" class="btn-secundario btn-adicionar-morador"
        data-acao-familia="morador">+ Adicionar morador</button>` : ''}
    </section>
    ${cartaoVisitas(d, visita)}
    ${acoes.botoes(contexto())}`;
}

/**
 * As visitas realizadas da família, com as salvas neste celular que ainda estão na fila por cima (até a nuvem
 * confirmar). A mais recente primeiro.
 * @param {!Object} d
 * @return {!Array<!Object>}
 */
function visitasComFila(d) {
  // O complemento de uma visita também vai na fila: a versão mais nova (por id) vale.
  return visitasComFilaDe(d, estado.fila, sessaoAtual.id_conferencia, estado.id);
}

/** Últimas visitas no cartão (o celular guarda as de 2 meses). */
const VISITAS_NO_CARTAO = 5;

/**
 * Cartão Visitas: "Registrar visita" (ou continuar a que está em andamento), "Ouvir a última visita" e as últimas.
 * @param {!Object} d
 * @param {string} ultimaDaLista Data da última visita pela lista de famílias ("" se nenhuma).
 * @return {string} HTML
 */
function cartaoVisitas(d, ultimaDaLista) {
  const permissoes = (sessaoAtual.perfil && sessaoAtual.perfil.permissoes) || [];
  const registra = permissoes.includes('VISITAS_REGISTRAR') && !dia(d.familia.data_termino);
  const visitas = visitasComFila(d);
  const ultima = visitas[0];
  const nome = (id) => (id === sessaoAtual.perfil.id_pessoa ? sessaoAtual.perfil.nome_exibicao : estado.nomes[id] || 'Vicentino');
  const quando = (data) => new Date(data + 'T12:00').toLocaleDateString('pt-BR');
  return `
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Visitas</h2>
      ${registra ? `<a class="btn-submit btn-link btn-registrar-visita" href="#visita/${encodeURIComponent(estado.id)}">${
  estado.emAndamento ? '▶ Continuar a visita em andamento' : 'Registrar visita'}</a>` : ''}
      ${ultima && veContatos() ? `<button type="button" class="btn-secundario" data-acao-familia="ouvir-visita">
        🔊 Ouvir a última visita (${esc(quando(ultima.data))})</button>` : ''}
      ${visitas.length ? `<ul class="visita-lista">${visitas.slice(0, VISITAS_NO_CARTAO).map((v) => `
        <li class="visita-item">
          <p class="visita-item-data">${esc(quando(v.data))}${v.participantes.length ? ' · ' +
            esc(v.participantes.map((p) => nome(p.id_pessoa)).join(' e ')) : ''}${sync.ehProvisorio(v.id) ?
  ' <span class="detalhe-nota">· no celular</span>' : ''}</p>
          ${veContatos() && v.combinados ? `<p class="tela-texto">Combinamos: ${esc(v.combinados)}</p>` : ''}
          ${v.auxilios.length ? `<p class="detalhe-nota">${v.auxilios.length === 1 ? '1 auxílio entregue' :
    v.auxilios.length + ' auxílios entregues'}</p>` : ''}
          ${registra && veContatos() && v.participantes.some((p) => p.id_pessoa === sessaoAtual.perfil.id_pessoa) ?
    `<a class="btn-secundario btn-link visita-acrescentar" href="#visita/${encodeURIComponent(estado.id)}/${
      encodeURIComponent(v.id)}">+ Acrescentar ao relato</a>` : ''}
        </li>`).join('')}</ul>
      <p class="detalhe-nota">O celular guarda as visitas dos últimos 2 meses.</p>` :
    `<p class="tela-texto">${ultimaDaLista ? 'Última visita em ' + esc(ultimaDaLista) + '.' :
      'Nenhuma visita nos últimos 2 meses.'}</p>`}
    </section>`;
}

/** @return {string} HTML */
function formularioDesbloqueio() {
  return `
    <form id="formDesbloquearFamilia" class="md-card detalhe-secao detalhe-form" novalidate>
      <h2 class="detalhe-titulo">Sem internet</h2>
      <p class="tela-texto">Os dados das famílias estão guardados neste celular, protegidos pela sua senha.
        Digite a mesma senha com que você entra no app.</p>
      ${campoSenha('iptSenhaFamilia', 'Sua senha')}
      <p class="feedback-msg" id="msgDesbloquearFamilia" role="status"></p>
      <div class="detalhe-acoes"><button type="submit" class="btn-submit">Abrir os dados</button></div>
    </form>`;
}

/** @return {!Object} O contexto das ações (familia_acoes.js). */
function contexto() {
  return {sessao: sessaoAtual, cf: sessaoAtual.id_conferencia, id: estado.id, d: estado.dados, nomes: estado.nomes,
    vinculos: vinculos || {}, pessoas: estado.pessoas};
}

/** @param {!HTMLElement} area */
function ligarEventos(area) {
  area.querySelectorAll('[data-acao-familia]').forEach((b) => {
    if (b.dataset.acaoFamilia === 'recarregar') {
      return;
    }
    if (b.dataset.acaoFamilia === 'ouvir-visita') {
      b.addEventListener('click', () => {
        vibrar();
        const v = visitasComFila(estado.dados)[0];
        const nome = (id) => (id === sessaoAtual.perfil.id_pessoa ? sessaoAtual.perfil.nome_exibicao :
          estado.nomes[id] || 'vicentino');
        if (v) {
          lerEmVozAlta(textoDaVisita(v, nome));
        }
      });
      return;
    }
    b.addEventListener('click', () => {
      vibrar();
      const acao = b.dataset.acaoFamilia;
      estado.modo = acao === 'cancelar' ? 'ver' : acao;
      estado.alvo = acao === 'retirar' ? estado.dados.moradores.find((m) => m.id_pessoa_familia === b.dataset.morador) : null;
      desenhar();
      area.scrollTop = 0;
    });
  });
  if (estado.modo !== 'ver' && estado.dados) {
    acoes.ligar(area, estado.modo, contexto(), estado.alvo, (aviso) => {
      estado.modo = 'ver';
      estado.id = '';
      voltar('#familias');
      acoes.avisarFim(aviso);
    });
  }
  const recarregar = area.querySelector('[data-acao-familia="recarregar"]');
  if (recarregar) {
    recarregar.addEventListener('click', () => carregar());
  }
  const form = area.querySelector('#formDesbloquearFamilia');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const campo = area.querySelector('#iptSenhaFamilia');
      const msg = area.querySelector('#msgDesbloquearFamilia');
      const senha = campo.value;
      campo.value = '';
      if (!senha) {
        msg.textContent = 'Digite a sua senha.';
        msg.className = 'feedback-msg erro';
        return;
      }
      const botao = form.querySelector('button[type="submit"]');
      botao.disabled = true;
      mostrarCarregando(botao, 'Abrindo'); // a conferência da senha leva 1 a 2 segundos no celular
      msg.textContent = '';
      const ok = await desbloquear(sessaoAtual.id_conferencia, senha, {criar: false});
      botao.disabled = false;
      botao.textContent = 'Abrir os dados';
      if (!ok) {
        msg.textContent = 'A senha não confere. Use a mesma senha com que você entra no app.';
        msg.className = 'feedback-msg erro';
        campo.focus();
        return;
      }
      carregar();
    });
  }
}

/** @return {string} */
function textoParaOuvir() {
  const d = estado.dados;
  if (!d) {
    return 'Buscando os dados da família.';
  }
  const sigla = String(d.familia.id_status_familia || '').toUpperCase();
  const partes = [d.familia.nome_referencia, NOME_DA_SITUACAO[sigla] || ''];
  if (veContatos() && d.endereco) {
    partes.push('endereço: ' + textoEndereco(d.endereco));
  }
  partes.push(d.moradores.length === 1 ? '1 morador' : d.moradores.length + ' moradores');
  return partes.filter(Boolean).join('. ') + '.';
}
