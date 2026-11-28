/**
 * @fileoverview Início do app e roteador por #hash.
 * Cada tela (js/telas/*.js) exporta renderizar(area, sessao) e devolve o texto do modo Ouvir.
 * Arquitetura: mvp/arquitetura.md
 */

import {carregarPreferencias} from './core/preferencias.js';
import {siglaDoCargo} from './core/cargos.js';
import {iniciarBotaoVoz, definirLeitor} from './core/voz.js';
import {iniciarCasca, avisar, marcarTelaAtual} from './casca.js';
import {iniciarTutoriais} from './componentes/tutorial.js';
import {iniciarBarraConexao, sessaoAtual, sairDaConferencia, abrirPainelConexao, chamarNaConferencia,
  conferenciasComSessao, conferenciasGuardadas, esquecerSessoesGuardadas, salvarSessoes, trancarSessoesGuardadas,
} from './componentes/barra_conexao.js';
import * as trava from './core/trava.js';
import * as telaTrava from './componentes/tela_trava.js';
import * as sync from './core/sync.js';
import {iniciarPainelSync, sincronizarAgora, aoAbrirAba} from './componentes/painel_sync.js';
import * as cofre from './core/cofre.js';
import * as db from './core/db.js';
import {desbloquear} from './telas/pessoa_dados.js';
import * as pessoas from './telas/pessoas.js';
import * as familias from './telas/familias.js';
import * as visita from './telas/visita.js';
import * as visitas from './telas/visitas.js';
import * as importarPessoas from './telas/importar_pessoas.js';
import * as comoFunciona from './telas/como_funciona.js';
import * as sugestoes from './telas/sugestoes.js';
import * as sobre from './telas/sobre.js';
import * as cuidados from './telas/cuidados.js';
import * as consolidacao from './telas/consolidacao.js';
import * as aniversarios from './core/aniversarios.js';
import {eventosFamilias} from './telas/familia_dados.js';
import {ligarCompartilhar} from './componentes/compartilhar.js';
import {esc, voltar} from './telas/comum.js';
import * as uso from './core/uso.js';

/** Telas por #hash. Pessoas é a inicial (mvp/telas/02_pessoas.md). */
const TELAS = {
  '#como-funciona': comoFunciona, // "Como o app guarda e envia", o primeiro do menu (05_sincronizacao.md)
  '#pessoas': pessoas,
  '#vicentinos': pessoas, // endereço antigo
  '#familias': familias,
  '#visitas': visitas,
  '#visita': visita, // #visita/<id_familia>: registrar uma visita (06_visitas.md, etapa 1)
  '#cuidados': cuidados, // fichas de micro-hábitos para as visitas (23/11/2026)
  '#consolidacao': consolidacao, // números da conferência e dos conselhos, só a Diretoria (27/11/2026)
  '#importar': importarPessoas,
  '#sobre': sobre, // apresentação para quem ainda não usa, sem login (22/11/2026)
  '#sugestoes': sugestoes, // sugestões, opiniões e dúvidas para o CC (homologação, 19/11/2026)
};
const TELA_INICIAL = '#pessoas';

/** Altura real da tela em --vh (celulares sem svh/dvh, como o Moto Z 1). */
function ajustarAltura() {
  document.documentElement.style.setProperty('--vh', (window.innerHeight * 0.01) + 'px');
}

function desenharTela() {
  // "#pessoas/PES_000002": a tela é "#pessoas" e o resto ("PES_000002") vai para ela.
  const [base, ...resto] = location.hash.split('/');
  const hash = TELAS[base] ? base : TELA_INICIAL;
  const area = document.getElementById('areaConteudo');
  // Sem sessão, a barra inferior (Menu, Nuvem, Falar, Sair) fica escondida: não há o que usar antes de entrar.
  document.body.classList.toggle('sem-sessao', !sessaoAtual());
  mostrarItensDaDiretoria();
  const texto = TELAS[hash].renderizar(area, sessaoAtual(), TELAS[base] ? decodeURIComponent(resto.join('/')) : '');
  // A tela pode devolver uma função: o texto é montado na hora de ler (a lista pode chegar depois).
  definirLeitor(() => (typeof texto === 'function' ? texto() : texto));
  marcarTelaAtual(hash === '#vicentinos' ? '#pessoas' : hash === '#visita' ? '#visitas' : hash);
  area.scrollTop = 0;
}

