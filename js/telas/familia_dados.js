/**
 * @fileoverview Dados das famílias: a lista (sem cifra, store "familias") e os detalhes de cada família
 * (cifrados no cofre, store "detalhes_familias"). Decisões: mvp/telas/03_familias.md (14/11/2026).
 *
 * A lista guarda, por família, os ids dos moradores, dos endereços e a data da última visita, para poder
 * receber só o que mudou (listar com "desde"), como a lista de pessoas.
 */

import * as db from '../core/db.js';
import * as cofre from '../core/cofre.js';

/**
 * "mudou": {detail: {conferencia}} a lista de famílias foi atualizada; "pessoas": a lista de pessoas foi atualizada.
 * A tela Pessoas usa as famílias para saber quem é responsável; a tela Famílias usa os nomes das pessoas (21/11/2026).
 */
export const eventosFamilias = new EventTarget();

/** Busca em andamento por conferência: Pessoas e Famílias não pedem a mesma lista duas vezes. */
const buscando = {};

/**
 * Situações de família desta versão (decisões de 14/11/2026): FVC fica de fora; a sindicância é uma visita
 * (o levantamento socioeconômico que decide se a família socorrida vira assistida, Regulamento Art. 118, V, nota 60),
 * não uma situação. Família com SIN na planilha (dados antigos) conta como socorrida, com o selo "Em sindicância".
 */
export const SITUACOES = [
  {sigla: 'AST', nome: 'Assistida', plural: 'Assistidas', ativa: true},
  {sigla: 'SOC', nome: 'Socorrida', plural: 'Socorridas', ativa: true},
  {sigla: 'SIN', nome: 'Em sindicância', plural: 'Em sindicância', ativa: true, comoSocorrida: true},
  {sigla: 'PRM', nome: 'Promovida', plural: 'Promovidas', ativa: false},
  {sigla: 'AFA', nome: 'Afastada', plural: 'Afastadas', ativa: false},
  {sigla: 'TRF', nome: 'Transferida', plural: 'Transferidas', ativa: false},
];
export const NOME_DA_SITUACAO = Object.fromEntries(SITUACOES.map((s) => [s.sigla, s.nome]));

/** @param {string} cf @return {string} Desde quando perguntar o que mudou na lista de famílias. */
export const chaveDesdeFamilias = (cf) => 'familias_desde:' + cf;
/** @param {string} cf @return {string} Hora em que a lista de famílias foi atualizada. */
export const chaveFamiliasAtualizada = (cf) => 'familias_atualizada:' + cf;

/**
 * Encerrado como o script entende em "apenas_ativas" (ativa = NÃO, ou com data de término).
 * @param {!Object} r
 * @return {boolean}
 */
export function encerrado(r) {
  return /^(n[aã]o|false)$/i.test(String(r.ativa === undefined ? '' : r.ativa)) ||
    (r.data_termino !== undefined && r.data_termino !== null && String(r.data_termino) !== '');
}

/** @param {*} valor @return {string} "AAAA-MM-DD" (ou ''). */
export const dia = (valor) => (valor ? String(valor).slice(0, 10) : '');

/**
 * moradores, titular, bairro e cidade saem dos ids guardados.
 * @param {!Object} r
 * @return {!Object}
 */
function derivar(r) {
  const moradores = Object.values(r.moradores_ids);
  const enderecos = Object.values(r.enderecos_ids).sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
  const titular = moradores.find((m) => m.vinculo === 'TIT');
  return {...r, moradores: moradores.length, id_titular: titular ? titular.id_pessoa : '',
    bairro: enderecos[0] ? enderecos[0].bairro : '', cidade: enderecos[0] ? enderecos[0].cidade : ''};
}

/**
 * Aplica linhas (todas, ou só as que mudaram) às famílias da lista.
 * @param {!Object<string, !Object>} porId Famílias por id (alterado aqui).
 * @param {{familias: !Array, moradores: !Array, enderecos: !Array, visitas: !Array}} linhas
 * @return {!Array<!Object>}
 */
