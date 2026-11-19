/**
 * @fileoverview Fila de sincronização. Decisões: mvp/telas/05_sincronizacao.md (14/11/2026).
 *
 * Um caminho só para gravar: a tela põe o pedido na fila (IndexedDB, store "fila") e a fila envia ao script do CC,
 * com ou sem internet na hora. Cada item é uma ação do vicentino (cadastrar, editar, mudar papel, desativar),
 * com as operações do "lote" do script e o efeito na lista (para a tela mostrar a mudança antes da confirmação).
 *
 * - Ids provisórios: "tmp-<uuid>". Toda operação que cria registro leva um, então reenviar nunca duplica
 *   (o script grava a troca em _ids_provisorios e devolve o mesmo id).
 * - Envio em ordem, por conferência, em lotes de até 50 operações; um item nunca é dividido.
 * - Estados do item: local (só no celular), enviando, sem_confirmacao (a resposta não chegou), recusado.
 *   Confirmado = saiu da fila.
 * - Envio automático ao abrir o app, ao voltar a internet e logo depois de gravar, respeitando "só Wi-Fi".
 *   O toque no botão Nuvem envia mesmo nos dados móveis (a casca pergunta antes).
 * - Preferência "Enviar: quando eu mandar" (17/11/2026): o automático leva só o relato de visita (e o que ele
 *   precisa antes, como a família cadastrada sem internet). O resto espera o "Enviar tudo".
 */

/** Vão na hora mesmo com "quando eu mandar": a dupla e o presidente precisam ver logo. */
const SEMPRE_NA_HORA = ['visita'];

/** Com "quando eu mandar", mudanças paradas há mais que isso fazem o app lembrar ao abrir. */
export const LEMBRAR_DEPOIS_MS = 24 * 60 * 60 * 1000;

/** @return {boolean} O vicentino escolheu juntar as mudanças e enviar quando mandar. */
export const juntando = () => prefs.envio === 'quando_mandar';

import * as db from './db.js';
import {eventosPreferencias, podeSincronizar, prefs} from './preferencias.js';
import {formularioSalvo} from './uso.js';

export const ESTADOS = {LOCAL: 'local', ENVIANDO: 'enviando', SEM_CONFIRMACAO: 'sem_confirmacao', RECUSADO: 'recusado',
  CONFIRMADO: 'confirmado'};

/** Estados de quem ainda vai para a planilha (o recusado espera alguém decidir). */
export const A_ENVIAR = ['local', 'sem_confirmacao', 'enviando'];

/** Do menos ao mais grave: o ícone de uma pessoa mostra o pior estado dos itens dela. */
const GRAVIDADE = {confirmado: 0, local: 1, sem_confirmacao: 2, enviando: 3, recusado: 4};

const LIMITE_LOTE = 50;
const CHAVE_ULTIMO_ENVIO = 'sync_ultimo_envio';
const PADRAO_TMP = /tmp-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const CRIA_REGISTRO = ['inserir', 'cadastrar_pessoa', 'cadastrar_socorrido'];

/**
 * Avisos para as telas e a casca:
 * - "mudou": a fila mudou (item novo, estado, envio começou ou terminou);
 * - "confirmado": {detail: {conferencia, trocas}} um ou mais itens foram aceitos pelo servidor;
 * - "baixar": o vicentino pediu "Sincronizar agora": as telas abertas baixam as listas de novo.
 */
export const eventos = new EventTarget();

const estado = {
  chamar: null, // (idConferencia, urlApi, acao, dados) => Promise
  conferencias: () => [], // conferências com sessão neste celular
  envio: null, // Promise do envio em andamento
  timer: 0,
  ultimoEnvio: '',
};

/** @param {string} nome @param {!Object=} detalhe */
function avisar(nome, detalhe) {
  eventos.dispatchEvent(new CustomEvent(nome, {detail: detalhe || {}}));
}

/**
 * @param {{chamar: function(string, string, string, !Object): !Promise<!Object>,
 *     conferencias: function(): !Array<string>}} opcoes
 */
export async function iniciarSync(opcoes) {
  estado.chamar = opcoes.chamar;
  estado.conferencias = opcoes.conferencias;
  estado.ultimoEnvio = (await db.lerConfig(CHAVE_ULTIMO_ENVIO)) || '';
  // O app fechou no meio de um envio: não se sabe se chegou.
  const presos = (await db.listar(db.STORES.FILA)).filter((i) => i.estado === ESTADOS.ENVIANDO);
  if (presos.length) {
    await db.gravar(db.STORES.FILA, presos.map((i) => ({...i, estado: ESTADOS.SEM_CONFIRMACAO})));
  }
  window.addEventListener('online', () => agendarEnvio());
  // Mudou a forma de enviar: o botão Nuvem e a aba se redesenham; voltou para "na hora", o que esperava já vai.
  eventosPreferencias.addEventListener('mudou', (e) => {
    if (e.detail.chave === 'envio') {
      avisar('mudou');
      agendarEnvio();
    }
  });
  avisar('mudou');
  agendarEnvio();
}