/** "📊 Consolidação" no Menu só para quem pode ver (CONSOLIDACAO_VER: Diretoria da conferência ou de um conselho). */
function mostrarItensDaDiretoria() {
  const item = document.getElementById('itemConsolidacao');
  if (item) {
    const s = sessaoAtual();
    item.hidden = !(s && s.perfil && (s.perfil.permissoes || []).includes('CONSOLIDACAO_VER'));
  }
}

/**
 * Sair com itens na fila desta conferência: tenta enviar antes; se sobrar algo, pergunta (os dados ficam em claro
 * no celular, então saem junto; decisão de 14/11/2026).
 * @return {!Promise<boolean>} Se pode sair.
 */
async function confirmarSaidaComFila() {
  const s = sessaoAtual();
  if (!s || !(await sync.daConferencia(s.id_conferencia)).length) {
    return true;
  }
  if (navigator.onLine) {
    avisar('Enviando o que falta antes de sair…');
    await sync.enviar({manual: true});
  }
  const faltam = (await sync.daConferencia(s.id_conferencia)).length;
  if (!faltam) {
    return true;
  }
  const texto = (faltam === 1 ? 'Há 1 mudança que ainda não foi enviada.' :
    `Há ${faltam} mudanças que ainda não foram enviadas.`) +
    ' Se sair agora, eles se perdem. Sair mesmo assim?';
  if (!window.confirm(texto)) {
    return false;
  }
  await sync.apagarDaConferencia(s.id_conferencia);
  return true;
}

/**
 * Sair ou sessão vencida: o cofre (detalhes cifrados) e as listas sem cifra (pessoas, famílias) da conferência
 * saem do celular (arquitetura.md §5). A fila fica: ao sair, confirmarSaidaComFila já decidiu; com a sessão
 * vencida, ela espera a pessoa entrar de novo.
 * @param {string} cf
 */
async function apagarDadosDaConferencia(cf) {
  // As telas esquecem o que têm na memória: o próximo login baixa e guarda a lista de novo (22/11/2026).
  eventosFamilias.dispatchEvent(new CustomEvent('saiu', {detail: {conferencia: cf}}));
  await cofre.apagar(cf);
  try {
    await db.substituirDaConferencia(db.STORES.PESSOAS, cf, []);
    await db.substituirDaConferencia(db.STORES.FAMILIAS, cf, []);
  } catch (erro) {
    // banco indisponível: nada a apagar
  }
  await Promise.all(['pessoas_atualizada:', 'pessoas_desde:', 'pessoas_lista:', 'familias_atualizada:',
    'familias_desde:', consolidacao.CHAVE_GUARDADA, aniversarios.CHAVE_GUARDADA].map((k) => db.apagarConfig(k + cf)));
}

/**
 * Tranca esquecida (esqueci o desenho, erros demais; 19/11/2026): as sessões e os dados guardados de todas as
 * conferências saem deste celular, e o app recomeça no e-mail e na senha. A fila fica, como na sessão vencida:
 * espera a pessoa entrar de novo.
 */
async function esquecerTudoNoCelular() {
  const cfs = new Set([...conferenciasComSessao(), ...(await conferenciasGuardadas())]);
  for (const cf of cfs) {
    await apagarDadosDaConferencia(cf);
  }
  await esquecerSessoesGuardadas();
  await trava.esquecer();
  location.reload();
}

/**
 * Depois de entrar com a senha: cria a tranca (primeira vez) ou pede o desenho (já havia). Então a chave dos dados
 * guardados é lembrada e as sessões são guardadas trancadas.
 */
async function garantirTrava() {
  if (!trava.configurada()) {
    await telaTrava.pedir('criar', {aoEsquecer: esquecerTudoNoCelular, aposLogin: true});
  } else if (!trava.aberta()) {
    await telaTrava.pedir('abrir', {aoEsquecer: esquecerTudoNoCelular, aposLogin: true});
  }
  await cofre.lembrarPendentes();
  await salvarSessoes();
}

/**
 * "Trocar o desenho ou o PIN" das Configurações (19/11/2026): confirma o atual (os mesmos 5 erros), cria o novo e
 * tranca de novo, com ele, a sessão e a chave dos dados guardados (sem sair da conferência nem pedir a senha).
 */
