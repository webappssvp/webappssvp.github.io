/**
 * @fileoverview Folhinha de um item das listas (pessoa ou família), aberta pelo toque no par de ícones
 * (js/componentes/icone_sync.js). Mostra os dois lados e uma ação para cada um (decisão de 17/11/2026,
 * mvp/telas/05_sincronizacao.md):
 * - No celular: guardado em tal hora (Atualizar) ou não guardado (Guardar no celular). Precisa de internet e da
 *   senha (o cofre, js/core/cofre.js); o item que ainda não chegou à planilha só pode ser guardado depois.
 * - Na planilha: o estado na fila. Falta enviar: Enviar agora (a fila vai em ordem, então o que está antes vai
 *   junto). Recusado: Tentar de novo. O toque no ícone não age sozinho: em campo, um toque sem querer é comum.
 */

import {botaoDoItem, iconeCelular, iconeSync, textoDoCelular, textoDoEstado} from './icone_sync.js';
import {chamarComSessao, conferirSenha, sessaoAtual} from './barra_conexao.js';
import {campoSenha} from '../telas/comum.js';
import {vibrar} from '../core/preferencias.js';
import * as sync from '../core/sync.js';
import * as cofre from '../core/cofre.js';
import * as db from '../core/db.js';
import {avisarGuardados, buscarDetalhe, guardadosEm, guardar} from '../telas/pessoa_dados.js';
import {buscarDetalheFamilia, guardarFamilia} from '../telas/familia_dados.js';
import {montarBlocoMudanca} from './bloco_mudanca.js';

export {botaoDoItem};

/** Gravidade do estado na fila (o pior manda no ícone). */
const GRAVIDADE = {confirmado: 0, enviando: 1, local: 2, sem_confirmacao: 3, recusado: 4};

/** @param {*} t @return {string} */
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  '\'': '&#39;'}[c]));

/** @param {string} t @return {string} Com ponto final (sem repetir o da mensagem do servidor). */
const frase = (t) => (/[.!?]$/.test(t) ? t : t + '.');

/** @param {string} tipo @return {string} */
const storeDe = (tipo) => (tipo === 'familia' ? db.STORES.DETALHES_FAMILIAS : db.STORES.DETALHES);

/**
 * Para as listas: quando cada item foi guardado no celular.
 * @param {string} cf
 * @param {string} tipo "pessoa" ou "familia".
 * @return {!Promise<!Object<string, string>>} id -> hora (ISO).
 */
export const guardadosDaLista = (cf, tipo) => guardadosEm(cf, storeDe(tipo));

/** O item aberto: {tipo, id, nome, cf}, a mensagem e se pede a senha. */
const aberta = {item: null, msg: '', erro: false, pedindoSenha: false, guardando: false};

let voltarPara = null;

/** @return {!HTMLElement} */
function $gaveta() {
  let g = document.getElementById('scrimItem');
  if (!g) {
    g = document.createElement('div');
    g.className = 'scrim-overlay-bottom';
    g.id = 'scrimItem';
    g.innerHTML = '<div class="bottom-sheet gaveta-origem gaveta-item" role="dialog" aria-modal="true" ' +
      'aria-labelledby="tituloItem"></div>';
    g.addEventListener('click', tocar);
    g.addEventListener('submit', enviarSenha);
    document.body.appendChild(g);
  }
  return g;
}

function fechar() {
  const g = document.getElementById('scrimItem');
  if (g) {
    g.classList.remove('aberto');
  }
  aberta.item = null;
  if (voltarPara && document.contains(voltarPara)) {
    voltarPara.focus();
  }
  voltarPara = null;
}

/** @return {!Promise<!Array<!Object>>} Os itens da fila deste item. */
async function daFila() {
  const {cf, id} = aberta.item;
  return (await sync.itens()).filter((i) => i.conferencia === cf && i.id_pessoa === id);
}

/** @return {boolean} Pode ver contatos (decifra endereço e relatos) ao guardar. */
function veContatos() {
  const s = sessaoAtual();
  const perfil = (s && s.perfil) || {};
  return (perfil.permissoes || []).includes('CONTATOS_VER') ||
    (aberta.item.tipo === 'pessoa' && perfil.id_pessoa === aberta.item.id);
}