export function aplicarLinhas(porId, linhas) {
  const tocadas = new Set();
  linhas.familias.forEach((f) => {
    const id = String(f.id_familia);
    const antes = porId[id] || {moradores_ids: {}, enderecos_ids: {}, ultima_visita: ''};
    porId[id] = {...antes, id, nome: String(f.nome_referencia || '(sem nome)'),
      situacao: String(f.id_status_familia || '').toUpperCase(), desde: dia(f.data_inicio),
      encerrada: encerrado(f), encerrada_em: dia(f.data_termino), ficticio: String(f.ficticio).toUpperCase() === 'SIM'};
    tocadas.add(id);
  });
  const daFamilia = (x) => {
    const r = porId[String(x.id_familia)];
    if (r) {
      tocadas.add(r.id);
    }
    return r;
  };
  linhas.moradores.forEach((x) => {
    const r = daFamilia(x);
    if (r) {
      if (encerrado(x)) {
        delete r.moradores_ids[String(x.id_pessoa_familia)];
      } else {
        r.moradores_ids[String(x.id_pessoa_familia)] = {id_pessoa: String(x.id_pessoa),
          vinculo: String(x.id_vinculo || '').toUpperCase()};
      }
    }
  });
  linhas.enderecos.forEach((x) => {
    const r = daFamilia(x);
    if (r) {
      if (encerrado(x)) {
        delete r.enderecos_ids[String(x.id_familia_endereco)];
      } else {
        r.enderecos_ids[String(x.id_familia_endereco)] = {bairro: String(x.bairro || ''), cidade: String(x.cidade || ''),
          data_inicio: dia(x.data_inicio)};
      }
    }
  });
  linhas.visitas.forEach((x) => {
    const r = daFamilia(x);
    const data = dia(x.data_visita);
    if (r && !encerrado(x) && String(x.id_status_visita || '').toUpperCase() === 'REA' && data > r.ultima_visita) {
      r.ultima_visita = data;
    }
  });
  tocadas.forEach((id) => {
    porId[id] = derivar(porId[id]);
  });
  return Object.values(porId);
}

/**
 * Busca a lista no servidor: tudo, ou só o que mudou desde a última vez.
 * @param {string} cf
 * @param {function(string, !Object): !Promise<!Object>} chamar
 * @param {boolean} completo
 * @return {!Promise<{familias: !Array<!Object>, mudou: boolean}>}
 */
export function atualizarLista(cf, chamar, completo) {
  if (buscando[cf] && !completo) {
    return buscando[cf];
  }
  const busca = baixarLista(cf, chamar, completo).finally(() => {
    if (buscando[cf] === busca) {
      delete buscando[cf];
    }
  });
  buscando[cf] = busca;
  return busca;
}

/**
 * @param {string} cf
 * @param {function(string, !Object): !Promise<!Object>} chamar
 * @param {boolean} completo
 * @return {!Promise<{familias: !Array<!Object>, mudou: boolean}>}
 */