async function trocarTrava() {
  if (!trava.configurada() || !conferenciasComSessao().length) {
    avisar('O desenho é criado depois de entrar numa conferência.');
    return;
  }
  if (!(await telaTrava.pedir('abrir', {aoEsquecer: esquecerTudoNoCelular, trocando: true}))) {
    return;
  }
  const chaves = await cofre.chavesParaTrocarTrava(conferenciasComSessao());
  if (!(await telaTrava.pedir('criar', {aoEsquecer: esquecerTudoNoCelular, trocando: true}))) {
    return; // cancelou: fica o desenho de antes
  }
  await cofre.lembrarComTravaNova(chaves);
  await salvarSessoes();
  avisar(trava.tipo() === 'pin' ? 'Pronto: o app agora abre com o PIN novo.' :
    'Pronto: o app agora abre com o desenho novo.');
}

/** Quem pode voltar a conferência ao estado inicial (EstadoInicial.gs no script do CC). */
const CARGOS_QUE_VOLTAM = ['PCF', 'VCF'];

/** O botão das Configurações aparece só para o presidente e o vice, numa conferência de teste. */
function mostrarVoltarAoInicio() {
  const linha = document.getElementById('linhaVoltarInicio');
  if (!linha) {
    return;
  }
  const s = sessaoAtual();
  const perfil = (s && s.perfil) || {};
  linha.hidden = !(s && perfil.teste !== false &&
    (perfil.cargos || []).some((c) => CARGOS_QUE_VOLTAM.includes(siglaDoCargo(c))));
}

/**
 * A tela que explica o que acontece e pede para escrever o nome da conferência.
 * @param {string} nome
 * @return {!Promise<?string>} O que foi escrito, ou null se cancelou.
 */
function confirmarVoltaAoInicio(nome) {
  return new Promise((resolver) => {
    const fundo = document.createElement('div');
    fundo.className = 'tela-trava tela-voltar-inicio';
    fundo.setAttribute('role', 'dialog');
    fundo.setAttribute('aria-modal', 'true');
    fundo.setAttribute('aria-labelledby', 'voltarTitulo');
    const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
      '\'': '&#39;'}[c]));
    fundo.innerHTML = `
      <form class="trava-caixa voltar-caixa" autocomplete="off">
        <h2 class="trava-titulo" id="voltarTitulo">Voltar ${esc(nome)} ao estado inicial?</h2>
        <p class="trava-texto">É para recomeçar os testes. A conferência volta ao que a importação dos .xlsx deixou.</p>
        <ul class="voltar-lista">
          <li><strong>Tudo o que foi feito depois da importação se perde:</strong> cadastros, mudanças, famílias e
            visitas novas.</li>
          <li><strong>Todos os vicentinos desta conferência saem do app</strong>, em todos os aparelhos, inclusive
            você. O que ainda não foi enviado é descartado.</li>
          <li><strong>As contas voltam à senha da demonstração.</strong> Para continuar, entre de novo.</li>
          <li>Só vale para esta conferência de teste. As outras não mudam.</li>
        </ul>
        <label class="form-label" for="voltarNome">Para confirmar, escreva o nome da conferência:
          <strong>${esc(nome)}</strong></label>
        <input id="voltarNome" class="form-input" autocomplete="off" autocapitalize="none" required>
        <p class="trava-aviso erro" role="alert"></p>
        <button type="submit" class="btn-perigo">Voltar ao estado inicial</button>
        <button type="button" class="link-conexao" data-voltar-cancelar>Cancelar</button>
      </form>`;
    const fechar = (valor) => {
      fundo.remove();
      resolver(valor);
    };
    const normal = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/\s+/g, ' ').trim();
    fundo.querySelector('[data-voltar-cancelar]').addEventListener('click', () => fechar(null));
    fundo.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const escrito = fundo.querySelector('#voltarNome').value;
      if (normal(escrito) !== normal(nome)) {
        fundo.querySelector('.trava-aviso').textContent = 'O nome não confere. Escreva ' + nome + '.';
        fundo.querySelector('#voltarNome').focus();
        return;
      }
      fechar(escrito);
    });
    document.body.appendChild(fundo);
    fundo.querySelector('#voltarNome').focus();
  });
}

/**
 * "Voltar ao estado inicial" (19/11/2026): o script do CC copia de volta a foto da importação e tira todos do app.
 * Aqui, como numa sessão encerrada: o que esperava envio nesta conferência e os dados guardados saem do celular.
 */
