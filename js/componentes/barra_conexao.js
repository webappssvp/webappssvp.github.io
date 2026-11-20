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
 * IndexedDB (store config): conexao_escolha, conexao_lista:<CM>_<CC>, conexao_sessoes.
 * Na barra superior (index.html): #statusHeaderBtn abre e fecha o painel; #lblConfName e #lblConfSub mostram a escolha.
 * Módulo: js/componentes/barra_conexao.js (veio de testes/app/js/barra_conexao.js)
 */

import * as db from '../core/db.js';
import {chamarCC} from '../core/api_cc.js';
import {prefs} from '../core/preferencias.js';
import {EM_TESTE, carregarMetropolitanos, metropolitanoDoSite, urlApiDo, definirUrlApiDeTeste,
  centraisDisponiveis} from '../core/conselhos.js';

import {mostrarCarregando} from './carregando.js';
import {LOGINS_DEV_ATIVOS, lembrarLogin, loginsDaConferencia, esquecerLogins} from './logins_dev.js';
import * as trava from '../core/trava.js';
import * as uso from '../core/uso.js';

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
  aoEntrarComSenha: null, // (cf, senha) => Promise: abre o cofre dos dados guardados
  aoEncerrarSessao: null, // (cf) => Promise: Sair ou sessão vencida; apaga os dados guardados
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
  return chamarNaConferencia(s.id_conferencia, s.url_api, acao, dados);
}

/**
 * Pedido com o token de uma conferência em que a pessoa entrou (não precisa ser a escolhida): a fila de
 * sincronização envia o que foi gravado em cada conferência com a sessão dela.
 * @param {string} idConferencia
 * @param {string} urlApi Endereço do script do CC daquela conferência.
 * @param {string} acao
 * @param {!Object=} dados
 * @return {Promise<!Object>}
 */
export async function chamarNaConferencia(idConferencia, urlApi, acao, dados = {}) {
  const sessao = estado.sessoes[idConferencia];
  if (!sessao) {
    const erro = new Error('Entre na conferência de novo para enviar.');
    erro.codigo = 'SEM_SESSAO';
    throw erro;
  }
  // O script confere que o token é desta conferência: id_conferencia vai em todo pedido.
  let resposta;
  // O resumo de uso do app (uso.js) vai junto com o envio da fila e com o Sincronizar (aba "uso"; Uso.gs).
  const resumoUso = acao === 'lote' || acao === 'registrar_uso' ? uso.separar() : null;
  try {
    // id_acesso: a linha deste login na aba "acessos" do índice (o servidor atualiza o último uso; Acessos.gs).
    resposta = await chamarCC(urlApi, acao, {...dados, id_conferencia: idConferencia, token: sessao.token,
      id_acesso: sessao.id_acesso || '', ...(resumoUso ? {uso: resumoUso} : {})});
    if (resumoUso) {
      uso.enviado(true);
    }
  } catch (erro) {
    if (resumoUso) {
      uso.enviado(false); // o servidor só grava o resumo quando o pedido dá certo: vai no próximo
    }
    if (erro.codigo === 'SEM_SESSAO' && estado.sessoes[idConferencia]) {
      // Sessão vencida ou encerrada no servidor: esquece o token e pede a senha de novo.
      delete estado.sessoes[idConferencia];
      await salvarSessoes();
      if (estado.aoEncerrarSessao) {
        await estado.aoEncerrarSessao(idConferencia); // os dados guardados saem junto com a sessão
      }
      await atualizarBarra();
      if (idConferencia === estado.escolha.cf) {
        abrirPainel(true);
        mensagem(erro.message, 'erro');
        if (estado.aoConectar) {
          estado.aoConectar(null);
        }
      }
    }
    throw erro;
  }
  if (resposta.token_novo && estado.sessoes[idConferencia]) {
    estado.sessoes[idConferencia].token = resposta.token_novo;
    await salvarSessoes();
  }
  return resposta;
}

/**
 * Guarda as sessões. Com tranca (19/11/2026, trava.js), o token vai cifrado pela chave do desenho; com a tranca
 * criada mas fechada, não grava (a cópia guardada continua a trancada). Sem tranca ainda (logo antes de criá-la),
 * grava como antes, e salvarSessoes() é chamada de novo assim que ela é criada.
 */