async function baixarLista(cf, chamar, completo) {
  // Sem nenhuma família guardada no celular, baixa tudo (19/11/2026; como na lista de pessoas): a marca "desde"
  // pode ter sobrado de uma lista apagada.
  const guardadas = completo ? [] : await db.listar(db.STORES.FAMILIAS, cf);
  const desde = completo || !guardadas.length ? null : await db.lerConfig(chaveDesdeFamilias(cf));
  // Famílias encerradas também vêm (filtro "Encerradas"); vínculos e endereços, só os ativos.
  const pedir = (aba, soAtivas) => chamar('listar', desde ? {aba, desde} :
    {aba, filtros: soAtivas ? {apenas_ativas: true} : {}});
  const respostas = await Promise.all([pedir('familias', false), pedir('familias_pessoas', true),
    pedir('familias_enderecos', true), pedir('visitas', true)]);
  const [familias, moradores, enderecos, visitas] = respostas.map((r) => r.registros);
  const linhas = {familias, moradores, enderecos, visitas};
  const mudou = !desde || respostas.some((r) => r.registros.length);
  let lista;
  if (desde) {
    const porId = {};
    guardadas.forEach((r) => {
      const {chave, conferencia, ...resto} = r; // eslint-disable-line no-unused-vars
      porId[r.id] = resto;
    });
    lista = aplicarLinhas(porId, linhas);
  } else {
    lista = aplicarLinhas({}, linhas);
  }
  if (mudou) {
    await db.substituirDaConferencia(db.STORES.FAMILIAS, cf, lista.map((f) => ({...f, chave: cf + '|' + f.id, conferencia: cf})));
  }
  const menor = Math.min(...respostas.map((r) => new Date(r.gerado_em || Date.now()).getTime()));
  await db.salvarConfig(chaveDesdeFamilias(cf), new Date(menor - 2 * 60 * 1000).toISOString());
  await db.salvarConfig(chaveFamiliasAtualizada(cf), new Date().toISOString());
  eventosFamilias.dispatchEvent(new CustomEvent('mudou', {detail: {conferencia: cf}}));
  return {familias: lista, mudou};
}

/**
 * As famílias com as mudanças de moradores que ainda estão na fila (entrou, saiu, novo titular).
 * @param {!Array<!Object>} familias
 * @param {!Array<!Object>} fila sync.itens()
 * @param {string} cf
 * @return {!Array<!Object>} Cópia.
 */
export function moradoresComFila(familias, fila, cf) {
  const copia = familias.map((f) => ({...f, moradores_ids: {...(f.moradores_ids || {})}}));
  const porId = Object.fromEntries(copia.map((f) => [f.id, f]));
  fila.filter((i) => i.conferencia === cf).forEach((i) => {
    (i.operacoes || []).filter((op) => op.aba === 'familias_pessoas').forEach((op) => {
      const dados = op.dados || {};
      if (op.acao === 'inserir' && porId[dados.id_familia]) {
        porId[dados.id_familia].moradores_ids[op.temp_uuid || 'fila:' + dados.id_pessoa] = {
          id_pessoa: String(dados.id_pessoa), vinculo: String(dados.id_vinculo || '').toUpperCase()};
      } else if (op.acao === 'desativar') {
        copia.forEach((f) => delete f.moradores_ids[op.id_registro]);
      } else if (op.acao === 'atualizar' && dados.id_vinculo) {
        copia.filter((f) => f.moradores_ids[op.id_registro]).forEach((f) => {
          f.moradores_ids[op.id_registro] = {...f.moradores_ids[op.id_registro],
            vinculo: String(dados.id_vinculo).toUpperCase()};
        });
      }
    });
  });
  return copia;
}

/**
 * Em que família ativa cada pessoa mora. Quem é titular em alguma família fica como titular; uma família sem titular
 * é marcada, para os moradores dela não sumirem da tela Pessoas (21/11/2026).
 * @param {!Array<!Object>} familias
 * @return {!Object<string, {id_familia: string, nome_familia: string, titular: boolean, temTitular: boolean}>}
 */
export function ligacoesDasPessoas(familias) {
  const ligacoes = {};
  familias.filter((f) => !f.encerrada).forEach((f) => {
    const moradores = Object.values(f.moradores_ids || {});
    const temTitular = moradores.some((m) => m.vinculo === 'TIT');
    moradores.forEach((m) => {
      const titular = m.vinculo === 'TIT';
      const antes = ligacoes[m.id_pessoa];
      if (!antes || (!antes.titular && (titular || !temTitular))) {
        ligacoes[m.id_pessoa] = {id_familia: f.id, nome_familia: f.nome, titular, temTitular};
      }
    });
  });
  return ligacoes;
}