async function voltarAoInicio() {
  const s = sessaoAtual();
  if (!s) {
    return;
  }
  const nome = (s.perfil && s.perfil.nome_conferencia) || document.getElementById('lblConfName').textContent;
  const escrito = await confirmarVoltaAoInicio(nome);
  if (escrito === null) {
    return;
  }
  avisar('Voltando ao estado inicial…');
  let resposta;
  try {
    resposta = await chamarNaConferencia(s.id_conferencia, s.url_api, 'voltar_ao_inicio', {confirmacao: escrito});
  } catch (erro) {
    avisar(erro.message);
    return;
  }
  await sync.apagarDaConferencia(s.id_conferencia);
  await sairDaConferencia();
  avisar(resposta.mensagem || 'A conferência voltou ao estado inicial. Entre de novo.');
}

/** A barra de conexão já carregou as sessões (antes disso, vale a sessão guardada). */
let barraCarregada = false;

/**
 * Cada toque adia a tranca; passados trava.minutos() sem uso (ou ao voltar para o app), pede o desenho. Começa logo
 * ao abrir, sem esperar a lista de conferências (que pode demorar sem internet boa), e confere a cada 5 segundos.
 * @param {boolean} comSessaoGuardada Havia sessão guardada ao abrir (antes de a barra carregar as sessões).
 */
function vigiarTrava(comSessaoGuardada) {
  ['pointerdown', 'keydown'].forEach((evento) => document.addEventListener(evento, () => {
    if (!telaTrava.mostrando()) {
      trava.marcarUso();
    }
  }, {passive: true, capture: true}));
  const conferir = () => {
    const comSessao = conferenciasComSessao().length > 0 || (comSessaoGuardada && !barraCarregada);
    if (trava.configurada() && comSessao && !telaTrava.mostrando() && trava.venceu()) {
      trava.trancar();
      telaTrava.pedir('abrir', {aoEsquecer: esquecerTudoNoCelular});
    }
  };
  setInterval(conferir, 5000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      conferir();
    }
  });
}

/**
 * A tela "Como o app guarda e envia" abre sozinha uma vez: na primeira entrada numa conferência, e para quem já
 * usava o app antes dela (17/11/2026). Depois, só pelo menu e pelos links.
 */
/**
 * Primeira vez neste aparelho: abre a apresentação. Quem já escolheu uma conferência, já entrou ou chegou por um link
 * vai direto ao que pediu.
 */
async function abrirApresentacaoNaPrimeiraVez() {
  const p = new URLSearchParams(location.search);
  if (['cm', 'cc', 'cf'].some((c) => p.has(c)) || !['', '#', '#pessoas'].includes(location.hash)) {
    return;
  }
  const [viu, escolha, sessoes] = await Promise.all([db.lerConfig(sobre.CHAVE_VIU), db.lerConfig('conexao_escolha'),
    db.lerConfig('conexao_sessoes')]);
  if (!viu && !(escolha && escolha.cf) && !(sessoes && Object.keys(sessoes).length)) {
    history.replaceState(null, '', location.pathname + location.search + '#sobre');
  }
}

async function mostrarComoFuncionaUmaVez() {
  if (!sessaoAtual() || location.hash.startsWith('#como-funciona') || (await db.lerConfig(comoFunciona.CHAVE_VIU))) {
    return;
  }
  location.hash = '#como-funciona';
}

/** "Enviar: quando eu mandar" com mudanças paradas há mais de um dia: lembra ao abrir o app. */
async function lembrarSeEsperando() {
  const n = await sync.esperandoDemais();
  if (n) {
    avisar((n === 1 ? '1 mudança espera' : n + ' mudanças esperam') +
        ' há mais de um dia no celular. Toque na Nuvem para enviar.');
  }
}

/** A etiqueta do alto mostra a versão que está rodando (a do service worker que controla a página). */
function pedirVersao() {
  const controlador = navigator.serviceWorker && navigator.serviceWorker.controller;
  if (controlador) {
    controlador.postMessage('versao');
  }
  // Sem resposta (página aberta com Ctrl+Shift+R, que não passa pelo service worker, ou um antigo que não responde):
  // a página veio da internet, então vale a versão escrita no sw.js do site.
  setTimeout(versaoPeloArquivo, controlador ? 1500 : 0);
}

function versaoPeloArquivo() {
  const etiqueta = document.getElementById('versaoApp');
  if (!etiqueta || etiqueta.textContent !== 'v…') {
    return;
  }
  fetch('./sw.js', {cache: 'no-store'}).then((r) => r.text()).then((texto) => {
    const achado = texto.match(/ssvp-casca-v([0-9.]+)/);
    if (achado && etiqueta.textContent === 'v…') {
      etiqueta.textContent = 'v' + achado[1];
    }
  }).catch(() => {
    // sem conexão: a etiqueta fica como está
  });
}