export async function salvarSessoes() {
  if (trava.configurada() && !trava.aberta()) {
    return;
  }
  const guardar = {};
  for (const [cf, s] of Object.entries(estado.sessoes)) {
    const {token, ...resto} = s;
    guardar[cf] = trava.configurada() ? {...resto, token_cifrado: await trava.cifrarTexto(token)} : s;
  }
  await db.salvarConfig(CHAVE_SESSOES, guardar);
}

/**
 * As sessões guardadas, com o token aberto pela tranca. A que não abre (tranca esquecida e refeita) fica de fora.
 * @param {!Object} guardadas
 * @return {!Promise<!Object>}
 */
async function abrirSessoes(guardadas) {
  const abertas = {};
  for (const [cf, s] of Object.entries(guardadas)) {
    if (s.token_cifrado) {
      const token = await trava.decifrarTexto(s.token_cifrado);
      if (token) {
        const {token_cifrado: _, ...resto} = s; // eslint-disable-line no-unused-vars
        abertas[cf] = {...resto, token};
      }
    } else if (s.token) {
      abertas[cf] = s;
    }
  }
  return abertas;
}

/** @return {!Promise<!Array<string>>} As conferências com sessão guardada (antes de abrir a tranca). */
export async function conferenciasGuardadas() {
  return Object.keys((await db.lerConfig(CHAVE_SESSOES)) || {});
}

/** Tranca criada antes de a barra carregar (quem entrou antes da tranca): cifra os tokens guardados já. */
export async function trancarSessoesGuardadas() {
  const guardadas = (await db.lerConfig(CHAVE_SESSOES)) || {};
  const trancadas = {};
  for (const [cf, s] of Object.entries(guardadas)) {
    const {token, ...resto} = s;
    trancadas[cf] = token && trava.aberta() ? {...resto, token_cifrado: await trava.cifrarTexto(token)} : s;
  }
  await db.salvarConfig(CHAVE_SESSOES, trancadas);
}

/** Esquece todas as sessões deste celular (erros demais na tranca, esqueci o desenho). */
export async function esquecerSessoesGuardadas() {
  estado.sessoes = {};
  await db.salvarConfig(CHAVE_SESSOES, {});
}

/** @return {!Array<string>} As conferências em que a pessoa entrou neste celular. */
export function conferenciasComSessao() {
  return Object.keys(estado.sessoes);
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
  estado.aoEntrarComSenha = opcoes.aoEntrarComSenha || null;
  estado.aoEncerrarSessao = opcoes.aoEncerrarSessao || null;
  montarPainel();
  try {
    estado.metropolitanos = await carregarMetropolitanos();
  } catch (erro) {
    mensagem('Não consegui carregar a lista de conselhos do aplicativo.', 'erro');
    return;
  }
  estado.cmDoSite = await metropolitanoDoSite();
  estado.escolha = {...estado.escolha, ...((await db.lerConfig(CHAVE_ESCOLHA)) || {})};
  estado.sessoes = await abrirSessoes((await db.lerConfig(CHAVE_SESSOES)) || {});
  if (estado.cmDoSite) {
    estado.escolha.cm = estado.cmDoSite.sigla;
  }
  aplicarLink();
  await db.salvarConfig(CHAVE_ESCOLHA, estado.escolha);

  preencherMetropolitanos();
  if (estado.escolha.cc) {
    // A lista guardada aparece na hora e o painel abre já com e-mail e senha; a do servidor (o Apps Script leva uns
    // segundos para responder) atualiza os selects quando chegar, sem segurar a tela (20/11/2026).
    estado.lista = await db.lerConfig(chaveLista(estado.escolha.cm, estado.escolha.cc));
    preencherCentrais();
    carregarLista(false);
  }
  const logado = estado.escolha.cf && estado.sessoes[estado.escolha.cf];
  await atualizarBarra();
  abrirPainel(!logado && !naAjuda());
  if (logado && estado.aoConectar) {
    estado.aoConectar(sessaoAtual());
  }
}