// ---------------------------------------------------------------------------
// Detalhes de uma família (cifrados no cofre)
// ---------------------------------------------------------------------------

/**
 * @param {!Object} familia Registro de "familias".
 * @param {!Array<!Object>} moradores familias_pessoas ativos da família.
 * @param {!Array<!Object>} enderecos familias_enderecos ativos da família (decifrados, se pode).
 * @param {!Array<!Object>=} visitas As visitas já montadas (montarVisitas).
 * @return {!Object} {familia, moradores, endereco, visitas}
 */
export function montarDetalheFamilia(familia, moradores, enderecos, visitas = []) {
  const endereco = enderecos.slice().sort((a, b) => dia(b.data_inicio).localeCompare(dia(a.data_inicio)))[0] || null;
  return {familia, moradores, endereco, visitas};
}

/** Visitas guardadas no celular: as dos últimos 2 meses (decisão de 14/11/2026, 06_visitas.md). */
export const DIAS_DE_VISITAS = 61;

/** @return {string} "AAAA-MM-DD" de 2 meses atrás. */
export const desdeVisitas = () => new Date(Date.now() - DIAS_DE_VISITAS * 86400000).toISOString().slice(0, 10);

/** Campos cifrados da visita: o relato e o que ficou combinado. */
export const CIFRADOS_VISITA = ['relato', 'combinados'];

/** Domínios da avaliação OMS (colunas oms_*). */
export const DOMINIOS_OMS = ['fisico', 'psicologico', 'independencia', 'relacoes', 'ambiente', 'espiritual'];

/**
 * Agrupa linhas por um campo (sem diferença de maiúsculas).
 * @param {!Array<!Object>} lista
 * @param {string} campo
 * @return {function(string): !Array<!Object>}
 */
export function agrupar(lista, campo) {
  const g = {};
  lista.forEach((x) => {
    (g[String(x[campo]).toUpperCase()] = g[String(x[campo]).toUpperCase()] || []).push(x);
  });
  return (id) => g[String(id).toUpperCase()] || [];
}

/**
 * As visitas de uma família como a tela usa (a mais recente primeiro), só as dos últimos 2 meses.
 * @param {!Array<!Object>} visitas Linhas de "visitas" da família.
 * @param {function(string): !Array<!Object>} participantesDe visitas_participantes por id_visita.
 * @param {function(string): !Array<!Object>} auxiliosDe visitas_auxilios por id_visita.
 * @return {!Array<!Object>}
 */
export function montarVisitas(visitas, participantesDe, auxiliosDe) {
  const limite = desdeVisitas();
  const simNao = (v) => (/^sim$/i.test(String(v || '')) ? 'SIM' : /^n[aã]o$/i.test(String(v || '')) ? 'NÃO' : '');
  return visitas.filter((v) => !encerrado(v) && dia(v.data_visita) >= limite).map((v) => {
    const id = String(v.id_visita);
    const oms = {};
    DOMINIOS_OMS.forEach((c) => {
      const n = Number(v['oms_' + c]);
      if (n >= 1 && n <= 5) {
        oms[c] = n;
      }
    });
    return {id, data: dia(v.data_visita), situacao: String(v.id_status_visita || '').toUpperCase(),
      duracao: Number(v.duracao_minutos) || 0, relato: String(v.relato || ''), combinados: String(v.combinados || ''),
      rezou: simNao(v.rezou), falou_de_fe: simNao(v.falou_de_fe), oms,
      participantes: participantesDe(id).filter((p) => !encerrado(p)).map((p) => ({id_pessoa: String(p.id_pessoa),
        meio_transporte: String(p.meio_transporte || '')})),
      auxilios: auxiliosDe(id).filter((a) => !encerrado(a)).map((a) => ({id: String(a.id_visita_auxilio || ''),
        tipo: String(a.id_tipo_auxilio || ''),
        quantidade: Number(a.quantidade) || 1, unidade: String(a.unidade_medida || '')}))};
  }).sort((a, b) => b.data.localeCompare(a.data));
}

