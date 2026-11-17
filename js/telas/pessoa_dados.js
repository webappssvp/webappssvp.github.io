/**
 * @fileoverview Dados dos detalhes de uma pessoa: montar a partir das abas do script e guardar cifrados
 * no celular, para ver e editar sem internet (decisões de 14/11/2026, mvp/telas/05_sincronizacao.md).
 *
 * - O mesmo formato serve à tela (pessoa_detalhe.js) e à cópia guardada: {pessoa, papeis, registros_papeis,
 *   cargo, endereco, aba_endereco, id_familia}.
 * - A cópia fica na store "detalhes" (chave "<conferência>|<id>"), cifrada pelo cofre (js/core/cofre.js).
 * - Baixar tudo: com a senha na mão (login, desbloqueio ou "Atualizar" na lista). Contatos e endereço só para
 *   quem tem CONTATOS_VER; os outros guardam papéis, cargo e família (dá para mudar papel e desativar).
 */

import * as db from '../core/db.js';
import * as cofre from '../core/cofre.js';
import {podeSincronizar} from '../core/preferencias.js';
import {chamarComSessao, sessaoAtual} from '../componentes/barra_conexao.js';
import {avisar} from '../casca.js';
import {CIFRADOS_VISITA, buscarDetalheFamilia, cifrarTodas, desdeVisitas, guardarFamilia} from './familia_dados.js';

/** "mudou": começou ou terminou de baixar, ou o cofre abriu (a lista redesenha a linha dos dados guardados). */
export const eventosDados = new EventTarget();
const avisarMudou = () => eventosDados.dispatchEvent(new Event('mudou'));

/** @param {?Object} s sessaoAtual() @return {boolean} */
const veContatos = (s) => Boolean(s && s.perfil && (s.perfil.permissoes || []).includes('CONTATOS_VER'));

/**
 * A senha foi digitada: abre o cofre e, com internet, baixa os detalhes.
 * @param {string} cf
 * @param {string} senha
 * @param {{criar: boolean}} opcoes criar: a senha foi conferida pelo servidor (login); sem internet, false.
 * @return {!Promise<boolean>} false: senha não confere com a guardada.
 */
export async function desbloquear(cf, senha, opcoes) {
  let aberto = false;
  try {
    aberto = await cofre.abrir(cf, senha, opcoes);
  } catch (erro) {
    return false; // navegador sem Web Crypto: segue sem a cópia para usar sem internet
  }
  avisarMudou();
  if (aberto) {
    atualizarGuardados(false);
  }
  return aberto;
}

/**
 * Põe em dia a cópia guardada da conferência escolhida, se o cofre está aberto e há internet.
 * Automático: só o que mudou desde a última vez (sincronizarGuardados). "Atualizar" na lista: tudo de novo.
 * @param {boolean} manual Toque em "Atualizar" (baixa tudo; vale nos dados móveis); senão respeita "só Wi-Fi".
 * @return {!Promise<!Array<string>>} Ids das pessoas que mudaram (todas, se baixou tudo).
 */
export async function atualizarGuardados(manual) {
  const s = sessaoAtual();
  if (s) {
    await cofre.restaurar(s.id_conferencia);
  }
  if (!s || !cofre.aberto(s.id_conferencia) || !navigator.onLine || (!manual && !podeSincronizar().pode)) {
    return [];
  }
  const cf = s.id_conferencia;
  const chamar = (acao, dados) => chamarComSessao(acao, dados);
  const promessa = manual ? baixarTudo(cf, chamar, veContatos(s)).then(() => ['*']) :
    sincronizarGuardados(cf, chamar, veContatos(s));
  if (manual) {
    avisarMudou();
  }
  try {
    const mudaram = await promessa;
    if (manual) {
      avisar('Dados guardados para usar sem internet.');
    }
    if (mudaram.length) {
      eventosDados.dispatchEvent(new CustomEvent('guardados', {detail: {conferencia: cf, ids: mudaram}}));
    }
    return mudaram;
  } catch (erro) {
    if (manual) {
      avisar('Não deu para guardar os dados para usar sem internet: ' + erro.message);
    }
    return [];
  } finally {
    avisarMudou();
  }
}

