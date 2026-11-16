/**
 * @fileoverview Barra de conexão: escolha da conferência (Metropolitano → Central → Particular → Conferência)
 * e login, logo abaixo da barra superior.
 *
 * - O metropolitano vem do endereço do site (siglas_conselhos_centrais.json, campo "sites"); fora deles, há select.
 * - A lista de CPs e conferências vem do script do CC (ação pública "conferencias") e fica guardada no IndexedDB:
 *   na próxima vez aparece na hora e é atualizada em segundo plano, se houver internet.
 * - Link do presidente: ?cc=SUD (e, se quiser, &cf=SP_SUD_ITA_ICO) já deixa escolhido.
 * - Uma sessão (token) por conferência: quem atua em várias troca sem digitar a senha de novo.
 * - Depois de entrar, os selects somem e o nome da conferência fica na barra; tocar nele mostra os selects de novo.
 *
 * IndexedDB (store config_conferencia): conexao_escolha, conexao_lista:<CM>_<CC>, conexao_sessoes.
 * Módulo: testes/app/js/barra_conexao.js
 */

import * as db from './db.js';
import {salvarSessaoAutenticada, desconectarSessao} from './auth.js';
import {chamarCC} from './api_cc.js';
import {EM_TESTE, carregarMetropolitanos, metropolitanoDoSite, urlApiDo, definirUrlApiDeTeste,
  centraisDisponiveis} from './conselhos.js';

const CHAVE_ESCOLHA = 'conexao_escolha';
const CHAVE_SESSOES = 'conexao_sessoes';
const chaveLista = (cm, cc) => 'conexao_lista:' + cm + '_' + cc;

const estado = {
  metropolitanos: [],
  cmDoSite: null,
  escolha: {cm: '', cc: '', cp: '', cf: ''},
  lista: null, // {nome_central, conselhos_particulares, conferencias}
  sessoes: {},
  aoConectar: null,
};
const el = {};

// ---------------------------------------------------------------------------
// Para as outras telas
// ---------------------------------------------------------------------------

/**
 * Sessão da conferência escolhida (ou null se não entrou).
 * @return {?{id_conferencia: string, url_api: string, token: string, perfil: !Object}}
 */
export function sessaoAtual() {
  const s = estado.sessoes[estado.escolha.cf];
  return s ? {...s, id_conferencia: estado.escolha.cf, url_api: urlAtual()} : null;
}

/**
 * Pedido ao script do CC com o token da conferência escolhida (guarda o token renovado).
 * @param {string} acao
 * @param {!Object=} dados
 * @return {Promise<!Object>}
 */
export async function chamarComSessao(acao, dados = {}) {
  const s = sessaoAtual();
  if (!s) {
    throw new Error('Entre na conferência primeiro.');
  }
  const resposta = await chamarCC(s.url_api, acao, {...dados, token: s.token});
  if (resposta.token_novo) {
    estado.sessoes[s.id_conferencia].token = resposta.token_novo;
    await db.salvarConfig(CHAVE_SESSOES, estado.sessoes);
  }
  return resposta;
}

// ---------------------------------------------------------------------------
// Início
// ---------------------------------------------------------------------------

/**
 * Monta a barra de conexão logo abaixo de #barraSuperior.
 * @param {{aoConectar: (function(!Object): void)=}=} opcoes aoConectar recebe sessaoAtual() a cada entrada ou troca.
 * @return {Promise<void>}
 */
export async function iniciarBarraConexao(opcoes = {}) {
  estado.aoConectar = opcoes.aoConectar || null;
  montarPainel();
  try {
    estado.metropolitanos = await carregarMetropolitanos();
  } catch (erro) {
    mensagem('Não consegui carregar a lista de conselhos do aplicativo.', 'erro');
    return;
  }
  estado.cmDoSite = await metropolitanoDoSite();
  estado.escolha = {...estado.escolha, ...((await db.lerConfig(CHAVE_ESCOLHA)) || {})};
  estado.sessoes = (await db.lerConfig(CHAVE_SESSOES)) || {};
  if (estado.cmDoSite) {
    estado.escolha.cm = estado.cmDoSite.sigla;
  }
  aplicarLink();
  await db.salvarConfig(CHAVE_ESCOLHA, estado.escolha);

  preencherMetropolitanos();
  if (estado.escolha.cc) {
    await carregarLista(false);
  }
  const logado = estado.escolha.cf && estado.sessoes[estado.escolha.cf];
  await atualizarBarra();
  abrirPainel(!logado);
  if (logado && estado.aoConectar) {
    estado.aoConectar(sessaoAtual());
  }
}

