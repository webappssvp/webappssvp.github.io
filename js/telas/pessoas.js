/**
 * @fileoverview Tela Pessoas (#pessoas), a inicial. Decisões: mvp/telas/02_pessoas.md
 *
 * Lista as pessoas ativas da conferência com busca e filtro por papel. A lista vem do script do CC
 * (listar pessoas, pessoas_papeis e pessoas_cargos) e fica guardada no celular (store "pessoas", um registro por
 * pessoa) para abrir sem internet. Só nomes de exibição, papéis e cargos: nada cifrado é pedido aqui.
 * O que está na fila de sincronização (js/core/sync.js) aparece por cima, com o ícone de estado em cada cartão.
 * Para a diretoria (presidente, vice, secretário; 20/11/2026), o semáforo de acesso ao app em cada pessoa que entra no
 * app: verde, usando agora; amarelo, já entrou (com o último acesso); vermelho, ainda não entrou (Acessos.gs).
 * Dos atendidos, a lista mostra só o responsável (titular) de cada família; os outros moradores ficam na tela Famílias
 * e a busca ainda os encontra, para quem pode ver os contatos (21/11/2026).
 */

import {campoSenha, esc, pedirConexao} from './comum.js';
import {NOMES_DOS_CARGOS, ORDEM_DOS_CARGOS, siglaDoCargo} from '../core/cargos.js';
import {CARD_BAIXANDO} from '../componentes/carregando.js';
import {atualizarOpcoes, barraOcupada, definirBarra} from '../componentes/barra_tela.js';
import {chamarComSessao, conferirSenha} from '../componentes/barra_conexao.js';
import * as cofre from '../core/cofre.js';
import {atualizarGuardados, chaveBaixados, estaBaixando, eventosDados} from './pessoa_dados.js';
import {atualizarLista, eventosFamilias, ligacoesDasPessoas, moradoresComFila} from './familia_dados.js';
import {textoDoEstado} from '../componentes/icone_sync.js';
import {botaoDoItem, guardadosDaLista} from '../componentes/folha_item.js';
import {acaoSincronizar} from '../componentes/painel_sync.js';
import * as db from '../core/db.js';
import * as aniversarios from '../core/aniversarios.js';
import {vibrar} from '../core/preferencias.js';
import * as sync from '../core/sync.js';
import {renderizarDetalhe} from './pessoa_detalhe.js';
import {papeisQuePodeCadastrar, renderizarNova} from './pessoa_nova.js';

/** Papéis na ordem dos filtros. */
const PAPEIS = [
  {sigla: 'VIC', nome: 'Vicentino', plural: 'Vicentinos'},
  {sigla: 'ASP', nome: 'Aspirante', plural: 'Aspirantes'},
  {sigla: 'AST', nome: 'Assistido', plural: 'Assistidos'},
  {sigla: 'SOC', nome: 'Socorrido', plural: 'Socorridos'},
  {sigla: 'VIS', nome: 'Visitante', plural: 'Visitantes'},
  {sigla: 'BEN', nome: 'Benfeitor', plural: 'Benfeitores'},
];
const NOME_DO_PAPEL = Object.fromEntries(PAPEIS.map((p) => [p.sigla, p.nome]));

/** Cargos da diretoria, na ordem em que aparecem no topo da lista (js/core/cargos.js). */
const CARGOS = NOMES_DOS_CARGOS;
const ORDEM_CARGO = ORDEM_DOS_CARGOS;

/** Papéis de quem é atendido: destes, a lista mostra só o responsável pela família. */
const ATENDIDOS = ['AST', 'SOC'];
/** Papéis que entram no app (os que têm semáforo de acesso). */
const PAPEIS_COM_LOGIN = ['VIC', 'ASP', 'VIS', 'BEN'];
/** Quem vê o semáforo de acesso. */
const CARGOS_QUE_VEEM_ACESSOS = ['PCF', 'VCF', 'SCF'];
/** Os acessos são pedidos de novo, no máximo, a cada tanto (ao voltar para a tela). */
const ACESSOS_DE_NOVO_MS = 60 * 1000;
const ACESSO = {
  verde: {texto: 'Usando o app', plural: 'Usando agora'},
  amarelo: {texto: 'Já entrou no app', plural: 'Já entraram'},
  vermelho: {texto: 'Ainda não entrou no app', plural: 'Não entraram'},
};

/** Estado da tela (continua igual ao voltar para ela). */
const estado = {
  conferencia: '',
  lista: null, // {pessoas: [...], atualizado_em: ISO}, como veio do servidor
  fila: [], // sync.itens()
  carregando: false,
  deNovo: false, // um envio foi confirmado durante a busca: busca de novo no fim
  erro: '',
  filtro: 'TODOS',
  busca: '',
  guardados: {}, // id -> hora em que os detalhes foram guardados no celular (ícone de banco de dados)
  veAcessos: false, // diretoria: semáforo de acesso ao app
  acessos: null, // {ID_PESSOA: {entrou, ultimo, agora}} do servidor (acessos_da_conferencia)
  acessosEm: 0,
  filtroAcesso: 'TODOS', // TODOS, verde, amarelo ou vermelho
  familias: null, // lista guardada (familia_dados.js), para saber quem é responsável e quem é morador
  veMoradores: false, // CONTATOS_VER: a busca acha os moradores e diz em que família moram
  aniversarios: {}, // id -> aniversário de hoje até 6 dias depois (js/core/aniversarios.js): a vela no cartão
};

