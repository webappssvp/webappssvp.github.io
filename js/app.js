/**
 * @fileoverview Início do app e roteador por #hash.
 * Cada tela (js/telas/*.js) exporta renderizar(area, sessao) e devolve o texto do modo Ouvir.
 * Arquitetura: mvp/arquitetura.md
 */

import {carregarPreferencias} from './core/preferencias.js';
import {iniciarBotaoVoz, definirLeitor} from './core/voz.js';
import {iniciarCasca, ajudaAtiva, avisar, marcarTelaAtual} from './casca.js';
import {iniciarBarraConexao, sessaoAtual, sairDaConferencia, abrirPainelConexao, chamarNaConferencia,
  conferenciasComSessao} from './componentes/barra_conexao.js';
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
import {voltar} from './telas/comum.js';

/** Telas por #hash. Pessoas é a inicial (mvp/telas/02_pessoas.md). */
const TELAS = {
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
  const texto = (faltam === 1 ? 'Há 1 item que ainda não foi enviado.' : `Há ${faltam} itens que ainda não foram enviados.`) +
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
  ['pessoas_atualizada:', 'pessoas_desde:', 'pessoas_lista:', 'familias_atualizada:', 'familias_desde:']
      .forEach((k) => db.apagarConfig(k + cf));
}

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  navigator.serviceWorker.register('./sw.js').then((registro) => {
    registro.addEventListener('updatefound', () => {
      const novo = registro.installing;
      novo.addEventListener('statechange', () => {
        if (novo.state === 'installed' && navigator.serviceWorker.controller) {
          avisar('Há uma versão nova do app. Feche e abra de novo para usar.');
        }
      });
    });
  }).catch(() => {
    // sem service worker o app funciona, só não abre offline
  });
}

async function iniciar() {
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

  desenharTela();
  await iniciarBarraConexao({
    aoConectar: () => {
      desenharTela();
      sync.agendarEnvio(); // entrou de novo (sessão vencida): envia o que esperava por ela
    },
    // A senha só existe aqui, na hora do login: vira a chave dos dados guardados para usar sem internet.
    aoEntrarComSenha: (cf, senha) => desbloquear(cf, senha, {criar: true}),
    // Sair ou sessão vencida: os dados guardados da conferência saem do celular (cofre e listas).
    aoEncerrarSessao: (cf) => apagarDadosDaConferencia(cf),
  });
  // A chave dos dados guardados lembrada nas últimas 12 horas (cofre.js): reaberto no mesmo dia, não pede a senha.
  await Promise.all(conferenciasComSessao().map((cf) => cofre.restaurar(cf)));
  await sync.iniciarSync({chamar: chamarNaConferencia, conferencias: conferenciasComSessao});
  registrarServiceWorker();
}

iniciar();