/** ?cm=SP&cc=SUD&cf=SP_SUD_ITA_ICO (link enviado pelo presidente). */
function aplicarLink() {
  const p = new URLSearchParams(location.search);
  const cm = (p.get('cm') || '').toUpperCase();
  const cc = (p.get('cc') || '').toUpperCase();
  const cf = (p.get('cf') || '').toUpperCase();
  if (cm && !estado.cmDoSite) {
    estado.escolha.cm = cm;
  }
  if (cc && cc !== estado.escolha.cc) {
    estado.escolha = {cm: estado.escolha.cm, cc: cc, cp: '', cf: ''};
  }
  if (cf && cf.startsWith((estado.escolha.cm || cf.split('_')[0]) + '_' + estado.escolha.cc + '_')) {
    estado.escolha.cf = cf;
    estado.escolha.cp = cf.split('_').slice(-2)[0];
  }
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

function montarPainel() {
  const barra = document.getElementById('barraSuperior');
  const painel = document.createElement('section');
  painel.className = 'painel-conexao';
  painel.id = 'painelConexao';
  painel.setAttribute('aria-label', 'Escolher a conferência e entrar');
  painel.innerHTML = `
    <div class="form-grupo" id="grpCm"><label class="form-label" for="selCm">Conselho Metropolitano</label>
      <select id="selCm" class="form-select"></select></div>
    <div class="form-grupo" id="grpCc"><label class="form-label" for="selCc">Conselho Central</label>
      <select id="selCc" class="form-select" disabled></select></div>
    <div class="form-grupo" id="grpUrl" hidden>
      <label class="form-label" for="iptUrl">Endereço do script deste Central (só em teste)</label>
      <input id="iptUrl" class="form-input" type="url" placeholder="https://script.google.com/macros/s/…/exec">
      <button type="button" class="btn-submit" id="btnUrl">Usar este endereço</button></div>
    <div class="form-grupo" id="grpCp"><label class="form-label" for="selCp">Conselho Particular</label>
      <select id="selCp" class="form-select" disabled></select></div>
    <div class="form-grupo" id="grpCf"><label class="form-label" for="selCf">Conferência</label>
      <select id="selCf" class="form-select" disabled></select></div>

    <form id="areaEntrar" class="painel-area" hidden autocomplete="on">
      <div class="form-grupo"><label class="form-label" for="iptEmail">Seu e-mail</label>
        <input id="iptEmail" class="form-input" type="email" autocomplete="username" inputmode="email" required></div>
      <div class="form-grupo"><label class="form-label" for="iptSenha">Sua senha</label>
        <input id="iptSenha" class="form-input" type="password" autocomplete="current-password" required></div>
      <button type="submit" class="btn-submit" id="btnEntrar">Entrar</button>
      <button type="button" class="link-conexao" id="btnPrimeiroAcesso">Primeiro acesso ou esqueci a senha</button>
    </form>

    <form id="areaCodigo" class="painel-area" hidden>
      <p class="painel-texto" id="txtCodigo"></p>
      <div class="form-grupo"><label class="form-label" for="iptCodigo">Código de 6 dígitos</label>
        <input id="iptCodigo" class="form-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></div>
      <div class="form-grupo"><label class="form-label" for="iptSenhaNova">Nova senha (8 ou mais caracteres)</label>
        <input id="iptSenhaNova" class="form-input" type="password" autocomplete="new-password" minlength="8" required></div>
      <button type="submit" class="btn-submit" id="btnCriarSenha">Criar senha e entrar</button>
      <button type="button" class="link-conexao" id="btnVoltarEntrar">Voltar</button>
    </form>

    <div id="areaConectado" class="painel-area" hidden>
      <p class="painel-texto" id="txtConectado"></p>
      <button type="button" class="btn-submit" id="btnFecharPainel">Continuar</button>
      <button type="button" class="link-conexao" id="btnSair">Sair desta conferência</button>
    </div>

    <p class="feedback-msg" id="msgConexao" role="status"></p>`;
  barra.insertAdjacentElement('afterend', painel);
  ['painelConexao', 'grpCm', 'selCm', 'grpCc', 'selCc', 'grpUrl', 'iptUrl', 'btnUrl', 'grpCp', 'selCp', 'grpCf', 'selCf',
    'areaEntrar', 'iptEmail', 'iptSenha', 'btnEntrar', 'btnPrimeiroAcesso', 'areaCodigo', 'txtCodigo', 'iptCodigo',
    'iptSenhaNova', 'btnCriarSenha', 'btnVoltarEntrar', 'areaConectado', 'txtConectado', 'btnFecharPainel', 'btnSair',
    'msgConexao'].forEach((id) => {
    el[id] = document.getElementById(id);
  });

  const botaoBarra = document.getElementById('statusHeaderBtn');
  if (botaoBarra) {
    botaoBarra.setAttribute('role', 'button');
    botaoBarra.setAttribute('tabindex', '0');
    botaoBarra.addEventListener('click', () => abrirPainel(el.painelConexao.hidden));
    botaoBarra.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        abrirPainel(el.painelConexao.hidden);
      }
    });
  }
  el.selCm.addEventListener('change', () => escolher({cm: el.selCm.value, cc: '', cp: '', cf: ''}));
  el.selCc.addEventListener('change', () => escolher({cc: el.selCc.value, cp: '', cf: ''}));
  el.selCp.addEventListener('change', () => escolher({cp: el.selCp.value, cf: ''}));
  el.selCf.addEventListener('change', () => escolher({cf: el.selCf.value}));
  el.btnUrl.addEventListener('click', async () => {
    definirUrlApiDeTeste(estado.escolha.cm, estado.escolha.cc, el.iptUrl.value);
    await carregarLista(true);
  });
  el.areaEntrar.addEventListener('submit', (e) => {
    e.preventDefault();
    entrar();
  });
  el.btnPrimeiroAcesso.addEventListener('click', pedirCodigo);
  el.areaCodigo.addEventListener('submit', (e) => {
    e.preventDefault();
    criarSenha();
  });
  el.btnVoltarEntrar.addEventListener('click', () => mostrarArea('entrar'));
  el.btnFecharPainel.addEventListener('click', () => abrirPainel(false));
  el.btnSair.addEventListener('click', sair);
}

