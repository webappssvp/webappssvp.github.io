/**
 * @fileoverview Botão Nuvem (barra inferior) e aba Sincronização (gaveta superior).
 * Decisões: mvp/telas/05_sincronizacao.md (14/11/2026).
 *
 * Botão Nuvem, entre Menu e Falar. Diz se dá para fechar o app tranquilo:
 * - tudo enviado: nuvem com ✓ verde, "Enviado";
 * - itens guardados: banco de dados, "Enviar 3". Pulsa só se há internet e o envio automático pode
 *   acontecer (falha, sessão vencida). Sem internet, ou nos dados móveis com "só Wi-Fi", fica parado;
 * - enviando: nuvem com seta subindo, "Enviando";
 * - algum recusado: nuvem com ! vermelha, "Ver erro", pulsando.
 * Tocar abre a aba Sincronização e, com internet, já envia. Nos dados móveis com "só Wi-Fi", pergunta antes.
 *
 * Aba Sincronização: conexão, recusados (Tentar de novo, Abrir, Descartar), o que falta enviar (agrupado,
 * com o tamanho) e a última sincronização.
 */

import * as db from '../core/db.js';
import * as sync from '../core/sync.js';
import {prefs, tipoDeRede, vibrar} from '../core/preferencias.js';
import {abrirGaveta, avisar, fecharGaveta} from '../casca.js';
import {iconeSync, textoDoEstado} from './icone_sync.js';
import {mostrarCarregando} from './carregando.js';
import {nomeConferencia, sessaoAtual} from './barra_conexao.js';

/** Como cada tipo de item aparece no resumo ("2 cadastros, 1 edição"). */
const TIPOS = {
  cadastrar: ['cadastro', 'cadastros'],
  editar: ['edição', 'edições'],
  papel: ['mudança de papel', 'mudanças de papel'],
  desativar: ['desativação', 'desativações'],
  visita: ['visita', 'visitas'],
};

const estado = {
  itens: [],
  perguntando: false, // nos dados móveis com "só Wi-Fi": esperando a resposta
};

const $ = (id) => document.getElementById(id);

/** @param {string} texto @return {string} */
const esc = (texto) => String(texto).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  '\'': '&#39;'}[c]));

/** Liga o botão e a aba. Chamar depois de iniciarCasca. */
export function iniciarPainelSync() {
  $('btnFooterNuvem').addEventListener('click', tocarNuvem);
  $('painelFila').addEventListener('click', tocarNoPainel);
  sync.eventos.addEventListener('mudou', atualizar);
  sync.eventos.addEventListener('confirmado', atualizar);
  window.addEventListener('online', desenhar);
  window.addEventListener('offline', desenhar);
  atualizar();
}

/** A aba Sincronização foi aberta (pelo ⋮ ou pelo botão): redesenha (as horas mudam). */
export function aoAbrirAba() {
  atualizar();
}

async function atualizar() {
  estado.itens = await sync.itens();
  desenhar();
}

// ---------------------------------------------------------------------------
// Enviar
// ---------------------------------------------------------------------------

/** @return {boolean} Nos dados móveis com "só Wi-Fi" (onde o navegador informa a rede). */
function dadosMoveisComSoWifi() {
  const rede = tipoDeRede();
  return Boolean(prefs.somenteWifi && rede && rede !== 'wifi' && rede !== 'ethernet');
}

/**
 * "Sincronizar agora" e o toque no Nuvem: envia (mesmo nos dados móveis, depois de perguntar) e baixa as listas.
 * @param {boolean=} confirmado A pessoa já respondeu "Enviar agora".
 */
export async function sincronizarAgora(confirmado = false) {
  if (!navigator.onLine) {
    avisar('Sem internet: os itens continuam guardados no celular.');
    return;
  }
  if (!confirmado && dadosMoveisComSoWifi()) {
    estado.perguntando = true;
    desenhar();
    return;
  }
  estado.perguntando = false;
  const botao = $('btnSincronizar');
  botao.disabled = true;
  mostrarCarregando(botao, 'Sincronizando', 'enviar'); // nuvem com a seta subindo, animada
  let motivo;
  try {
    motivo = await sync.enviar({manual: true});
  } finally {
    botao.disabled = false;
    botao.textContent = 'Sincronizar agora';
  }
  sync.pedirListas();
  const restantes = (await sync.itens()).filter((i) => i.estado !== sync.ESTADOS.RECUSADO).length;
  if (motivo === 'vazia' && restantes) {
    avisar('Entre na conferência para enviar os itens guardados.');
  } else if (restantes) {
    avisar(restantes === 1 ? 'Ainda falta enviar 1 item.' : `Ainda falta enviar ${restantes} itens.`);
  } else {
    avisar(motivo === 'vazia' ? 'Nada para enviar. Buscando as listas.' : 'Tudo enviado.');
  }
}