async function desenhar() {
  const item = aberta.item;
  if (!item) {
    return;
  }
  const fila = await daFila();
  const pior = fila.reduce((p, i) => (GRAVIDADE[i.estado] > GRAVIDADE[p] ? i.estado : p), 'confirmado');
  const motivo = (fila.find((i) => i.estado === 'recusado') || {}).ultimo_erro || '';
  const guardadoEm = (await guardadosEm(item.cf, storeDe(item.tipo)))[item.id] || '';
  if (!aberta.item || aberta.item !== item) {
    return; // fechou ou abriu outro enquanto lia
  }
  const provisorio = sync.ehProvisorio(item.id);
  let celular = '';
  if (aberta.guardando) {
    celular = '<p class="detalhe-nota">Guardando…</p>';
  } else if (provisorio) {
    celular = '<p class="detalhe-nota">Dá para guardar depois que a planilha confirmar o cadastro.</p>';
  } else if (aberta.pedindoSenha) {
    celular = `
      <form class="form-senha-offline" data-item-senha novalidate>
        ${campoSenha('iptSenhaItem', 'Sua senha (a mesma com que você entra no app)')}
        <button type="submit" class="btn-submit">${guardadoEm ? 'Atualizar' : 'Guardar no celular'}</button>
      </form>`;
  } else {
    celular = `<button type="button" class="btn-secundario" data-item-acao="guardar">${
      guardadoEm ? 'Atualizar' : 'Guardar no celular'}</button>`;
  }
  let planilha = '';
  if (pior === 'local' || pior === 'sem_confirmacao') {
    // Com "quando eu mandar", o Enviar agora leva todas as que esperam (é o mesmo "Enviar tudo" da Nuvem).
    planilha = `<button type="button" class="btn-secundario" data-item-acao="enviar">Enviar agora</button>
      <p class="detalhe-nota">${sync.juntando() ? 'Envia todas as mudanças que estão esperando.' :
    'A fila vai em ordem: o que foi gravado antes vai junto.'}</p>`;
  } else if (pior === 'recusado') {
    planilha = '<button type="button" class="btn-secundario" data-item-acao="tentar">Tentar de novo</button>';
  }
  const folha = $gaveta().querySelector('.gaveta-item');
  // Com mudança sua esperando, o lado da planilha vira a comparação (qual vale: a sua ou a da planilha), em cima.
  const ladoPlanilha = fila.length ? '<div class="item-lado" data-folha-mudanca></div>' : `
      <section class="item-lado">
        <h3 class="origem-secao">${iconeSync(pior, motivo)}Na planilha</h3>
        <p class="item-lado-texto">${esc(frase(textoDoEstado(pior, motivo)))}</p>
        ${planilha}
      </section>`;
  folha.innerHTML = `
    <div class="origem-topo">
      <h2 class="origem-titulo" id="tituloItem">${esc(item.nome)}</h2>
      <button type="button" class="origem-fechar" data-item-fechar aria-label="Fechar">✕</button>
    </div>
    <div class="origem-corpo">
      ${fila.length ? ladoPlanilha : ''}
      <section class="item-lado">
        <h3 class="origem-secao">${iconeCelular(guardadoEm)}No celular</h3>
        <p class="item-lado-texto">${esc(frase(textoDoCelular(guardadoEm)))}</p>
        <p class="detalhe-nota">${guardadoEm ? 'Abre mesmo sem internet.' : 'Sem internet, não abre.'}</p>
        ${celular}
      </section>
      ${fila.length ? '' : ladoPlanilha}
      ${aberta.msg ? `<p class="feedback-msg${aberta.erro ? ' erro' : ''}" role="status">${esc(aberta.msg)}</p>` : ''}
      <p class="item-o-que-e"><a class="link-painel" href="#como-funciona" data-item-fechar>O que são esses ícones?</a></p>
    </div>
    <div class="origem-botoes">
      <a class="btn-secundario btn-link" href="#${item.tipo === 'familia' ? 'familias' : 'pessoas'}/${
  encodeURIComponent(item.id)}" data-item-fechar>Abrir</a>
      <button type="button" class="btn-submit" data-item-fechar>Fechar</button>
    </div>`;
  const lugar = folha.querySelector('[data-folha-mudanca]');
  if (lugar) {
    montarBlocoMudanca(lugar, item);
  }
  const campo = folha.querySelector('#iptSenhaItem');
  if (campo) {
    campo.focus();
  }
}

/** @param {string} texto @param {boolean=} erro */
function avisar(texto, erro = false) {
  aberta.msg = texto;
  aberta.erro = erro;
  desenhar();
}