/** @return {string} Id provisório novo ("tmp-<uuid>"). */
export function novoProvisorio() {
  if (crypto.randomUUID) {
    return 'tmp-' + crypto.randomUUID();
  }
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return 'tmp-' + h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}

/** @param {*} id @return {boolean} */
export function ehProvisorio(id) {
  return typeof id === 'string' && /^tmp-/.test(id);
}

/**
 * Põe uma ação na fila e tenta enviar.
 * @param {{conferencia: string, url_api: string, tipo: string, descricao: string,
 *     id_pessoa: string, operacoes: !Array<!Object>, efeito: (!Object|!Array<!Object>|undefined),
 *     efeito_familia: (!Object|undefined)}} item
 *     id_pessoa: a pessoa (ou a família) do ícone na lista. efeito: nas pessoas da lista; efeito_familia: na lista de
 *     famílias ({id, situacao?, encerrada_em?, moradores?, bairro?}).
 *     tipo: cadastrar, editar, papel ou desativar (a aba Sincronização agrupa por ele).
 * @return {!Promise<!Object>} O item gravado.
 */
export async function enfileirar(item) {
  const operacoes = item.operacoes.map((op) => (CRIA_REGISTRO.includes(op.acao) && !op.temp_uuid ?
    {...op, temp_uuid: novoProvisorio()} : op));
  const gravado = {...item, operacoes, id_operacao: novoProvisorio().slice(4), estado: ESTADOS.LOCAL, tentativas: 0,
    ultimo_erro: '', criado_em: new Date().toISOString(), enviado_em: ''};
  await db.gravar(db.STORES.FILA, [gravado]);
  formularioSalvo(); // uso do app: o formulário começado foi salvo (uso.js)
  avisar('mudou');
  agendarEnvio();
  return gravado;
}

/** @return {!Promise<!Array<!Object>>} Todos os itens, na ordem em que foram gravados. */
export async function itens() {
  return (await db.listar(db.STORES.FILA)).sort((a, b) => a.criado_em.localeCompare(b.criado_em));
}

/** "Sincronizar agora": depois de enviar, as telas abertas baixam as listas de novo (evento "baixar"). */
export function pedirListas() {
  avisar('baixar');
}

/** @return {boolean} */
export function enviando() {
  return Boolean(estado.envio);
}

/** @return {string} ISO do último envio aceito, ou ''. */
export function ultimoEnvio() {
  return estado.ultimoEnvio;
}

/** @param {!Object} item @return {number} Bytes que o item ocupa (o que vai pela internet). */
export function tamanho(item) {
  return new Blob([JSON.stringify(item.operacoes)]).size;
}

/**
 * Estado de cada pessoa com algo na fila (as outras estão confirmadas).
 * @param {!Array<!Object>} lista itens()
 * @param {string} conferencia
 * @return {!Object<string, string>} id_pessoa → estado
 */
export function estadosPorPessoa(lista, conferencia) {
  const porId = {};
  lista.filter((i) => i.conferencia === conferencia && i.id_pessoa).forEach((i) => {
    const atual = porId[i.id_pessoa];
    if (!atual || GRAVIDADE[i.estado] > GRAVIDADE[atual]) {
      porId[i.id_pessoa] = i.estado;
    }
  });
  return porId;
}

/**
 * Aplica à lista de pessoas o que está na fila (cadastros, nomes e papéis novos, desativações).
 * @param {!Array<!Object>} pessoas Lista como veio do servidor.
 * @param {!Array<!Object>} lista itens()
 * @param {string} conferencia
 * @return {!Array<!Object>} Cópia com as mudanças.
 */
export function aplicarFila(pessoas, lista, conferencia) {
  let resultado = pessoas.slice();
  lista.filter((i) => i.conferencia === conferencia).forEach((i) => {
    efeitosDe(i).forEach((efeito) => {
      resultado = aplicarEfeito(resultado, efeito);
    });
  });
  return resultado;
}

/**
 * @param {!Array<!Object>} pessoas
 * @param {!Object} efeito {id, novo?: {nome, papeis}, nome?, papeis?, removida?}
 * @return {!Array<!Object>}
 */
