/**
 * @fileoverview Tela Consolidação (#consolidacao, 27/11/2026): os números da conferência e dos conselhos, só para a
 * Diretoria. Veio do teste testes/ux/t2_consolidacao.html, agora com os números da rodada da noite do script do CC
 * (rota "consolidacao", Consolidacao.gs).
 * - Presidente, vice, secretário e tesoureiro da conferência veem a conferência; quem tem cargo num CP ou no CC vê o
 *   conselho e cada unidade dele (o servidor decide e confere; aqui só se desenha o que veio).
 * - Só números: nomes, endereços e relatos ficam na conferência.
 * - As unidades de baixo ficam em ordem alfabética: comparar serve para ajudar, não para ranking.
 * - Sem internet: os últimos números guardados no celular (apagados ao sair, como as listas).
 */

import {esc, pedirConexao} from './comum.js';
import {definirBarra, barraOcupada} from '../componentes/barra_tela.js';
import {chamarComSessao} from '../componentes/barra_conexao.js';
import * as db from '../core/db.js';

/** Chave dos números guardados no celular (+ id da conferência da sessão). */
export const CHAVE_GUARDADA = 'consolidacao:';

const estado = {
  conferencia: '', // a sessão de quem pediu (trocou de conferência: busca de novo)
  dados: null, // a resposta da rota
  guardadaEm: 0, // quando os números foram guardados (sem internet)
  semInternet: false,
  erro: '',
  carregando: false,
  raiz: 0, // qual das unidades da pessoa (CC, CP, conferência)
  caminho: [], // ids da raiz até a unidade aberta
  abertos: {alertas: false, numeros: false}, // no CC e no CP: o que a pessoa abriu fica aberto ao trocar de nível
  cpsAbertos: {}, // no CC: os cards de CP abertos (id do CP → true)
};

/**
 * @param {!HTMLElement} area
 * @param {?Object} sessao
 * @return {(string|function(): string)} Texto para o modo Ouvir.
 */
export function renderizar(area, sessao) {
  if (!sessao) {
    return pedirConexao(area, 'Consolidação');
  }
  definirBarra({titulo: 'Consolidação'});
  const pode = ((sessao.perfil && sessao.perfil.permissoes) || []).includes('CONSOLIDACAO_VER');
  if (!pode) {
    area.innerHTML = `<div class="tela-consolidacao"><p class="consolidacao-aviso">A Consolidação é da Diretoria:
      presidente, vice, secretário e tesoureiro da conferência ou do conselho. Abra outra tela pelo Menu.</p></div>`;
    return 'A Consolidação é da Diretoria da conferência ou do conselho.';
  }
  if (estado.conferencia !== sessao.id_conferencia) {
    Object.assign(estado, {conferencia: sessao.id_conferencia, dados: null, guardadaEm: 0, erro: '', raiz: 0,
      caminho: []});
  }
  area.innerHTML = '<div class="tela-consolidacao" id="consolidacao"></div>';
  const caixa = area.querySelector('#consolidacao');
  caixa.addEventListener('click', (e) => aoTocar(e, caixa));
  // "toggle" não sobe pela árvore: escuta na fase de captura.
  caixa.addEventListener('toggle', (e) => {
    const d = e.target.dataset || {};
    if (d.dobra) {
      estado.abertos[d.dobra] = e.target.open;
    } else if (d.cp) {
      estado.cpsAbertos[d.cp] = e.target.open; // ao voltar de uma conferência, o card do CP continua aberto
    }
  }, true);
  desenhar(caixa);
  buscar(caixa, sessao.id_conferencia);
  return () => textoParaOuvir();
}

/**
 * Busca os números (com internet) ou usa os guardados.
 * @param {!HTMLElement} caixa
 * @param {string} cf
 */