/** Campos do endereço da família a decifrar. */
const CIFRADOS_ENDERECO = ['logradouro', 'numero', 'complemento', 'ponto_referencia', 'cep'];

/**
 * Uma família, do servidor.
 * @param {string} id
 * @param {function(string, !Object): !Promise<!Object>} chamar
 * @param {boolean} contatos Decifra o endereço e os detalhes dos vínculos.
 * @return {!Promise<!Object>}
 */
export async function buscarDetalheFamilia(id, chamar, contatos) {
  const listar = (aba, decifrar, mais = {}) => chamar('listar', {aba, filtros: {id_familia: id, apenas_ativas: true,
    ...mais}, decifrar}).then((r) => r.registros);
  const [obtido, moradores, enderecos, visitas, participantes, auxilios] = await Promise.all([
    chamar('obter', {aba: 'familias', id_registro: id}),
    listar('familias_pessoas', contatos ? ['detalhes_vinculo'] : []),
    listar('familias_enderecos', contatos ? CIFRADOS_ENDERECO : []),
    listar('visitas', contatos ? CIFRADOS_VISITA : [], {data_visita_desde: desdeVisitas()}),
    // A dupla não tem id_familia: vêm todas (sem cifra) e ficam só as destas visitas.
    chamar('listar', {aba: 'visitas_participantes', filtros: {apenas_ativas: true}}).then((r) => r.registros),
    listar('visitas_auxilios', []),
  ]);
  return montarDetalheFamilia(obtido.registro, moradores, enderecos,
      montarVisitas(visitas, agrupar(participantes, 'id_visita'), agrupar(auxilios, 'id_visita')));
}

/** @param {string} cf @param {string} id @return {!Promise<?Object>} */
export async function lerFamiliaGuardada(cf, id) {
  const registro = await db.ler(db.STORES.DETALHES_FAMILIAS, cf + '|' + id);
  return registro ? cofre.decifrar(cf, registro) : null;
}

/** @param {string} cf @param {string} id @param {?Object} dados null apaga. */
export async function guardarFamilia(cf, id, dados) {
  if (!cofre.aberto(cf)) {
    return;
  }
  const chave = cf + '|' + id;
  if (!dados) {
    await db.apagar(db.STORES.DETALHES_FAMILIAS, [chave]);
    return;
  }
  await db.gravar(db.STORES.DETALHES_FAMILIAS, [{chave, conferencia: cf, guardado_em: new Date().toISOString(),
    ...(await cofre.cifrar(cf, dados))}]);
}

/**
 * Monta e cifra os detalhes de todas as famílias, a partir das linhas já baixadas (junto com as pessoas).
 * @param {string} cf
 * @param {!Array<!Object>} familias Todas as famílias (com as encerradas).
 * @param {!Array<!Object>} moradores familias_pessoas ativos.
 * @param {!Array<!Object>} enderecos familias_enderecos ativos.
 * @param {{visitas: !Array, participantes: !Array, auxilios: !Array}=} deVisitas As linhas das visitas (2 meses).
 * @return {!Promise<!Array<!Object>>} Registros para a store detalhes_familias.
 */
export async function cifrarTodas(cf, familias, moradores, enderecos,
    deVisitas = {visitas: [], participantes: [], auxilios: []}) {
  const moradoresDe = agrupar(moradores, 'id_familia');
  const enderecosDe = agrupar(enderecos, 'id_familia');
  const visitasDe = agrupar(deVisitas.visitas, 'id_familia');
  const participantesDe = agrupar(deVisitas.participantes, 'id_visita');
  const auxiliosDe = agrupar(deVisitas.auxilios, 'id_visita');
  const registros = [];
  for (const f of familias) {
    const id = String(f.id_familia);
    registros.push({chave: cf + '|' + id, conferencia: cf, guardado_em: new Date().toISOString(),
      ...(await cofre.cifrar(cf, montarDetalheFamilia(f, moradoresDe(id), enderecosDe(id),
          montarVisitas(visitasDe(id), participantesDe, auxiliosDe))))});
  }
  return registros;
}