/** Relê os aniversários guardados e redesenha (a vela 🕯️ no cartão; 28/11/2026). */
async function lerAniversarios() {
  const cf = estado.conferencia;
  if (!cf) {
    return;
  }
  const lista = await aniversarios.daSemana(cf);
  if (cf === estado.conferencia) {
    estado.aniversarios = lista;
    desenharLista();
  }
}

aniversarios.eventos.addEventListener('mudou', (e) => {
  if (e.detail.conferencia === estado.conferencia) {
    lerAniversarios();
  }
});

/** @type {?HTMLElement} */
let areaAtual = null;

/** @param {string} id @return {string} Chave (store config) da hora em que a lista foi baixada. */
const chaveAtualizada = (id) => 'pessoas_atualizada:' + id;
/** @param {string} id @return {string} Marca: este celular já trocou a lista completa pelo resumo (visitante, benfeitor). */
const chaveResumoMoradores = (id) => 'resumo_moradores_v1:' + id;
/** @param {string} id @return {string} Pacote antigo (store config, antes da store "pessoas"). */
const chaveAntiga = (id) => 'pessoas_lista:' + id;

/** @return {!Object} Em que família cada pessoa mora (com o que está na fila). */
function ligacoes() {
  return estado.familias ?
    ligacoesDasPessoas(moradoresComFila(estado.familias, estado.fila, estado.conferencia)) : {};
}

/**
 * Sai da lista quem só é atendido e mora numa família que tem outro titular.
 * @param {!Object} p
 * @param {!Object} ligadas ligacoes()
 * @return {boolean}
 */
function ehMorador(p, ligadas) {
  const l = ligadas[p.id];
  return Boolean(l && !l.titular && l.temTitular && p.papeis.length && p.papeis.every((s) => ATENDIDOS.includes(s)));
}

/** As pessoas com o que está na fila por cima (cadastros, nomes, papéis, desativações). @return {!Array<!Object>} */
function pessoasComFila() {
  return estado.lista ? sync.aplicarFila(estado.lista.pessoas, estado.fila, estado.conferencia) : [];
}

/** Relê o que está guardado no celular e redesenha os ícones. */
async function lerGuardados() {
  const cf = estado.conferencia;
  if (!cf) {
    return;
  }
  const guardados = await guardadosDaLista(cf, 'pessoa');
  if (cf === estado.conferencia) {
    estado.guardados = guardados;
    desenharLista();
  }
}

// Começou ou terminou de guardar os dados para usar sem internet.
eventosDados.addEventListener('mudou', () => {
  desenharOffline();
  lerGuardados();
});
eventosDados.addEventListener('guardados', () => lerGuardados());
eventosFamilias.addEventListener('mudou', async (e) => {
  if (e.detail.conferencia === estado.conferencia) {
    estado.familias = await db.listar(db.STORES.FAMILIAS, estado.conferencia);
    desenharLista();
  }
});

// A sessão acabou: nada desta conferência fica na memória da tela.
eventosFamilias.addEventListener('saiu', (e) => {
  if (e.detail.conferencia === estado.conferencia) {
    Object.assign(estado, {conferencia: '', lista: null, erro: '', filtro: 'TODOS', busca: '', guardados: {},
      acessos: null, acessosEm: 0, filtroAcesso: 'TODOS', familias: null, carregando: false, deNovo: false});
  }
});

// A fila mudou: redesenha os ícones. Um envio foi aceito: relê a lista guardada e busca a do servidor.
sync.eventos.addEventListener('mudou', async () => {
  estado.fila = await sync.itens();
  desenharLista();
});
sync.eventos.addEventListener('baixar', () => {
  if (estado.conferencia && !estado.carregando) {
    atualizar();
  }
});
sync.eventos.addEventListener('confirmado', async (e) => {
  if (e.detail.conferencia !== estado.conferencia) {
    return;
  }
  await lerGuardada(estado.conferencia);
  estado.fila = await sync.itens();
  desenharLista();
  if (estado.carregando) {
    estado.deNovo = true;
  } else {
    atualizar();
  }
});

/**
 * @param {!HTMLElement} area
 * @param {?Object} sessao sessaoAtual() do barra_conexao.js
 * @param {string=} rota O que vem depois de "#pessoas/": o id da pessoa, para abrir os detalhes.
 * @return {string|function(): string} Texto (ou função que o monta) para o modo Ouvir.
 */