async function buscar(caixa, cf) {
  if (estado.carregando) {
    return;
  }
  estado.carregando = true;
  if (!estado.dados) {
    const guardada = await db.lerConfig(CHAVE_GUARDADA + cf).catch(() => null);
    if (guardada && guardada.dados && estado.conferencia === cf) {
      estado.dados = guardada.dados;
      estado.guardadaEm = guardada.em || 0;
      desenhar(caixa);
    }
  }
  if (!navigator.onLine) {
    estado.semInternet = true;
    estado.carregando = false;
    desenhar(caixa);
    return;
  }
  barraOcupada(true);
  try {
    const resposta = await chamarComSessao('consolidacao');
    if (estado.conferencia !== cf) {
      return; // trocou de conferência enquanto buscava
    }
    estado.dados = resposta;
    estado.guardadaEm = Date.now();
    estado.semInternet = false;
    estado.erro = '';
    await db.salvarConfig(CHAVE_GUARDADA + cf, {dados: resposta, em: estado.guardadaEm}).catch(() => {});
  } catch (erro) {
    estado.erro = erro.message;
    estado.semInternet = !navigator.onLine;
  } finally {
    estado.carregando = false;
    barraOcupada(false);
    if (caixa.isConnected) {
      desenhar(caixa);
    }
  }
}

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------

/** @param {*} v @return {number} */
const num = (v) => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? 0 : Number(v));
/** @param {*} v @return {boolean} */
const tem = (v) => v !== '' && v !== null && v !== undefined && !isNaN(Number(v));
const decimal = (v, casas) => num(v).toLocaleString('pt-BR', {minimumFractionDigits: casas, maximumFractionDigits: casas});
const dinheiro = (v) => num(v).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0});
const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const plural = (n, um, varios) => n + ' ' + (n === 1 ? um : varios);

/** "25/11 às 03:00". @param {string|number} quando @return {string} */
function quandoFoi(quando) {
  const d = new Date(quando);
  if (!quando || isNaN(d.getTime())) {
    return '';
  }
  const dois = (n) => String(n).padStart(2, '0');
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} às ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** @param {!Object} no @return {!Array<!Object>} As conferências da unidade (ela mesma, se for conferência). */
function conferenciasDe(no) {
  if (no.nivel === 'cf') {
    return [no];
  }
  return (no.filhos || []).reduce((lista, f) => lista.concat(conferenciasDe(f)), []);
}

/**
 * Os alertas de uma conferência.
 * @param {!Object} c Nó de conferência.
 * @param {boolean} comNome Acima da conferência, cada alerta diz de qual.
 * @return {!Array<string>}
 */
function alertasDaConferencia(c, comNome) {
  const n = c.numeros || {};
  const de = comNome ? c.nome + ': ' : '';
  const alertas = [];
  if (c.sem_dados) {
    return comNome ? [de + 'sem números na última rodada (a planilha não abriu).'] : [];
  }
  const sem14 = num(n.familias_sem_visita_14_dias);
  if (sem14) {
    alertas.push(comNome ? de + plural(sem14, 'família', 'famílias') + ' sem visita há mais de 14 dias.' :
      maiuscula(plural(sem14, 'família está', 'famílias estão')) + ' sem visita há mais de 14 dias.');
  }
  if (num(n.conferencias_abaixo_minimo_art25)) {
    alertas.push(comNome ? de + 'abaixo do mínimo de famílias da Regra (Art. 25).' :
      `Abaixo do mínimo da Regra (Art. 25): ${num(n.familias_assistidas)} famílias para ${num(n.vicentinos_ativos)} ` +
        `vicentinos ativos. O mínimo é ${num(n.minimo_familias_art25)}.`);
  }
  const sin30 = num(n.familias_sindicancia_30_dias);
  if (sin30) {
    alertas.push(de + maiusculaSe(!comNome, plural(sin30, 'família', 'famílias') +
      ' em sindicância há mais de 30 dias.'));
  }
  if (tem(n.diretoria_provisoria_dias) && num(n.diretoria_provisoria_dias) <= 60) {
    const dias = num(n.diretoria_provisoria_dias);
    alertas.push(de + maiusculaSe(!comNome, dias > 0 ? `a Diretoria provisória termina em ${plural(dias, 'dia', 'dias')} ` +
      '(Art. 169).' : 'o mandato da Diretoria provisória já terminou (Art. 169).'));
  }
  return alertas;
}

