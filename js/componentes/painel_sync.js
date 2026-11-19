/**
 * @fileoverview Botão Nuvem (barra inferior) e a aba "Para enviar" (gaveta superior).
 * Decisões: mvp/telas/05_sincronizacao.md (14/11/2026; "Para enviar" e "Enviar: quando eu mandar" em 17/11/2026).
 *
 * Botão Nuvem, entre Menu e Falar. Diz se dá para fechar o app tranquilo:
 * - tudo enviado: nuvem com ✓ verde, "Enviado";
 * - mudanças esperando: contorno de nuvem com seta, "Enviar 3". Com "na hora", pulsa só se há internet e o
 *   envio automático pode acontecer; com "quando eu mandar", é o normal e não pulsa;
 * - enviando: nuvem com seta subindo, "Enviando";
 * - alguma não aceita: nuvem com ! vermelha, "Ver", pulsando.
 * Tocar abre a aba. Com "na hora" e internet, já envia; com "quando eu mandar", abre para conferir antes.
 * Nos dados móveis com "só Wi-Fi", pergunta antes de enviar.
 *
 * Aba "Para enviar": as não aceitas no topo (com o motivo: Tentar de novo, Abrir, Desfazer), cada mudança numa
 * linha com Desfazer, o botão "Enviar tudo" e, quando não há nada, "Tudo enviado hoje às 14:32".
 */

import * as db from '../core/db.js';
import * as sync from '../core/sync.js';
import {prefs, tipoDeRede, vibrar} from '../core/preferencias.js';
import {abrirGaveta, avisar, fecharGaveta} from '../casca.js';
import {iconeSync, textoDoEstado} from './icone_sync.js';
import {mostrarCarregando} from './carregando.js';
import {chamarComSessao, nomeConferencia, sessaoAtual} from './barra_conexao.js';
import * as uso from '../core/uso.js';

/** Tipos de item que abrem a família (os outros abrem a pessoa). */
const DA_FAMILIA = ['familia', 'visita'];

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

/** A aba foi aberta (pelo ⋮ ou pelo botão): redesenha (as horas mudam). */
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

/** @return {number} Mudanças esperando (sem as não aceitas). */
const pendentes = () => estado.itens.filter((i) => i.estado !== sync.ESTADOS.RECUSADO).length;

/** @return {string} O botão de baixo da aba: "Enviar tudo (3)" ou, sem nada esperando, "Buscar as listas de novo". */
function rotuloDoBotao() {
  const n = pendentes();
  return n ? `Enviar tudo (${n})` : 'Buscar as listas de novo';
}

/**
 * "Enviar tudo" e o toque no Nuvem: envia (mesmo nos dados móveis, depois de perguntar) e baixa as listas.
 * @param {boolean=} confirmado A pessoa já respondeu "Enviar agora".
 */
export async function sincronizarAgora(confirmado = false) {
  if (!navigator.onLine) {
    avisar('Sem internet: as mudanças continuam guardadas no celular.');
    return;
  }
  if (!confirmado && pendentes() && dadosMoveisComSoWifi()) {
    estado.perguntando = true;
    desenhar();
    return;
  }
  estado.perguntando = false;
  const botao = $('btnSincronizar');
  const enviando = pendentes() > 0;
  botao.disabled = true;
  mostrarCarregando(botao, enviando ? 'Enviando' : 'Buscando', enviando ? 'enviar' : 'baixar');
  let motivo;
  try {
    motivo = await sync.enviar({manual: true});
    // Sem nada na fila, o resumo de uso do app (uso.js) vai sozinho.
    if (uso.temPendente() && sessaoAtual()) {
      await chamarComSessao('registrar_uso').catch(() => 0);
    }
  } finally {
    botao.disabled = false;
  }
  sync.pedirListas();
  await atualizar();
  const restantes = pendentes();
  if (motivo === 'vazia' && restantes) {
    avisar('Entre na conferência para enviar as mudanças guardadas.');
  } else if (restantes) {
    avisar(restantes === 1 ? 'Ainda falta enviar 1 mudança.' : `Ainda falta enviar ${restantes} mudanças.`);
  } else {
    avisar(motivo === 'vazia' ? 'Nada para enviar. Buscando as listas.' : 'Tudo enviado.');
  }
}