/** @param {boolean} aberto */
function abrirPainel(aberto) {
  el.painelConexao.hidden = !aberto;
  if (aberto) {
    mensagem('');
    mostrarAreaDaEscolha();
  }
}

/** @param {string} texto @param {string=} tipo erro, sucesso ou info */
function mensagem(texto, tipo) {
  el.msgConexao.textContent = texto;
  el.msgConexao.className = 'feedback-msg' + (texto ? ' ' + (tipo || 'info') : '');
}

/** @param {string} qual entrar, codigo, conectado ou '' */
function mostrarArea(qual) {
  el.areaEntrar.hidden = qual !== 'entrar';
  el.areaCodigo.hidden = qual !== 'codigo';
  el.areaConectado.hidden = qual !== 'conectado';
}

function mostrarAreaDaEscolha() {
  const cf = estado.escolha.cf;
  if (!cf) {
    mostrarArea('');
  } else if (estado.sessoes[cf]) {
    const s = estado.sessoes[cf];
    el.txtConectado.textContent = 'Você está na ' + nomeConferencia(cf) + ' como ' +
        ((s.perfil && s.perfil.nome_exibicao) || 'vicentino(a)') + '.';
    mostrarArea('conectado');
  } else {
    mostrarArea('entrar');
  }
}

// ---------------------------------------------------------------------------
// Selects
// ---------------------------------------------------------------------------

/**
 * @param {!HTMLSelectElement} select
 * @param {!Array<{valor: string, texto: string}>} opcoes
 * @param {string} escolhido
 * @param {string} vazio Texto da 1ª opção.
 */
function preencher(select, opcoes, escolhido, vazio) {
  select.innerHTML = '';
  select.appendChild(new Option(vazio, ''));
  opcoes.forEach((o) => select.appendChild(new Option(o.texto, o.valor, false, o.valor === escolhido)));
  select.disabled = !opcoes.length;
}