// ---------------------------------------------------------------------------
// Papéis dos moradores (decisões de 14/11/2026, 03_familias.md)
// ---------------------------------------------------------------------------

/** Papéis de atendimento e de membro. */
export const ATENDIMENTO = ['AST', 'SOC'];
const MEMBROS = ['VIC', 'ASP', 'VIS', 'BEN'];

/** @return {string} Hoje, "AAAA-MM-DD". */
export const hoje = () => new Date().toISOString().slice(0, 10);

/**
 * Papel de atendimento que combina com a situação da família.
 * @param {string} situacao
 * @return {string} AST ou SOC.
 */
export function papelDaSituacao(situacao) {
  return situacao === 'AST' || situacao === 'PRM' ? 'AST' : 'SOC';
}

/**
 * Os moradores ativos da família, pela lista guardada.
 * @param {string} cf
 * @param {string} idFamilia
 * @return {!Promise<!Array<{id_pessoa_familia: string, id_pessoa: string, vinculo: string}>>}
 */
export async function moradoresDaFamilia(cf, idFamilia) {
  const f = await db.ler(db.STORES.FAMILIAS, cf + '|' + idFamilia);
  return f ? Object.entries(f.moradores_ids).map(([id, m]) => ({id_pessoa_familia: id, ...m})) : [];
}

/**
 * A família em que a pessoa é titular (pela lista guardada), ou null.
 * @param {string} cf
 * @param {string} idPessoa
 * @return {!Promise<?Object>}
 */
export async function familiaDoTitular(cf, idPessoa) {
  const familias = await db.listar(db.STORES.FAMILIAS, cf);
  return familias.find((f) => !f.encerrada &&
    Object.values(f.moradores_ids).some((m) => m.id_pessoa === idPessoa && m.vinculo === 'TIT')) || null;
}

/**
 * Operações para trocar (ou encerrar) o papel de atendimento dos moradores. Quem é membro (VIC, ASP, VIS, BEN)
 * não muda (por enquanto, fica só como membro; pendência 7 de 03_familias.md).
 * @param {string} cf
 * @param {!Array<string>} idsPessoas
 * @param {string} novo AST, SOC, ou '' para só encerrar.
 * @param {string} motivo
 * @param {function(): string} novoId Gera o id provisório dos papéis novos.
 * @return {!Promise<{operacoes: !Array<!Object>, efeitos: !Array<!Object>}>}
 */
export async function operacoesDePapeis(cf, idsPessoas, novo, motivo, novoId) {
  const pessoas = Object.fromEntries((await db.listar(db.STORES.PESSOAS, cf)).map((p) => [p.id, p]));
  const operacoes = [];
  const efeitos = [];
  for (const id of idsPessoas) {
    const p = pessoas[id];
    const papeis = p && p.papeis_ids ? p.papeis_ids : {};
    const siglas = Object.values(papeis);
    if (siglas.some((s) => MEMBROS.includes(s))) {
      continue;
    }
    Object.entries(papeis).filter(([, s]) => ATENDIMENTO.includes(s) && s !== novo).forEach(([idPapel]) => {
      operacoes.push({acao: 'desativar', aba: 'pessoas_papeis', id_registro: idPapel, motivo});
    });
    if (novo && !siglas.includes(novo)) {
      operacoes.push({acao: 'inserir', aba: 'pessoas_papeis', temp_uuid: novoId(),
        dados: {id_pessoa: id, id_papel: novo, data_inicio: hoje()}});
    }
    efeitos.push({id, papeis: novo ? [novo] : []});
  }
  return {operacoes, efeitos};
}