/**
 * A última ação das Opções de Pessoas e Famílias (17/11/2026). Com mudanças esperando nesta conferência:
 * "Sincronizar", em destaque e com o número: envia e busca a lista inteira de novo. Sem nenhuma: "Atualizar a
 * lista", sem destaque: só busca (pega também o que foi mudado à mão na planilha).
 * @param {!Array<!Object>} fila sync.itens()
 * @param {string} conferencia
 * @param {function()} buscarLista Baixa a lista inteira da tela.
 * @return {{texto: string, destaque: boolean, contador: number, rotulo: string, aoTocar: function()}}
 */
export function acaoSincronizar(fila, conferencia, buscarLista) {
  const n = fila.filter((i) => i.conferencia === conferencia && sync.A_ENVIAR.includes(i.estado)).length;
  return {
    texto: n ? 'Sincronizar' : 'Atualizar a lista',
    destaque: n > 0,
    contador: n,
    rotulo: n ? `Sincronizar: enviar ${n === 1 ? '1 mudança' : n + ' mudanças'} e buscar a lista de novo` :
      'Atualizar a lista: buscar de novo na planilha',
    aoTocar: async () => {
      if (!navigator.onLine) {
        avisar('Sem internet agora: as mudanças continuam guardadas no celular.');
        return;
      }
      if (n) {
        await sync.enviar({manual: true});
      }
      buscarLista();
    },
  };
}

async function tocarNuvem() {
  vibrar(25);
  abrirGaveta('sincronizacao');
  // "Quando eu mandar": abre para conferir; quem envia é o "Enviar tudo".
  if (!sync.juntando() && pendentes() && navigator.onLine) {
    await sincronizarAgora();
  }
}

/** Toques dentro da aba (mudanças, não aceitas, pergunta dos dados móveis). @param {!Event} e */
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
    avisar('As mudanças vão quando o celular estiver no Wi-Fi.');
  } else if (acao === 'tentar') {
    await sync.tentarDeNovo(id);
  } else if (acao === 'desfazer') {
    const juntos = await sync.comDependentes(id);
    const extra = juntos.length > 1 ? ` Também saem ${juntos.length - 1} mudança(s) que dependem desta.` : '';
    if (window.confirm('Desfazer esta mudança? Ela é apagada do celular e não vai para a planilha.' + extra)) {
      await sync.descartar(id);
      avisar('Mudança desfeita.');
    }
  } else if (acao === 'abrir') {
    abrirItem(estado.itens.find((i) => i.id_operacao === id));
  } else if (acao === 'como-funciona') {
    fecharGaveta();
    location.hash = '#como-funciona';
  } else if (acao === 'mudar-envio') {
    abrirGaveta('configuracoes');
  }
}