/** Campos do endereço: [campo, rótulo, cifrado?, só na família?]. */
export const CAMPOS_ENDERECO = [
  ['cep', 'CEP', true, false], // primeiro: com o CEP, o app preenche rua, bairro, cidade e UF (16/11/2026)
  ['logradouro', 'Rua, avenida…', true, false],
  ['numero', 'Número', true, false],
  ['complemento', 'Complemento', true, false],
  ['ponto_referencia', 'Ponto de referência', true, true],
  ['bairro', 'Bairro', false, false],
  ['cidade', 'Cidade', false, false],
  ['estado_uf', 'UF', false, false],
];

export const ATENDIDOS = ['AST', 'SOC'];

/** @param {string} cf @return {string} Chave (store config) da hora em que os detalhes foram baixados. */
export const chaveBaixados = (cf) => 'detalhes_baixados:' + cf;

/**
 * Versão do que a cópia guarda. Aumentar quando a cópia passar a guardar algo novo: a próxima conferência baixa tudo.
 * 2: com os detalhes das famílias (14/11/2026).
 */
const VERSAO_COPIA = 3; // 3 (16/11/2026): as visitas dos últimos 2 meses dentro de cada família

/** @param {string} cf @return {string} */
const chaveVersao = (cf) => 'detalhes_versao:' + cf;

/** @param {string} cf @return {string} Desde quando perguntar o que mudou (hora do servidor, com folga). */
const chaveDesde = (cf) => 'detalhes_desde:' + cf;

/**
 * Folga na hora do servidor: uma gravação que terminou enquanto a lista era lida não se perde (pedir de novo
 * as mesmas linhas não estraga nada).
 */
const FOLGA_MS = 2 * 60 * 1000;

/** Acima disto, baixar tudo sai mais barato que buscar pessoa por pessoa. */
const LIMITE_PESSOAS_MUDADAS = 15;

/**
 * @param {!Array<!Object>} respostas De listar (cada uma com gerado_em).
 * @return {string} A menor hora do servidor, menos a folga (ISO).
 */
function proximoDesde(respostas) {
  const menor = Math.min(...respostas.map((r) => new Date(r.gerado_em || Date.now()).getTime()));
  return new Date(menor - FOLGA_MS).toISOString();
}

/**
 * Uma pessoa, do servidor (o que a tela de detalhes mostra).
 * @param {string} id
 * @param {function(string, !Object): !Promise<!Object>} chamar
 * @param {boolean} contatos Decifra contatos e endereço.
 * @return {!Promise<?Object>} null se a pessoa não está mais ativa.
 */
export async function buscarDetalhe(id, chamar, contatos) {
  const listar = (aba, filtros, decifrar) => chamar('listar', {aba, filtros: {...filtros, apenas_ativas: true}, decifrar})
      .then((r) => r.registros);
  const [obtido, papeis, cargos, enderecosPessoa, vinculos] = await Promise.all([
    chamar('obter', {aba: 'pessoas', id_registro: id, decifrar: contatos ? ['nome', 'email', 'celular'] : []}),
    listar('pessoas_papeis', {id_pessoa: id}),
    listar('pessoas_cargos', {id_pessoa: id}),
    listar('pessoas_enderecos', {id_pessoa: id}, camposDecifrados(contatos, false)),
    listar('familias_pessoas', {id_pessoa: id}),
  ]);
  if (String(obtido.registro.ativa).toUpperCase() === 'NÃO') {
    return null;
  }
  // Endereço da família: só se a pessoa é atendida e tem família (montarDetalhe decide).
  const atendido = papeis.some((p) => ATENDIDOS.includes(String(p.id_papel).toUpperCase()));
  const idFamilia = atendido && vinculos.length ? String(vinculos[0].id_familia) : '';
  const enderecosFamilia = idFamilia ?
    await listar('familias_enderecos', {id_familia: idFamilia}, camposDecifrados(contatos, true)) : [];
  return montarDetalhe(obtido.registro, papeis, cargos, enderecosPessoa, vinculos, () => enderecosFamilia);
}

/** Pergunta em andamento, por conferência (não repete ao mesmo tempo). @type {!Object<string, !Promise>} */
const sincronizando = {};

