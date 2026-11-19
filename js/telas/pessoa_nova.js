/**
 * @fileoverview Nova pessoa (#pessoas/novo). Decisões: mvp/telas/02_pessoas.md
 *
 * Os papéis que aparecem vêm das permissões do login (a tela não decide pelo cargo; o servidor confere de novo):
 *   SOCORRIDOS_CADASTRAR → socorrido; ASSISTIDOS_CADASTRAR → assistido;
 *   VICENTINOS_CADASTRAR → vicentino, aspirante, visitante e benfeitor.
 * No padrão, presidente e vice escolhem qualquer papel; o vicentino só cadastra socorridos (vai direto ao formulário).
 *
 * O cadastro vai pela fila de sincronização (js/core/sync.js), com ou sem internet, num item só:
 * - Socorrido: cadastrar_socorrido (pessoa SOC + família SOC com ela como titular + endereço da família).
 * - Assistido: cadastrar_pessoa (AST), a família (status AST, ela como titular) e o endereço da família.
 * - Membros: cadastrar_pessoa com o papel, o e-mail (é com ele que a pessoa entra no app) e o endereço pessoal.
 * A pessoa nova tem id provisório ("tmp-…") até o servidor confirmar.
 */

import {esc, voltar} from './comum.js';
import {definirBarra} from '../componentes/barra_tela.js';
import {campoConfirmarEmail, ligarConfirmarEmail} from '../componentes/confirmar_email.js';
import {avisar} from '../casca.js';
import * as sync from '../core/sync.js';
import {ligarEndereco} from '../componentes/endereco_busca.js';
import {CAMPOS_ENDERECO, formatarCelular, avisoDaFila} from './pessoa_detalhe.js';

/** Papéis na ordem da escolha, com a permissão que cada um exige. */
const PAPEIS_NOVOS = [
  {sigla: 'SOC', nome: 'Socorrido', explica: 'atendido pela conferência; depois pode passar para assistido',
    permissao: 'SOCORRIDOS_CADASTRAR'},
  {sigla: 'AST', nome: 'Assistido', explica: 'atendido, com família acompanhada', permissao: 'ASSISTIDOS_CADASTRAR'},
  {sigla: 'VIC', nome: 'Vicentino', explica: 'membro da conferência; entra no app', permissao: 'VICENTINOS_CADASTRAR'},
  {sigla: 'ASP', nome: 'Aspirante', explica: 'em preparação para ser vicentino; entra no app', permissao: 'VICENTINOS_CADASTRAR'},
  {sigla: 'VIS', nome: 'Visitante', explica: 'acompanha visitas; entra no app', permissao: 'VICENTINOS_CADASTRAR'},
  {sigla: 'BEN', nome: 'Benfeitor', explica: 'ajuda a conferência; entra no app', permissao: 'VICENTINOS_CADASTRAR'},
];
const ATENDIDOS = ['AST', 'SOC'];

/** Busca do endereço nos Correios no formulário aberto (js/componentes/endereco_busca.js). */
let buscaEndereco = null;
/** "Confirme o novo e-mail" (confirmar_email.js). */
let confirmacaoEmail = null;

/**
 * @param {!Array<string>} permissoes
 * @return {!Array<!Object>} Os papéis que esta pessoa pode cadastrar.
 */
export function papeisQuePodeCadastrar(permissoes) {
  return PAPEIS_NOVOS.filter((p) => permissoes.includes(p.permissao));
}

/**
 * "Maria das Dores Silva" → "Maria Silva" (como o script faz na importação).
 * @param {string} nome
 * @return {string}
 */
function nomeDeExibicao(nome) {
  const partes = nome.split(' ').filter(Boolean);
  return partes.length <= 2 ? partes.join(' ') : partes[0] + ' ' + partes[partes.length - 1];
}

/** Para comparar nomes sem diferença de maiúsculas e acentos. */
const comparavel = (texto) => String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Sugestão de nome de exibição (decisão de 13/11/2026): só o primeiro nome, se ninguém na conferência
 * começa com ele ("Ana Lúcia" → "Ana"); senão, primeiro + último nome ("Ana Lúcia Souza" → "Ana Souza").
 * Sem a lista da conferência (ainda não carregada), primeiro + último, para não arriscar nomes repetidos.
 * @param {string} nome Nome completo.
 * @param {?Array<string>} existentes Nomes de exibição de quem já está na conferência.
 * @return {string}
 */