/** Abre a pessoa ou a família do item (só na conferência escolhida agora). @param {?Object} item */
function abrirItem(item) {
  if (!item || !item.id_pessoa) {
    return;
  }
  const s = sessaoAtual();
  if (!s || s.id_conferencia !== item.conferencia) {
    avisar('Escolha a conferência ' + nomeConferencia(item.conferencia) + ' para abrir esta mudança.');
    return;
  }
  fecharGaveta();
  location.hash = (DA_FAMILIA.includes(item.tipo) ? '#familias/' : '#pessoas/') + encodeURIComponent(item.id_pessoa);
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
  const n = pendentes();
  if (recusados) {
    return {estado: 'recusado', rotulo: 'Ver', pulsa: true,
      texto: recusados === 1 ? '1 mudança não foi aceita e precisa de você. Toque para ver.' :
        `${recusados} mudanças não foram aceitas e precisam de você. Toque para ver.`};
  }
  if (sync.enviando()) {
    return {estado: 'enviando', rotulo: 'Enviando', pulsa: false, texto: 'Enviando para a planilha.'};
  }
  if (n) {
    const pode = navigator.onLine && !dadosMoveisComSoWifi();
    const texto = (n === 1 ? '1 mudança gravada no celular' : n + ' mudanças gravadas no celular') +
      (sync.juntando() ? ', esperando você mandar. Toque para conferir e enviar.' :
        pode ? ', falta enviar. Toque para enviar.' : navigator.onLine ? ', esperando o Wi-Fi.' :
          ', esperando a internet.');
    return {estado: 'local', rotulo: 'Enviar ' + n, pulsa: pode && !sync.juntando(), texto};
  }
  return {estado: 'confirmado', rotulo: 'Enviado', pulsa: false, texto: 'Tudo enviado para a planilha.'};
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

/** @param {string} iso @return {string} "hoje às 14:32" ou "em 13/11/2026 às 08:10". */
function quando(iso) {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
  return (new Date().toDateString() === d.toDateString() ? 'hoje' : 'em ' + d.toLocaleDateString('pt-BR')) +
    ' às ' + hora;
}

/** @param {!Object} i @return {string} HTML de uma mudança esperando. */
function linhaDoItem(i) {
  const detalhe = i.estado === sync.ESTADOS.LOCAL && i.ultimo_erro ? i.ultimo_erro : textoDoEstado(i.estado);
  const desfazer = i.estado === sync.ESTADOS.ENVIANDO ? '' :
    `<button type="button" class="btn-painel-desfazer" data-painel="desfazer" data-item="${esc(i.id_operacao)}"
      aria-label="Desfazer: ${esc(i.descricao || 'mudança')}">Desfazer</button>`;
  return `
    <li class="item-para-enviar">
      <button type="button" class="item-fila" data-painel="abrir" data-item="${esc(i.id_operacao)}">
        ${iconeSync(i.estado)}
        <span class="item-fila-texto"><span class="item-fila-nome">${esc(i.descricao || 'Mudança')}</span>
          <span class="item-fila-estado">${esc(detalhe)}</span></span>
      </button>
      ${desfazer}
    </li>`;
}

async function desenharPainel() {
  const painel = $('painelFila');
  if (!painel) {
    return;
  }
  const recusados = estado.itens.filter((i) => i.estado === sync.ESTADOS.RECUSADO);
  const esperando = estado.itens.filter((i) => i.estado !== sync.ESTADOS.RECUSADO);
  const partes = [`
    <p class="painel-ajuda"><button type="button" class="link-painel" data-painel="como-funciona">O que são esses ícones?</button></p>`];

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
        <span class="sheet-card-title painel-titulo-icone">${iconeSync('recusado')}<span>Não foi aceito: precisa de você</span></span>
        <ul class="lista-fila">${recusados.map((i) => `
          <li class="item-recusado">
            <p class="item-fila"><span class="item-fila-texto">
              <span class="item-fila-nome">${esc(i.descricao || 'Mudança')}</span>
              <span class="item-fila-estado">${esc(i.ultimo_erro || 'Sem motivo informado.')}</span></span></p>
            <div class="painel-acoes">
              <button type="button" class="btn-painel-secundario" data-painel="tentar" data-item="${esc(i.id_operacao)}">Tentar de novo</button>
              <button type="button" class="btn-painel-secundario" data-painel="abrir" data-item="${esc(i.id_operacao)}">Abrir</button>
              <button type="button" class="btn-painel-perigo" data-painel="desfazer" data-item="${esc(i.id_operacao)}">Desfazer</button>
            </div>
          </li>`).join('')}
        </ul>
      </div>`);
  }

  const conferencias = [...new Set(esperando.map((i) => i.conferencia))];
  if (esperando.length) {
    partes.push(`
      <div class="sheet-card-box">
        <span class="sheet-card-title">${esperando.length === 1 ? '1 mudança' : esperando.length + ' mudanças'} para enviar</span>
        ${conferencias.map((cf) => `
          ${conferencias.length > 1 ? `<span class="painel-subtitulo">${esc(nomeConferencia(cf))}</span>` : ''}
          <ul class="lista-fila">${esperando.filter((i) => i.conferencia === cf).map(linhaDoItem).join('')}</ul>`).join('')}
      </div>`);
  } else if (!recusados.length) {
    const ultimo = sync.ultimoEnvio();
    partes.push(`
      <p class="painel-texto painel-texto-icone painel-tudo-enviado">${iconeSync('confirmado')}<span>${
  ultimo ? 'Tudo enviado ' + esc(quando(ultimo)) + '.' : 'Nada para enviar.'}</span></p>`);
  }

  const s = sessaoAtual();
  const baixada = s ? await db.lerConfig('pessoas_atualizada:' + s.id_conferencia) : '';
  partes.push(`
    <p class="painel-rodape">Enviar: <strong>${sync.juntando() ? 'quando eu mandar' : 'na hora'}</strong>
      · <button type="button" class="link-painel" data-painel="mudar-envio">mudar</button>${
  baixada ? `<br>Listas buscadas ${esc(quando(baixada))}.` : ''}</p>`);

  painel.innerHTML = partes.join('');
  const botao = $('btnSincronizar');
  if (botao && !botao.disabled) {
    botao.textContent = rotuloDoBotao();
  }
}