/**
 * Versão nova baixada e esperando: o card "Versão Nova" (padrão de 24/11/2026, testes/ux/t1_versao_nova.html).
 * Três colunas: "Versão Nova", o código e o tipo | "O que mudou" (abre os detalhes para cima) e "Atualizar agora" |
 * ✕ (Agora não), só quando a versão pode esperar. O tipo e o texto vêm do sw.js da versão nova (NOVIDADES,
 * NECESSARIA). Os códigos, no card e na barra do alto, pulsam: vermelhos se a versão é necessária, amarelos se pode
 * esperar. Atualizar troca de versão e recarrega; o que está guardado no celular (fila, cópias, rascunhos) fica. Sem
 * tocar, a versão nova vale quando todas as janelas do app forem fechadas.
 * @param {!ServiceWorker} espera
 */
function oferecerAtualizacao(espera) {
  if (document.getElementById('avisoVersao')) {
    return;
  }
  const faixa = document.createElement('div');
  faixa.id = 'avisoVersao';
  faixa.className = 'aviso-versao';
  faixa.setAttribute('role', 'status');
  faixa.addEventListener('click', (e) => {
    if (e.target.closest('.aviso-versao-mudou')) {
      faixa.classList.toggle('expandido');
      desenharAvisoVersao();
    } else if (e.target.closest('.aviso-versao-botao')) {
      const botao = e.target.closest('.aviso-versao-botao');
      botao.disabled = true;
      botao.textContent = 'Atualizando…';
      estadoAtualizacao.recarregar = true;
      espera.postMessage('atualizar');
    } else if (e.target.closest('.aviso-versao-fechar')) {
      fecharAvisoVersao();
    }
  });
  document.body.appendChild(faixa);
  document.body.classList.add('com-aviso-versao');
  // Os avisos rápidos sobem acima do card, em vez de ficarem escondidos atrás dele.
  if ('ResizeObserver' in window) {
    estadoAtualizacao.medidor = new ResizeObserver(() => {
      document.body.style.setProperty('--altura-aviso-versao', faixa.offsetHeight + 'px');
    });
    estadoAtualizacao.medidor.observe(faixa);
  }
  estadoAtualizacao.espera = espera;
  estadoAtualizacao.info = {versao: '', grupos: [], necessaria: false};
  desenharAvisoVersao();
  espera.postMessage('versao');
  setTimeout(lerVersaoNovaPeloArquivo, 1500); // sem resposta do service worker novo: o que está escrito no sw.js
}