export function sugerirNomeDeExibicao(nome, existentes) {
  const partes = nome.split(' ').filter(Boolean);
  if (partes.length < 2 || !existentes) {
    return nomeDeExibicao(nome);
  }
  const primeiro = comparavel(partes[0]);
  const repetido = existentes.some((n) => comparavel(n).split(' ')[0] === primeiro);
  return repetido ? nomeDeExibicao(nome) : partes[0];
}

/**
 * @param {!HTMLElement} area
 * @param {!Object} sessao
 * @param {{nomesNaConferencia: (?Array<string>|undefined)}} opcoes
 * @return {string} Texto para o modo Ouvir.
 */
export function renderizarNova(area, sessao, opcoes) {
  const papeis = papeisQuePodeCadastrar((sessao.perfil && sessao.perfil.permissoes) || []);
  if (!papeis.length) {
    definirBarra({titulo: 'Nova pessoa', voltar: '#pessoas'});
    area.innerHTML = `
      <div class="tela-pessoas tela-detalhe">
        <p class="tela-texto">Você não pode cadastrar pessoas nesta conferência. Fale com o presidente.</p>
      </div>`;
    return 'Você não pode cadastrar pessoas nesta conferência.';
  }
  const soUm = papeis.length === 1 ? papeis[0] : null;
  const titulo = soUm ? 'Novo ' + soUm.nome.toLowerCase() : 'Nova pessoa';
  const campo = (id, rotulo, extra = '', ajuda = '') => `
    <div class="form-grupo" data-campo="${id}"><label class="form-label" for="${id}">${esc(rotulo)}</label>
      <input id="${id}" class="form-input" ${extra}${/autocomplete=/.test(extra) ? '' : ' autocomplete="off"'}>${ajuda ? `<p class="detalhe-nota">${esc(ajuda)}</p>` : ''}</div>`;
  const escolha = soUm ? '' : `
        <fieldset class="md-card detalhe-secao form-conjunto">
          <legend class="detalhe-titulo">Papel</legend>
          <div class="opcoes-papel" role="radiogroup" aria-label="Papel da pessoa nova">
          ${papeis.map((p) => `
            <label class="opcao-papel">
              <input type="radio" name="novoPapel" value="${p.sigla}">
              <span>${esc(p.nome)} <span class="detalhe-nota">· ${esc(p.explica)}</span></span>
            </label>`).join('')}
          </div>
        </fieldset>`;
  definirBarra({titulo, voltar: '#pessoas'});
  area.innerHTML = `
    <div class="tela-pessoas tela-detalhe">
      <p class="tela-texto">${soUm && soUm.sigla === 'SOC' ?
    'Para quem a conferência atende. Depois, o presidente ou o vice podem passá-lo(a) para assistido.' :
    'Escolha o papel e preencha os dados.'}</p>
      <form id="formNovaPessoa" class="detalhe-form" novalidate autocomplete="off">
        ${escolha}
        <fieldset class="md-card detalhe-secao form-conjunto">
          <legend class="detalhe-titulo">Dados pessoais</legend>
          ${campo('novo_nome', 'Nome completo', 'required maxlength="200" autocomplete="off" autocapitalize="words"')}
          ${campo('novo_nome_exibicao', 'Nome de exibição (aparece na lista)', 'required maxlength="60" autocapitalize="words"',
      'Vem do nome completo: só o primeiro nome, se não houver outro igual na conferência. Pode trocar, por um apelido, por exemplo.')}
          <p class="detalhe-nota" id="avisoNomeRepetido" hidden></p>
          ${campo('novo_celular', 'Celular com DDD', 'type="tel" inputmode="tel" autocomplete="off"')}
          ${campo('novo_email', 'E-mail', 'type="email" inputmode="email" autocomplete="off" autocapitalize="none" maxlength="200"',
      'É com este e-mail que a pessoa entra no app e recebe o código de acesso.')}
          ${campoConfirmarEmail('novo_email_confirma')}
        </fieldset>
        <fieldset class="md-card detalhe-secao form-conjunto">
          <legend class="detalhe-titulo" id="legendaEndereco">Endereço</legend>
          ${CAMPOS_ENDERECO.map(([c, rotulo]) => campo('novo_' + c, rotulo, c === 'estado_uf' ?
      'maxlength="2" autocapitalize="characters" value="SP"' : c === 'cep' ? 'inputmode="numeric"' : '')).join('')}
        </fieldset>
        <p class="feedback-msg" id="msgNovo" role="status"></p>
        <div class="detalhe-acoes">
          <button type="submit" class="btn-submit" id="btnCadastrarPessoa">Cadastrar</button>
          <a class="btn-secundario btn-link" href="#pessoas">Cancelar</a>
        </div>
      </form>
    </div>`;
  const form = area.querySelector('#formNovaPessoa');
  const papelEscolhido = () => (soUm ? soUm.sigla : (form.querySelector('input[name="novoPapel"]:checked') || {}).value || '');
  // O e-mail é dos membros (entram no app); o ponto de referência, do endereço da família dos atendidos.
  const ajustarCampos = () => {
    const papel = papelEscolhido();
    const atendido = !papel || ATENDIDOS.includes(papel);
    area.querySelector('[data-campo="novo_email"]').hidden = atendido;
    area.querySelector('[data-campo="novo_ponto_referencia"]').hidden = !atendido;
    area.querySelector('#legendaEndereco').textContent = papel && atendido ? 'Endereço da família' : 'Endereço';
  };
  form.addEventListener('change', ajustarCampos);
  ajustarCampos();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    cadastrar(area, sessao, papelEscolhido());
  });
  ligarNomeDeExibicao(area, opcoes.nomesNaConferencia || null);
  confirmacaoEmail = ligarConfirmarEmail(form, 'novo_email', 'novo_email_confirma');
  // Rua e CEP conferidos na base dos Correios enquanto preenche (15/11/2026).
  buscaEndereco = ligarEndereco(form, 'novo_');
  area.querySelector('#novo_celular').addEventListener('blur', (e) => {
    e.target.value = formatarCelular(e.target.value.replace(/\D/g, '')) || e.target.value;
  });
  area.scrollTop = 0; // sem focar o nome: o teclado só abre quando a pessoa tocar no campo
  return soUm ? titulo + '. Escreva o nome completo, confira o nome de exibição, o celular e o endereço, e toque em ' +
    'Cadastrar.' : 'Nova pessoa. Escolha o papel, escreva o nome completo, confira o nome de exibição, o celular e o ' +
    'endereço, e toque em Cadastrar.';
}