export function renderizar(area, sessao, rota = '') {
  if (!sessao) {
    return pedirConexao(area, 'Pessoas');
  }
  if (estado.conferencia !== sessao.id_conferencia) {
    Object.assign(estado, {conferencia: sessao.id_conferencia, lista: null, erro: '', filtro: 'TODOS', busca: '',
      guardados: {}, acessos: null, acessosEm: 0, filtroAcesso: 'TODOS', familias: null, aniversarios: {}});
    abrirConferencia(sessao.id_conferencia);
  }
  estado.euMesmo = String((sessao.perfil && sessao.perfil.id_pessoa) || '');
  estado.podeCadastrar = papeisQuePodeCadastrar((sessao.perfil && sessao.perfil.permissoes) || []).length > 0;
  const perfil = sessao.perfil || {};
  estado.veMoradores = (perfil.permissoes || []).includes('CONTATOS_VER');
  estado.veAcessos = Boolean(perfil.dev) || (perfil.cargos || []).some((c) => CARGOS_QUE_VEEM_ACESSOS.includes(siglaDoCargo(c)));
  if (rota === 'novo') {
    areaAtual = null;
    // Os nomes de exibição de quem já está na conferência, para a sugestão do nome da pessoa nova (null: lista não carregada).
    const nomes = estado.lista ? pessoasComFila().map((p) => p.nome) : null;
    return renderizarNova(area, sessao, {nomesNaConferencia: nomes});
  }
  if (rota) {
    areaAtual = null; // a lista não desenha por cima dos detalhes
    const resumo = pessoasComFila().find((p) => p.id === rota) || null;
    return renderizarDetalhe(area, sessao, rota, {resumo});
  }
  areaAtual = area;
  montar(area);
  lerGuardados();
  lerAniversarios();
  aniversarios.atualizar(sessao.id_conferencia, chamarComSessao); // no máximo 1 vez por hora; o evento redesenha
  buscarAcessos(false);
  return textoParaOuvir;
}

/**
 * Lê a lista guardada no celular (store "pessoas"; na primeira vez, o pacote antigo da store config).
 * @param {string} id
 */
async function lerGuardada(id) {
  let pessoas = await db.listar(db.STORES.PESSOAS, id);
  let atualizada = await db.lerConfig(chaveAtualizada(id));
  if (!pessoas.length && !atualizada) {
    const antiga = await db.lerConfig(chaveAntiga(id));
    if (!antiga) {
      return;
    }
    pessoas = antiga.pessoas;
    atualizada = antiga.atualizado_em;
  }
  if (estado.conferencia === id) {
    estado.lista = {pessoas, atualizado_em: atualizada || ''};
  }
}

/** Mostra a cópia guardada e busca a lista nova em seguida. @param {string} id */
async function abrirConferencia(id) {
  const [, fila, familias] = await Promise.all([estado.lista ? null : lerGuardada(id), sync.itens(),
    db.listar(db.STORES.FAMILIAS, id)]);
  if (estado.conferencia !== id) {
    return;
  }
  estado.fila = fila;
  estado.familias = familias.length ? familias : null;
  desenharLista();
  atualizar();
}

/** @param {string} id @return {string} Desde quando perguntar o que mudou na lista (hora do servidor, com folga). */
const chaveDesdeLista = (id) => 'pessoas_desde:' + id;

/** Folga na hora do servidor (pedir de novo umas linhas não estraga nada; perder uma, sim). */
const FOLGA_MS = 2 * 60 * 1000;

/**
 * Busca a lista no script do CC. Com uma lista já baixada, pergunta só o que mudou desde a última vez
 * (listar com "desde"): se nada mudou, não baixa nada. O botão de atualizar baixa tudo de novo
 * (pega também o que foi mudado à mão na planilha, que não marca a hora da mudança).
 * @param {{completo: (boolean|undefined)}=} opcoes
 */