/** ?cm=SP&cc=SUD&cf=SP_SUD_ITA_ICO (link enviado pelo presidente). */
function aplicarLink() {
  const p = new URLSearchParams(location.search);
  const cf = (p.get('cf') || '').toUpperCase();
  // Só ?cf= basta (20/11/2026): o metropolitano e o CC são as duas primeiras partes do código (SP_SUD_ITA_ICO).
  // Os links antigos, com ?cm= e ?cc=, continuam valendo.
  const partes = cf.split('_');
  const cm = (p.get('cm') || (partes.length >= 3 ? partes[0] : '')).toUpperCase();
  const cc = (p.get('cc') || (partes.length >= 3 ? partes[1] : '')).toUpperCase();
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
  // Usado o link (de convite ou do Compartilhar), ele sai do endereço (18/11/2026): a escolha já fica guardada, e
  // recarregar a página não volta para a conferência do link se a pessoa trocou de conferência depois.
  if (cm || cc || cf) {
    p.delete('cm');
    p.delete('cc');
    p.delete('cf');
    const resto = p.toString();
    history.replaceState(null, '', location.pathname + (resto ? '?' + resto : '') + location.hash);
  }
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

/**
 * Botão de olho (mostrar/esconder senha), para ir dentro de um .campo-senha.
 * @param {string} id
 * @return {string}
 */
function botaoOlho(id) {
  return `<button type="button" class="btn-olho" id="${id}" aria-pressed="false" aria-label="Mostrar a senha">
    <svg viewBox="0 0 24 24" aria-hidden="true" data-olho="aberto"><path d="M12 5C6.5 5 2.3 8.6 1 12c1.3 3.4 5.5 7 11 7s9.7-3.6 11-7c-1.3-3.4-5.5-7-11-7zm0 11.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm0-2.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/></svg>
    <svg viewBox="0 0 24 24" aria-hidden="true" data-olho="fechado" hidden><path d="M2.3 3.7 3.7 2.3l18 18-1.4 1.4-3.4-3.4A12 12 0 0 1 12 19C6.5 19 2.3 15.4 1 12a12.6 12.6 0 0 1 4-5.3zM12 5c5.5 0 9.7 3.6 11 7a12.4 12.4 0 0 1-3 4.5l-3.3-3.3A4.5 4.5 0 0 0 10.8 7.3L8.4 4.9A12 12 0 0 1 12 5zm-4.4 5.4a4.5 4.5 0 0 0 6 6z"/></svg>
  </button>`;
}

function montarPainel() {
  const barra = document.getElementById('appHeader');
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
    <button type="button" class="link-conexao link-url-teste" id="btnMostrarUrl" hidden>Trocar o endereço do script
      (só em teste)</button>
    <div class="form-grupo" id="grpCp"><label class="form-label" for="selCp">Conselho Particular</label>
      <select id="selCp" class="form-select" disabled></select></div>
    <div class="form-grupo" id="grpCf"><label class="form-label" for="selCf">Conferência</label>
      <select id="selCf" class="form-select" disabled></select></div>

    <form id="areaEntrar" class="painel-area" hidden autocomplete="off">
      <div class="form-grupo grupo-dev" id="grpDevLogin" hidden>
        <label class="form-label" for="selDevLogin">Contas salvas (só em desenvolvimento)</label>
        <select id="selDevLogin" class="form-select"></select></div>
      <div class="form-grupo"><label class="form-label" for="iptEmail">Seu e-mail</label>
        <input id="iptEmail" class="form-input" type="email" autocomplete="off" inputmode="email" required></div>
      <div class="form-grupo"><label class="form-label" for="iptSenha">Sua senha</label>
        <div class="campo-senha">
          <input id="iptSenha" class="form-input" type="password" autocomplete="off" required>
          ${botaoOlho('btnOlhoEntrar')}
        </div></div>
      <button type="submit" class="btn-submit" id="btnEntrar">Entrar</button>
      <button type="button" class="link-conexao" id="btnPrimeiroAcesso">Primeiro acesso ou esqueci a senha</button>
      <button type="button" class="link-conexao" id="btnPerdiCelular">Perdi o celular</button>
    </form>

    <form id="areaCodigo" class="painel-area" hidden>
      <p class="painel-texto" id="txtCodigo"></p>
      <div class="form-grupo"><label class="form-label" for="iptCodigo">Código de 6 dígitos</label>
        <input id="iptCodigo" class="form-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></div>
      <div class="form-grupo"><label class="form-label" for="iptSenhaNova">Nova senha (8 ou mais caracteres)</label>
        <div class="campo-senha">
          <input id="iptSenhaNova" class="form-input" type="password" autocomplete="off" minlength="8" required>
          ${botaoOlho('btnOlhoSenha')}
        </div></div>
      <div class="form-grupo"><label class="form-label" for="iptSenhaConfirma">Confirme a nova senha</label>
        <input id="iptSenhaConfirma" class="form-input" type="password" autocomplete="off" required
          aria-describedby="erroSenhaConfirma">
        <p class="campo-erro" id="erroSenhaConfirma" role="alert" hidden>As duas senhas não são iguais. Escreva a mesma senha nos dois campos.</p></div>
      <button type="submit" class="btn-submit" id="btnCriarSenha">Criar senha e entrar</button>
      <button type="button" class="link-conexao" id="btnVoltarEntrar">Voltar</button>
    </form>

    <div id="areaConectado" class="painel-area" hidden>
      <p class="painel-texto" id="txtConectado"></p>
      <button type="button" class="btn-submit" id="btnFecharPainel">Continuar</button>
      <button type="button" class="link-conexao" id="btnSair">Sair desta conferência</button>
      <button type="button" class="link-conexao link-perigo" id="btnSairTodos">Perdi um celular: sair de todos os
        aparelhos</button>
    </div>

    <p class="feedback-msg" id="msgConexao" role="status"></p>`;
  // Em "Como o app guarda e envia" (abre sem login, link compartilhado) o painel começa fechado: senão ficaria por
  // cima da explicação enquanto a lista de conferências carrega.
  painel.hidden = naAjuda();
  barra.insertAdjacentElement('afterend', painel);
  ['painelConexao', 'grpCm', 'selCm', 'grpCc', 'selCc', 'grpUrl', 'iptUrl', 'btnUrl', 'btnMostrarUrl', 'grpCp', 'selCp', 'grpCf', 'selCf',
    'areaEntrar', 'grpDevLogin', 'selDevLogin', 'iptEmail', 'iptSenha', 'btnOlhoEntrar', 'btnEntrar', 'btnPrimeiroAcesso', 'areaCodigo', 'txtCodigo', 'iptCodigo',
    'iptSenhaNova', 'btnOlhoSenha', 'iptSenhaConfirma', 'erroSenhaConfirma', 'btnCriarSenha', 'btnVoltarEntrar', 'areaConectado', 'txtConectado', 'btnFecharPainel', 'btnSair', 'btnSairTodos', 'btnPerdiCelular',
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
  [el.selCm, el.selCc, el.selCp, el.selCf].forEach((s) => s.addEventListener('change', () => corDoSelect(s)));
  el.btnMostrarUrl.addEventListener('click', () => {
    el.grpUrl.hidden = false;
    el.btnMostrarUrl.hidden = true;
    el.iptUrl.focus();
  });
  el.btnUrl.addEventListener('click', async () => {
    definirUrlApiDeTeste(estado.escolha.cm, estado.escolha.cc, el.iptUrl.value);
    await carregarLista(true);
  });
  el.areaEntrar.addEventListener('submit', (e) => {
    e.preventDefault();
    entrar();
  });
  el.btnPrimeiroAcesso.addEventListener('click', pedirCodigo);
  // Depois do vermelho (não entrou), mexer no e-mail ou na senha volta os dois ao amarelo.
  [el.iptEmail, el.iptSenha].forEach((campo) => campo.addEventListener('input', () => {
    if (campo.classList.contains('sinal-vermelho')) {
      corDoLogin('amarelo');
    }
  }));
  el.selDevLogin.addEventListener('change', escolherLoginDev);
  el.areaCodigo.addEventListener('submit', (e) => {
    e.preventDefault();
    criarSenha();
  });
  el.btnOlhoEntrar.addEventListener('click', () => alternarOlho(el.btnOlhoEntrar, [el.iptSenha]));
  el.btnOlhoSenha.addEventListener('click', () => alternarOlho(el.btnOlhoSenha, [el.iptSenhaNova, el.iptSenhaConfirma]));
  el.iptSenhaConfirma.addEventListener('input', () => {
    if (el.msgConexao.classList.contains('erro')) {
      mensagem('');
    }
  });
  // Ao sair da confirmação, avisa se as senhas não batem; enquanto o aviso está na tela,
  // ele some assim que as duas ficarem iguais.
  el.iptSenhaConfirma.addEventListener('blur', () => conferirSenhas(true));
  el.iptSenhaConfirma.addEventListener('input', () => conferirSenhas(false));
  el.iptSenhaNova.addEventListener('input', () => conferirSenhas(false));
  el.btnVoltarEntrar.addEventListener('click', () => mostrarArea('entrar'));
  el.btnFecharPainel.addEventListener('click', () => abrirPainel(false));
  el.btnSair.addEventListener('click', sair);
  el.btnSairTodos.addEventListener('click', sairDeTodos);
  el.btnPerdiCelular.addEventListener('click', () => mensagem('Entre aqui com o seu e-mail e a sua senha e toque em ' +
    '"Perdi um celular: sair de todos os aparelhos". O celular perdido sai da conferência na próxima vez que usar a ' +
    'internet. Se não lembrar a senha, use "Esqueci a senha": a senha nova também tira todos os aparelhos.', 'info'));
}

/** @param {boolean} aberto */
function abrirPainel(aberto) {
  // Sem sessão na conferência escolhida, o painel não fecha: é a única coisa na tela (19/11/2026). Em "Como o app
  // guarda e envia", que abre sem login (link compartilhado), fecha: senão cobriria a explicação.
  if (!aberto && !estado.sessoes[estado.escolha.cf] && !naAjuda()) {
    aberto = true;
  }
  el.painelConexao.hidden = !aberto;
  document.body.classList.toggle('painel-aberto', Boolean(aberto));
  if (aberto) {
    mensagem('');
    mostrarAreaDaEscolha();
  }
}

/**
 * @param {string} texto
 * @param {string=} tipo info, erro ou sucesso.
 * @param {boolean=} carregando Põe o card da nuvem baixando depois do texto.
 */
function mensagem(texto, tipo, carregando) {
  if (carregando) {
    mostrarCarregando(el.msgConexao, texto);
  } else {
    el.msgConexao.textContent = texto;
  }
  el.msgConexao.className = 'feedback-msg' + (texto ? ' ' + (tipo || 'info') : '');
  if (texto && !el.painelConexao.hidden) {
    // O aviso fica no pé do painel: no celular, fora da tela sem isto.
    el.msgConexao.scrollIntoView({block: 'nearest', behavior: prefs.reduzirAnimacoes ? 'auto' : 'smooth'});
  }
}

/** @param {string} qual entrar, codigo, conectado ou '' */
function mostrarArea(qual) {
  el.areaEntrar.hidden = qual !== 'entrar';
  if (qual === 'entrar') {
    preencherLoginsDev();
    corDoLogin('amarelo');
  }
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
/**
 * "Conselho Metropolitano de São Paulo" → "São Paulo"; "Conselho Central Sudeste" → "Sudeste".
 * O rótulo do campo já diz qual conselho é, e o nome inteiro não cabia no celular.
 * @param {string} nome
 * @return {string}
 */
function nomeCurto(nome) {
  return String(nome).replace(/^Conselho\s+(Metropolitano|Central|Particular)\s+((de|do|da|dos|das)\s+)?/i, '');
}

function preencher(select, opcoes, escolhido, vazio) {
  select.innerHTML = '';
  select.appendChild(new Option(vazio, ''));
  opcoes.forEach((o) => select.appendChild(new Option(o.texto, o.valor, false, o.valor === escolhido)));
  select.disabled = !opcoes.length;
  corDoSelect(select);
}

/**
 * Semáforo da escolha da conferência (19/11/2026): vermelho = ainda não dá para escolher (falta o de cima);
 * amarelo = pronto para escolher; verde = escolhido. Sem depender só da cor: o texto do campo já diz "Escolha o …".
 * @param {!HTMLElement} campo
 * @param {string} cor vermelho, amarelo ou verde
 */
function sinal(campo, cor) {
  ['vermelho', 'amarelo', 'verde'].forEach((c) => campo.classList.toggle('sinal-' + c, c === cor));
}

/** @param {!HTMLSelectElement} select */
function corDoSelect(select) {
  sinal(select, select.value ? 'verde' : (select.disabled ? 'vermelho' : 'amarelo'));
}

/** E-mail e senha: amarelos ao aparecer (falta preencher); vermelhos se não conseguiu entrar. @param {string} cor */
function corDoLogin(cor) {
  [el.iptEmail, el.iptSenha].forEach((campo) => sinal(campo, cor));
}

function preencherMetropolitanos() {
  el.grpCm.hidden = Boolean(estado.cmDoSite);
  const comCentrais = estado.metropolitanos.filter((cm) => centraisDisponiveis(cm).length);
  preencher(el.selCm, comCentrais.map((cm) => ({valor: cm.sigla, texto: nomeCurto(cm.nome)})), estado.escolha.cm,
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
    texto: nomeCurto(cc.nome) + (urlApiDo(cm.sigla, cc) ? '' : ' (sem endereço do script)')})), estado.escolha.cc,
  'Escolha o Central');
  const cc = ccAtual();
  const url = cc ? urlApiDo(cm.sigla, cc) : '';
  // Em teste, o campo só aparece quando o Central ainda não tem endereço; com endereço, o link "Trocar" o mostra.
  el.grpUrl.hidden = !(EM_TESTE && cc && !url);
  el.btnMostrarUrl.hidden = !(EM_TESTE && cc && url);
  el.iptUrl.value = url;
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
    mensagem('Buscando as conferências', 'info', true);
  }
  try {
    const r = await chamarCC(url, 'conferencias');
    const lista = {nome_central: r.nome_central || '', conselhos_particulares: r.conselhos_particulares || [],
      conferencias: r.conferencias || []};
    await db.salvarConfig(chaveLista(cm, cc), lista);
    // Trocou de Central enquanto esta lista chegava: guarda, mas não põe na tela.
    if (estado.escolha.cm === cm && estado.escolha.cc === cc) {
      estado.lista = lista;
      mensagem('');
      preencherParticulares();
      await atualizarBarra(); // o nome da conferência pode ter mudado
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
  const cfAntes = estado.escolha.cf;
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
  } else {
    // Outra conferência (ou nenhuma) em que ainda não entrou: a tela deixa de mostrar a anterior
    // e a barra inferior some até entrar.
    if (estado.escolha.cf !== cfAntes && estado.aoConectar) {
      estado.aoConectar(null);
    }
    if (mudanca.cf) {
      el.iptEmail.focus();
    }
  }
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export function nomeConferencia(id) {
  const c = estado.lista && estado.lista.conferencias.find((x) => x.id_conferencia === id);
  return c ? c.nome : id;
}

/** @param {!HTMLButtonElement} botao @param {function(): Promise<void>} tarefa */
async function ocupado(botao, tarefa) {
  const texto = botao.textContent;
  botao.disabled = true;
  mostrarCarregando(botao, 'Aguarde', 'enviar');
  try {
    await tarefa();
  } catch (erro) {
    mensagem(erro.message, 'erro');
  } finally {
    botao.disabled = false;
    botao.textContent = texto;
  }
}

/** Só em desenvolvimento: o select com as contas que já entraram nesta conferência. */
async function preencherLoginsDev() {
  if (!LOGINS_DEV_ATIVOS) {
    return;
  }
  const logins = await loginsDaConferencia(estado.escolha.cf);
  el.grpDevLogin.hidden = !logins.length;
  el.selDevLogin.innerHTML = '';
  el.selDevLogin.appendChild(new Option('Escolha uma conta salva…', ''));
  // "Esquecer" é a primeira opção da lista; o texto de escolha segue como valor inicial, para não apagar sem querer.
  el.selDevLogin.appendChild(new Option('✕ Esquecer as contas salvas neste navegador', '__esquecer'));
  logins.forEach((l) => el.selDevLogin.appendChild(new Option((l.nome ? l.nome + ' · ' : '') + l.email, l.email)));
}

async function escolherLoginDev() {
  const valor = el.selDevLogin.value;
  if (valor === '__esquecer') {
    await esquecerLogins();
    await preencherLoginsDev();
    mensagem('Contas salvas apagadas deste navegador.', 'info');
    return;
  }
  const login = (await loginsDaConferencia(estado.escolha.cf)).find((l) => l.email === valor);
  if (login) {
    el.iptEmail.value = login.email;
    el.iptSenha.value = login.senha;
  }
}

function entrar() {
  return ocupado(el.btnEntrar, async () => {
    const email = el.iptEmail.value.trim();
    const senha = el.iptSenha.value;
    let r;
    try {
      r = await chamarCC(urlAtual(), 'entrar', {id_conferencia: estado.escolha.cf, email, senha, ...doAparelho()});
    } catch (erro) {
      corDoLogin('vermelho');
      throw erro;
    }
    await lembrarLogin(estado.escolha.cf, email, senha, r.perfil && r.perfil.nome_exibicao);
    await guardarSessao(r, email, senha);
  });
}

/**
 * Confere a senha de quem já entrou (botão "Atualizar" dos dados guardados): entra de novo com o e-mail da sessão.
 * Com a senha certa, a sessão é renovada e aoEntrarComSenha abre o cofre (e o refaz, se a senha mudou).
 * @param {string} senha
 * @return {!Promise<void>} Rejeita com a mensagem do servidor (ex.: senha errada).
 */
export async function conferirSenha(senha) {
  const s = sessaoAtual();
  if (!s) {
    throw new Error('Entre na conferência primeiro.');
  }
  if (!s.email) {
    throw new Error('Para guardar os dados no celular, saia e entre de novo nesta conferência (só desta vez).');
  }
  // sem_acesso: só confere a senha (Atualizar os dados guardados); não é um login novo na aba "acessos".
  const r = await chamarCC(urlAtual(), 'entrar', {id_conferencia: s.id_conferencia, email: s.email, senha,
    sem_acesso: true});
  await guardarSessao(r, s.email, senha);
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

/**
 * Mostra ou esconde os campos de senha ligados a um botão de olho.
 * @param {!HTMLButtonElement} botao
 * @param {!Array<!HTMLInputElement>} campos
 * @param {boolean=} mostrar Sem ele, inverte.
 */
function alternarOlho(botao, campos, mostrar) {
  const ver = mostrar === undefined ? botao.getAttribute('aria-pressed') !== 'true' : mostrar;
  campos.forEach((campo) => {
    campo.type = ver ? 'text' : 'password';
  });
  const plural = campos.length > 1 ? 'as senhas' : 'a senha';
  botao.setAttribute('aria-pressed', String(ver));
  botao.setAttribute('aria-label', (ver ? 'Esconder ' : 'Mostrar ') + plural);
  botao.querySelector('[data-olho="aberto"]').toggleAttribute('hidden', ver);
  botao.querySelector('[data-olho="fechado"]').toggleAttribute('hidden', !ver);
}

/** Volta a esconder todas as senhas (depois de entrar). */
function esconderSenhas() {
  alternarOlho(el.btnOlhoEntrar, [el.iptSenha], false);
  alternarOlho(el.btnOlhoSenha, [el.iptSenhaNova, el.iptSenhaConfirma], false);
}

/**
 * Mostra ou esconde o aviso de senhas diferentes, logo abaixo da confirmação
 * (o aviso do pé do painel fica sob o teclado do celular).
 * @param {boolean} mostrar true: mostra o aviso se as senhas forem diferentes.
 *     false: só esconde o aviso, se elas ficaram iguais (não avisa no meio da digitação).
 * @return {boolean} true se as senhas são iguais.
 */
function conferirSenhas(mostrar) {
  const confirma = el.iptSenhaConfirma.value;
  const iguais = el.iptSenhaNova.value === confirma;
  const avisoNaTela = !el.erroSenhaConfirma.hidden;
  const comErro = !iguais && confirma !== '' && (mostrar || avisoNaTela);
  el.erroSenhaConfirma.hidden = !comErro;
  el.iptSenhaConfirma.toggleAttribute('aria-invalid', comErro);
  return iguais;
}

function criarSenha() {
  if (!conferirSenhas(true)) {
    el.iptSenhaConfirma.focus();
    el.erroSenhaConfirma.scrollIntoView({block: 'center', behavior: prefs.reduzirAnimacoes ? 'auto' : 'smooth'});
    return Promise.resolve();
  }
  return ocupado(el.btnCriarSenha, async () => {
    const email = el.iptEmail.value.trim();
    const senha = el.iptSenhaNova.value;
    const r = await chamarCC(urlAtual(), 'criar_senha', {id_conferencia: estado.escolha.cf, ...doAparelho(),
      email, codigo: el.iptCodigo.value.trim(), senha_nova: senha});
    await lembrarLogin(estado.escolha.cf, email, senha, r.perfil && r.perfil.nome_exibicao);
    await guardarSessao(r, email, senha);
  });
}

/**
 * @param {{token: string, perfil: !Object}} resposta
 * @param {string} email Fica na sessão, para conferir a senha depois sem pedir o e-mail de novo.
 * @param {string} senha Não é guardada: só vai para aoEntrarComSenha (abre o cofre dos dados guardados).
 */
async function guardarSessao(resposta, email, senha) {
  const cf = estado.escolha.cf;
  const idAcesso = resposta.id_acesso || (estado.sessoes[cf] && estado.sessoes[cf].id_acesso) || '';
  estado.sessoes[cf] = {token: resposta.token, perfil: resposta.perfil || {}, cm: estado.escolha.cm, id_acesso: idAcesso,
    cc: estado.escolha.cc, email, entrou_em: new Date().toISOString()};
  await salvarSessoes();
  if (estado.aoEntrarComSenha) {
    await estado.aoEntrarComSenha(cf, senha);
  }
  el.iptSenha.value = '';
  el.iptSenhaNova.value = '';
  el.iptSenhaConfirma.value = '';
  conferirSenhas(false);
  esconderSenhas();
  el.iptCodigo.value = '';
  await atualizarBarra();
  abrirPainel(false);
  if (estado.aoConectar) {
    estado.aoConectar(sessaoAtual());
  }
}

/**
 * "Perdi um celular" (19/11/2026): o servidor encerra a sessão em todos os aparelhos (sessao_versao + 1), inclusive
 * neste. O perdido, ao usar a internet, recebe "sessão terminou" e apaga os dados guardados.
 */
function sairDeTodos() {
  if (!window.confirm('Sair desta conferência em todos os aparelhos, inclusive neste? Depois, entre de novo aqui.')) {
    return Promise.resolve();
  }
  return ocupado(el.btnSairTodos, async () => {
    await chamarComSessao('sair_de_todos');
    await sair();
    mensagem('Pronto: você saiu em todos os aparelhos. O celular perdido sai na próxima vez que usar a internet. ' +
      'Entre de novo neste.', 'sucesso');
  });
}

/** Para a aba "acessos" do índice: o tipo de aparelho (sem mais nada dele) e a versão do app. @return {!Object} */
function doAparelho() {
  const ua = navigator.userAgent;
  const aparelho = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad' :
    /iPhone|iPod/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : 'Computador';
  const versao = ((document.getElementById('versaoApp') || {}).textContent || '').replace(/^v/, '');
  return {aparelho, versao_app: /^\d/.test(versao) ? versao : ''};
}

async function sair() {
  const cf = estado.escolha.cf;
  const s = estado.sessoes[cf];
  // A linha deste login na aba "acessos" ganha a saída. Sem internet ou demorando, sai assim mesmo.
  if (s && s.token && navigator.onLine) {
    await Promise.race([
      chamarCC(urlAtual(), 'sair', {id_conferencia: cf, token: s.token, id_acesso: s.id_acesso || ''}).catch(() => 0),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  }
  delete estado.sessoes[cf];
  await salvarSessoes();
  if (estado.aoEncerrarSessao) {
    await estado.aoEncerrarSessao(cf);
  }
  await atualizarBarra();
  mostrarAreaDaEscolha();
  mensagem('Você saiu desta conferência neste celular.', 'info');
  if (estado.aoConectar) {
    estado.aoConectar(null);
  }
}

/**
 * Botão Sair da barra inferior: sai da conferência atual e abre o painel.
 * @return {!Promise<boolean>} false se não havia ninguém conectado.
 */
export async function sairDaConferencia() {
  if (!sessaoAtual()) {
    return false;
  }
  await sair();
  abrirPainel(true);
  return true;
}

/** Abre o painel de conexão (para a casca e as telas). */
/** @return {boolean} Na tela "Como o app guarda e envia" (abre sem login). */
const naAjuda = () => location.hash.startsWith('#como-funciona');

export function abrirPainelConexao() {
  if (!el.painelConexao) {
    return; // ainda montando: iniciarBarraConexao abre o painel se não houver sessão
  }
  abrirPainel(true);
  el.painelConexao.scrollIntoView({block: 'nearest'});
}

/** Barra superior: conferência escolhida e quem entrou. */
async function atualizarBarra() {
  const titulo = document.getElementById('lblConfName');
  const sub = document.getElementById('lblConfSub');
  const cf = estado.escolha.cf;
  if (!titulo || !sub) {
    return;
  }
  if (!cf) {
    const pillDev = document.getElementById('pillDev');
    if (pillDev) {
      pillDev.hidden = true;
    }
    titulo.textContent = 'Escolha a conferência';
    sub.textContent = 'Toque aqui para conectar';
    return;
  }
  const s = estado.sessoes[cf];
  const cp = estado.lista && estado.lista.conselhos_particulares.find((x) => x.sigla === estado.escolha.cp);
  titulo.textContent = nomeConferencia(cf);
  // Acesso DEV (Dev.gs): a etiqueta vermelha mostra que está com todas as permissões.
  const pillDev = document.getElementById('pillDev');
  if (pillDev) {
    pillDev.hidden = !(s && s.perfil && s.perfil.dev);
  }
  if (s) {
    const nome = s.perfil && s.perfil.nome_exibicao ? s.perfil.nome_exibicao : 'vicentino(a)';
    sub.textContent = (cp ? cp.nome + ' • ' : '') + nome;
  } else {
    sub.textContent = 'Toque aqui para entrar';
  }
}
