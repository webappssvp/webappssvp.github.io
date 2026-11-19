/**
 * @fileoverview Início do app e roteador por #hash.
 * Cada tela (js/telas/*.js) exporta renderizar(area, sessao) e devolve o texto do modo Ouvir.
 * Arquitetura: mvp/arquitetura.md
 */

import {carregarPreferencias} from './core/preferencias.js';
import {iniciarBotaoVoz, definirLeitor} from './core/voz.js';
import {iniciarCasca, ajudaAtiva, avisar, marcarTelaAtual} from './casca.js';
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
import {ligarCompartilhar} from './componentes/compartilhar.js';
import {voltar} from './telas/comum.js';

/** Telas por #hash. Pessoas é a inicial (mvp/telas/02_pessoas.md). */
const TELAS = {
  '#como-funciona': comoFunciona, // "Como o app guarda e envia", o primeiro do menu (05_sincronizacao.md)
  '#pessoas': pessoas,
  '#vicentinos': pessoas, // endereço antigo
  '#familias': familias,
  '#visitas': visitas,
  '#visita': visita, // #visita/<id_familia>: registrar uma visita (06_visitas.md, etapa 1)
  '#importar': importarPessoas,
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
  const texto = TELAS[hash].renderizar(area, sessaoAtual(), TELAS[base] ? decodeURIComponent(resto.join('/')) : '');
  // A tela pode devolver uma função: o texto é montado na hora de ler (a lista pode chegar depois).
  definirLeitor(() => (typeof texto === 'function' ? texto() : texto));
  marcarTelaAtual(hash === '#vicentinos' ? '#pessoas' : hash === '#visita' ? '#visitas' : hash);
  area.scrollTop = 0;
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
  await cofre.apagar(cf);
  try {
    await db.substituirDaConferencia(db.STORES.PESSOAS, cf, []);
    await db.substituirDaConferencia(db.STORES.FAMILIAS, cf, []);
  } catch (erro) {
    // banco indisponível: nada a apagar
  }
  await Promise.all(['pessoas_atualizada:', 'pessoas_desde:', 'pessoas_lista:', 'familias_atualizada:',
    'familias_desde:'].map((k) => db.apagarConfig(k + cf)));
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
const CARGOS_QUE_VOLTAM = ['PRE', 'VIC'];

/** O botão das Configurações aparece só para o presidente e o vice, numa conferência de teste. */
function mostrarVoltarAoInicio() {
  const linha = document.getElementById('linhaVoltarInicio');
  if (!linha) {
    return;
  }
  const s = sessaoAtual();
  const perfil = (s && s.perfil) || {};
  linha.hidden = !(s && perfil.teste !== false &&
    (perfil.cargos || []).some((c) => CARGOS_QUE_VOLTAM.includes(String(c).toUpperCase())));
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
 * Versão nova baixada e esperando (18/11/2026): uma faixa com "Atualizar agora". Tocar troca de versão e recarrega;
 * o que está guardado no celular (fila, cópias, rascunhos) fica. Sem tocar, a versão nova vale quando todas as
 * janelas do app forem fechadas.
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
  faixa.innerHTML = '<span>Versão nova do app.</span>' +
    '<button type="button" class="aviso-versao-botao">Atualizar agora</button>' +
    '<button type="button" class="aviso-versao-fechar" aria-label="Agora não">✕</button>';
  faixa.querySelector('.aviso-versao-botao').addEventListener('click', () => {
    estadoAtualizacao.recarregar = true;
    espera.postMessage('atualizar');
  });
  faixa.querySelector('.aviso-versao-fechar').addEventListener('click', () => faixa.remove());
  document.body.appendChild(faixa);
}

const estadoAtualizacao = {recarregar: false};

/** Logo ao abrir (antes de esperar a conexão): a etiqueta da versão e a troca de versão pedida pela faixa. */
function ouvirServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  navigator.serviceWorker.addEventListener('message', (e) => {
    const etiqueta = document.getElementById('versaoApp');
    if (e.data && e.data.versao && etiqueta) {
      etiqueta.textContent = 'v' + e.data.versao;
    }
  });
  // A versão nova assumiu: recarrega se a pessoa pediu ("Atualizar agora"); senão, só acerta a etiqueta.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (estadoAtualizacao.recarregar) {
      location.reload();
    } else {
      pedirVersao();
    }
  });
  pedirVersao();
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  navigator.serviceWorker.register('./sw.js').then((registro) => {
    if (registro.waiting && navigator.serviceWorker.controller) {
      oferecerAtualizacao(registro.waiting);
    }
    registro.addEventListener('updatefound', () => {
      const novo = registro.installing;
      novo.addEventListener('statechange', () => {
        if (novo.state === 'installed' && navigator.serviceWorker.controller) {
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
  iniciarCasca({
    aoSair: async () => {
      if (!(await confirmarSaidaComFila())) {
        return;
      }
      if (!(await sairDaConferencia())) {
        avisar('Você ainda não entrou em nenhuma conferência.');
      }
    },
    aoSincronizar: () => sincronizarAgora(),
    aoAbrirSincronizacao: aoAbrirAba,
  });
  iniciarBotaoVoz({avisar, bloqueado: ajudaAtiva});
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