async function atualizar(opcoes = {}) {
  if (estado.carregando) {
    return;
  }
  const id = estado.conferencia;
  estado.carregando = true;
  estado.erro = '';
  desenharLista();
  try {
    // Visitante e benfeitor (21/11/2026): o que este celular guardou antes do resumo é trocado uma vez, com internet.
    const trocarPeloResumo = !estado.veMoradores && navigator.onLine && !(await db.lerConfig(chaveResumoMoradores(id)));
    if (trocarPeloResumo) {
      opcoes = {...opcoes, completo: true};
    }
    // Sem nenhuma pessoa guardada no celular, baixa tudo (19/11/2026): se a lista foi apagada (Sair, sessão
    // vencida) e a marca "desde" sobrou, pedir só o que mudou dava uma lista vazia ("Ninguém com esse papel").
    const guardadas = opcoes.completo ? [] : await db.listar(db.STORES.PESSOAS, id);
    const desde = opcoes.completo || !guardadas.length ? null : await db.lerConfig(chaveDesdeLista(id));
    // Só o que mudou vem sem "apenas_ativas": uma desativação também é mudança.
    const listar = (aba) => chamarComSessao('listar', desde ? {aba, desde} : {aba, filtros: {apenas_ativas: true}});
    const respostas = await Promise.all([listar('pessoas'), listar('pessoas_papeis'), listar('pessoas_cargos')]);
    if (estado.conferencia !== id) {
      return;
    }
    const [pessoas, papeis, cargos] = respostas.map((r) => r.registros);
    const mudou = !desde || pessoas.length || papeis.length || cargos.length;
    const lista = desde ? mesclar(guardadas, pessoas, papeis, cargos) :
      juntar(pessoas, papeis, cargos);
    const agora = new Date().toISOString();
    if (mudou) {
      await db.substituirDaConferencia(db.STORES.PESSOAS, id,
          lista.map((p) => ({...p, chave: id + '|' + p.id, conferencia: id})));
    }
    const menor = Math.min(...respostas.map((r) => new Date(r.gerado_em || Date.now()).getTime()));
    await db.salvarConfig(chaveDesdeLista(id), new Date(menor - FOLGA_MS).toISOString());
    await db.salvarConfig(chaveAtualizada(id), agora);
    await db.apagarConfig(chaveAntiga(id));
    estado.lista = {pessoas: lista, atualizado_em: agora};
    if (trocarPeloResumo) {
      await Promise.all([db.substituirDaConferencia(db.STORES.DETALHES, id, []),
        db.substituirDaConferencia(db.STORES.DETALHES_FAMILIAS, id, [])]);
    }
    eventosFamilias.dispatchEvent(new CustomEvent('pessoas', {detail: {conferencia: id}}));
    // A lista trouxe mudança (ex.: data de nascimento corrigida) ou foi atualizada pelo botão: a vela vem de novo.
    if (mudou || opcoes.completo) {
      aniversarios.atualizar(id, chamarComSessao, true);
    }
    if (navigator.onLine) {
      // Quem é responsável vem da lista de famílias; se falhar, fica a guardada.
      atualizarLista(id, (acao, dados) => chamarComSessao(acao, dados), Boolean(opcoes.completo)).then(() =>
        (trocarPeloResumo ? db.salvarConfig(chaveResumoMoradores(id), new Date().toISOString()) : 0)).catch(() => 0);
    }
    atualizarGuardados(Boolean(opcoes.completo) && cofre.aberto(id)); // a cópia para usar sem internet também
  } catch (erro) {
    estado.erro = erro.message;
  } finally {
    estado.carregando = false;
    if (estado.conferencia === id) {
      desenharLista();
      if (!estado.erro) {
        buscarAcessos(true);
      }
      if (estado.deNovo) {
        estado.deNovo = false;
        atualizar();
      }
    }
  }
}

/**
 * Encerrado como o script entende em "apenas_ativas" (ativa = NÃO, ou com data de término).
 * @param {!Object} r
 * @return {boolean}
 */
function encerrado(r) {
  return /^(n[aã]o|false)$/i.test(String(r.ativa === undefined ? '' : r.ativa)) ||
    (r.data_termino !== undefined && r.data_termino !== null && String(r.data_termino) !== '');
}

/**
 * Cada pessoa da lista guarda os ids dos papéis e cargos ativos (papeis_ids, cargos_ids), para a lista poder
 * receber só o que mudou; papeis, cargo e provisorio saem deles.
 * @param {!Object} r
 * @return {!Object}
 */
function derivar(r) {
  const papeis = [...new Set(Object.values(r.papeis_ids))].sort((a, b) => PAPEIS.findIndex((x) => x.sigla === a) -
    PAPEIS.findIndex((x) => x.sigla === b));
  const cargo = Object.values(r.cargos_ids).sort((a, b) => ORDEM_CARGO.indexOf(a.sigla) - ORDEM_CARGO.indexOf(b.sigla))[0];
  return {...r, papeis, cargo: cargo ? cargo.sigla : '', provisorio: cargo ? cargo.provisorio : false};
}

/**
 * Aplica linhas de pessoas, papéis e cargos (todas, ou só as que mudaram) às pessoas da lista.
 * @param {!Object<string, !Object>} porId Pessoas da lista por id (alterado aqui).
 * @param {!Array<!Object>} pessoas
 * @param {!Array<!Object>} papeis
 * @param {!Array<!Object>} cargos
 * @return {!Array<!Object>} A lista, só com as pessoas ativas.
 */
function aplicarLinhas(porId, pessoas, papeis, cargos) {
  const tocadas = new Set();
  pessoas.forEach((p) => {
    const id = String(p.id_pessoa);
    if (encerrado(p)) {
      delete porId[id];
      return;
    }
    const antes = porId[id];
    porId[id] = {...(antes || {papeis_ids: {}, cargos_ids: {}, papeis: [], cargo: '', provisorio: false}), id,
      nome: String(p.nome_exibicao || '(sem nome)'), ficticio: String(p.ficticio).toUpperCase() === 'SIM'};
    tocadas.add(id);
  });
  const naPessoa = (x) => {
    const r = porId[String(x.id_pessoa)];
    if (r) {
      // Registro gravado pela fila (antes desta versão ou pelo efeito de um envio) pode não ter os ids.
      r.papeis_ids = r.papeis_ids || {};
      r.cargos_ids = r.cargos_ids || {};
      tocadas.add(r.id);
    }
    return r;
  };
  papeis.forEach((x) => {
    const r = naPessoa(x);
    if (r) {
      if (encerrado(x)) {
        delete r.papeis_ids[String(x.id_pessoa_papel)];
      } else {
        r.papeis_ids[String(x.id_pessoa_papel)] = String(x.id_papel).toUpperCase();
      }
    }
  });
  cargos.forEach((x) => {
    const r = naPessoa(x);
    if (r) {
      if (encerrado(x)) {
        delete r.cargos_ids[String(x.id_pessoa_cargo)];
      } else {
        r.cargos_ids[String(x.id_pessoa_cargo)] = {sigla: siglaDoCargo(x.id_cargo),
          provisorio: String(x.provisorio).toUpperCase() === 'SIM'};
      }
    }
  });
  tocadas.forEach((id) => {
    if (porId[id]) {
      porId[id] = derivar(porId[id]);
    }
  });
  return Object.values(porId);
}