async function tocarNuvem() {
  vibrar(25);
  abrirGaveta('sincronizacao');
  if (estado.itens.some((i) => i.estado !== sync.ESTADOS.RECUSADO) && navigator.onLine) {
    await sincronizarAgora();
  }
}

/** Toques dentro da aba (itens, recusados, pergunta dos dados móveis). @param {!Event} e */
async function tocarNoPainel(e) {
  const alvo = e.target.closest('[data-painel]');
  if (!alvo) {
    return;
  }
  vibrar();
  const acao = alvo.dataset.painel;
  const id = alvo.dataset.item || '';
  if (acao === 'enviar-agora') {
    await sincronizarAgora(true);
  } else if (acao === 'esperar-wifi') {
    estado.perguntando = false;
    desenhar();
    avisar('Os itens vão quando o celular estiver no Wi-Fi.');
  } else if (acao === 'tentar') {
    await sync.tentarDeNovo(id);
  } else if (acao === 'descartar') {
    const juntos = await sync.comDependentes(id);
    const extra = juntos.length > 1 ? ` Também saem ${juntos.length - 1} mudança(s) que dependem desta.` : '';
    if (window.confirm('Descartar esta mudança? Ela é apagada do celular e não vai para a nuvem.' + extra)) {
      await sync.descartar(id);
      avisar('Mudança descartada.');
    }
  } else if (acao === 'abrir') {
    abrirItem(estado.itens.find((i) => i.id_operacao === id));
  }
}

