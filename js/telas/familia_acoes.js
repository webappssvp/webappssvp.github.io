/**
 * @fileoverview Ações no detalhe da família (#familias/<id>). Decisões: mvp/telas/03_familias.md (14/11/2026).
 *
 * Todas vão pela fila (js/core/sync.js), com ou sem internet, num item só por ação:
 * - Editar (como em Pessoas): nome de referência e endereço, só o que mudou. "A família se mudou" grava um endereço
 *   novo e encerra o anterior (histórico); sem marcar, corrige o endereço atual.
 * - Adicionar morador: pessoa nova (com o papel da situação da família) ou alguém que já está na conferência.
 * - Retirar morador: encerra o vínculo e o papel de atendimento; se é o titular, pede o novo titular.
 * - Mudar a situação (assistida ↔ socorrida): muda o papel de atendimento de todos os moradores.
 * - Família promovida (só o presidente, FAMILIAS_PROMOVER) e Encerrar (afastada ou transferida):
 *   encerram a família e os papéis de atendimento dos moradores.
 * Moradores que são membros (VIC, ASP, VIS, BEN) não mudam de papel (pendência 7).
 */

import {esc} from './comum.js';
import {avisar} from '../casca.js';
import * as sync from '../core/sync.js';
import {CAMPOS_ENDERECO} from './pessoa_dados.js';
import {ligarEndereco} from '../componentes/endereco_busca.js';

/** Busca do endereço nos Correios no formulário Editar aberto. */
let buscaEndereco = null;
import {botaoCombinado, botaoRegra} from '../componentes/de_onde_vem.js';
import {guardarFamilia, hoje, NOME_DA_SITUACAO, operacoesDePapeis, papelDaSituacao} from './familia_dados.js';

/* Contexto (ctx) que o detalhe passa: {sessao, cf, id, d: {familia, moradores, endereco}, nomes, vinculos, pessoas}. */

/** @param {!Object} ctx @return {!Array<string>} */
const permissoes = (ctx) => (ctx.sessao.perfil && ctx.sessao.perfil.permissoes) || [];

/** @param {!Object} ctx @return {string} */
const situacao = (ctx) => String(ctx.d.familia.id_status_familia || '').toUpperCase();

/** @param {!Object} ctx @return {boolean} A família ainda é atendida (não promovida nem encerrada). */
const ativa = (ctx) => !ctx.d.familia.data_termino && ['AST', 'SOC', 'SIN'].includes(situacao(ctx));

/** @param {!Object} ctx @return {boolean} Pode cuidar do cadastro desta família (endereço, moradores). */
function podeCuidar(ctx) {
  const p = permissoes(ctx);
  return ['SOC', 'SIN'].includes(situacao(ctx)) ? p.includes('SOCORRIDOS_CADASTRAR') : p.includes('ASSISTIDOS_CADASTRAR');
}

/** @param {!Object} ctx @return {boolean} Presidente e vice (padrão): mudar a situação e encerrar. */
function podeMudarSituacao(ctx) {
  const p = permissoes(ctx);
  return ['ASSISTIDOS_CADASTRAR', 'SOCORRIDOS_CADASTRAR', 'PESSOAS_DESATIVAR'].every((a) => p.includes(a));
}

/** @param {!Object} ctx @return {boolean} Só o presidente (fixo no servidor). */
const podePromover = (ctx) => permissoes(ctx).includes('FAMILIAS_PROMOVER');

/** @param {!Object} ctx @return {boolean} */
const veContatos = (ctx) => permissoes(ctx).includes('CONTATOS_VER');

/**
 * Botões de ação, conforme as permissões.
 * @param {!Object} ctx
 * @return {string} HTML ('' se não pode nada)
 */