/**
 * A lista inteira, a partir das linhas ativas.
 * @param {!Array<!Object>} pessoas
 * @param {!Array<!Object>} papeis
 * @param {!Array<!Object>} cargos
 * @return {!Array<{id: string, nome: string, papeis: !Array<string>, cargo: string, provisorio: boolean,
 *     ficticio: boolean, papeis_ids: !Object, cargos_ids: !Object}>}
 */
function juntar(pessoas, papeis, cargos) {
  return aplicarLinhas({}, pessoas, papeis, cargos);
}

/**
 * A lista guardada com só o que mudou por cima.
 * @param {!Array<!Object>} guardadas Store "pessoas" desta conferência.
 * @param {!Array<!Object>} pessoas
 * @param {!Array<!Object>} papeis
 * @param {!Array<!Object>} cargos
 * @return {!Array<!Object>}
 */
function mesclar(guardadas, pessoas, papeis, cargos) {
  const porId = {};
  guardadas.forEach((r) => {
    const {chave, conferencia, ...resto} = r; // eslint-disable-line no-unused-vars
    porId[r.id] = resto;
  });
  return aplicarLinhas(porId, pessoas, papeis, cargos);
}

/** Quem entrou sempre no topo; depois a diretoria (na ordem dos cargos) e os demais por nome. */
function ordenar(a, b) {
  const eu = (a.id === estado.euMesmo ? 0 : 1) - (b.id === estado.euMesmo ? 0 : 1);
  if (eu) {
    return eu;
  }
  const ca = a.cargo ? ORDEM_CARGO.indexOf(a.cargo) : 99;
  const cb = b.cargo ? ORDEM_CARGO.indexOf(b.cargo) : 99;
  return ca - cb || a.nome.localeCompare(b.nome, 'pt-BR');
}