/** @param {boolean} sim @param {string} t @return {string} */
function maiusculaSe(sim, t) {
  return sim ? maiuscula(t) : t;
}

/** @param {!Object} no @return {!Array<string>} */
function alertasDe(no) {
  const n = no.numeros || {};
  const alertas = no.nivel === 'cf' ? alertasDaConferencia(no, false) :
    conferenciasDe(no).reduce((lista, c) => lista.concat(alertasDaConferencia(c, true)), []);
  if (num(n.familias_assistidas) && tem(n.cobertura_semanal_pct) && num(n.cobertura_semanal_pct) < 60) {
    alertas.push(`Só ${num(n.cobertura_semanal_pct)}% das famílias foram visitadas nos últimos 7 dias.`);
  }
  return alertas;
}

/** @param {!Object} no @return {!Array<{nome: string, valor: string, classe: string, frase: string}>} */
function indicadoresDe(no) {
  const n = no.numeros || {};
  const fam = num(n.familias_assistidas);
  const vic = num(n.vicentinos_ativos);
  const cobertura = num(n.cobertura_semanal_pct);
  const sem14 = num(n.familias_sem_visita_14_dias);
  const comPlano = num(n.familias_com_plano_pct);
  const visitas = num(n.visitas_realizadas_mes);
  const dupla = num(n.visitas_em_dupla_pct);
  const pct = (v) => (fam ? v + '%' : '—');
  return [
    {nome: 'Visitas na semana', valor: pct(cobertura), classe: fam ? (cobertura >= 80 ? 'bom' : 'atencao') : '',
      frase: fam ? `${num(n.familias_visitadas_7_dias)} de ${fam} famílias visitadas nos últimos 7 dias (a Regra pede ` +
        'visita semanal, Art. 26).' : 'Nenhuma família assistida.'},
    {nome: 'Sem visita há mais de 14 dias', valor: String(sem14), classe: sem14 ? 'atencao' : 'bom',
      frase: sem14 ? 'Famílias que precisam de visita já.' : 'Nenhuma família esquecida.'},
    {nome: 'Plano de promoção', valor: pct(comPlano), classe: fam ? (comPlano >= 50 ? 'bom' : 'atencao') : '',
      frase: `${num(n.familias_com_plano_ativo)} de ${fam} famílias com plano de promoção em andamento.`},
    {nome: 'Visitas em dupla', valor: visitas ? dupla + '%' : '—', classe: visitas ? (dupla >= 80 ? 'bom' : 'atencao') : '',
      frase: visitas ? `${num(n.visitas_em_dupla_mes)} de ${plural(visitas, 'visita', 'visitas')} do mês com 2 ou mais ` +
        'vicentinos (Art. 118, § 3º).' : 'Nenhuma visita registrada neste mês.'},
    {nome: 'Auxílios no mês', valor: dinheiro(n.auxilios_valor_mes), classe: '',
      frase: `${plural(num(n.auxilios_mes), 'auxílio entregue', 'auxílios entregues')} (valor estimado).`},
    {nome: 'Famílias por vicentino', valor: vic ? decimal(n.familias_por_vicentino, 1) : '—',
      classe: num(n.conferencias_abaixo_minimo_art25) ? 'atencao' : (vic ? 'bom' : ''),
      frase: `${plural(fam, 'família', 'famílias')} e ${plural(vic, 'vicentino ativo', 'vicentinos ativos')}.` +
        (no.nivel === 'cf' && vic ? ` Mínimo da Regra (Art. 25): ${num(n.minimo_familias_art25)} famílias.` : '')},
    {nome: 'Sindicância', valor: String(num(n.familias_sindicancia)),
      classe: num(n.familias_sindicancia_30_dias) ? 'atencao' : '',
      frase: num(n.familias_sindicancia) ? `Famílias em sindicância; ${num(n.familias_sindicancia_30_dias)} há mais de ` +
        '30 dias.' : 'Nenhuma família em sindicância.'},
  ];
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

/** @return {?Object} A unidade aberta. */
function noAberto() {
  const raizes = (estado.dados && estado.dados.raizes) || [];
  let no = raizes[estado.raiz] || raizes[0] || null;
  for (const id of estado.caminho) {
    const filho = no && (no.filhos || []).find((f) => f.id === id);
    if (!filho) {
      break;
    }
    no = filho;
  }
  return no;
}

/** @return {!Array<!Object>} Os nós da raiz até a unidade aberta. */
function nosDoCaminho() {
  const raizes = (estado.dados && estado.dados.raizes) || [];
  const nos = [raizes[estado.raiz] || raizes[0]].filter(Boolean);
  for (const id of estado.caminho) {
    const filho = (nos[nos.length - 1].filhos || []).find((f) => f.id === id);
    if (!filho) {
      break;
    }
    nos.push(filho);
  }
  return nos;
}

/**
 * O resumo de uma unidade na lista: famílias, % visitadas na semana e, na linha de baixo, os alertas.
 * @param {!Object} f
 * @return {{meta: string, alertas: string}}
 */
function resumoDaUnidade(f) {
  const nAlertas = conferenciasDe(f).reduce((t, c) => t + alertasDaConferencia(c, true).length, 0);
  const partes = [];
  if (f.nivel === 'cp') {
    partes.push(plural(conferenciasDe(f).length, 'conferência', 'conferências'));
  }
  const fn = f.numeros || {};
  if (f.sem_dados) {
    partes.push('sem números');
  } else {
    partes.push(plural(num(fn.familias_assistidas), 'família', 'famílias'));
    if (num(fn.familias_assistidas)) {
      partes.push(num(fn.cobertura_semanal_pct) + '% visitadas na semana');
    }
  }
  if (f.nivel === 'cf' && f.teste) {
    partes.push('🧪 teste');
  }
  return {meta: partes.join(' · '), alertas: nAlertas ? '⚠️ ' + plural(nAlertas, 'alerta', 'alertas') : ''};
}

/**
 * Botão que abre uma unidade.
 * @param {!Object} f
 * @param {string} caminho Ids a acrescentar ao caminho, separados por "|" (do CC direto a uma conferência: CP|CF).
 * @return {string} HTML
 */
function botaoDaUnidade(f, caminho) {
  const r = resumoDaUnidade(f);
  return `<button type="button" class="unidade-botao" data-abrir="${esc(caminho)}">
    <span class="unidade-texto"><span class="unidade-nome">${esc(f.nome)}</span>
      <span class="unidade-meta">${esc(r.meta)}</span>
      ${r.alertas ? `<span class="unidade-alertas">${esc(r.alertas)}</span>` : ''}</span>
    <span class="unidade-seta" aria-hidden="true">›</span></button>`;
}

/**
 * No CC, cada CP é um card que abre e fecha (28/11/2026): aberto, mostra as conferências do CP (cada uma leva aos
 * detalhes dela) e, no fim, o botão para os números do CP.
 * @param {!Object} cp
 * @return {string} HTML
 */
function cardDoCp(cp) {
  const r = resumoDaUnidade(cp);
  const aberto = Boolean(estado.cpsAbertos[cp.id]);
  return `<li><details class="unidade-card"${aberto ? ' open' : ''} data-cp="${esc(cp.id)}">
    <summary>
      <span class="unidade-texto"><span class="unidade-nome">${esc(cp.nome)}</span>
        <span class="unidade-meta">${esc(r.meta)}</span>
        ${r.alertas ? `<span class="unidade-alertas">${esc(r.alertas)}</span>` : ''}</span>
      <span class="unidade-abre" aria-hidden="true"></span>
    </summary>
    <ul class="consolidacao-unidades unidade-filhas">
      ${(cp.filhos || []).map((c) => `<li>${botaoDaUnidade(c, cp.id + '|' + c.id)}</li>`).join('') ||
        '<li class="consolidacao-nota">Nenhuma conferência com números.</li>'}
    </ul>
    <button type="button" class="unidade-ver-cp" data-abrir="${esc(cp.id)}">Ver os números do ${esc(cp.nome)} ›</button>
  </details></li>`;
}

/** @param {!HTMLElement} caixa */
function desenhar(caixa) {
  const dados = estado.dados;
  if (!dados) {
    caixa.innerHTML = estado.erro ? `<p class="consolidacao-aviso">${esc(estado.erro)}</p>` :
      estado.semInternet ? '<p class="consolidacao-aviso">📵 Sem internet, e ainda não há números guardados neste ' +
        'celular. Abra esta tela de novo com internet.</p>' :
      '<p class="consolidacao-nota">Buscando os números…</p>';
    return;
  }
  const raizes = dados.raizes || [];
  if (!raizes.length) {
    caixa.innerHTML = `<p class="consolidacao-aviso">${esc(dados.mensagem || 'Ainda não há números para mostrar.')}</p>`;
    return;
  }
  const no = noAberto();
  const caminho = nosDoCaminho();
  const htmlRaizes = raizes.length > 1 ? `
    <div class="consolidacao-raizes" role="group" aria-label="Ver os números de">
      ${raizes.map((r, i) => `<button type="button" class="chip-filtro" data-raiz="${i}" aria-pressed="${i === estado.raiz}">${
  esc(r.nome)}</button>`).join('')}
    </div>` : '';
  const htmlCaminho = caminho.length > 1 || no.nivel !== 'cf' ? `<nav aria-label="Caminho"><ol class="consolidacao-caminho">${
    caminho.map((p, i) => (i === caminho.length - 1 ? `<li><span aria-current="page">${esc(p.nome)}</span></li>` :
      `<li><button type="button" data-voltar-nivel="${i}">${esc(p.nome)}</button></li>`)).join('')}</ol></nav>` :
    `<p class="consolidacao-caminho"><span aria-current="page">${esc(no.nome)}</span></p>`;

  const avisos = [];
  if (estado.semInternet || (estado.erro && estado.guardadaEm)) {
    avisos.push(`📵 ${estado.semInternet ? 'Sem internet' : esc(estado.erro)}: números guardados no celular em ${
      esc(quandoFoi(estado.guardadaEm))}.`);
  }
  if (no.so_teste) {
    avisos.push('🧪 Conferência de teste: os números são da demonstração (fictícios).');
  }

  const alertas = no.nivel === 'cf' && no.sem_dados ? [] : alertasDe(no);
  const htmlAlertas = alertas.length ?
    alertas.map((a) => `<li><span aria-hidden="true">⚠️</span><span>${esc(a)}</span></li>`).join('') :
    '<li class="tudo-bem"><span aria-hidden="true">✅</span><span>Nada precisa de atenção agora.</span></li>';

  let htmlNumeros;
  if (no.nivel === 'cf' && no.sem_dados) {
    htmlNumeros = '<p class="consolidacao-aviso">A última rodada não conseguiu abrir a planilha desta conferência. ' +
      'O Conselho Central foi avisado no resumo da rodada.</p>';
  } else if (!no.com_dados) {
    htmlNumeros = '<p class="consolidacao-aviso">Ainda não há números das conferências desta unidade.</p>';
  } else {
    htmlNumeros = `<ul class="consolidacao-indicadores">${indicadoresDe(no).map((i) => `
      <li class="consolidacao-indicador ${i.classe}">
        <p class="indicador-nome">${esc(i.nome)}</p>
        <p class="indicador-valor">${esc(i.valor)}</p>
        <p class="indicador-frase">${esc(i.frase)}</p>
      </li>`).join('')}</ul>`;
  }

  let htmlUnidades = '';
  if (no.nivel !== 'cf' && (no.filhos || []).length) {
    const deCp = no.filhos.every((f) => f.nivel === 'cp');
    htmlUnidades = `
      <h2 class="consolidacao-secao">${deCp ? 'Conselhos Particulares' : 'Conferências'}</h2>
      <ul class="consolidacao-unidades">${no.filhos.map((f) => (f.nivel === 'cp' ? cardDoCp(f) :
        `<li>${botaoDaUnidade(f, f.id)}</li>`)).join('')}</ul>`;
  }

  const atualizado = quandoFoi(no.atualizado_em || dados.atualizado_em);
  const htmlAvisos = avisos.map((a) => `<p class="consolidacao-aviso">${a}</p>`).join('');
  let htmlCorpo;
  if (htmlUnidades) {
    // CC e CP (28/11/2026): a lista primeiro; os alertas e as somas do conselho embaixo, abrindo com um toque.
    const nomeNivel = no.nivel === 'cc' ? 'do CC' : 'do CP';
    htmlCorpo = `
      ${htmlUnidades}
      <details class="consolidacao-dobra"${estado.abertos.alertas ? ' open' : ''} data-dobra="alertas">
        <summary><h2 class="consolidacao-secao">Precisa de atenção${alertas.length ? ` (${alertas.length})` : ''}</h2></summary>
        <ul class="consolidacao-alertas">${htmlAlertas}</ul>
      </details>
      <details class="consolidacao-dobra"${estado.abertos.numeros ? ' open' : ''} data-dobra="numeros">
        <summary><h2 class="consolidacao-secao">Números ${nomeNivel} no mês</h2></summary>
        ${htmlNumeros}
      </details>`;
  } else {
    htmlCorpo = `
      <h2 class="consolidacao-secao">Precisa de atenção</h2>
      <ul class="consolidacao-alertas">${htmlAlertas}</ul>
      <h2 class="consolidacao-secao">Números do mês</h2>
      ${htmlNumeros}`;
  }
  caixa.innerHTML = `
    ${htmlRaizes}
    ${htmlCaminho}
    ${htmlAvisos}
    ${htmlCorpo}
    <p class="consolidacao-nota">${atualizado ? 'Calculado em ' + esc(atualizado) + ' (o Conselho Central recalcula toda ' +
      'noite). ' : ''}Só números: nomes, endereços e relatos ficam na conferência.</p>`;
}

/** @param {!Event} e @param {!HTMLElement} caixa */
function aoTocar(e, caixa) {
  const abrir = e.target.closest('[data-abrir]');
  const voltarNivel = e.target.closest('[data-voltar-nivel]');
  const raiz = e.target.closest('[data-raiz]');
  if (abrir) {
    estado.caminho.push(...abrir.dataset.abrir.split('|'));
  } else if (voltarNivel) {
    estado.caminho = estado.caminho.slice(0, Number(voltarNivel.dataset.voltarNivel));
  } else if (raiz) {
    estado.raiz = Number(raiz.dataset.raiz);
    estado.caminho = [];
  } else {
    return;
  }
  desenhar(caixa);
  const area = document.getElementById('areaConteudo');
  if (area) {
    area.scrollTop = 0;
  }
}

/** @return {string} */
function textoParaOuvir() {
  const no = estado.dados ? noAberto() : null;
  if (!no) {
    return 'Consolidação. Os números da Diretoria ainda não chegaram.';
  }
  const alertas = alertasDe(no);
  const n = no.numeros || {};
  return `Consolidação de ${no.nome}. ` + (alertas.length ? 'Precisa de atenção: ' + alertas.join(' ') + ' ' :
    'Nada precisa de atenção agora. ') + (no.com_dados ? `${num(n.familias_assistidas)} famílias assistidas, ` +
    `${num(n.cobertura_semanal_pct)} por cento visitadas nos últimos 7 dias, ${num(n.familias_sem_visita_14_dias)} sem ` +
    'visita há mais de 14 dias.' : '');
}