export function botoes(ctx) {
  if (!ativa(ctx)) {
    return '';
  }
  const b = [];
  if (podePromover(ctx) && situacao(ctx) === 'AST') { // só a família assistida pode ser promovida (14/11/2026)
    b.push('<button type="button" class="btn-submit btn-promover" data-acao-familia="promover">★ Família promovida</button>');
  }
  if (podeCuidar(ctx)) {
    b.unshift('<button type="button" class="btn-submit" data-acao-familia="editar">Editar</button>');
    // "+ Adicionar morador" fica no cartão Moradores, junto do "Retirar" de cada um (15/11/2026).
  }
  if (podeMudarSituacao(ctx)) {
    b.push('<button type="button" class="btn-secundario" data-acao-familia="situacao">Mudar a situação</button>');
    b.push('<button type="button" class="btn-perigo" data-acao-familia="encerrar">Encerrar</button>');
  }
  return b.length ? `<div class="detalhe-acoes">${b.join('')}</div>` : '';
}

/** @param {!Object} ctx @return {boolean} Pode retirar moradores (mostra o botão em cada um). */
export function podeRetirar(ctx) {
  return ativa(ctx) && podeCuidar(ctx);
}

// ---------------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------------

/**
 * @param {string} modo endereco, morador, retirar, situacao, promover ou encerrar
 * @param {!Object} ctx
 * @param {?Object} alvo Morador a retirar (modo retirar).
 * @return {string} HTML
 */