/**
 * Só o que mudou desde a última vez: pergunta ao servidor as linhas alteradas (listar com "desde") e busca de
 * novo só as pessoas afetadas. Sem cópia ou com muitas mudanças, baixa tudo.
 * @param {string} cf
 * @param {function(string, !Object): !Promise<!Object>} chamar
 * @param {boolean} contatos
 * @return {!Promise<!Array<string>>} Ids das pessoas que mudaram ("*" = todas).
 */
export function sincronizarGuardados(cf, chamar, contatos) {
  if (!sincronizando[cf]) {
    sincronizando[cf] = sincronizar(cf, chamar, contatos).finally(() => {
      delete sincronizando[cf];
    });
  }
  return sincronizando[cf];
}

/** @param {string} cf @param {function(string, !Object): !Promise<!Object>} chamar @param {boolean} contatos */
async function sincronizar(cf, chamar, contatos) {
  const desde = await db.lerConfig(chaveDesde(cf));
  // Cópia de uma versão anterior (ex.: sem as famílias, antes de 14/11/2026): baixa tudo uma vez.
  const versao = await db.lerConfig(chaveVersao(cf));
  if (!desde || versao !== VERSAO_COPIA || !(await haGuardados(cf))) {
    await baixarTudo(cf, chamar, contatos);
    return ['*'];
  }
  // Sem "apenas_ativas": uma desativação também é mudança. Nada é decifrado se nada mudou.
  const abas = ['pessoas', 'pessoas_papeis', 'pessoas_cargos', 'pessoas_enderecos', 'familias_pessoas',
    'familias_enderecos', 'familias', 'visitas'];
  const respostas = await Promise.all(abas.map((aba) => chamar('listar', {aba, desde})));
  const afetadas = new Set();
  respostas.slice(0, 5).forEach((r) => r.registros.forEach((x) => afetadas.add(String(x.id_pessoa))));
  const familias = new Set(respostas[5].registros.map((x) => String(x.id_familia).toUpperCase()));
  // Famílias cujo cadastro, moradores, endereço ou visitas mudaram: os detalhes delas vêm de novo.
  const familiasMudadas = new Set([...respostas[4].registros, ...respostas[5].registros, ...respostas[6].registros,
    ...respostas[7].registros].map((x) => String(x.id_familia)));
  if (familias.size) {
    // Endereço de família mudou: quem é dessa família (pela cópia guardada).
    for (const reg of await db.listar(db.STORES.DETALHES, cf)) {
      const d = await cofre.decifrar(cf, reg);
      if (d && d.id_familia && familias.has(String(d.id_familia).toUpperCase())) {
        afetadas.add(String(d.pessoa.id_pessoa));
      }
    }
  }
  afetadas.delete('undefined');
  familiasMudadas.delete('undefined');
  if (afetadas.size + familiasMudadas.size > LIMITE_PESSOAS_MUDADAS) {
    await baixarTudo(cf, chamar, contatos);
    return ['*'];
  }
  for (const id of afetadas) {
    await guardar(cf, id, await buscarDetalhe(id, chamar, contatos));
  }
  for (const id of familiasMudadas) {
    await guardarFamilia(cf, id, await buscarDetalheFamilia(id, chamar, contatos));
    afetadas.add(id); // o evento "guardados" avisa a tela da família também
  }
  if (cofre.aberto(cf)) {
    await db.salvarConfig(chaveDesde(cf), proximoDesde(respostas));
    await db.salvarConfig(chaveBaixados(cf), new Date().toISOString()); // a cópia está em dia agora
  }
  return [...afetadas];
}

/**
 * @param {boolean} contatos Pode ver contatos (CONTATOS_VER ou os próprios dados).
 * @param {boolean} familia Endereço da família (tem ponto de referência).
 * @return {!Array<string>} Campos do endereço a decifrar.
 */
export function camposDecifrados(contatos, familia) {
  return contatos ? CAMPOS_ENDERECO.filter((c) => c[2] && (familia || !c[3])).map((c) => c[0]) : [];
}

/** @param {!Array<!Object>} lista @return {?Object} O mais recente (pela data de início). */
export function ultimo(lista) {
  return lista.slice().sort((a, b) => String(b.data_inicio || '').localeCompare(String(a.data_inicio || '')))[0] || null;
}