/** @param {string} texto @return {string} Sem acentos e em minúsculas, para a busca. */
function simplificar(texto) {
  return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/**
 * Diretoria: pede ao servidor quem está usando o app, o último acesso e quem nunca entrou (só com internet; sem ela,
 * o semáforo some).
 * @param {boolean} forcar Pede mesmo que tenha pedido há menos de ACESSOS_DE_NOVO_MS.
 */
async function buscarAcessos(forcar) {
  const cf = estado.conferencia;
  // Sem forcar, com a lista sendo buscada (ou ainda por buscar): espera, porque o fim da busca pede os acessos.
  if (!estado.veAcessos || !cf || !navigator.onLine ||
      (!forcar && (estado.carregando || !estado.lista || Date.now() - estado.acessosEm < ACESSOS_DE_NOVO_MS))) {
    return;
  }
  estado.acessosEm = Date.now();
  try {
    const r = await chamarComSessao('acessos_da_conferencia');
    if (estado.conferencia === cf) {
      estado.acessos = r.acessos || {};
      desenharLista();
    }
  } catch (erro) {
    // sem o semáforo: a lista continua igual
  }
}

/**
 * @param {!Object} p
 * @return {string} verde, amarelo, vermelho ou '' (não entra no app, cadastro ainda no celular, ou sem os acessos).
 */
function corDoAcesso(p) {
  if (!estado.veAcessos || !estado.acessos || sync.ehProvisorio(p.id) ||
      !p.papeis.some((s) => PAPEIS_COM_LOGIN.includes(s))) {
    return '';
  }
  const a = estado.acessos[String(p.id).toUpperCase()];
  return a && a.agora ? 'verde' : a && a.entrou ? 'amarelo' : 'vermelho';
}

/** @param {!Object} p @return {string} HTML do semáforo de acesso no cartão. */
function sinalDeAcesso(p) {
  const cor = corDoAcesso(p);
  if (!cor) {
    return '';
  }
  let texto = ACESSO[cor].texto;
  const a = estado.acessos[String(p.id).toUpperCase()];
  if (cor === 'amarelo' && a && a.ultimo) {
    const d = new Date(a.ultimo);
    const dias = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
    const hora = d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
    texto = 'Último acesso: ' + (dias === 0 ? 'hoje às ' + hora : dias === 1 ? 'ontem às ' + hora :
      d.toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'}));
  }
  return `<span class="sinal-acesso sinal-acesso-${cor}">${esc(texto)}</span>`;
}

/** @return {!Array<!Object>} As pessoas que passam pelo filtro e pela busca, já ordenadas. */
function visiveis() {
  if (!estado.lista) {
    return [];
  }
  const busca = simplificar(estado.busca.trim());
  const ligadas = ligacoes();
  return pessoasComFila()
      .filter((p) => !ehMorador(p, ligadas) || (estado.veMoradores && busca && simplificar(p.nome).includes(busca)))
      .filter((p) => estado.filtroAcesso === 'TODOS' || corDoAcesso(p) === estado.filtroAcesso)
      .filter((p) => estado.filtro === 'TODOS' || p.papeis.includes(estado.filtro))
      .filter((p) => !busca || simplificar(p.nome).includes(busca))
      .sort(ordenar);
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

/** Estrutura fixa da tela (busca e filtros não são redesenhados a cada letra). @param {!HTMLElement} area */
function montar(area) {
  area.innerHTML = `
    <div class="tela-pessoas">
      <p class="pessoas-situacao" id="situacaoPessoas" role="status"></p>
      <div class="pessoas-offline" id="offlinePessoas"></div>
      <ul class="lista-pessoas" id="listaPessoas"></ul>
    </div>`;
  area.querySelector('#offlinePessoas').addEventListener('click', tocarOffline);
  area.querySelector('#offlinePessoas').addEventListener('submit', enviarSenhaOffline);
  estado.pedindoSenha = false;
  desenharOffline();
  // Título e Opções (buscar, mostrar e ações) ficam na barra da tela (decisões de 15/11/2026).
  definirBarra({titulo: 'Pessoas', opcoes: opcoesDaBarra()});
  desenharLista();
}

/** @return {!Array<{valor: string, texto: string, n: number}>} Os papéis que têm alguém, mais o escolhido. */
function filtrosDisponiveis() {
  const ligadas = ligacoes();
  const pessoas = pessoasComFila().filter((p) => !ehMorador(p, ligadas));
  const conta = (sigla) => pessoas.filter((p) => p.papeis.includes(sigla)).length;
  // Quantas de cada filtro têm mudança esperando para ir à planilha (o filtro ganha destaque).
  const estados = sync.estadosPorPessoa(estado.fila, estado.conferencia);
  const esperando = pessoas.filter((p) => sync.A_ENVIAR.includes(estados[p.id]));
  const aEnviar = (sigla) => esperando.filter((p) => p.papeis.includes(sigla)).length;
  return [{valor: 'TODOS', texto: 'Todos', n: pessoas.length, aEnviar: esperando.length}]
      .concat(PAPEIS.map((p) => ({valor: p.sigla, texto: p.plural, n: conta(p.sigla), aEnviar: aEnviar(p.sigla)}))
          .filter((p) => p.n || p.valor === estado.filtro));
}

/** @return {!Array<!Object>} Diretoria, com os acessos: o filtro pelo semáforo (Opções > Acesso ao app). */
function filtroDeAcesso() {
  if (!estado.veAcessos || !estado.acessos) {
    return [];
  }
  const pessoas = pessoasComFila();
  const conta = (cor) => pessoas.filter((p) => corDoAcesso(p) === cor).length;
  return [{titulo: 'Acesso ao app', valor: estado.filtroAcesso, padrao: 'TODOS',
    itens: [{valor: 'TODOS', texto: 'Todos'}].concat(['verde', 'amarelo', 'vermelho']
        .map((cor) => ({valor: cor, texto: ACESSO[cor].plural, n: conta(cor)}))),
    aoEscolher: (v) => {
      estado.filtroAcesso = v;
      desenharLista();
    }}];
}

/** @return {!Object} Opções da barra da tela: buscar, mostrar e ações. */
function opcoesDaBarra() {
  return {
    busca: {valor: estado.busca, rotulo: 'Buscar pelo nome', aoMudar: (v) => {
      estado.busca = v;
      desenharLista();
    }},
    filtros: [{titulo: 'Mostrar', valor: estado.filtro, padrao: 'TODOS', itens: filtrosDisponiveis(),
      aoEscolher: (v) => {
        estado.filtro = v;
        desenharLista();
      }}].concat(filtroDeAcesso()),
    acoes: [estado.podeCadastrar ? {texto: '+ Nova pessoa', aoTocar: () => {
      location.hash = '#pessoas/novo';
    }} : null,
    // Envia o que espera e baixa tudo (pega também o que foi mudado à mão na planilha).
    acaoSincronizar(estado.fila, estado.conferencia, () => atualizar({completo: true}))].filter(Boolean),
    resultado: visiveis().length,
    aoLimpar: () => {
      estado.busca = '';
      estado.filtro = 'TODOS';
      estado.filtroAcesso = 'TODOS';
      desenharLista();
    },
  };
}

/** Filtros, situação e cartões. */
function desenharLista() {
  const area = areaAtual;
  if (!area || !area.querySelector('#listaPessoas')) {
    return;
  }
  atualizarOpcoes(opcoesDaBarra());
  const lista = visiveis();
  area.querySelector('#situacaoPessoas').innerHTML = situacao(lista.length);
  area.querySelector('#situacaoPessoas').className = 'pessoas-situacao' + (estado.erro ? ' com-erro' : '');
  barraOcupada(estado.carregando);
  const estados = sync.estadosPorPessoa(estado.fila, estado.conferencia);
  const ligadas = ligacoes();
  const motivos = {};
  estado.fila.filter((i) => i.conferencia === estado.conferencia && i.estado === sync.ESTADOS.RECUSADO)
      .forEach((i) => {
        motivos[i.id_pessoa] = i.ultimo_erro;
      });
  area.querySelector('#listaPessoas').innerHTML = lista.map((p) => cartao(p, estados[p.id] || sync.ESTADOS.CONFIRMADO,
      motivos[p.id] || '', ligadas)).join('');
}

// ---------------------------------------------------------------------------
// Dados guardados para usar sem internet (cifrados com a senha; js/telas/pessoa_dados.js)
// ---------------------------------------------------------------------------

/** "Para usar sem internet: dados de 12/11 · Atualizar" (ou "Guardar"), com o pedido de senha. */
async function desenharOffline() {
  const area = areaAtual;
  const caixa = area && area.querySelector('#offlinePessoas');
  const cf = estado.conferencia;
  if (!caixa || !cf) {
    return;
  }
  const baixados = await db.lerConfig(chaveBaixados(cf));
  if (estado.pedindoSenha && caixa.querySelector('#iptSenhaOffline')) {
    return; // não apaga a senha sendo digitada
  }
  let texto;
  let botao = '';
  if (estaBaixando(cf)) {
    texto = esc('Guardando os dados para usar sem internet') + CARD_BAIXANDO;
  } else if (baixados) {
    const d = new Date(baixados);
    const hoje = new Date().toDateString() === d.toDateString();
    texto = esc('Para usar sem internet: dados de ' + (hoje ? 'hoje' : d.toLocaleDateString('pt-BR')) + ' às ' +
      d.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'}));
    botao = 'Atualizar';
  } else {
    texto = esc('Os dados ainda não estão guardados para usar sem internet.');
    botao = 'Guardar';
  }
  const form = estado.pedindoSenha ? `
    <form class="form-senha-offline" novalidate>
      ${campoSenha('iptSenhaOffline', 'Sua senha (a mesma com que você entra no app)')}
      <button type="submit" class="btn-submit" id="btnSenhaOffline">${botao || 'Atualizar'}</button>
      <p class="feedback-msg" id="msgSenhaOffline" role="status"></p>
    </form>` : '';
  caixa.innerHTML = `<p class="pessoas-offline-linha">${texto}${botao && !estado.pedindoSenha ?
    ` · <button type="button" class="link-offline" data-offline="atualizar">${botao}</button>` : ''}</p>${form}`;
}

/** Toque em "Atualizar"/"Guardar": com o cofre aberto, baixa; senão pede a senha. @param {!Event} e */
function tocarOffline(e) {
  if (!e.target.closest('[data-offline="atualizar"]')) {
    return;
  }
  vibrar();
  if (!navigator.onLine) {
    avisarAqui('Sem internet agora: para atualizar os dados guardados, conecte-se.');
    return;
  }
  if (cofre.aberto(estado.conferencia)) {
    atualizarGuardados(true);
    return;
  }
  estado.pedindoSenha = true;
  desenharOffline().then(() => {
    const campo = areaAtual && areaAtual.querySelector('#iptSenhaOffline');
    if (campo) {
      campo.focus();
    }
  });
}

/** A senha é conferida no servidor (entra de novo); certa, abre o cofre e baixa. @param {!Event} e */
async function enviarSenhaOffline(e) {
  e.preventDefault();
  const area = areaAtual;
  const campo = area.querySelector('#iptSenhaOffline');
  const msg = area.querySelector('#msgSenhaOffline');
  const botao = area.querySelector('#btnSenhaOffline');
  if (!campo.value) {
    msg.textContent = 'Digite a sua senha.';
    msg.className = 'feedback-msg erro';
    return;
  }
  const senha = campo.value;
  campo.value = '';
  botao.disabled = true;
  try {
    await conferirSenha(senha); // abre (ou refaz) o cofre pelo aoEntrarComSenha
    estado.pedindoSenha = false;
    atualizarGuardados(true);
    desenharOffline();
  } catch (erro) {
    botao.disabled = false;
    msg.textContent = erro.message;
    msg.className = 'feedback-msg erro';
    campo.focus();
  }
}

/** @param {string} texto */
function avisarAqui(texto) {
  const caixa = areaAtual && areaAtual.querySelector('#offlinePessoas');
  if (caixa) {
    caixa.querySelector('.pessoas-offline-linha').textContent = texto;
  }
}

/** @param {number} n Pessoas visíveis. @return {string} HTML */
function situacao(n) {
  if (!estado.lista) {
    if (estado.erro) {
      return esc(estado.erro);
    }
    return estado.carregando ? 'Buscando as pessoas da conferência' + CARD_BAIXANDO : '';
  }
  if (!estado.lista.atualizado_em) {
    return esc(n === 1 ? '1 pessoa' : n + ' pessoas') + (estado.carregando ? esc(' · atualizando') + CARD_BAIXANDO : '');
  }
  const quando = new Date(estado.lista.atualizado_em);
  const hoje = new Date().toDateString() === quando.toDateString();
  const hora = quando.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'});
  const data = hoje ? 'hoje às ' + hora : quando.toLocaleDateString('pt-BR') + ' às ' + hora;
  const vazio = n ? '' : (estado.busca ? 'Ninguém com esse nome. ' : 'Ninguém com esse papel. ');
  const ligadas = ligacoes();
  const moradores = estado.busca.trim() || estado.filtro !== 'TODOS' || estado.filtroAcesso !== 'TODOS' ? 0 :
    pessoasComFila().filter((p) => ehMorador(p, ligadas)).length;
  const contagem = vazio + (n === 1 ? '1 pessoa' : n + ' pessoas') +
    (moradores ? ' + ' + moradores + (moradores === 1 ? ' morador' : ' moradores') + ' em Famílias' : '');
  if (estado.erro) {
    return esc(contagem + ' · lista guardada no celular, de ' + data + '. ' + estado.erro);
  }
  return esc(contagem + ' · atualizada ' + data) + (estado.carregando ? esc(' · atualizando') + CARD_BAIXANDO : '');
}

/** @param {string} nome @return {string} Até duas iniciais. */
function iniciais(nome) {
  const partes = nome.split(/\s+/).filter((p) => p && !/^(d[aeo]s?|e)$/i.test(p));
  return ((partes[0] || '?')[0] + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

/**
 * @param {!Object} p Pessoa de juntar().
 * @param {string} situacaoSync Estado na fila (confirmado se não está nela).
 * @param {string} motivo Mensagem do servidor, se recusado.
 * @param {!Object} ligadas ligacoes()
 * @return {string} HTML
 */
function cartao(p, situacaoSync, motivo, ligadas) {
  const l = ligadas[p.id];
  const morador = ehMorador(p, ligadas);
  const destino = morador ? '#familias/' + encodeURIComponent(l.id_familia) : '#pessoas/' + encodeURIComponent(p.id);
  const responsavel = Boolean(l && l.titular && p.papeis.some((s) => ATENDIDOS.includes(s)));
  const papeis = morador ? 'Mora na ' + (/^fam[ií]lia\s/i.test(l.nome_familia) ? '' : 'família ') + l.nome_familia :
    (p.papeis.map((s) => NOME_DO_PAPEL[s] || s).join(' · ') || 'Sem papel ativo') +
    (responsavel ? ' · responsável pela família' : '');
  const cargo = p.cargo ? `<span class="selo-cargo">${esc(CARGOS[p.cargo] || p.cargo)}${p.provisorio ?
    ' (provisório)' : ''}</span>` : '';
  const exemplo = (p.id === estado.euMesmo ? '<span class="selo-voce">Você</span>' : '') +
    (p.ficticio ? '<span class="selo-exemplo">EXEMPLO</span>' : '');
  const tipo = (p.papeis[0] || 'X').toLowerCase();
  // O par de ícones é um botão ao lado do link (botão dentro de link não vale): abre a folhinha do item.
  return `
    <li class="cartao-com-icones"><a class="cartao-pessoa${p.cargo ? ' da-diretoria' : ''}${p.id === estado.euMesmo ? ' e-voce' : ''}" href="${esc(destino)}">
      <span class="avatar-pessoa avatar-${tipo}" aria-hidden="true">${esc(iniciais(p.nome))}</span>
      <span class="cartao-pessoa-texto">
        <span class="cartao-pessoa-nome">${esc(p.nome)}</span>
        <span class="cartao-pessoa-papel">${esc(papeis)}</span>
        ${cargo || exemplo ? `<span class="cartao-pessoa-selos">${cargo}${exemplo}</span>` : ''}
        ${aniversarios.selo(estado.aniversarios[p.id])}
        ${sinalDeAcesso(p)}
      </span>
      <span class="cartao-pessoa-seta" aria-hidden="true">›</span>
    </a>${botaoDoItem({tipo: 'pessoa', id: p.id, nome: p.nome, estado: situacaoSync, motivo,
      guardadoEm: estado.guardados[p.id] || ''})}</li>`;
}

/** @return {string} O que o modo Ouvir lê. */
function textoParaOuvir() {
  const lista = visiveis();
  if (!lista.length) {
    return 'Pessoas. ' + (estado.lista ? 'Nenhuma pessoa na lista.' : 'Buscando a lista.');
  }
  const estados = sync.estadosPorPessoa(estado.fila, estado.conferencia);
  const nomes = lista.slice(0, 10).map((p) => p.nome + (p.cargo ? ', ' + CARGOS[p.cargo] : '') +
    (estado.aniversarios[p.id] ? ', aniversário ' + estado.aniversarios[p.id].texto.toLowerCase() : '') +
    (estados[p.id] ? ', ' + textoDoEstado(estados[p.id]).toLowerCase() : '')).join('; ');
  const naFila = lista.filter((p) => estados[p.id]).length;
  return 'Pessoas. ' + lista.length + (lista.length === 1 ? ' pessoa' : ' pessoas') + '. ' +
      (naFila ? naFila + ' com mudanças que a nuvem ainda não confirmou. ' : '') + nomes +
      (lista.length > 10 ? '; e mais ' + (lista.length - 10) + '.' : '.');
}