export function formulario(modo, ctx, alvo) {
  const botoesFim = (rotulo, classe = 'btn-submit') => `
    <p class="feedback-msg" id="msgAcaoFamilia" role="status"></p>
    <div class="detalhe-acoes">
      <button type="submit" class="${classe}" id="btnAcaoFamilia">${esc(rotulo)}</button>
      <button type="button" class="btn-secundario" data-acao-familia="cancelar">Cancelar</button>
    </div>`;
  const nomeFamilia = esc(ctx.d.familia.nome_referencia);
  if (modo === 'editar') {
    const e = ctx.d.endereco || {};
    const campo = (id, rotulo, valor, extra = '') => `
      <div class="form-grupo"><label class="form-label" for="${id}">${esc(rotulo)}</label>
        <input id="${id}" class="form-input" value="${esc(valor || '')}" autocomplete="off" ${extra}></div>`;
    // Sem CONTATOS_VER os campos cifrados chegam vazios: o endereço não aparece (senão, salvar apagaria os dados).
    const endereco = veContatos(ctx) ? `
      <fieldset class="md-card detalhe-secao form-conjunto">
        <legend class="detalhe-titulo">Endereço</legend>
        ${CAMPOS_ENDERECO.map(([c, rotulo]) => campo('fam_' + c, rotulo, e[c] || (c === 'estado_uf' && !ctx.d.endereco ? 'SP' : ''),
      c === 'estado_uf' ? 'maxlength="2" autocapitalize="characters"' : c === 'cep' ? 'inputmode="numeric"' : '')).join('')}
        ${ctx.d.endereco ? `<label class="opcao-papel"><input type="checkbox" id="fam_mudou">
          <span>A família se mudou para este endereço <span class="detalhe-nota">· o anterior fica guardado no histórico.
          Sem marcar, só corrige o endereço atual (erro de digitação, número, CEP).</span></span></label>` : ''}
      </fieldset>` : '';
    return `
      <form id="formAcaoFamilia" class="detalhe-form" novalidate autocomplete="off">
        <fieldset class="md-card detalhe-secao form-conjunto">
          <legend class="detalhe-titulo">Dados da família</legend>
          ${campo('fam_nome', 'Nome de referência (aparece na lista)', ctx.d.familia.nome_referencia, 'required maxlength="120"')}
        </fieldset>
        ${endereco}
        ${botoesFim('Salvar')}
      </form>`;
  }
  if (modo === 'morador') {
    const naFamilia = new Set(ctx.d.moradores.map((m) => m.id_pessoa));
    const outros = ctx.pessoas.filter((p) => !naFamilia.has(p.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const vinculos = Object.entries(ctx.vinculos).filter(([s]) => s !== 'TIT');
    return `
      <form id="formAcaoFamilia" class="md-card detalhe-secao detalhe-form" novalidate>
        <h2 class="detalhe-titulo">Novo morador em ${nomeFamilia}</h2>
        <fieldset class="form-conjunto opcoes-papel"><legend class="form-label">Quem é?</legend>
          <label class="opcao-papel"><input type="radio" name="quemMorador" value="nova" checked><span>Pessoa nova</span></label>
          ${outros.length ? '<label class="opcao-papel"><input type="radio" name="quemMorador" value="existente"><span>Alguém que já está na conferência</span></label>' : ''}
        </fieldset>
        <div data-quem="nova">
          <div class="form-grupo"><label class="form-label" for="mor_nome">Nome completo</label>
            <input id="mor_nome" class="form-input" maxlength="200" autocomplete="off" autocapitalize="words"></div>
          <div class="form-grupo"><label class="form-label" for="mor_exibicao">Nome de exibição (aparece na lista)</label>
            <input id="mor_exibicao" class="form-input" maxlength="60" autocomplete="off" autocapitalize="words"></div>
        </div>
        <div data-quem="existente" hidden>
          <div class="form-grupo"><label class="form-label" for="mor_pessoa">Pessoa</label>
            <select id="mor_pessoa" class="form-input"><option value="">Escolha</option>${outros.map((p) =>
    `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('')}</select></div>
        </div>
        <div class="form-grupo"><label class="form-label" for="mor_vinculo">Relação com o titular</label>
          <select id="mor_vinculo" class="form-input"><option value="">Escolha</option>${vinculos.map(([s, nome]) =>
    `<option value="${esc(s)}">${esc(nome)}</option>`).join('')}</select></div>
        <p class="detalhe-nota">A pessoa entra como ${esc(papelDaSituacao(situacao(ctx)) === 'AST' ? 'assistida' : 'socorrida')},
          como a família. Quem já é vicentino continua só vicentino.</p>
        ${botoesFim('Adicionar morador')}
      </form>`;
  }
  if (modo === 'retirar' && alvo) {
    const outros = ctx.d.moradores.filter((m) => m.id_pessoa !== alvo.id_pessoa);
    const nome = esc(ctx.nomes[alvo.id_pessoa] || alvo.nome || 'Morador');
    const titular = String(alvo.id_vinculo).toUpperCase() === 'TIT';
    if (!outros.length) {
      return `
        <div class="md-card detalhe-secao">
          <h2 class="detalhe-titulo">Retirar ${nome}</h2>
          <p class="tela-texto">É o único morador da família. Para retirar, encerre a família.</p>
          <div class="detalhe-acoes">
            ${podeMudarSituacao(ctx) ? '<button type="button" class="btn-perigo" data-acao-familia="encerrar">Encerrar a família</button>' : ''}
            <button type="button" class="btn-secundario" data-acao-familia="cancelar">Voltar</button>
          </div>
        </div>`;
    }
    return `
      <form id="formAcaoFamilia" class="md-card detalhe-secao detalhe-form" novalidate>
        <h2 class="detalhe-titulo">Retirar ${nome} da família</h2>
        <p class="tela-texto">A pessoa deixa de morar com a família e de ser atendida por ela. Nada é apagado: o
          histórico fica na planilha.</p>
        <div class="form-grupo"><label class="form-label" for="ret_motivo">Motivo</label>
          <input id="ret_motivo" class="form-input" maxlength="200" autocomplete="off"
            placeholder="Ex.: mudou-se, faleceu, foi morar com parentes"></div>
        ${titular ? `<div class="form-grupo"><label class="form-label" for="ret_titular">Novo titular (responsável)</label>
          <select id="ret_titular" class="form-input"><option value="">Escolha</option>${outros.map((m) =>
    `<option value="${esc(m.id_pessoa_familia)}">${esc(ctx.nomes[m.id_pessoa] || m.nome || m.id_pessoa)}</option>`).join('')}</select>
          <p class="detalhe-nota">${nome} é o titular: escolha quem passa a ser o responsável pela família.</p></div>` : ''}
        ${botoesFim('Retirar da família', 'btn-perigo')}
      </form>`;
  }
  if (modo === 'situacao') {
    const atual = situacao(ctx);
    const opcoes = ['AST', 'SOC'].filter((s) => s !== atual);
    return `
      <form id="formAcaoFamilia" class="md-card detalhe-secao detalhe-form" novalidate>
        <h2 class="detalhe-titulo">Mudar a situação de ${nomeFamilia}</h2>
        <p class="tela-texto">Hoje: ${esc(NOME_DA_SITUACAO[atual] || atual)}. Todos os moradores mudam junto (menos quem é
          vicentino).</p>
        <p class="origens">${botaoCombinado('socorrida_assistida')}${botaoRegra('sindicancia', 'Sindicância: o que diz a Regra')}</p>
        <fieldset class="form-conjunto opcoes-papel"><legend class="form-label">Nova situação</legend>
          ${opcoes.map((s, n) => `<label class="opcao-papel"><input type="radio" name="novaSituacao" value="${s}"${n ? '' : ' checked'}>
            <span>${esc(NOME_DA_SITUACAO[s])}</span></label>`).join('')}
        </fieldset>
        ${botoesFim('Mudar a situação')}
      </form>`;
  }
  if (modo === 'promover') {
    return `
      <form id="formAcaoFamilia" class="md-card detalhe-secao detalhe-form form-promover" novalidate>
        <h2 class="detalhe-titulo">★ ${nomeFamilia} foi promovida?</h2>
        <p class="tela-texto">A família conquistou a autonomia: é a meta da conferência. Ela sai do atendimento e entra
          em Promovidas, com a data de hoje.</p>
        <p class="origens">${botaoRegra('autonomia')}${botaoCombinado(['promover_presidente', 'promover_assistida'])}</p>
        <div class="form-grupo"><label class="form-label" for="prm_texto">O que a família conquistou (opcional)</label>
          <input id="prm_texto" class="form-input" maxlength="200" autocomplete="off"
            placeholder="Ex.: emprego fixo, casa própria, renda do próprio negócio"></div>
        ${botoesFim('Confirmar a promoção', 'btn-submit btn-promover')}
      </form>`;
  }
  if (modo === 'encerrar') {
    return `
      <form id="formAcaoFamilia" class="md-card detalhe-secao detalhe-form" novalidate>
        <h2 class="detalhe-titulo">Encerrar o atendimento de ${nomeFamilia}</h2>
        <p class="tela-texto">Para família que conquistou a autonomia, use "Família promovida". Nada é apagado: o
          histórico fica na planilha.</p>
        <fieldset class="form-conjunto opcoes-papel"><legend class="form-label">Por quê?</legend>
          <label class="opcao-papel"><input type="radio" name="motivoEncerrar" value="AFA" checked>
            <span>Afastada <span class="detalhe-nota">· não quis mais, mudou para longe, faleceu</span></span></label>
          <label class="opcao-papel"><input type="radio" name="motivoEncerrar" value="TRF">
            <span>Transferida <span class="detalhe-nota">· passou para outra conferência</span></span></label>
        </fieldset>
        <div class="form-grupo"><label class="form-label" for="enc_texto">Motivo</label>
          <input id="enc_texto" class="form-input" maxlength="200" autocomplete="off" required></div>
        ${botoesFim('Encerrar', 'btn-perigo')}
      </form>`;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

/**
 * Liga o formulário aberto.
 * @param {!HTMLElement} area
 * @param {string} modo
 * @param {!Object} ctx
 * @param {?Object} alvo
 * @param {function(string): void} aoTerminar Recebe o aviso; volta para a lista.
 */
export function ligar(area, modo, ctx, alvo, aoTerminar) {
  const form = area.querySelector('#formAcaoFamilia');
  if (!form) {
    return;
  }
  // Rua e CEP conferidos na base dos Correios enquanto edita (15/11/2026).
  buscaEndereco = modo === 'editar' ? ligarEndereco(form, 'fam_',
      {conferido: Boolean(ctx.d.endereco && ctx.d.endereco.endereco_conferido === 'SIM')}) : null;
  if (modo === 'morador') {
    form.addEventListener('change', () => {
      const quem = (form.querySelector('input[name="quemMorador"]:checked') || {}).value;
      form.querySelectorAll('[data-quem]').forEach((b) => {
        b.hidden = b.dataset.quem !== quem;
      });
    });
    const nome = form.querySelector('#mor_nome');
    const exibicao = form.querySelector('#mor_exibicao');
    let mexeu = false;
    nome.addEventListener('input', () => {
      if (!mexeu) {
        const partes = nome.value.trim().split(/\s+/).filter(Boolean);
        exibicao.value = partes.length <= 2 ? partes.join(' ') : partes[0] + ' ' + partes[partes.length - 1];
      }
    });
    exibicao.addEventListener('input', () => {
      mexeu = exibicao.value.trim() !== '';
    });
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = form.querySelector('#msgAcaoFamilia');
    const botao = form.querySelector('#btnAcaoFamilia');
    const erro = (texto) => {
      msg.textContent = texto;
      msg.className = 'feedback-msg erro';
      msg.scrollIntoView({block: 'nearest'});
    };
    let acao;
    try {
      acao = await montar(modo, ctx, alvo, form);
    } catch (falta) {
      erro(falta.message);
      return;
    }
    botao.disabled = true;
    try {
      await sync.enfileirar({conferencia: ctx.cf, url_api: ctx.sessao.url_api, tipo: 'familia', id_pessoa: ctx.id,
        descricao: acao.descricao, operacoes: acao.operacoes, efeito: acao.efeitos, efeito_familia: acao.efeitoFamilia});
    } catch (falha) {
      botao.disabled = false;
      erro('Não deu para guardar no celular: ' + falha.message);
      return;
    }
    guardarFamilia(ctx.cf, ctx.id, acao.depois).catch(() => {});
    aoTerminar(navigator.onLine ? acao.aviso : acao.aviso + ' Guardado no celular: vai para a nuvem quando houver internet.');
  });
}

/**
 * Monta as operações da ação a partir do formulário.
 * @param {string} modo
 * @param {!Object} ctx
 * @param {?Object} alvo
 * @param {!HTMLFormElement} form
 * @return {!Promise<{descricao: string, aviso: string, operacoes: !Array, efeitos: !Array, efeitoFamilia: !Object,
 *     depois: !Object}>} Rejeita com a mensagem do que falta preencher.
 */
async function montar(modo, ctx, alvo, form) {
  const v = (id) => {
    const campo = form.querySelector('#' + id);
    return campo ? campo.value.trim() : '';
  };
  const marcado = (nome) => (form.querySelector(`input[name="${nome}"]:checked`) || {}).value || '';
  const falta = (texto) => {
    throw new Error(texto);
  };
  const id = ctx.id;
  const nomeFamilia = ctx.d.familia.nome_referencia;
  const d = JSON.parse(JSON.stringify(ctx.d));
  const todos = ctx.d.moradores.map((m) => m.id_pessoa);

  if (modo === 'editar') {
    const nome = v('fam_nome').replace(/\s+/g, ' ') || falta('Escreva o nome de referência.');
    const operacoes = [];
    const efeitoFamilia = {id};
    if (nome !== String(ctx.d.familia.nome_referencia || '')) {
      operacoes.push({acao: 'atualizar', aba: 'familias', id_registro: id, dados: {nome_referencia: nome}});
      d.familia = {...d.familia, nome_referencia: nome};
      efeitoFamilia.nome = nome;
    }
    if (form.querySelector('#fam_logradouro')) {
      const antes = ctx.d.endereco || {};
      const campos = {};
      const mudou = {};
      CAMPOS_ENDERECO.forEach(([c]) => {
        let valor = v('fam_' + c);
        valor = c === 'estado_uf' ? valor.toUpperCase() : c === 'cep' ? valor.replace(/\D/g, '') : valor;
        campos[c] = valor;
        if (valor !== String(antes[c] || '')) {
          mudou[c] = valor;
        }
      });
      // Conferido nos Correios (SIM) ou a conferir (NÃO): vai com o endereço novo, ou quando muda.
      const conferido = buscaEndereco ? buscaEndereco.conferido() : 'NÃO';
      campos.endereco_conferido = conferido;
      if (campos.logradouro && conferido !== String(antes.endereco_conferido || '')) {
        mudou.endereco_conferido = conferido;
      }
      const seMudou = Boolean(form.querySelector('#fam_mudou') && form.querySelector('#fam_mudou').checked);
      // Sem endereço ainda: o primeiro vale como novo (a UF já vem preenchida e não conta).
      const primeiro = !ctx.d.endereco && Object.keys(mudou).some((c) => mudou[c] && !['estado_uf', 'endereco_conferido'].includes(c));
      if (seMudou || primeiro) {
        if (!campos.logradouro && !campos.bairro) {
          falta('Escreva pelo menos a rua ou o bairro.');
        }
        if (ctx.d.endereco) {
          operacoes.push({acao: 'desativar', aba: 'familias_enderecos', id_registro: ctx.d.endereco.id_familia_endereco,
            motivo: 'A família se mudou'});
        }
        const idNovo = sync.novoProvisorio();
        const dados = {...campos, id_familia: id, data_inicio: hoje()};
        operacoes.push({acao: 'inserir', aba: 'familias_enderecos', temp_uuid: idNovo, dados});
        d.endereco = {...dados, id_familia_endereco: idNovo};
        efeitoFamilia.bairro = campos.bairro;
      } else if (ctx.d.endereco && Object.keys(mudou).length) {
        operacoes.push({acao: 'atualizar', aba: 'familias_enderecos', id_registro: ctx.d.endereco.id_familia_endereco,
          dados: mudou});
        d.endereco = {...ctx.d.endereco, ...mudou};
        efeitoFamilia.bairro = campos.bairro;
      }
    }
    if (!operacoes.length) {
      falta('Nada mudou.');
    }
    return {descricao: 'Edição de ' + nome, aviso: 'Dados de ' + nome + ' salvos.', operacoes, efeitos: [],
      efeitoFamilia, depois: d};
  }

  if (modo === 'morador') {
    const vinculo = v('mor_vinculo') || falta('Escolha a relação com o titular.');
    const papel = papelDaSituacao(String(ctx.d.familia.id_status_familia || '').toUpperCase());
    const operacoes = [];
    let efeitos = [];
    let idPessoa;
    let nome;
    if (marcado('quemMorador') === 'existente') {
      idPessoa = v('mor_pessoa') || falta('Escolha a pessoa.');
      nome = (ctx.pessoas.find((p) => p.id === idPessoa) || {}).nome || idPessoa;
      const papeis = await operacoesDePapeis(ctx.cf, [idPessoa], papel, 'Entrou na família ' + nomeFamilia,
          sync.novoProvisorio);
      operacoes.push(...papeis.operacoes);
      efeitos = papeis.efeitos;
    } else {
      const completo = v('mor_nome').replace(/\s+/g, ' ') || falta('Escreva o nome completo.');
      nome = v('mor_exibicao').replace(/\s+/g, ' ') || falta('Escreva o nome de exibição.');
      idPessoa = sync.novoProvisorio();
      operacoes.push({acao: 'cadastrar_pessoa', temp_uuid: idPessoa, id_papel: papel,
        dados: {nome_exibicao: nome, nome: completo}});
      efeitos = [{id: idPessoa, novo: {nome, papeis: [papel]}}];
    }
    const idVinculo = sync.novoProvisorio();
    const dados = {id_pessoa: idPessoa, id_familia: id, id_vinculo: vinculo, data_inicio: hoje()};
    operacoes.push({acao: 'inserir', aba: 'familias_pessoas', temp_uuid: idVinculo, dados});
    d.moradores.push({...dados, id_pessoa_familia: idVinculo, nome});
    return {descricao: nome + ' na família ' + nomeFamilia, aviso: nome + ' agora mora com a família ' + nomeFamilia + '.',
      operacoes, efeitos, efeitoFamilia: {id, moradores: d.moradores.length}, depois: d};
  }

  if (modo === 'retirar') {
    const motivo = v('ret_motivo') || falta('Escreva o motivo.');
    const titular = String(alvo.id_vinculo).toUpperCase() === 'TIT';
    const novoTitular = titular ? (v('ret_titular') || falta('Escolha o novo titular.')) : '';
    const nome = ctx.nomes[alvo.id_pessoa] || alvo.nome || 'Morador';
    const operacoes = [{acao: 'desativar', aba: 'familias_pessoas', id_registro: alvo.id_pessoa_familia, motivo}];
    const papeis = await operacoesDePapeis(ctx.cf, [alvo.id_pessoa], '', 'Saiu da família: ' + motivo, sync.novoProvisorio);
    operacoes.push(...papeis.operacoes);
    if (novoTitular) {
      operacoes.push({acao: 'atualizar', aba: 'familias_pessoas', id_registro: novoTitular, dados: {id_vinculo: 'TIT'}});
    }
    d.moradores = d.moradores.filter((m) => m.id_pessoa_familia !== alvo.id_pessoa_familia)
        .map((m) => (m.id_pessoa_familia === novoTitular ? {...m, id_vinculo: 'TIT'} : m));
    return {descricao: 'Saída de ' + nome + ' da família ' + nomeFamilia, aviso: nome + ' saiu da família ' + nomeFamilia + '.',
      operacoes, efeitos: papeis.efeitos, efeitoFamilia: {id, moradores: d.moradores.length}, depois: d};
  }

  if (modo === 'situacao') {
    const nova = marcado('novaSituacao') || falta('Escolha a nova situação.');
    const papeis = await operacoesDePapeis(ctx.cf, todos, nova, 'Família passou para ' + NOME_DA_SITUACAO[nova].toLowerCase(),
        sync.novoProvisorio);
    d.familia = {...d.familia, id_status_familia: nova};
    return {descricao: nomeFamilia + ' para ' + NOME_DA_SITUACAO[nova].toLowerCase(),
      aviso: nomeFamilia + ' agora é ' + NOME_DA_SITUACAO[nova].toLowerCase() + '.',
      operacoes: [{acao: 'atualizar', aba: 'familias', id_registro: id, dados: {id_status_familia: nova}}, ...papeis.operacoes],
      efeitos: papeis.efeitos, efeitoFamilia: {id, situacao: nova}, depois: d};
  }

  if (modo === 'promover' || modo === 'encerrar') {
    const promover = modo === 'promover';
    const nova = promover ? 'PRM' : (marcado('motivoEncerrar') || 'AFA');
    const motivo = promover ? (v('prm_texto') || 'Família promovida') : (v('enc_texto') || falta('Escreva o motivo.'));
    const papeis = await operacoesDePapeis(ctx.cf, todos, '', (promover ? 'Família promovida' : 'Família encerrada') +
      ': ' + motivo, sync.novoProvisorio);
    const dados = {id_status_familia: nova, data_termino: hoje(), motivo_termino: motivo};
    d.familia = {...d.familia, ...dados};
    return {descricao: (promover ? 'Promoção de ' : 'Encerramento de ') + nomeFamilia,
      aviso: promover ? '★ ' + nomeFamilia + ' foi promovida! Parabéns à conferência.' : nomeFamilia + ' foi encerrada.',
      operacoes: [{acao: 'atualizar', aba: 'familias', id_registro: id, dados}, ...papeis.operacoes],
      efeitos: papeis.efeitos, efeitoFamilia: {id, situacao: nova, encerrada: true, encerrada_em: hoje()}, depois: d};
  }
  throw new Error('Ação desconhecida.');
}

/** Mostra o aviso (usado quando a ação termina). @param {string} texto */
export function avisarFim(texto) {
  avisar(texto);
}