/** Busca o item no servidor e guarda cifrado no celular (o cofre já está aberto). */
async function guardarAgora() {
  const item = aberta.item;
  aberta.guardando = true;
  aberta.msg = '';
  desenhar();
  try {
    const chamar = (acao, d) => chamarComSessao(acao, d);
    if (item.tipo === 'familia') {
      await guardarFamilia(item.cf, item.id, await buscarDetalheFamilia(item.id, chamar, veContatos()));
    } else {
      const dados = await buscarDetalhe(item.id, chamar, veContatos());
      if (!dados) {
        throw new Error('Esta pessoa não está mais ativa na planilha.');
      }
      await guardar(item.cf, item.id, dados);
    }
    aberta.guardando = false;
    avisarGuardados(item.cf, [item.id]);
    avisar('Guardado. Abre mesmo sem internet.');
  } catch (erro) {
    aberta.guardando = false;
    avisar(erro.message || 'Não deu para guardar agora.', true);
  }
}

/** @param {!Event} e */
async function tocar(e) {
  const g = document.getElementById('scrimItem');
  if (e.target === g || e.target.closest('[data-item-fechar]')) {
    fechar();
    return;
  }
  const acao = e.target.closest('[data-item-acao]');
  if (!acao || !aberta.item) {
    return;
  }
  vibrar();
  const {cf} = aberta.item;
  if (acao.dataset.itemAcao === 'guardar') {
    if (!navigator.onLine) {
      avisar('Sem internet agora: para guardar, conecte-se.', true);
      return;
    }
    await cofre.restaurar(cf);
    if (!cofre.aberto(cf)) {
      aberta.pedindoSenha = true;
      aberta.msg = '';
      desenhar();
      return;
    }
    guardarAgora();
  } else if (acao.dataset.itemAcao === 'enviar') {
    if (!navigator.onLine) {
      avisar('Sem internet agora: vai sozinho quando o celular se conectar.', true);
      return;
    }
    aberta.msg = 'Enviando…';
    aberta.erro = false;
    const motivo = await sync.enviar({manual: true});
    avisar(motivo === 'sem_internet' ? 'Sem internet agora: vai sozinho quando o celular se conectar.' : '');
  } else if (acao.dataset.itemAcao === 'tentar') {
    for (const i of (await daFila()).filter((x) => x.estado === 'recusado')) {
      await sync.tentarDeNovo(i.id_operacao);
    }
    avisar('');
  }
}

/** A senha é conferida no servidor (entra de novo); certa, abre o cofre e guarda. @param {!Event} e */
async function enviarSenha(e) {
  if (!e.target.closest('[data-item-senha]')) {
    return;
  }
  e.preventDefault();
  const campo = e.target.querySelector('#iptSenhaItem');
  if (!campo.value) {
    avisar('Digite a sua senha.', true);
    return;
  }
  const senha = campo.value;
  campo.value = '';
  try {
    await conferirSenha(senha); // abre (ou refaz) o cofre
    aberta.pedindoSenha = false;
    guardarAgora();
  } catch (erro) {
    avisar(erro.message, true);
  }
}

/** @param {!HTMLElement} botao O .botao-item tocado. */
function abrir(botao) {
  const s = sessaoAtual();
  if (!s) {
    return;
  }
  voltarPara = botao;
  Object.assign(aberta, {item: {tipo: botao.dataset.itemTipo, id: botao.dataset.itemId, nome: botao.dataset.itemNome,
    cf: s.id_conferencia}, msg: '', erro: false, pedindoSenha: false, guardando: false});
  $gaveta().classList.add('aberto');
  desenhar().then(() => {
    const fecharBotao = $gaveta().querySelector('.origem-fechar');
    if (fecharBotao && !$gaveta().querySelector('#iptSenhaItem')) {
      fecharBotao.focus();
    }
  });
}

document.addEventListener('click', (e) => {
  const botao = e.target.closest('.botao-item');
  if (botao) {
    e.preventDefault();
    vibrar();
    abrir(botao);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && aberta.item) {
    fechar();
  }
});

// A fila mudou (enviou, confirmou, recusou): a folhinha aberta mostra o estado novo.
sync.eventos.addEventListener('mudou', () => {
  if (aberta.item && !aberta.pedindoSenha) {
    desenhar();
  }
});

// Mudou de tela (ex.: desfez um cadastro e voltou para a lista): a folhinha fecha.
window.addEventListener('hashchange', () => {
  if (aberta.item) {
    fechar();
  }
});