function preencherMetropolitanos() {
  el.grpCm.hidden = Boolean(estado.cmDoSite);
  const comCentrais = estado.metropolitanos.filter((cm) => centraisDisponiveis(cm).length);
  preencher(el.selCm, comCentrais.map((cm) => ({valor: cm.sigla, texto: cm.nome})), estado.escolha.cm,
      'Escolha o Metropolitano');
  preencherCentrais();
}

function cmAtual() {
  return estado.metropolitanos.find((cm) => cm.sigla === estado.escolha.cm) || null;
}

function ccAtual() {
  const cm = cmAtual();
  return cm ? (cm.conselhos_centrais || []).find((cc) => cc.sigla === estado.escolha.cc) || null : null;
}

function urlAtual() {
  const cc = ccAtual();
  return cc ? urlApiDo(estado.escolha.cm, cc) : '';
}

function preencherCentrais() {
  const cm = cmAtual();
  const centrais = cm ? centraisDisponiveis(cm) : [];
  preencher(el.selCc, centrais.map((cc) => ({valor: cc.sigla,
    texto: cc.nome + (urlApiDo(cm.sigla, cc) ? '' : ' (sem endereço do script)')})), estado.escolha.cc, 'Escolha o Central');
  const cc = ccAtual();
  el.grpUrl.hidden = !(EM_TESTE && cc);
  el.iptUrl.value = cc ? urlApiDo(cm.sigla, cc) : '';
  preencherParticulares();
}

function preencherParticulares() {
  const cps = estado.lista ? estado.lista.conselhos_particulares : [];
  // Um CP só: escolhido sem perguntar.
  if (cps.length === 1 && !estado.escolha.cp) {
    estado.escolha.cp = cps[0].sigla;
  }
  el.grpCp.hidden = cps.length === 1;
  preencher(el.selCp, cps.map((cp) => ({valor: cp.sigla, texto: cp.nome})), estado.escolha.cp, 'Escolha o Particular');
  const cfs = estado.lista && estado.escolha.cp ?
    estado.lista.conferencias.filter((c) => c.id_conselho_particular === estado.escolha.cp) : [];
  preencher(el.selCf, cfs.map((c) => ({valor: c.id_conferencia, texto: c.nome})), estado.escolha.cf, 'Escolha a Conferência');
}

/**
 * Lista de CPs e conferências do CC: a guardada aparece na hora; a do servidor atualiza em seguida.
 * @param {boolean} avisarErro Mostra o erro se não conseguir falar com o CC.
 * @return {Promise<void>}
 */
async function carregarLista(avisarErro) {
  const {cm, cc} = estado.escolha;
  estado.lista = await db.lerConfig(chaveLista(cm, cc));
  preencherCentrais();
  const url = urlAtual();
  if (!url) {
    mensagem(EM_TESTE ? 'Informe o endereço do script deste Central (campo acima).' :
      'Este Conselho Central ainda não está ligado ao aplicativo.', 'info');
    return;
  }
  if (!estado.lista) {
    mensagem('Buscando as conferências…', 'info');
  }
  try {
    const r = await chamarCC(url, 'conferencias');
    estado.lista = {nome_central: r.nome_central || '', conselhos_particulares: r.conselhos_particulares || [],
      conferencias: r.conferencias || []};
    await db.salvarConfig(chaveLista(cm, cc), estado.lista);
    if (estado.escolha.cm === cm && estado.escolha.cc === cc) {
      mensagem('');
      preencherParticulares();
    }
  } catch (erro) {
    if (avisarErro || !estado.lista) {
      mensagem(erro.message, 'erro');
    }
  }
}

/**
 * @param {!Object} mudanca Campos de estado.escolha que mudaram.
 * @return {Promise<void>}
 */