function aplicarEfeito(pessoas, efeito) {
  if (efeito.removida) {
    return pessoas.filter((p) => p.id !== efeito.id);
  }
  if (efeito.novo) {
    return pessoas.filter((p) => p.id !== efeito.id).concat([{id: efeito.id, cargo: '', provisorio: false,
      ficticio: false, ...efeito.novo}]);
  }
  return pessoas.map((p) => (p.id !== efeito.id ? p : {...p, ...(efeito.nome ? {nome: efeito.nome} : {}),
    ...(efeito.papeis ? {papeis: efeito.papeis} : {})}));
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

/** Envio automático, um instante depois (junta gravações seguidas). */
export function agendarEnvio() {
  clearTimeout(estado.timer);
  estado.timer = setTimeout(() => enviar({manual: false}), 400);
}

/**
 * Envia a fila de todas as conferências com sessão.
 * @param {{manual: boolean}} opcoes manual: toque no botão (ignora "só Wi-Fi").
 * @return {!Promise<string>} '' se tentou; senão o motivo: 'sem_internet', 'so_wifi', 'vazia'.
 */
export function enviar(opcoes) {
  if (estado.envio) {
    return estado.envio;
  }
  estado.envio = enviarTudo(opcoes).finally(() => {
    estado.envio = null;
    avisar('mudou');
  });
  avisar('mudou');
  return estado.envio;
}

/** @param {{manual: boolean}} opcoes @return {!Promise<string>} */
async function enviarTudo(opcoes) {
  if (!estado.chamar) {
    return 'vazia';
  }
  const comSessao = estado.conferencias();
  let fila = (await itens()).filter((i) => comSessao.includes(i.conferencia) && i.estado !== ESTADOS.RECUSADO);
  // "Quando eu mandar": o automático leva só o que vai sempre na hora, com o que ele precisa antes.
  const so = !opcoes.manual && juntando() ? necessarios(fila) : null;
  if (so) {
    fila = fila.filter((i) => so.has(i.id_operacao));
  }
  if (!fila.length) {
    return 'vazia';
  }
  if (!navigator.onLine) {
    return 'sem_internet';
  }
  if (!opcoes.manual && !podeSincronizar().pode) {
    return 'so_wifi';
  }
  const conferencias = [...new Set(fila.map((i) => i.conferencia))];
  for (const cf of conferencias) {
    await enviarConferencia(cf, so);
  }
  return '';
}

/**
 * Os itens que vão sempre na hora e, antes deles, os que criam os ids provisórios que eles usam.
 * @param {!Array<!Object>} fila Em ordem.
 * @return {!Set<string>} id_operacao
 */
function necessarios(fila) {
  const ids = new Set();
  const precisa = new Set();
  for (let n = fila.length - 1; n >= 0; n--) {
    const i = fila[n];
    if (SEMPRE_NA_HORA.includes(i.tipo) || criados(i).some((t) => precisa.has(t))) {
      ids.add(i.id_operacao);
      usados(i).forEach((t) => precisa.add(t));
    }
  }
  return ids;
}

/**
 * Com "quando eu mandar": há mudanças esperando há mais de um dia? (a casca lembra ao abrir o app).
 * @return {!Promise<number>} Quantas estão esperando, se a mais antiga passou do prazo; senão 0.
 */
export async function esperandoDemais() {
  const lista = (await itens()).filter((i) => i.estado !== ESTADOS.RECUSADO);
  if (!juntando() || !lista.length || Date.now() - new Date(lista[0].criado_em).getTime() < LEMBRAR_DEPOIS_MS) {
    return 0;
  }
  return lista.length;
}

/** @param {!Object} item @return {!Array<string>} Ids provisórios que o item cria. */
const criados = (item) => item.operacoes.map((op) => op.temp_uuid).filter(ehProvisorio);

/** @param {!Object} item @return {!Array<string>} Ids provisórios de outros itens que este usa. */
function usados(item) {
  const proprios = criados(item);
  return [...new Set(JSON.stringify(item.operacoes).match(PADRAO_TMP) || [])].filter((t) => !proprios.includes(t));
}

/**
 * @param {string} conferencia
 * @param {?Set<string>=} so Só estes itens (id_operacao); null: todos.
 */
async function enviarConferencia(conferencia, so = null) {
  const daConferencia = (await itens()).filter((i) => i.conferencia === conferencia &&
    (!so || so.has(i.id_operacao)));
  // O que depende de um item recusado (ou de outro que depende dele) espera: o servidor não teria o id.
  const bloqueados = new Set();
  daConferencia.forEach((i) => {
    if (i.estado === ESTADOS.RECUSADO || usados(i).some((t) => bloqueados.has(t))) {
      criados(i).forEach((t) => bloqueados.add(t));
    }
  });
  const prontos = daConferencia.filter((i) => i.estado !== ESTADOS.RECUSADO && !usados(i).some((t) => bloqueados.has(t)));
  // Lotes de até 50 operações, sem dividir um item.
  const lotes = [];
  prontos.forEach((i) => {
    const ultimo = lotes[lotes.length - 1];
    if (ultimo && ultimo.reduce((n, x) => n + x.operacoes.length, 0) + i.operacoes.length <= LIMITE_LOTE) {
      ultimo.push(i);
    } else {
      lotes.push([i]);
    }
  });
  for (const lote of lotes) {
    if (!(await enviarLote(conferencia, lote))) {
      return; // sem conexão ou sem sessão: tenta de novo depois
    }
  }
}

/**
 * @param {string} conferencia
 * @param {!Array<!Object>} lote Itens (já atualizados com os ids trocados pelos lotes anteriores).
 * @return {!Promise<boolean>} false se o envio parou (rede, sessão): os lotes seguintes esperam.
 */
async function enviarLote(conferencia, lote) {
  // Relê: um lote anterior pode ter trocado ids provisórios nestes itens.
  const atuais = (await itens()).filter((i) => lote.some((x) => x.id_operacao === i.id_operacao));
  if (!atuais.length) {
    return true;
  }
  const anteriores = atuais.map((i) => i.estado);
  await db.gravar(db.STORES.FILA, atuais.map((i) => ({...i, estado: ESTADOS.ENVIANDO,
    tentativas: (i.tentativas || 0) + 1, enviado_em: new Date().toISOString()})));
  avisar('mudou');
  let resposta;
  try {
    resposta = await estado.chamar(conferencia, atuais[0].url_api, 'lote',
        {operacoes: atuais.flatMap((i) => i.operacoes)});
  } catch (erro) {
    const codigo = erro.codigo || '';
    if (['SEM_INTERNET', 'OCUPADO', 'SEM_SESSAO'].includes(codigo)) {
      // Não chegou a gravar: volta como estava.
      await db.gravar(db.STORES.FILA, atuais.map((i, n) => ({...i, estado: anteriores[n],
        ultimo_erro: codigo === 'SEM_SESSAO' ? 'Entre de novo na conferência para enviar.' : erro.message})));
      return false;
    }
    if (['SEM_CONEXAO', 'RESPOSTA_INVALIDA'].includes(codigo) || !codigo) {
      // Pode ter chegado: reenviar é seguro (os ids provisórios não deixam duplicar).
      await db.gravar(db.STORES.FILA, atuais.map((i) => ({...i, estado: ESTADOS.SEM_CONFIRMACAO,
        ultimo_erro: erro.message})));
      return false;
    }
    // O servidor recusou o lote inteiro (ex.: sem permissão para um dos itens): nada foi gravado.
    if (atuais.length > 1) {
      // Um por vez, para achar o que foi recusado.
      await db.gravar(db.STORES.FILA, atuais.map((i, n) => ({...i, estado: anteriores[n]})));
      for (const item of atuais) {
        if (!(await enviarLote(conferencia, [item]))) {
          return false;
        }
      }
      return true;
    }
    await db.gravar(db.STORES.FILA, [{...atuais[0], estado: ESTADOS.RECUSADO, ultimo_erro: erro.message}]);
    return true;
  }
  const resultados = resposta.resultados || [];
  let inicio = 0;
  const trocas = {};
  for (const item of atuais) {
    const meus = resultados.slice(inicio, inicio + item.operacoes.length);
    inicio += item.operacoes.length;
    const falhas = meus.filter((r) => r.status !== 'success');
    if (!falhas.length) {
      meus.forEach((r, n) => {
        const temp = item.operacoes[n].temp_uuid;
        if (ehProvisorio(temp) && r.id_gerado) {
          trocas[temp] = r.id_gerado;
        }
      });
      await confirmar(item, trocas);
    } else if (falhas.every((r) => r.codigo === 'PROVISORIO_DESCONHECIDO')) {
      await db.gravar(db.STORES.FILA, [{...item, estado: ESTADOS.LOCAL,
        ultimo_erro: 'Espera outro item desta conferência ser aceito.'}]);
    } else {
      await db.gravar(db.STORES.FILA, [{...item, estado: ESTADOS.RECUSADO,
        ultimo_erro: [...new Set(falhas.map((r) => r.mensagem || 'Não foi aceito.'))].join(' ')}]);
    }
  }
  if (Object.keys(trocas).length) {
    await trocarNaFila(conferencia, trocas);
  }
  estado.ultimoEnvio = new Date().toISOString();
  await db.salvarConfig(CHAVE_ULTIMO_ENVIO, estado.ultimoEnvio);
  avisar('confirmado', {conferencia, trocas});
  return true;
}

/**
 * O servidor aceitou: grava o efeito na lista guardada (com o id definitivo) e tira o item da fila.
 * @param {!Object} item
 * @param {!Object<string, string>} trocas
 */
async function confirmar(item, trocas) {
  for (const efeito of efeitosDe(trocar(item, trocas))) {
    const guardadas = await db.listar(db.STORES.PESSOAS, item.conferencia);
    const depois = aplicarEfeito(guardadas, efeito);
    const chave = item.conferencia + '|' + efeito.id;
    const registro = depois.find((p) => p.id === efeito.id);
    if (registro) {
      await db.gravar(db.STORES.PESSOAS, [{...registro, chave, conferencia: item.conferencia}]);
    } else {
      await db.apagar(db.STORES.PESSOAS, [chave]);
    }
  }
  await db.apagar(db.STORES.FILA, [item.id_operacao]);
}

/**
 * Um item pode mudar várias pessoas (ex.: mudar a situação da família muda o papel de todos os moradores).
 * @param {!Object} item
 * @return {!Array<!Object>} Os efeitos nas pessoas (efeito pode ser um objeto ou uma lista).
 */
function efeitosDe(item) {
  return item.efeito ? [].concat(item.efeito).filter((e) => e && e.id) : [];
}

/**
 * @param {*} valor
 * @param {!Object<string, string>} trocas
 * @return {*} Cópia com os ids provisórios trocados.
 */
function trocar(valor, trocas) {
  return JSON.parse(JSON.stringify(valor).replace(PADRAO_TMP, (t) => trocas[t] || t));
}

/**
 * @param {string} conferencia
 * @param {!Object<string, string>} trocas
 */
async function trocarNaFila(conferencia, trocas) {
  const restantes = (await itens()).filter((i) => i.conferencia === conferencia);
  const mudados = restantes.map((i) => trocar(i, trocas)).filter((i, n) => JSON.stringify(i) !== JSON.stringify(restantes[n]));
  if (mudados.length) {
    await db.gravar(db.STORES.FILA, mudados);
  }
}

// ---------------------------------------------------------------------------
// Ações da aba Sincronização
// ---------------------------------------------------------------------------

/**
 * Item recusado: volta para a fila e tenta de novo.
 * @param {string} idOperacao
 */
export async function tentarDeNovo(idOperacao) {
  const item = (await itens()).find((i) => i.id_operacao === idOperacao);
  if (item) {
    await db.gravar(db.STORES.FILA, [{...item, estado: ESTADOS.LOCAL, ultimo_erro: ''}]);
    avisar('mudou');
    enviar({manual: true});
  }
}

/**
 * Itens que seriam apagados junto (os que dependem deste).
 * @param {string} idOperacao
 * @return {!Promise<!Array<!Object>>} O item e os dependentes.
 */
export async function comDependentes(idOperacao) {
  const todos = await itens();
  const item = todos.find((i) => i.id_operacao === idOperacao);
  if (!item) {
    return [];
  }
  const removidos = [item];
  const ids = new Set(criados(item));
  todos.filter((i) => i.conferencia === item.conferencia && i !== item).forEach((i) => {
    if (usados(i).some((t) => ids.has(t))) {
      removidos.push(i);
      criados(i).forEach((t) => ids.add(t));
    }
  });
  return removidos;
}

/**
 * @param {string} conferencia
 * @return {!Promise<!Array<!Object>>} Os itens dessa conferência que ainda não foram confirmados.
 */
export async function daConferencia(conferencia) {
  return (await itens()).filter((i) => i.conferencia === conferencia);
}

/**
 * Ao sair da conferência sem enviar: os dados ficam em claro no celular, então saem junto (decisão de 14/11/2026).
 * @param {string} conferencia
 */
export async function apagarDaConferencia(conferencia) {
  const lista = await daConferencia(conferencia);
  if (lista.length) {
    await db.apagar(db.STORES.FILA, lista.map((i) => i.id_operacao));
    avisar('mudou');
  }
}

/**
 * Apaga do celular o item e os que dependem dele.
 * @param {string} idOperacao
 * @return {!Promise<number>} Quantos itens saíram.
 */
export async function descartar(idOperacao) {
  const removidos = await comDependentes(idOperacao);
  await db.apagar(db.STORES.FILA, removidos.map((i) => i.id_operacao));
  avisar('mudou');
  return removidos.length;
}