/** Abre a pessoa do item (só na conferência escolhida agora). @param {?Object} item */
function abrirItem(item) {
  if (!item || !item.id_pessoa) {
    return;
  }
  const s = sessaoAtual();
  if (!s || s.id_conferencia !== item.conferencia) {
    avisar('Escolha a conferência ' + nomeConferencia(item.conferencia) + ' para abrir este item.');
    return;
  }
  fecharGaveta();
  location.hash = '#pessoas/' + encodeURIComponent(item.id_pessoa);
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

function desenhar() {
  desenharBotao();
  desenharPainel();
}

/** @return {{estado: string, rotulo: string, pulsa: boolean, texto: string}} Situação do botão Nuvem. */
function situacaoDoBotao() {
  const recusados = estado.itens.filter((i) => i.estado === sync.ESTADOS.RECUSADO).length;
  const pendentes = estado.itens.length - recusados;
  if (recusados) {
    return {estado: 'recusado', rotulo: 'Ver erro', pulsa: true,
      texto: recusados === 1 ? 'A nuvem recusou 1 item. Toque para ver.' : `A nuvem recusou ${recusados} itens. Toque para ver.`};
  }
  if (sync.enviando()) {
    return {estado: 'enviando', rotulo: 'Enviando', pulsa: false, texto: 'Enviando para a nuvem.'};
  }
  if (pendentes) {
    const pode = navigator.onLine && !dadosMoveisComSoWifi();
    return {estado: 'local', rotulo: 'Enviar ' + pendentes, pulsa: pode,
      texto: (pendentes === 1 ? '1 item guardado no celular' : pendentes + ' itens guardados no celular') +
        (pode ? ', falta enviar. Toque para enviar.' : navigator.onLine ? ', esperando o Wi-Fi.' : ', esperando a internet.')};
  }
  return {estado: 'confirmado', rotulo: 'Enviado', pulsa: false, texto: 'Tudo enviado para a nuvem.'};
}

function desenharBotao() {
  const botao = $('btnFooterNuvem');
  if (!botao) {
    return;
  }
  const s = situacaoDoBotao();
  $('iconeNuvem').innerHTML = iconeSync(s.estado);
  $('lblNuvem').textContent = s.rotulo;
  botao.setAttribute('aria-label', s.texto);
  botao.title = s.texto;
  botao.classList.toggle('pulsando', s.pulsa);
  botao.dataset.estado = s.estado;
}

/** @param {string} iso @return {string} "hoje às 14:32" ou "13/11/2026 às 08:10". */
function quando(iso) {
  if (!iso) {
    return 'ainda não';
  }
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
  return (new Date().toDateString() === d.toDateString() ? 'hoje' : d.toLocaleDateString('pt-BR')) + ' às ' + hora;
}

/** @param {number} bytes @return {string} */
function tamanhoLegivel(bytes) {
  return bytes < 1024 ? bytes + ' bytes' : Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

/** @param {!Array<!Object>} itens @return {string} "2 cadastros, 1 edição" */
function resumoPorTipo(itens) {
  const conta = {};
  itens.forEach((i) => {
    conta[i.tipo] = (conta[i.tipo] || 0) + 1;
  });
  return Object.keys(conta).map((t) => {
    const nomes = TIPOS[t] || ['mudança', 'mudanças'];
    return conta[t] + ' ' + (conta[t] === 1 ? nomes[0] : nomes[1]);
  }).join(', ');
}

/** @param {!Object} i @return {string} HTML de um item da fila. */
function linhaDoItem(i) {
  const detalhe = i.estado === sync.ESTADOS.LOCAL && i.ultimo_erro ? i.ultimo_erro : textoDoEstado(i.estado);
  return `
    <li><button type="button" class="item-fila" data-painel="abrir" data-item="${esc(i.id_operacao)}">
      ${iconeSync(i.estado)}
      <span class="item-fila-texto"><span class="item-fila-nome">${esc(i.descricao || 'Mudança')}</span>
        <span class="item-fila-estado">${esc(detalhe)}</span></span>
    </button></li>`;
}

async function desenharPainel() {
  const painel = $('painelFila');
  if (!painel) {
    return;
  }
  const recusados = estado.itens.filter((i) => i.estado === sync.ESTADOS.RECUSADO);
  const pendentes = estado.itens.filter((i) => i.estado !== sync.ESTADOS.RECUSADO);
  const partes = [];

  if (estado.perguntando) {
    partes.push(`
      <div class="sheet-card-box card-pergunta" role="alertdialog" aria-label="Enviar nos dados móveis?">
        <span class="sheet-card-title">📶 Dados móveis</span>
        <p class="painel-texto">Você está nos dados móveis. Enviar mesmo assim?</p>
        <div class="painel-acoes">
          <button type="button" class="btn-acao-gaveta" data-painel="enviar-agora">Enviar agora</button>
          <button type="button" class="btn-painel-secundario" data-painel="esperar-wifi">Esperar o Wi-Fi</button>
        </div>
      </div>`);
  }

  if (recusados.length) {
    partes.push(`
      <div class="sheet-card-box card-recusados">
        <span class="sheet-card-title">⚠️ A nuvem recusou</span>
        <ul class="lista-fila">${recusados.map((i) => `
          <li class="item-recusado">
            <p class="item-fila">${iconeSync('recusado')}<span class="item-fila-texto">
              <span class="item-fila-nome">${esc(i.descricao || 'Mudança')}</span>
              <span class="item-fila-estado">${esc(i.ultimo_erro || 'Sem motivo informado.')}</span></span></p>
            <div class="painel-acoes">
              <button type="button" class="btn-painel-secundario" data-painel="tentar" data-item="${esc(i.id_operacao)}">Tentar de novo</button>
              <button type="button" class="btn-painel-secundario" data-painel="abrir" data-item="${esc(i.id_operacao)}">Abrir</button>
              <button type="button" class="btn-painel-perigo" data-painel="descartar" data-item="${esc(i.id_operacao)}">Descartar</button>
            </div>
          </li>`).join('')}
        </ul>
      </div>`);
  }

  const bytes = pendentes.reduce((n, i) => n + sync.tamanho(i), 0);
  const conferencias = [...new Set(pendentes.map((i) => i.conferencia))];
  partes.push(`
    <div class="sheet-card-box">
      <span class="sheet-card-title">📦 Para enviar</span>
      ${pendentes.length ? `
        <p class="painel-texto"><strong>${pendentes.length === 1 ? '1 item' : pendentes.length + ' itens'} para enviar</strong>
          · ${esc(tamanhoLegivel(bytes))}<br>${esc(resumoPorTipo(pendentes))}</p>
        ${conferencias.map((cf) => `
          ${conferencias.length > 1 ? `<span class="painel-subtitulo">${esc(nomeConferencia(cf))}</span>` : ''}
          <ul class="lista-fila">${pendentes.filter((i) => i.conferencia === cf).map(linhaDoItem).join('')}</ul>`).join('')}` :
    `<p class="painel-texto painel-texto-icone">${iconeSync('confirmado')}<span>Nada para enviar: o que foi gravado neste celular já está na nuvem.</span></p>`}
    </div>`);

  const s = sessaoAtual();
  const baixada = s ? await db.lerConfig('pessoas_atualizada:' + s.id_conferencia) : '';
  partes.push(`
    <div class="sheet-card-box">
      <span class="sheet-card-title">🕒 Última sincronização</span>
      <div class="sheet-row"><span>Enviado:</span><strong>${esc(quando(sync.ultimoEnvio()))}</strong></div>
      <div class="sheet-row"><span>Lista baixada:</span><strong>${esc(s ? quando(baixada) : 'entre numa conferência')}</strong></div>
    </div>`);

  painel.innerHTML = partes.join('');
}