/**
 * Detalhes de uma pessoa a partir das abas (já filtradas por ela, exceto os endereços das famílias).
 * @param {!Object} pessoa Registro de "pessoas".
 * @param {!Array<!Object>} papeis
 * @param {!Array<!Object>} cargos
 * @param {!Array<!Object>} enderecosPessoa
 * @param {!Array<!Object>} vinculos familias_pessoas da pessoa.
 * @param {function(string): !Array<!Object>} enderecosDaFamilia
 * @return {!Object}
 */
export function montarDetalhe(pessoa, papeis, cargos, enderecosPessoa, vinculos, enderecosDaFamilia) {
  const siglas = papeis.map((p) => String(p.id_papel).toUpperCase());
  const atendido = siglas.some((s) => ATENDIDOS.includes(s));
  const dados = {pessoa, papeis: siglas, registros_papeis: papeis, cargo: cargos[0] || null, endereco: null,
    aba_endereco: atendido ? 'familias_enderecos' : 'pessoas_enderecos', id_familia: ''};
  if (atendido) {
    dados.id_familia = vinculos.length ? String(vinculos[0].id_familia) : '';
    dados.endereco = dados.id_familia ? ultimo(enderecosDaFamilia(dados.id_familia)) : null;
  } else {
    dados.endereco = ultimo(enderecosPessoa);
  }
  return dados;
}

// ---------------------------------------------------------------------------
// Cópia cifrada no celular
// ---------------------------------------------------------------------------

/**
 * @param {string} cf
 * @param {string} id
 * @return {!Promise<?Object>} Os detalhes guardados (null se não há ou o cofre está fechado).
 */
export async function lerGuardado(cf, id) {
  const registro = await db.ler(db.STORES.DETALHES, cf + '|' + id);
  return registro ? cofre.decifrar(cf, registro) : null;
}

/**
 * Guarda (ou troca) os detalhes de uma pessoa. Sem fazer nada se o cofre está fechado.
 * @param {string} cf
 * @param {string} id
 * @param {?Object} dados null apaga.
 */
export async function guardar(cf, id, dados) {
  if (!cofre.aberto(cf)) {
    return;
  }
  const chave = cf + '|' + id;
  if (!dados) {
    await db.apagar(db.STORES.DETALHES, [chave]);
    return;
  }
  await db.gravar(db.STORES.DETALHES, [{chave, conferencia: cf, guardado_em: new Date().toISOString(),
    ...(await cofre.cifrar(cf, dados))}]);
}

/**
 * Quando cada item foi guardado no celular (o ícone de banco de dados das listas; 05_sincronizacao.md).
 * Cópias de antes de 17/11/2026 não têm a hora: vale a do último "Guardar" da conferência.
 * @param {string} cf
 * @param {string} store db.STORES.DETALHES (pessoas) ou db.STORES.DETALHES_FAMILIAS.
 * @return {!Promise<!Object<string, string>>} id -> hora (ISO).
 */
export async function guardadosEm(cf, store) {
  const [registros, geral] = await Promise.all([db.listar(store, cf), db.lerConfig(chaveBaixados(cf))]);
  const porId = {};
  registros.forEach((r) => {
    porId[String(r.chave).slice(cf.length + 1)] = r.guardado_em || geral || '';
  });
  return porId;
}

/**
 * Avisa as telas que estes itens foram guardados de novo (um item só, pela folhinha do ícone).
 * @param {string} cf
 * @param {!Array<string>} ids
 */
export function avisarGuardados(cf, ids) {
  eventosDados.dispatchEvent(new CustomEvent('guardados', {detail: {conferencia: cf, ids}}));
}

/** @param {string} cf @return {!Promise<boolean>} Há detalhes guardados desta conferência. */
export async function haGuardados(cf) {
  return Boolean(await db.lerConfig(chaveBaixados(cf)));
}

/** Baixando agora, por conferência (não começa outro igual). @type {!Object<string, !Promise<number>>} */
const baixando = {};

/** @param {string} cf @return {boolean} */
export function estaBaixando(cf) {
  return Boolean(baixando[cf]);
}