/** Monta o card com o que se sabe da versão nova (o código pode chegar depois). */
function desenharAvisoVersao() {
  const faixa = document.getElementById('avisoVersao');
  if (!faixa) {
    return;
  }
  const {versao, grupos, necessaria} = estadoAtualizacao.info;
  const aberto = faixa.classList.contains('expandido');
  const cor = necessaria ? 'versao-necessaria' : 'versao-espera';
  const lista = grupos.length ? grupos : [{versao, novidades: ['Correções e melhorias.']}];
  // Pulou versões (28/11/2026): o que mudou em cada uma, da mais nova para a mais antiga.
  const varias = lista.length > 1;
  const titulo = varias && estadoAtualizacao.atual ? 'O que muda desde a v' + esc(estadoAtualizacao.atual) :
    'O que muda' + (versao ? ' na v' + esc(versao) : '');
  const itens = (g) => `<ul>${(g.novidades.length ? g.novidades : ['Correções e melhorias.'])
      .map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  const corpo = varias ? lista.map((g) => `<h3>Na v${esc(g.versao)}</h3>${itens(g)}`).join('') : itens(lista[0]);
  faixa.classList.toggle('necessaria', necessaria);
  faixa.innerHTML = `
    <div class="aviso-versao-detalhes" id="avisoVersaoDetalhes" aria-hidden="${!aberto}">
      ${necessaria ? `<p class="aviso-versao-motivo"><strong>Necessária</strong> para continuar enviando. O app funciona
        sem internet, e o que você registrar fica guardado no celular.</p>` : ''}
      <h2>${titulo}</h2>
      ${corpo}
      <p class="aviso-versao-fica">O que está guardado no celular continua: mudanças a enviar, famílias guardadas e
        rascunhos.</p>
    </div>
    <div class="aviso-versao-linha">
      <span class="aviso-versao-textos">
        <strong>Versão Nova</strong>
        <span class="aviso-versao-codigo versao-pulsando ${cor}" id="avisoVersaoCodigo">v${esc(versao || '…')}</span>
        <span class="aviso-versao-tipo${necessaria ? ' e-necessaria' : ''}">${necessaria ? 'Necessária' : 'Pode esperar'}</span>
      </span>
      <span class="aviso-versao-acoes">
        <button type="button" class="aviso-versao-mudou" aria-expanded="${aberto}" aria-controls="avisoVersaoDetalhes">${
  aberto ? 'Fechar ▾' : 'O que mudou ▴'}</button>
        <button type="button" class="aviso-versao-botao">Atualizar agora</button>
      </span>
      ${necessaria ? '' : '<button type="button" class="aviso-versao-fechar" aria-label="Agora não">✕</button>'}
    </div>`;
  const atual = document.getElementById('versaoApp');
  if (atual) {
    atual.classList.remove('versao-necessaria', 'versao-espera');
    atual.classList.add('versao-pulsando', cor);
  }
}

/** Tira o card e para o pulso da versão atual. */
function fecharAvisoVersao() {
  const faixa = document.getElementById('avisoVersao');
  if (faixa) {
    faixa.remove();
  }
  if (estadoAtualizacao.medidor) {
    estadoAtualizacao.medidor.disconnect();
    estadoAtualizacao.medidor = null;
  }
  document.body.classList.remove('com-aviso-versao');
  document.body.style.removeProperty('--altura-aviso-versao');
  const atual = document.getElementById('versaoApp');
  if (atual) {
    atual.classList.remove('versao-pulsando', 'versao-necessaria', 'versao-espera');
  }
  estadoAtualizacao.espera = null;
}

/**
 * Compara versões "0.29.1".
 * @param {string} a
 * @param {string} b
 * @return {number} Positivo se a é mais nova que b.
 */
function compararVersoes(a, b) {
  const x = String(a).split('.').map(Number);
  const y = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) {
      return d;
    }
  }
  return 0;
}

/**
 * O que a versão nova diz de si, vindo do service worker que espera (ou do sw.js do site).
 * Com as anteriores (sw.js a partir da v0.29.1), junta as versões que a pessoa pulou desde a que está rodando; a
 * atualização é necessária se alguma delas era (28/11/2026).
 * @param {!Object} dados {versao, novidades?, necessaria?, anteriores?: [{versao, novidades, necessaria}]}
 */
function guardarInfoDaVersaoNova(dados) {
  estadoAtualizacao.dados = dados;
  const textos = (lista) => (Array.isArray(lista) ? lista.map(String).filter(Boolean).slice(0, 8) : []);
  const versao = String(dados.versao || '');
  const atual = estadoAtualizacao.atual;
  const puladas = atual && Array.isArray(dados.anteriores) ? dados.anteriores.filter((v) => v && v.versao &&
    compararVersoes(v.versao, atual) > 0 && compararVersoes(v.versao, versao) < 0).slice(0, 6) : [];
  const grupos = [{versao, novidades: textos(dados.novidades)}]
      .concat(puladas.map((v) => ({versao: String(v.versao), novidades: textos(v.novidades)})))
      .filter((g, i) => i === 0 || g.novidades.length);
  estadoAtualizacao.info = {
    versao,
    grupos: grupos.length === 1 && !grupos[0].novidades.length ? [] : grupos,
    necessaria: dados.necessaria === true || puladas.some((v) => v.necessaria === true),
  };
  desenharAvisoVersao();
}

function lerVersaoNovaPeloArquivo() {
  if (!document.getElementById('avisoVersao') || estadoAtualizacao.info.versao) {
    return;
  }
  fetch('./sw.js', {cache: 'no-store'}).then((r) => r.text()).then((texto) => {
    const versao = texto.match(/ssvp-casca-v([0-9.]+)/);
    if (!versao || estadoAtualizacao.info.versao) {
      return;
    }
    let novidades = [];
    let anteriores = [];
    try {
      novidades = JSON.parse((texto.match(/const NOVIDADES = (\[[\s\S]*?\]);/) || [])[1] || '[]');
      anteriores = JSON.parse((texto.match(/const ANTERIORES = (\[[\s\S]*?\n\]);/) || [])[1] || '[]');
    } catch (erro) {
      // fica o texto padrão
    }
    guardarInfoDaVersaoNova({versao: versao[1], novidades, anteriores,
      necessaria: /const NECESSARIA = true;/.test(texto)});
  }).catch(() => {
    // sem conexão: o card fica sem o número
  });
}

// atual: a versão que está rodando (a do service worker que controla a página), para juntar as versões puladas.
const estadoAtualizacao = {recarregar: false, espera: null, medidor: null, atual: '', dados: null,
  info: {versao: '', grupos: [], necessaria: false}};

/** O Sair está em andamento (pode estar enviando o que falta antes). */
let saindo = false;

/** Logo ao abrir (antes de esperar a conexão): a etiqueta da versão e a troca de versão pedida pela faixa. */
function ouvirServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (!e.data || !e.data.versao) {
      return;
    }
    // Quem responde é o service worker que espera: é o código da versão nova, não o da que está rodando.
    if (estadoAtualizacao.espera && e.source === estadoAtualizacao.espera) {
      guardarInfoDaVersaoNova(e.data);
      return;
    }
    if (e.source === navigator.serviceWorker.controller) {
      estadoAtualizacao.atual = String(e.data.versao);
      if (estadoAtualizacao.dados && estadoAtualizacao.espera) {
        guardarInfoDaVersaoNova(estadoAtualizacao.dados); // a versão nova respondeu antes: junta as puladas agora
      }
    }
    const etiqueta = document.getElementById('versaoApp');
    if (etiqueta) {
      etiqueta.textContent = 'v' + e.data.versao;
    }
  });
  // A versão nova assumiu: recarrega se a pessoa pediu ("Atualizar agora"); senão, só acerta a etiqueta.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (estadoAtualizacao.recarregar) {
      location.reload();
    } else {
      fecharAvisoVersao(); // a versão nova já assumiu (por outra janela)
      pedirVersao();
    }
  });
  pedirVersao();
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  // Só é versão nova se a página já veio de um service worker. Na primeira instalação ele assume a página logo em
  // seguida (clients.claim) e, olhando o controller depois, parecia uma atualização (22/11/2026).
  const jaInstalado = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.register('./sw.js').then((registro) => {
    if (registro.waiting && jaInstalado) {
      oferecerAtualizacao(registro.waiting);
    }
    registro.addEventListener('updatefound', () => {
      const novo = registro.installing;
      novo.addEventListener('statechange', () => {
        if (novo.state === 'installed' && jaInstalado) {
          oferecerAtualizacao(novo);
        }
      });
    });
  }).catch(() => {
    // sem service worker o app funciona, só não abre offline
  });
}

async function iniciar() {
  ouvirServiceWorker();
  ligarCompartilhar();
  ajustarAltura();
  window.addEventListener('resize', ajustarAltura);
  window.addEventListener('orientationchange', ajustarAltura);
  // A página não rola (só a área do conteúdo). Se o navegador deslocá-la para mostrar o campo sob o teclado,
  // o topo some sem volta: devolve a página ao lugar e rola só a área até o campo.
  window.addEventListener('scroll', () => {
    if (window.scrollY || document.documentElement.scrollTop) {
      window.scrollTo(0, 0);
      const area = document.getElementById('areaConteudo');
      const campo = document.activeElement;
      if (campo && area.contains(campo)) {
        // Só a área rola (scrollIntoView rolaria a página de novo). O campo fica no primeiro terço da área.
        area.scrollTop += campo.getBoundingClientRect().top - area.getBoundingClientRect().top - area.clientHeight / 3;
      }
    }
  }, {passive: true});

  window.addEventListener('banco-bloqueado', () => {
    window.alert('O app está aberto em outra aba com a versão anterior. Feche as outras abas do app e recarregue ' +
      'esta página.');
  });
  await carregarPreferencias();
  await iniciarTutoriais(); // Ajuda de cada tela (tutorial.js)
  await uso.iniciar(); // homologação: resumo de como o app é usado (uso.js; Configurações > Ajudar a melhorar o app)
  iniciarCasca({
    aoSair: async () => {
      if (saindo) {
        return; // segundo toque enquanto envia o que falta
      }
      saindo = true;
      try {
        if (!(await confirmarSaidaComFila())) {
          return;
        }
        if (!(await sairDaConferencia())) {
          avisar('Você ainda não entrou em nenhuma conferência.');
        }
      } finally {
        saindo = false;
      }
    },
    aoSincronizar: () => sincronizarAgora(),
    aoAbrirSincronizacao: aoAbrirAba,
  });
  iniciarBotaoVoz({avisar, bloqueado: () => false});
  iniciarPainelSync(); // o botão Nuvem mostra a fila guardada já ao abrir, antes de a conexão carregar

  document.getElementById('areaConteudo').addEventListener('click', (e) => {
    if (e.target.closest('[data-acao="abrir-conexao"]')) {
      abrirPainelConexao();
    }
    const botaoVoltar = e.target.closest('[data-voltar]');
    if (botaoVoltar) {
      e.preventDefault();
      voltar(botaoVoltar.getAttribute('href'));
    }
  });
  // A seta de voltar da barra da tela (barra_tela.js) faz o mesmo que o Voltar do celular.
  document.getElementById('barraTela').addEventListener('click', (e) => {
    const botaoVoltar = e.target.closest('[data-voltar]');
    if (botaoVoltar) {
      e.preventDefault();
      voltar(botaoVoltar.getAttribute('href'));
    }
  });
  window.addEventListener('hashchange', desenharTela);
  // Saiu da apresentação sem ter entrado: o login aparece.
  window.addEventListener('hashchange', (e) => {
    if (new URL(e.oldURL).hash.startsWith('#sobre') && !sessaoAtual() && !location.hash.startsWith('#como-funciona')) {
      abrirPainelConexao();
    }
  });

  // A planilha confirmou um cadastro: a tela aberta com o id provisório passa para o definitivo.
  sync.eventos.addEventListener('confirmado', (e) => {
    const [base, id] = location.hash.split('/');
    const definitivo = id && e.detail.trocas[decodeURIComponent(id)];
    if (definitivo) {
      location.replace(base + '/' + encodeURIComponent(definitivo));
    }
  });

  // Tranca (19/11/2026): com sessão guardada e a tranca fechada (mais de 15 minutos sem uso), o desenho vem antes
  // de tudo: sem ele, os tokens e a chave dos dados guardados não abrem.
  await trava.iniciar();
  const comSessaoGuardada = (await conferenciasGuardadas()).length > 0;
  if (comSessaoGuardada && trava.configurada() && !trava.aberta()) {
    await telaTrava.pedir('abrir', {aoEsquecer: esquecerTudoNoCelular});
  } else if (comSessaoGuardada && !trava.configurada()) {
    // Quem já tinha entrado antes da tranca: cria o desenho agora (uma vez); as sessões são trancadas logo abaixo.
    await telaTrava.pedir('criar', {aoEsquecer: esquecerTudoNoCelular});
    await trancarSessoesGuardadas();
  }
  vigiarTrava(comSessaoGuardada);
  const botaoTrocar = document.getElementById('btnTrocarTrava');
  if (botaoTrocar) {
    botaoTrocar.addEventListener('click', trocarTrava);
  }
  const botaoVoltarInicio = document.getElementById('btnVoltarInicio');
  if (botaoVoltarInicio) {
    botaoVoltarInicio.addEventListener('click', voltarAoInicio);
  }
  await abrirApresentacaoNaPrimeiraVez();
  desenharTela();
  await iniciarBarraConexao({
    aoConectar: () => {
      mostrarVoltarAoInicio();
      desenharTela();
      sync.agendarEnvio(); // entrou de novo (sessão vencida): envia o que esperava por ela
      mostrarComoFuncionaUmaVez();
    },
    // A senha só existe aqui, na hora do login: vira a chave dos dados guardados para usar sem internet.
    // Depois, a tranca: criar o desenho (primeira vez) ou desenhar (garantirTrava).
    aoEntrarComSenha: async (cf, senha) => {
      await desbloquear(cf, senha, {criar: true});
      await garantirTrava();
    },
    // Sair ou sessão vencida: os dados guardados da conferência saem do celular (cofre e listas).
    aoEncerrarSessao: (cf) => apagarDadosDaConferencia(cf),
  });
  barraCarregada = true;
  uso.appAberto();
  mostrarVoltarAoInicio();
  // A chave dos dados guardados lembrada nas últimas 12 horas (cofre.js), trancada pelo desenho: reaberto no mesmo
  // dia, não pede a senha.
  await Promise.all(conferenciasComSessao().map((cf) => cofre.restaurar(cf)));
  await sync.iniciarSync({chamar: chamarNaConferencia, conferencias: conferenciasComSessao});
  await mostrarComoFuncionaUmaVez();
  lembrarSeEsperando();
  registrarServiceWorker();
}

iniciar();