async function escolher(mudanca) {
  const ccAntes = estado.escolha.cc;
  const cmAntes = estado.escolha.cm;
  estado.escolha = {...estado.escolha, ...mudanca};
  await db.salvarConfig(CHAVE_ESCOLHA, estado.escolha);
  mensagem('');
  if (estado.escolha.cm !== cmAntes) {
    estado.lista = null;
    preencherCentrais();
  } else if (estado.escolha.cc !== ccAntes) {
    estado.lista = null;
    if (estado.escolha.cc) {
      await carregarLista(true);
    } else {
      preencherCentrais();
    }
  } else {
    preencherParticulares();
  }
  await atualizarBarra();
  mostrarAreaDaEscolha();
  if (mudanca.cf && estado.sessoes[mudanca.cf]) {
    // Já entrou nesta conferência antes: troca sem senha.
    abrirPainel(false);
    if (estado.aoConectar) {
      estado.aoConectar(sessaoAtual());
    }
  } else if (mudanca.cf) {
    el.iptEmail.focus();
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

function nomeConferencia(id) {
  const c = estado.lista && estado.lista.conferencias.find((x) => x.id_conferencia === id);
  return c ? c.nome : id;
}

/** @param {!HTMLButtonElement} botao @param {function(): Promise<void>} tarefa */
async function ocupado(botao, tarefa) {
  const texto = botao.textContent;
  botao.disabled = true;
  botao.textContent = 'Aguarde…';
  try {
    await tarefa();
  } catch (erro) {
    mensagem(erro.message, 'erro');
  } finally {
    botao.disabled = false;
    botao.textContent = texto;
  }
}

function entrar() {
  return ocupado(el.btnEntrar, async () => {
    const r = await chamarCC(urlAtual(), 'entrar', {id_conferencia: estado.escolha.cf,
      email: el.iptEmail.value.trim(), senha: el.iptSenha.value});
    await guardarSessao(r);
  });
}

function pedirCodigo() {
  const email = el.iptEmail.value.trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    mensagem('Escreva o seu e-mail acima e toque de novo em "Primeiro acesso".', 'erro');
    el.iptEmail.focus();
    return Promise.resolve();
  }
  return ocupado(el.btnPrimeiroAcesso, async () => {
    const r = await chamarCC(urlAtual(), 'pedir_codigo', {id_conferencia: estado.escolha.cf, email: email});
    el.txtCodigo.textContent = r.mensagem || 'Enviamos um código para o seu e-mail.';
    mensagem('');
    mostrarArea('codigo');
    el.iptCodigo.focus();
  });
}

function criarSenha() {
  return ocupado(el.btnCriarSenha, async () => {
    const r = await chamarCC(urlAtual(), 'criar_senha', {id_conferencia: estado.escolha.cf,
      email: el.iptEmail.value.trim(), codigo: el.iptCodigo.value.trim(), senha_nova: el.iptSenhaNova.value});
    await guardarSessao(r);
  });
}

/** @param {{token: string, perfil: !Object}} resposta */
async function guardarSessao(resposta) {
  const cf = estado.escolha.cf;
  estado.sessoes[cf] = {token: resposta.token, perfil: resposta.perfil || {}, cm: estado.escolha.cm,
    cc: estado.escolha.cc, entrou_em: new Date().toISOString()};
  await db.salvarConfig(CHAVE_SESSOES, estado.sessoes);
  el.iptSenha.value = '';
  el.iptSenhaNova.value = '';
  el.iptCodigo.value = '';
  await atualizarBarra();
  abrirPainel(false);
  if (estado.aoConectar) {
    estado.aoConectar(sessaoAtual());
  }
}

async function sair() {
  delete estado.sessoes[estado.escolha.cf];
  await db.salvarConfig(CHAVE_SESSOES, estado.sessoes);
  await atualizarBarra();
  mostrarAreaDaEscolha();
  mensagem('Você saiu desta conferência neste celular.', 'info');
}

/** Barra superior (semáforo de auth.js) com a conferência escolhida e quem entrou. */
async function atualizarBarra() {
  const cf = estado.escolha.cf;
  if (!cf) {
    await desconectarSessao();
    return;
  }
  const s = estado.sessoes[cf];
  const cp = estado.lista && estado.lista.conselhos_particulares.find((x) => x.sigla === estado.escolha.cp);
  await salvarSessaoAutenticada({
    conectado: Boolean(s),
    conselho_metropolitano: estado.escolha.cm,
    id_cc: estado.escolha.cm + '_' + estado.escolha.cc,
    nome_cc: (estado.lista && estado.lista.nome_central) || (ccAtual() || {}).nome || estado.escolha.cc,
    id_cp: estado.escolha.cp,
    nome_cp: cp ? cp.nome : estado.escolha.cp,
    id_ssvp: cf,
    nome_cf: nomeConferencia(cf),
    nome_pessoa: s && s.perfil ? s.perfil.nome_exibicao || '' : null,
    email_pessoa: null,
  });
}