/**
 * Baixa os detalhes de todas as pessoas ativas e guarda cifrados (o cofre precisa estar aberto).
 * @param {string} cf
 * @param {function(string, !Object): !Promise<!Object>} chamar (acao, dados) com a sessão da conferência.
 * @param {boolean} contatos Pode ver contatos (CONTATOS_VER).
 * @return {!Promise<number>} Quantas pessoas foram guardadas.
 */
export function baixarTudo(cf, chamar, contatos) {
  if (!baixando[cf]) {
    baixando[cf] = baixar(cf, chamar, contatos).finally(() => {
      delete baixando[cf];
    });
  }
  return baixando[cf];
}

/** @param {string} cf @param {function(string, !Object): !Promise<!Object>} chamar @param {boolean} contatos */
async function baixar(cf, chamar, contatos) {
  if (!cofre.aberto(cf)) {
    throw new Error('Digite a senha para guardar os dados no celular.');
  }
  const listar = (aba, decifrar = []) => chamar('listar', {aba, filtros: {apenas_ativas: true}, decifrar});
  const respostas = await Promise.all([
    listar('pessoas', contatos ? ['nome', 'email', 'celular'] : []),
    listar('pessoas_papeis'),
    listar('pessoas_cargos'),
    listar('pessoas_enderecos', camposDecifrados(contatos, false)),
    listar('familias_pessoas', contatos ? ['detalhes_vinculo'] : []),
    listar('familias_enderecos', camposDecifrados(contatos, true)),
    chamar('listar', {aba: 'familias'}), // com as encerradas (a tela Famílias tem o filtro "Encerradas")
    // Visitas dos últimos 2 meses: relato e combinados decifrados só para quem tem CONTATOS_VER.
    chamar('listar', {aba: 'visitas', filtros: {apenas_ativas: true, data_visita_desde: desdeVisitas()},
      decifrar: contatos ? CIFRADOS_VISITA : []}),
    listar('visitas_participantes'),
    listar('visitas_auxilios'),
  ]);
  const [pessoas, papeis, cargos, enderecosPessoas, vinculos, enderecosFamilias, familias, visitas, participantes,
    auxilios] = respostas.map((r) => r.registros);
  const agrupar = (lista, campo) => {
    const grupos = {};
    lista.forEach((r) => {
      const chave = String(r[campo]).toUpperCase();
      (grupos[chave] = grupos[chave] || []).push(r);
    });
    return (id) => grupos[String(id).toUpperCase()] || [];
  };
  const papeisDe = agrupar(papeis, 'id_pessoa');
  const cargosDe = agrupar(cargos, 'id_pessoa');
  const enderecosDe = agrupar(enderecosPessoas, 'id_pessoa');
  const vinculosDe = agrupar(vinculos, 'id_pessoa');
  const enderecosDaFamilia = agrupar(enderecosFamilias, 'id_familia');
  const registros = [];
  for (const p of pessoas.filter((x) => String(x.ativa).toUpperCase() !== 'NÃO')) {
    const id = String(p.id_pessoa);
    const dados = montarDetalhe(p, papeisDe(id), cargosDe(id), enderecosDe(id), vinculosDe(id), enderecosDaFamilia);
    registros.push({chave: cf + '|' + id, conferencia: cf, guardado_em: new Date().toISOString(),
      ...(await cofre.cifrar(cf, dados))});
  }
  const registrosFamilias = await cifrarTodas(cf, familias, vinculos, enderecosFamilias,
      {visitas, participantes, auxilios});
  if (!cofre.aberto(cf)) {
    return 0; // saiu da conferência enquanto baixava: não grava nada
  }
  await db.substituirDaConferencia(db.STORES.DETALHES, cf, registros);
  await db.substituirDaConferencia(db.STORES.DETALHES_FAMILIAS, cf, registrosFamilias);
  await db.salvarConfig(chaveBaixados(cf), new Date().toISOString());
  await db.salvarConfig(chaveDesde(cf), proximoDesde(respostas)); // daqui em diante, só o que mudar
  await db.salvarConfig(chaveVersao(cf), VERSAO_COPIA);
  return registros.length;
}