/**
 * O nome de exibição acompanha o nome completo até a pessoa mexer nele; se ela apagar tudo, volta a acompanhar.
 * Avisa (sem impedir) quando já há alguém com o mesmo nome de exibição.
 * @param {!HTMLElement} area
 * @param {?Array<string>} existentes
 */
function ligarNomeDeExibicao(area, existentes) {
  const nome = area.querySelector('#novo_nome');
  const exibicao = area.querySelector('#novo_nome_exibicao');
  const aviso = area.querySelector('#avisoNomeRepetido');
  let mexeu = false;
  const conferirRepetido = () => {
    const v = comparavel(exibicao.value.replace(/\s+/g, ' '));
    const igual = Boolean(v && existentes && existentes.some((n) => comparavel(n) === v));
    aviso.hidden = !igual;
    aviso.textContent = igual ? 'Já há alguém com este nome de exibição na conferência. Acrescente algo para diferenciar.' : '';
  };
  nome.addEventListener('input', () => {
    if (!mexeu) {
      exibicao.value = sugerirNomeDeExibicao(nome.value.trim().replace(/\s+/g, ' '), existentes);
      conferirRepetido();
    }
  });
  exibicao.addEventListener('input', () => {
    mexeu = exibicao.value.trim() !== '';
    conferirRepetido();
  });
}

/**
 * @param {!HTMLElement} msg
 * @param {string} texto
 */
function erro(msg, texto) {
  msg.textContent = texto;
  msg.className = 'feedback-msg' + (texto ? ' erro' : '');
  if (texto) {
    msg.scrollIntoView({block: 'nearest'});
  }
}

/**
 * @param {!HTMLElement} area
 * @param {!Object} sessao
 * @param {string} papel Sigla escolhida.
 */
async function cadastrar(area, sessao, papel) {
  const msg = area.querySelector('#msgNovo');
  const valor = (id) => area.querySelector('#' + id).value.trim();
  const nome = valor('novo_nome').replace(/\s+/g, ' ');
  const nomeExibicao = valor('novo_nome_exibicao').replace(/\s+/g, ' ');
  const celular = valor('novo_celular').replace(/\D/g, '');
  const atendido = ATENDIDOS.includes(papel);
  const email = atendido ? '' : valor('novo_email').toLowerCase();
  if (!papel) {
    erro(msg, 'Escolha o papel da pessoa.');
    area.querySelector('input[name="novoPapel"]').focus();
    return;
  }
  if (!nome) {
    erro(msg, 'Escreva o nome completo.');
    area.querySelector('#novo_nome').focus();
    return;
  }
  if (!nomeExibicao) {
    erro(msg, 'Escreva o nome de exibição: é ele que aparece na lista.');
    area.querySelector('#novo_nome_exibicao').focus();
    return;
  }
  if (celular && !/^\d{10,11}$/.test(celular)) {
    erro(msg, 'Celular com DDD: 10 ou 11 números, como (11) 98765-4321.');
    area.querySelector('#novo_celular').focus();
    return;
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    erro(msg, 'Confira o e-mail: falta o @ ou o ponto.');
    area.querySelector('#novo_email').focus();
    return;
  }
  const semConfirmar = email && confirmacaoEmail ? confirmacaoEmail.conferir() : '';
  if (semConfirmar) {
    erro(msg, semConfirmar);
    return;
  }
  const endereco = {};
  CAMPOS_ENDERECO.filter((c) => atendido || !c[3]).forEach(([c]) => {
    let v = valor('novo_' + c);
    v = c === 'estado_uf' ? v.toUpperCase() : c === 'cep' ? v.replace(/\D/g, '') : v;
    if (v) {
      endereco[c] = v;
    }
  });
  // Só a UF (que já vem preenchida) não conta como endereço.
  if (Object.keys(endereco).length === 1 && endereco.estado_uf) {
    delete endereco.estado_uf;
  }
  const temEndereco = Object.keys(endereco).length > 0;
  if (temEndereco) {
    endereco.endereco_conferido = buscaEndereco ? buscaEndereco.conferido() : 'NÃO';
  }
  const botao = area.querySelector('#btnCadastrarPessoa');
  botao.disabled = true; // dois toques não cadastram duas vezes
  erro(msg, '');
  const idNovo = sync.novoProvisorio();
  const dados = {nome_exibicao: nomeExibicao, nome, celular};
  let operacoes;
  if (papel === 'SOC') {
    operacoes = [{acao: 'cadastrar_socorrido', temp_uuid: idNovo, dados, endereco}];
  } else {
    if (email) {
      dados.email = email;
    }
    const pedido = {acao: 'cadastrar_pessoa', temp_uuid: idNovo, id_papel: papel, dados};
    if (!atendido && temEndereco) {
      pedido.endereco = endereco; // membro: endereço pessoal (pessoas_enderecos)
    }
    operacoes = [pedido];
    if (papel === 'AST') {
      operacoes.push(...familiaDoAssistido(idNovo, nome, temEndereco ? endereco : null));
    }
  }
  try {
    await sync.enfileirar({conferencia: sessao.id_conferencia, url_api: sessao.url_api, tipo: 'cadastrar',
      descricao: 'Cadastro de ' + nomeExibicao, id_pessoa: idNovo, operacoes,
      efeito: {id: idNovo, novo: {nome: nomeExibicao, papeis: [papel]}}});
  } catch (e) {
    botao.disabled = false;
    erro(msg, 'Não deu para guardar no celular: ' + e.message);
    return;
  }
  voltar('#pessoas');
  avisar(avisoDaFila(nomeExibicao + ' cadastrado(a).'));
}

/**
 * Assistido: a família dele (status AST, ele como titular) e o endereço na família, no mesmo item da fila.
 * @param {string} idPessoa Id provisório da pessoa nova.
 * @param {string} nome
 * @param {?Object} endereco
 * @return {!Array<!Object>} Operações do lote.
 */
function familiaDoAssistido(idPessoa, nome, endereco) {
  const hoje = new Date().toISOString().slice(0, 10);
  const idFamilia = sync.novoProvisorio();
  const operacoes = [
    {acao: 'inserir', aba: 'familias', temp_uuid: idFamilia, dados: {nome_referencia: nome, id_status_familia: 'AST',
      data_inicio: hoje}},
    {acao: 'inserir', aba: 'familias_pessoas', dados: {id_pessoa: idPessoa, id_familia: idFamilia, id_vinculo: 'TIT',
      data_inicio: hoje}},
  ];
  if (endereco) {
    operacoes.push({acao: 'inserir', aba: 'familias_enderecos', dados: {...endereco, id_familia: idFamilia, data_inicio: hoje}});
  }
  return operacoes;
}
