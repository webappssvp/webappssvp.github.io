/**
 * @fileoverview Detalhes de uma pessoa (#pessoas/<id_pessoa>): ver, editar e desativar.
 * Decisões: mvp/telas/02_pessoas.md
 *
 * O que cada um pode fazer vem de perfil.permissoes (o servidor confere de novo cada pedido):
 * - editar: a ação de cadastro de cada papel ativo da pessoa (VICENTINOS_, ASSISTIDOS_ ou SOCORRIDOS_CADASTRAR);
 * - desativar: isso mais PESSOAS_DESATIVAR;
 * - ver contatos e endereço decifrados: CONTATOS_VER.
 * Endereço: membros em pessoas_enderecos; assistidos e socorridos na família (familias_enderecos).
 *
 * Salvar, mudar papel e desativar vão pela fila de sincronização (js/core/sync.js), com ou sem internet.
 * Abrir os dados precisa de internet (os contatos decifrados não ficam no celular). A pessoa cadastrada
 * neste celular e ainda não confirmada (id "tmp-…") mostra só o resumo e a situação do envio.
 */

import {campoSenha, esc, voltar} from './comum.js';
import {definirBarra} from '../componentes/barra_tela.js';
import {CARD_BAIXANDO, mostrarCarregando} from '../componentes/carregando.js';
import {chamarComSessao} from '../componentes/barra_conexao.js';
import {textoDoEstado} from '../componentes/icone_sync.js';
import {montarBlocoMudanca} from '../componentes/bloco_mudanca.js';
import {enderecoComMapa} from '../componentes/mapa.js';
import {vibrar} from '../core/preferencias.js';
import * as sync from '../core/sync.js';
import * as cofre from '../core/cofre.js';
import {avisar} from '../casca.js';
import {ATENDIDOS, CAMPOS_ENDERECO, atualizarGuardados, buscarDetalhe, chaveBaixados, desbloquear, eventosDados,
  guardar, haGuardados, lerGuardado} from './pessoa_dados.js';
import * as db from '../core/db.js';
import {ligarEndereco} from '../componentes/endereco_busca.js';
import {familiaDoTitular, operacoesDePapeis} from './familia_dados.js';

export {CAMPOS_ENDERECO};

const NOME_DO_PAPEL = {VIC: 'Vicentino', ASP: 'Aspirante', AST: 'Assistido', SOC: 'Socorrido', VIS: 'Visitante',
  BEN: 'Benfeitor'};
const CARGOS = {PRE: 'Presidente', VIC: 'Vice-presidente', SEC: 'Secretário(a)', TES: 'Tesoureiro(a)'};

/** Erros de rede (api_cc.js): sem eles, a tela não tenta a cópia guardada. */
const SEM_REDE = ['SEM_INTERNET', 'SEM_CONEXAO'];

/** Estado do detalhe aberto. */
const estado = {
  id: '',
  dados: null, // {pessoa, papeis, cargo, endereco, aba_endereco, id_familia}
  carregando: false,
  erro: '',
  modo: 'ver', // ver | editar | desativar | papel
  papelEscolhido: '',
  salvando: false,
  aviso: '',
  resumo: null, // a pessoa como está na lista
  fila: [], // itens da fila desta pessoa
};

/** @type {?HTMLElement} */
let areaAtual = null;
/** @type {?Object} */
let sessaoAtual = null;
/** Busca do endereço nos Correios no formulário de edição aberto (js/componentes/endereco_busca.js). */
let buscaEndereco = null;

/**
 * Aviso depois de pôr na fila: sem internet, diz que fica guardado.
 * @param {string} texto
 * @return {string}
 */
export function avisoDaFila(texto) {
  return navigator.onLine ? texto : texto + ' Guardado no celular: vai para a nuvem quando houver internet.';
}

// A fila mudou: atualiza a situação do envio (só vendo os dados, para não apagar um formulário em uso).
sync.eventos.addEventListener('mudou', async () => {
  if (!estado.id) {
    return;
  }
  estado.fila = await lerFila(estado.id);
  if (estado.modo === 'ver' && !estado.bloqueado) { // não apaga a senha sendo digitada
    desenhar();
  }
});

/**
 * @param {string} id
 * @return {!Promise<!Array<!Object>>} Os itens da fila desta pessoa.
 */
async function lerFila(id) {
  const cf = sessaoAtual ? sessaoAtual.id_conferencia : '';
  return (await sync.itens()).filter((i) => i.conferencia === cf && i.id_pessoa === id);
}

/**
 * @param {!HTMLElement} area
 * @param {!Object} sessao
 * @param {string} id id_pessoa
 * @param {{resumo: ?Object}} opcoes resumo = a pessoa da lista (aparece na hora).
 * @return {function(): string} Texto para o modo Ouvir.
 */
export function renderizarDetalhe(area, sessao, id, opcoes) {
  areaAtual = area;
  sessaoAtual = sessao;
  // Sempre busca de novo ao abrir: outra pessoa pode ter mudado os dados.
  Object.assign(estado, {id, dados: null, erro: '', modo: 'ver', aviso: '', resumo: opcoes.resumo || null, fila: []});
  lerFila(id).then((fila) => {
    if (estado.id === id) {
      estado.fila = fila;
      if (estado.modo === 'ver') {
        desenhar();
      }
    }
  });
  if (sync.ehProvisorio(id)) {
    desenhar(); // ainda não está na planilha: não há o que buscar
  } else {
    carregar();
  }
  return textoParaOuvir;
}

// ---------------------------------------------------------------------------
// Permissões (as mesmas regras do Permissoes.gs; o servidor tem a palavra final)
// ---------------------------------------------------------------------------

/** @return {!Array<string>} */
function permissoes() {
  return (sessaoAtual && sessaoAtual.perfil && sessaoAtual.perfil.permissoes) || [];
}

/** @param {string} papel @return {string} */
function acaoDoPapel(papel) {
  return {AST: 'ASSISTIDOS_CADASTRAR', SOC: 'SOCORRIDOS_CADASTRAR'}[papel] || 'VICENTINOS_CADASTRAR';
}

/** A pessoa aberta é quem entrou: vê e edita os próprios dados (decisão de 11/11/2026). */
function eProprio() {
  return Boolean(sessaoAtual && sessaoAtual.perfil && estado.id &&
    String(sessaoAtual.perfil.id_pessoa || '').toUpperCase() === estado.id.toUpperCase());
}

/** @param {!Array<string>} papeis @return {boolean} */
function podeEditar(papeis) {
  if (eProprio()) {
    return true;
  }
  const p = permissoes();
  return (papeis.length ? papeis : ['VIC']).every((papel) => p.includes(acaoDoPapel(papel)));
}

/** @param {!Array<string>} papeis @return {boolean} */
/** Socorrido → assistido (decisão de 11/11/2026): só quem encerra o SOC e cadastra assistidos. */
function podePromover(papeis) {
  const p = permissoes();
  return papeis.includes('SOC') && ['SOCORRIDOS_CADASTRAR', 'ASSISTIDOS_CADASTRAR', 'PESSOAS_DESATIVAR'].every((a) => p.includes(a));
}

/**
 * Mudar o papel de outra pessoa (presidente e vice): encerrar e cadastrar qualquer papel.
 * Não vale para si mesmo (o presidente não se tranca fora sem querer).
 */
function podeMudarPapel() {
  const p = permissoes();
  return !eProprio() && ['VICENTINOS_CADASTRAR', 'ASSISTIDOS_CADASTRAR', 'SOCORRIDOS_CADASTRAR', 'PESSOAS_DESATIVAR']
      .every((a) => p.includes(a));
}

/** @param {!Array<string>} papeis @return {boolean} */
function podeDesativar(papeis) {
  // Ninguém se desativa (nem o presidente): o servidor também recusa.
  return !eProprio() && podeEditar(papeis) && permissoes().includes('PESSOAS_DESATIVAR');
}

function veContatos() {
  return eProprio() || permissoes().includes('CONTATOS_VER');
}

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------

/** Última conferência das mudanças a partir dos detalhes (ms), para não perguntar a cada pessoa aberta. */
let ultimaConferencia = 0;
const INTERVALO_CONFERENCIA_MS = 60 * 1000;

// A cópia guardada mudou (alguém alterou esta pessoa em outro lugar): mostra a versão nova, se está só vendo.
eventosDados.addEventListener('guardados', async (e) => {
  const {conferencia, ids} = e.detail;
  if (!estado.id || !sessaoAtual || conferencia !== sessaoAtual.id_conferencia ||
      !(ids.includes('*') || ids.includes(estado.id)) || estado.modo !== 'ver' || !estado.dados) {
    return;
  }
  const novo = await lerGuardado(conferencia, estado.id);
  if (novo && estado.modo === 'ver') {
    estado.dados = novo;
    desenhar();
  }
});

/**
 * Abre a pessoa. Com a cópia guardada aberta (cofre), mostra dela na hora, sem esperar o servidor, e confere
 * em segundo plano se algo mudou (só o que mudou vem). Sem cópia, busca no servidor. Sem internet e sem
 * cópia aberta, pede a senha ou explica.
 */
async function carregar() {
  const id = estado.id;
  const cf = sessaoAtual.id_conferencia;
  Object.assign(estado, {carregando: true, erro: '', bloqueado: false, doCelular: false, guardadoEm: ''});
  const guardado = (await cofre.restaurar(cf)) ? await lerGuardado(cf, id) : null;
  if (guardado && estado.id === id) {
    estado.dados = guardado;
    estado.carregando = false;
    if (!navigator.onLine) {
      estado.doCelular = true;
      estado.guardadoEm = (await db.lerConfig(chaveBaixados(cf))) || '';
    } else if (Date.now() - ultimaConferencia > INTERVALO_CONFERENCIA_MS) {
      ultimaConferencia = Date.now();
      atualizarGuardados(false); // se esta pessoa mudou, o evento "guardados" redesenha
    }
    desenhar();
    return;
  }
  desenhar();
  try {
    if (!navigator.onLine) {
      const erro = new Error('Sem internet.');
      erro.codigo = 'SEM_INTERNET';
      throw erro;
    }
    const dados = await buscarDetalhe(id, (acao, d) => chamarComSessao(acao, d), veContatos());
    if (!dados) {
      throw new Error('Esta pessoa foi desativada.');
    }
    if (estado.id === id) {
      estado.dados = dados;
    }
    guardar(cf, id, dados); // a cópia para usar sem internet fica em dia (se o cofre está aberto)
  } catch (erro) {
    if (estado.id === id) {
      if (SEM_REDE.includes(erro.codigo) || !navigator.onLine) {
        await usarGuardado(cf, id);
      } else {
        estado.erro = erro.message;
      }
    }
  } finally {
    if (estado.id === id) {
      estado.carregando = false;
      desenhar();
    }
  }
}

/**
 * Sem internet: abre a cópia guardada, ou pede a senha, ou explica que não há cópia.
 * @param {string} cf
 * @param {string} id
 */
async function usarGuardado(cf, id) {
  if (!(await haGuardados(cf))) {
    estado.erro = 'Sem internet, e os dados desta conferência ainda não foram guardados no celular. Com internet, ' +
      'toque em "Guardar" na lista de pessoas.';
    return;
  }
  if (!cofre.aberto(cf)) {
    estado.bloqueado = true;
    return;
  }
  const guardado = await lerGuardado(cf, id);
  if (!guardado) {
    estado.erro = 'Sem internet, e esta pessoa não está entre os dados guardados no celular.';
    return;
  }
  estado.dados = guardado;
  estado.doCelular = true;
  estado.guardadoEm = (await db.lerConfig(chaveBaixados(cf))) || '';
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

function desenhar() {
  const area = areaAtual;
  // Resposta que chegou depois de a pessoa sair dos detalhes: não desenha por cima da outra tela.
  const [base, idNaRota] = location.hash.split('/');
  if (!area || base !== '#pessoas' || decodeURIComponent(idNaRota || '') !== estado.id) {
    return;
  }
  const d = estado.dados;
  const nome = d ? d.pessoa.nome_exibicao : (estado.resumo ? estado.resumo.nome : 'Pessoa');
  let corpo;
  if (sync.ehProvisorio(estado.id)) {
    corpo = visualizacaoProvisoria();
  } else if (estado.bloqueado) {
    corpo = formularioDesbloqueio();
  } else if (!d) {
    corpo = estado.erro ? `<p class="feedback-msg erro">${esc(estado.erro)}</p>
      <button type="button" class="btn-submit" data-acao-detalhe="recarregar">Tentar de novo</button>` :
      `<p class="tela-texto">Buscando os dados${CARD_BAIXANDO}</p>`;
  } else if (estado.modo === 'editar') {
    corpo = formularioEdicao(d);
  } else if (estado.modo === 'papel') {
    corpo = formularioPapel(d);
  } else if (estado.modo === 'desativar') {
    corpo = formularioDesativar(d);
  } else {
    corpo = visualizacao(d);
  }
  definirBarra({titulo: nome, voltar: '#pessoas'});
  area.innerHTML = `
    <div class="tela-pessoas tela-detalhe">
      ${corpo}
    </div>`;
  ligarEventos(area);
  preencherCifras(area);
  const lugar = area.querySelector('[data-bloco-mudanca]');
  if (lugar && sessaoAtual) {
    montarBlocoMudanca(lugar, {tipo: 'pessoa', id: estado.id, nome, cf: sessaoAtual.id_conferencia});
  }
}

/** @param {!Object} d @return {string} HTML */
function visualizacao(d) {
  const p = d.pessoa;
  const papeis = d.papeis.map((s) => NOME_DO_PAPEL[s] || s).join(' · ') || 'Sem papel ativo';
  const cargo = d.cargo ? `<span class="selo-cargo">${esc(CARGOS[String(d.cargo.id_cargo).toUpperCase()] ||
    d.cargo.id_cargo)}${String(d.cargo.provisorio).toUpperCase() === 'SIM' ? ' (provisório)' : ''}</span>` : '';
  const exemplo = String(p.ficticio).toUpperCase() === 'SIM' ? '<span class="selo-exemplo">EXEMPLO</span>' : '';
  const linha = (rotulo, valor, link) => `<div class="detalhe-linha"><dt>${esc(rotulo)}</dt><dd>${valor ?
    (link ? `<a href="${link}">${esc(valor)}</a>` : esc(valor)) : '<span class="detalhe-vazio">não informado</span>'}</dd></div>`;
  const celular = p.celular ? String(p.celular) : '';
  const contatos = veContatos() ? `
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Dados pessoais</h2>
      <dl class="detalhe-lista">
        ${linha('Nome completo', p.nome)}
        ${linha('Celular', formatarCelular(celular), celular ? 'tel:+55' + celular.replace(/\D/g, '') : '')}
        ${linha('E-mail', p.email, p.email ? 'mailto:' + p.email : '')}
      </dl>
    </section>
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Endereço${d.aba_endereco === 'familias_enderecos' ? ' (da família)' : ''}</h2>
      ${d.aba_endereco === 'familias_enderecos' && !d.id_familia ?
    '<p class="tela-texto">Esta pessoa ainda não está ligada a uma família.</p>' :
    enderecoComMapa(esc(textoEndereco(d.endereco)) || '<span class="detalhe-vazio">não informado</span>', d.endereco)}
      ${d.endereco && d.endereco.endereco_conferido === 'NÃO' ? '<p class="endereco-nota endereco-conferir">Endereço a conferir nos Correios: abra Editar e escolha a rua na lista.</p>' : ''}
    </section>` : dadosProtegidos(d);
  const editar = podeEditar(d.papeis) ?
    '<button type="button" class="btn-submit" data-acao-detalhe="editar">Editar</button>' : '';
  const promover = podePromover(d.papeis) ?
    '<button type="button" class="btn-secundario" data-acao-detalhe="promover">Passar para assistido</button>' : '';
  const papel = podeMudarPapel() ?
    '<button type="button" class="btn-secundario" data-acao-detalhe="papel">Mudar papel</button>' : '';
  const desativar = podeDesativar(d.papeis) ?
    '<button type="button" class="btn-perigo" data-acao-detalhe="desativar">Desativar</button>' : '';
  return `
    <p class="detalhe-papeis">${esc(papeis)}${eProprio() ? ' · <strong>seus dados</strong>' : ''}</p>
    ${cargo || exemplo ? `<div class="cartao-pessoa-selos">${cargo}${exemplo}</div>` : ''}
    ${estado.aviso ? `<p class="feedback-msg sucesso" role="status">${esc(estado.aviso)}</p>` : ''}
    ${estado.doCelular ? `<p class="detalhe-nota detalhe-guardado" role="status">Sem
      internet: dados guardados no celular${estado.guardadoEm ? ' em ' + esc(new Date(estado.guardadoEm)
      .toLocaleDateString('pt-BR')) : ''}. O que você mudar vai para a nuvem quando a internet voltar.</p>` : ''}
    ${situacaoDoEnvio()}
    ${contatos}
    ${editar || promover || papel || desativar ?
    `<div class="detalhe-acoes">${editar}${promover}${papel}${desativar}</div>` : ''}`;
}

/** @return {string} Pior estado dos itens da fila desta pessoa ('confirmado' se não há nenhum). */
function estadoNaFila() {
  const cf = sessaoAtual ? sessaoAtual.id_conferencia : '';
  return sync.estadosPorPessoa(estado.fila || [], cf)[estado.id] || sync.ESTADOS.CONFIRMADO;
}

/**
 * Situação do envio: ícone e texto; recusado, com o motivo e as saídas (tentar de novo ou descartar).
 * @return {string} HTML ('' se não há nada na fila).
 */
function situacaoDoEnvio() {
  // Com mudança sua esperando: o bloco "Você mudou e ainda não enviou" (js/componentes/bloco_mudanca.js), que
  // compara com a planilha e deixa escolher qual vale (17/11/2026). Desenhado depois, em desenhar().
  return (estado.fila || []).length ? '<div data-bloco-mudanca></div>' : '';
}

/** Sem internet e com o cofre fechado: pede a senha do login. @return {string} HTML */
function formularioDesbloqueio() {
  return `
    <form id="formDesbloquear" class="md-card detalhe-secao detalhe-form" novalidate>
      <h2 class="detalhe-titulo">Sem internet</h2>
      <p class="tela-texto">Os dados das pessoas estão guardados neste celular, protegidos pela sua senha.
        Digite a mesma senha com que você entra no app.</p>
      ${campoSenha('iptSenhaCofre', 'Sua senha')}
      <p class="feedback-msg" id="msgDesbloquear" role="status"></p>
      <div class="detalhe-acoes">
        <button type="submit" class="btn-submit" id="btnDesbloquear">Abrir os dados</button>
      </div>
    </form>`;
}

/** Pessoa cadastrada neste celular e ainda não confirmada: resumo e situação do envio. @return {string} HTML */
function visualizacaoProvisoria() {
  const r = estado.resumo;
  const papeis = r ? r.papeis.map((s) => NOME_DO_PAPEL[s] || s).join(' · ') : '';
  if (!r && !(estado.fila || []).length) {
    return '<p class="tela-texto">Este cadastro não está mais no celular: foi enviado ou descartado. Volte para a lista.</p>';
  }
  return `
    ${papeis ? `<p class="detalhe-papeis">${esc(papeis)}</p>` : ''}
    ${situacaoDoEnvio()}
    <p class="tela-texto">Cadastro feito neste celular. Os dados completos e as ações (editar, mudar papel, desativar)
      aparecem depois que a nuvem confirmar.</p>`;
}

/** Textos de exemplo cifrados no lugar dos dados verdadeiros (o app não os recebe). */
const EXEMPLOS_CIFRA = {
  nome: 'Nome completo da pessoa',
  celular: '(11) 90000-0000',
  email: 'nome.sobrenome@exemplo.com.br',
  endereco: 'Rua Exemplo, 123, Bairro, Cidade/UF, CEP 00000-000',
};

/** Ilustrações já cifradas, por pessoa e campo (não mudam a cada redesenho). @type {!Map<string, string>} */
const cifrasDeExemplo = new Map();

/** @type {?Promise<CryptoKey>} Chave AES-256 só desta sessão, descartada ao fechar o app. */
let chaveDeExemplo = null;

/**
 * Cifra um texto de exemplo com AES-256-GCM do próprio navegador (Web Crypto) e devolve em base64,
 * como os dados ficam na planilha. Sem Web Crypto, usa bytes aleatórios do mesmo tamanho.
 * @param {string} texto
 * @return {!Promise<string>}
 */
async function cifrarExemplo(texto) {
  const bytes = new TextEncoder().encode(texto);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  let cifrado;
  if (crypto.subtle) {
    chaveDeExemplo = chaveDeExemplo ||
        crypto.subtle.generateKey({name: 'AES-GCM', length: 256}, false, ['encrypt']);
    cifrado = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await chaveDeExemplo, bytes));
  } else {
    cifrado = crypto.getRandomValues(new Uint8Array(bytes.length + 16));
  }
  const tudo = new Uint8Array(iv.length + cifrado.length);
  tudo.set(iv);
  tudo.set(cifrado, iv.length);
  return btoa(String.fromCharCode(...tudo));
}

/**
 * Troca cada [data-cifra] pela ilustração cifrada (depois de desenhar a tela).
 * @param {!HTMLElement} area
 */
async function preencherCifras(area) {
  const id = estado.id;
  for (const alvo of area.querySelectorAll('[data-cifra]')) {
    const campo = alvo.dataset.cifra;
    const chave = id + '|' + campo;
    if (!cifrasDeExemplo.has(chave)) {
      try {
        cifrasDeExemplo.set(chave, await cifrarExemplo(EXEMPLOS_CIFRA[campo]));
      } catch (erro) {
        continue; // fica o cadeado
      }
    }
    if (estado.id !== id) {
      return; // a pessoa saiu dos detalhes enquanto cifrava
    }
    alvo.textContent = cifrasDeExemplo.get(chave);
    alvo.classList.add('detalhe-cifra');
    // O leitor de tela diz "texto cifrado" em vez de soletrar as letras embaralhadas.
    alvo.setAttribute('aria-hidden', 'true');
    alvo.insertAdjacentHTML('afterend', '<span class="visualmente-oculto">texto cifrado</span>');
  }
}

/**
 * Sem CONTATOS_VER (aspirante, visitante, benfeitor): os mesmos campos, com uma ilustração cifrada
 * no lugar do valor, e o cartão da LGPD. O script do CC não manda nada cifrado: o app nem recebe esses dados.
 * @param {!Object} d
 * @return {string} HTML
 */
function dadosProtegidos(d) {
  const protegido = (campo) => `<span class="detalhe-protegido" data-cifra="${campo}">🔒 protegido</span>`;
  const linha = (rotulo, campo) => `<div class="detalhe-linha"><dt>${esc(rotulo)}</dt><dd>${protegido(campo)}</dd></div>`;
  return `
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Dados pessoais</h2>
      <dl class="detalhe-lista">
        ${linha('Nome completo', 'nome')}
        ${linha('Celular', 'celular')}
        ${linha('E-mail', 'email')}
      </dl>
    </section>
    <section class="md-card detalhe-secao">
      <h2 class="detalhe-titulo">Endereço${d.aba_endereco === 'familias_enderecos' ? ' (da família)' : ''}</h2>
      <p class="tela-texto">${protegido('endereco')}</p>
    </section>
    <section class="md-card detalhe-secao cartao-lgpd" aria-labelledby="tituloLgpd">
      <h2 class="detalhe-titulo" id="tituloLgpd">🔒 Dados protegidos pela LGPD</h2>
      <p class="tela-texto">Nome completo, celular, e-mail e endereço ficam guardados com criptografia
        (AES-256, a mesma usada pelos bancos). Só os vicentinos registrados nesta conferência podem ver estes
        dados abertos.</p>
      <p class="tela-texto">Os dados verdadeiros são cifrados com uma chave própria do Conselho Central.
        Essa chave fica guardada na conta Google do Conselho Central e nunca é enviada ao app nem aos celulares.</p>
      <p class="tela-texto">Os textos embaralhados acima são só uma ilustração: o app cifrou um exemplo com uma
        chave de demonstração, criada neste celular e apagada ao fechar o app. Não são os dados desta pessoa.</p>
      <p class="tela-texto">Assim a conferência cumpre a LGPD (Lei Geral de Proteção de Dados) e protege as
        famílias atendidas.</p>
    </section>`;
}

/** @param {?Object} e @return {string} */
function textoEndereco(e) {
  if (!e) {
    return '';
  }
  const rua = [e.logradouro, e.numero].filter(Boolean).join(', ');
  const cidade = [e.cidade, e.estado_uf].filter(Boolean).join('/');
  return [rua, e.complemento, e.bairro, cidade, e.cep ? 'CEP ' + formatarCep(e.cep) : '', e.ponto_referencia ?
    'Referência: ' + e.ponto_referencia : ''].filter(Boolean).join(' · ');
}

/** @param {string} c Só dígitos. @return {string} */
export function formatarCelular(c) {
  const d = String(c || '').replace(/\D/g, '');
  if (d.length === 11) {
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }
  if (d.length === 10) {
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  }
  return c || '';
}

/** @param {string} c @return {string} */
function formatarCep(c) {
  const d = String(c || '').replace(/\D/g, '');
  return d.length === 8 ? d.slice(0, 5) + '-' + d.slice(5) : c;
}

/** @param {!Object} d @return {string} HTML */
function formularioEdicao(d) {
  const p = d.pessoa;
  const campo = (id, rotulo, valor, extra = '') => `
    <div class="form-grupo"><label class="form-label" for="${id}">${esc(rotulo)}</label>
      <input id="${id}" class="form-input" value="${esc(valor || '')}" ${extra}${
  /autocomplete=/.test(extra) ? '' : ' autocomplete="off"'}></div>`;
  const naFamilia = d.aba_endereco === 'familias_enderecos';
  // Sem CONTATOS_VER os campos cifrados chegam vazios: não aparecem (senão, salvar apagaria os dados).
  const contatos = veContatos();
  const endereco = !contatos ? '' : !naFamilia || d.id_familia ? `
    <fieldset class="md-card detalhe-secao form-conjunto">
      <legend class="detalhe-titulo">Endereço${naFamilia ? ' (da família)' : ''}</legend>
      ${CAMPOS_ENDERECO.filter((c) => naFamilia || !c[3]).map(([c, rotulo]) => campo('end_' + c, rotulo,
      d.endereco ? d.endereco[c] : '', c === 'estado_uf' ? 'maxlength="2" autocapitalize="characters"' :
        c === 'cep' ? 'inputmode="numeric"' : '')).join('')}
    </fieldset>` : '<p class="tela-texto">Endereço: esta pessoa ainda não está ligada a uma família.</p>';
  return `
    <form id="formEditarPessoa" class="detalhe-form" novalidate autocomplete="off">
      <fieldset class="md-card detalhe-secao form-conjunto">
        <legend class="detalhe-titulo">Dados pessoais</legend>
        ${campo('ed_nome_exibicao', 'Nome de exibição (aparece na lista)', p.nome_exibicao, 'required maxlength="60"')}
        ${contatos ? campo('ed_nome', 'Nome completo', p.nome, 'maxlength="200"') +
          campo('ed_celular', 'Celular com DDD', formatarCelular(p.celular), 'type="tel" inputmode="tel"') +
          campo('ed_email', 'E-mail (usado para entrar no app)', p.email,
              'type="email" inputmode="email" autocomplete="off"') : ''}
      </fieldset>
      ${endereco}
      <p class="feedback-msg" id="msgEditar" role="status"></p>
      <div class="detalhe-acoes">
        <button type="submit" class="btn-submit" id="btnSalvarPessoa">Salvar</button>
        <button type="button" class="btn-secundario" data-acao-detalhe="cancelar">Cancelar</button>
      </div>
    </form>`;
}

/** @param {!Object} d @return {string} HTML */
function formularioPapel(d) {
  const atual = d.papeis;
  const opcoes = Object.keys(NOME_DO_PAPEL).map((sigla) => {
    const eAtual = atual.length === 1 && atual[0] === sigla;
    return `
      <label class="opcao-papel${eAtual ? ' opcao-atual' : ''}">
        <input type="radio" name="novoPapel" value="${sigla}" ${eAtual ? 'disabled' : ''}
          ${estado.papelEscolhido === sigla ? 'checked' : ''}>
        <span>${esc(NOME_DO_PAPEL[sigla])}${eAtual ? ' (atual)' : ''}</span>
      </label>`;
  }).join('');
  return `
    <form id="formPapelPessoa" class="md-card detalhe-secao detalhe-form" novalidate>
      <h2 class="detalhe-titulo">Mudar o papel de ${esc(d.pessoa.nome_exibicao)}</h2>
      <p class="tela-texto">Hoje: ${esc(atual.map((s) => NOME_DO_PAPEL[s] || s).join(' e ') || 'sem papel')}.
        O papel de hoje termina e o novo começa hoje. Nada é apagado: o histórico fica na planilha.</p>
      <fieldset class="form-conjunto opcoes-papel"><legend class="form-label">Novo papel</legend>${opcoes}</fieldset>
      <p class="tela-texto detalhe-nota">Assistido ou socorrido: a pessoa fica com uma família (criada agora, se não
        tiver), e o endereço passa a ser o da família.</p>
      <p class="feedback-msg" id="msgPapel" role="status"></p>
      <div class="detalhe-acoes">
        <button type="submit" class="btn-submit" id="btnConfirmarPapel">Mudar papel</button>
        <button type="button" class="btn-secundario" data-acao-detalhe="cancelar">Cancelar</button>
      </div>
    </form>`;
}

/** @param {!Object} d @return {string} HTML */
function formularioDesativar(d) {
  return `
    <form id="formDesativarPessoa" class="md-card detalhe-secao detalhe-form" novalidate>
      <h2 class="detalhe-titulo">Desativar ${esc(d.pessoa.nome_exibicao)}?</h2>
      <p class="tela-texto">A pessoa sai da lista e não consegue mais entrar no app. Nada é apagado: os dados
        continuam na planilha da conferência.</p>
      <div class="form-grupo"><label class="form-label" for="iptMotivo">Motivo</label>
        <input id="iptMotivo" class="form-input" maxlength="200" autocomplete="off" required
          placeholder="Ex.: mudou de cidade, faleceu, pediu para sair"></div>
      <p class="feedback-msg" id="msgDesativar" role="status"></p>
      <div class="detalhe-acoes">
        <button type="submit" class="btn-perigo" id="btnConfirmarDesativar">Desativar</button>
        <button type="button" class="btn-secundario" data-acao-detalhe="cancelar">Cancelar</button>
      </div>
    </form>`;
}

/** @param {!HTMLElement} area */
function ligarEventos(area) {
  area.querySelectorAll('[data-fila-acao]').forEach((b) => b.addEventListener('click', async () => {
    vibrar();
    const idOperacao = b.dataset.filaItem;
    if (b.dataset.filaAcao === 'tentar') {
      await sync.tentarDeNovo(idOperacao);
      return;
    }
    const juntos = await sync.comDependentes(idOperacao);
    const extra = juntos.length > 1 ? ` Também saem ${juntos.length - 1} mudança(s) que dependem desta.` : '';
    if (window.confirm('Descartar esta mudança? Ela é apagada do celular e não vai para a nuvem.' + extra)) {
      await sync.descartar(idOperacao);
      if (sync.ehProvisorio(estado.id)) {
        voltarParaLista('Cadastro descartado.');
      } else {
        avisar('Mudança descartada.');
      }
    }
  }));
  area.querySelectorAll('[data-acao-detalhe]').forEach((b) => b.addEventListener('click', () => {
    vibrar();
    const acao = b.dataset.acaoDetalhe;
    if (acao === 'recarregar') {
      carregar();
      return;
    }
    // "Passar para assistido" é o "Mudar papel" com Assistido já escolhido.
    estado.papelEscolhido = acao === 'promover' ? 'AST' : '';
    estado.modo = acao === 'cancelar' ? 'ver' : acao === 'promover' ? 'papel' : acao;
    estado.aviso = '';
    desenhar();
    // Sem focar o 1º campo: no celular o teclado abriria sozinho e esconderia o topo do formulário.
    area.scrollTop = 0;
  }));
  const formDesbloquear = area.querySelector('#formDesbloquear');
  if (formDesbloquear) {
    formDesbloquear.addEventListener('submit', async (e) => {
      e.preventDefault();
      const campo = area.querySelector('#iptSenhaCofre');
      const msg = area.querySelector('#msgDesbloquear');
      const botao = area.querySelector('#btnDesbloquear');
      if (!campo.value) {
        mostrar(msg, 'Digite a sua senha.');
        campo.focus();
        return;
      }
      botao.disabled = true;
      mostrar(msg, '');
      const senha = campo.value;
      campo.value = '';
      mostrarCarregando(botao, 'Abrindo'); // a conferência da senha leva 1 a 2 segundos no celular
      const ok = await desbloquear(sessaoAtual.id_conferencia, senha, {criar: false});
      botao.disabled = false;
      botao.textContent = 'Abrir os dados';
      if (!ok) {
        mostrar(msg, 'A senha não confere. Use a mesma senha com que você entra no app.');
        campo.focus();
        return;
      }
      carregar();
    });
  }
  const formEditar = area.querySelector('#formEditarPessoa');
  if (formEditar) {
    // Rua e CEP conferidos na base dos Correios enquanto edita (15/11/2026).
    buscaEndereco = ligarEndereco(formEditar, 'end_',
        {conferido: Boolean(estado.dados && estado.dados.endereco && estado.dados.endereco.endereco_conferido === 'SIM')});
    formEditar.addEventListener('submit', (e) => {
      e.preventDefault();
      salvar(area);
    });
  }
  const formPapel = area.querySelector('#formPapelPessoa');
  if (formPapel) {
    formPapel.addEventListener('submit', (e) => {
      e.preventDefault();
      mudarPapel(area);
    });
  }
  const formDesativar = area.querySelector('#formDesativarPessoa');
  if (formDesativar) {
    formDesativar.addEventListener('submit', (e) => {
      e.preventDefault();
      desativar(area);
    });
  }
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

/**
 * @param {!HTMLElement} msg
 * @param {string} texto
 * @param {string=} tipo
 */
function mostrar(msg, texto, tipo = 'erro') {
  msg.textContent = texto;
  msg.className = 'feedback-msg' + (texto ? ' ' + tipo : '');
  if (texto) {
    msg.scrollIntoView({block: 'nearest'});
  }
}

/** Depois de salvar: volta para a lista e avisa (decisão de 11/11/2026). @param {string} texto */
function voltarParaLista(texto) {
  estado.id = '';
  voltar('#pessoas');
  avisar(texto);
}

/**
 * Põe a mudança na fila e volta para a lista. O botão fica desligado (dois toques não gravam duas vezes).
 * @param {!HTMLElement} botao
 * @param {!HTMLElement} msg
 * @param {{tipo: string, descricao: string, operacoes: !Array<!Object>, efeito: !Object}} item
 * @param {string} aviso
 * @param {?Object} depois Os detalhes como ficam (null: a pessoa saiu), para a cópia guardada mostrar a mudança
 *     se for aberta de novo sem internet. Registros novos levam o id provisório do temp_uuid da operação.
 */
async function porNaFila(botao, msg, item, aviso, depois) {
  const cf = sessaoAtual.id_conferencia;
  const id = estado.id;
  botao.disabled = true;
  mostrar(msg, '');
  try {
    await sync.enfileirar({...item, conferencia: cf, url_api: sessaoAtual.url_api, id_pessoa: id});
  } catch (erro) {
    botao.disabled = false;
    mostrar(msg, 'Não deu para guardar no celular: ' + erro.message);
    return;
  }
  guardar(cf, id, depois).catch(() => {}); // a fila já tem a mudança; a cópia é só para ver depois
  voltarParaLista(avisoDaFila(aviso));
}

/** Manda só o que mudou, num lote: dados pessoais e endereço juntos. @param {!HTMLElement} area */
async function salvar(area) {
  const d = estado.dados;
  const msg = area.querySelector('#msgEditar');
  const valor = (id) => {
    const campo = area.querySelector('#' + id);
    return campo ? campo.value.trim() : null;
  };
  // null = campo que não está na tela: não é enviado.
  const celularDigitado = valor('ed_celular');
  const emailDigitado = valor('ed_email');
  const novos = {nome_exibicao: valor('ed_nome_exibicao'), nome: valor('ed_nome'),
    celular: celularDigitado === null ? null : celularDigitado.replace(/\D/g, ''),
    email: emailDigitado === null ? null : emailDigitado.toLowerCase()};
  if (!novos.nome_exibicao) {
    mostrar(msg, 'Escreva o nome de exibição.');
    area.querySelector('#ed_nome_exibicao').focus();
    return;
  }
  if (novos.celular && !/^\d{10,11}$/.test(novos.celular)) {
    mostrar(msg, 'Celular com DDD: 10 ou 11 números, como (11) 98765-4321.');
    area.querySelector('#ed_celular').focus();
    return;
  }
  if (novos.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(novos.email)) {
    mostrar(msg, 'Confira o e-mail: falta o @ ou o ponto.');
    area.querySelector('#ed_email').focus();
    return;
  }
  const antes = d.pessoa;
  const mudouPessoa = {};
  Object.keys(novos).filter((c) => novos[c] !== null).forEach((c) => {
    const anterior = c === 'celular' ? String(antes.celular || '').replace(/\D/g, '') : String(antes[c] || '');
    if (novos[c] !== anterior) {
      mudouPessoa[c] = novos[c];
    }
  });
  const operacoes = [];
  const depois = {...d, pessoa: {...d.pessoa, ...mudouPessoa}};
  if (Object.keys(mudouPessoa).length) {
    operacoes.push({acao: 'atualizar', aba: 'pessoas', id_registro: estado.id, dados: mudouPessoa});
  }
  const naFamilia = d.aba_endereco === 'familias_enderecos';
  if (veContatos() && (!naFamilia || d.id_familia)) {
    const mudouEndereco = {};
    CAMPOS_ENDERECO.filter((c) => naFamilia || !c[3]).forEach(([c]) => {
      let v = valor('end_' + c);
      v = c === 'estado_uf' ? v.toUpperCase() : c === 'cep' ? v.replace(/\D/g, '') : v;
      if (v !== String((d.endereco && d.endereco[c]) || '')) {
        mudouEndereco[c] = v;
      }
    });
    // Conferido nos Correios (SIM) ou a conferir (NÃO): vai quando muda o endereço ou a situação dele.
    const conferido = buscaEndereco ? buscaEndereco.conferido() : 'NÃO';
    const temRua = Boolean(valor('end_logradouro'));
    if (temRua && (Object.keys(mudouEndereco).length || conferido !== String((d.endereco && d.endereco.endereco_conferido) || ''))) {
      mudouEndereco.endereco_conferido = conferido;
    }
    if (Object.keys(mudouEndereco).length) {
      const colunaId = naFamilia ? 'id_familia_endereco' : 'id_pessoa_endereco';
      if (d.endereco) {
        operacoes.push({acao: 'atualizar', aba: d.aba_endereco, id_registro: d.endereco[colunaId], dados: mudouEndereco});
        depois.endereco = {...d.endereco, ...mudouEndereco};
      } else {
        const dono = naFamilia ? {id_familia: d.id_familia} : {id_pessoa: estado.id};
        const idNovo = sync.novoProvisorio();
        const dados = {...dono, ...mudouEndereco, data_inicio: new Date().toISOString().slice(0, 10)};
        operacoes.push({acao: 'inserir', aba: d.aba_endereco, temp_uuid: idNovo, dados});
        depois.endereco = {...dados, [colunaId]: idNovo};
      }
    }
  }
  if (!operacoes.length) {
    voltarParaLista('Nada mudou.');
    return;
  }
  await porNaFila(area.querySelector('#btnSalvarPessoa'), msg, {tipo: 'editar',
    descricao: 'Edição de ' + novos.nome_exibicao, operacoes,
    efeito: mudouPessoa.nome_exibicao ? {id: estado.id, nome: mudouPessoa.nome_exibicao} : {id: estado.id}},
  'Dados de ' + novos.nome_exibicao + ' salvos.', depois);
}

/**
 * Num lote: encerra os papéis de hoje, começa o novo e ajusta família e endereço (decisão de 11/11/2026):
 * - para AST ou SOC: a família passa a ter esse status (ou é criada, com a pessoa como titular), e o endereço
 *   pessoal, se houver, vai para a família;
 * - de AST ou SOC para membro: o endereço da família é copiado como endereço pessoal (a família fica como está:
 *   pode ter outros moradores).
 * @param {!HTMLElement} area
 */
async function mudarPapel(area) {
  const d = estado.dados;
  const msg = area.querySelector('#msgPapel');
  const marcado = area.querySelector('input[name="novoPapel"]:checked');
  if (!marcado) {
    mostrar(msg, 'Escolha o novo papel.');
    return;
  }
  const novo = marcado.value;
  if (d.cargo && novo !== 'VIC') {
    mostrar(msg, d.pessoa.nome_exibicao + ' tem o cargo de ' + (CARGOS[String(d.cargo.id_cargo).toUpperCase()] ||
      d.cargo.id_cargo) + ', que é só de vicentinos. Tire o cargo antes de mudar o papel.');
    return;
  }
  const hoje = new Date().toISOString().slice(0, 10);
  const nomeNovo = NOME_DO_PAPEL[novo];
  const operacoes = d.registros_papeis.filter((p) => String(p.id_papel).toUpperCase() !== novo).map((p) => (
    {acao: 'desativar', aba: 'pessoas_papeis', id_registro: p.id_pessoa_papel, motivo: 'Passou para ' + nomeNovo}));
  // Como a pessoa fica, para a cópia guardada (os registros novos com o id provisório da operação).
  const registrosPapeis = d.registros_papeis.filter((p) => String(p.id_papel).toUpperCase() === novo);
  if (!d.papeis.includes(novo)) {
    const idPapel = sync.novoProvisorio();
    const dados = {id_pessoa: estado.id, id_papel: novo, data_inicio: hoje};
    operacoes.push({acao: 'inserir', aba: 'pessoas_papeis', temp_uuid: idPapel, dados});
    registrosPapeis.push({...dados, id_pessoa_papel: idPapel});
  }
  const atendidoNovo = ATENDIDOS.includes(novo);
  const atendidoAntes = d.papeis.some((s) => ATENDIDOS.includes(s));
  const depois = {...d, papeis: [novo], registros_papeis: registrosPapeis,
    aba_endereco: atendidoNovo ? 'familias_enderecos' : 'pessoas_enderecos',
    id_familia: atendidoNovo ? d.id_familia : '', endereco: atendidoNovo === atendidoAntes ? d.endereco : null};
  // Endereço que está na tela (pessoal ou da família), sem o ponto de referência quando vai para a pessoa.
  const copiaEndereco = (paraFamilia) => {
    const dados = {};
    CAMPOS_ENDERECO.filter((c) => paraFamilia || !c[3]).forEach(([c]) => {
      if (d.endereco && d.endereco[c]) {
        dados[c] = d.endereco[c];
      }
    });
    return Object.keys(dados).length ? dados : null;
  };
  if (atendidoNovo) {
    if (d.id_familia) {
      operacoes.push({acao: 'atualizar', aba: 'familias', id_registro: d.id_familia, dados: {id_status_familia: novo}});
    } else {
      const idFamilia = sync.novoProvisorio();
      depois.id_familia = idFamilia;
      operacoes.push({acao: 'inserir', aba: 'familias', temp_uuid: idFamilia, dados: {
        nome_referencia: d.pessoa.nome || d.pessoa.nome_exibicao, id_status_familia: novo, data_inicio: hoje}});
      operacoes.push({acao: 'inserir', aba: 'familias_pessoas', dados: {id_pessoa: estado.id, id_familia: idFamilia,
        id_vinculo: 'TIT', data_inicio: hoje}});
      const endereco = !atendidoAntes ? copiaEndereco(true) : null;
      if (endereco) {
        const idEndereco = sync.novoProvisorio();
        const dados = {...endereco, id_familia: idFamilia, data_inicio: hoje};
        operacoes.push({acao: 'inserir', aba: 'familias_enderecos', temp_uuid: idEndereco, dados});
        operacoes.push({acao: 'desativar', aba: 'pessoas_enderecos', id_registro: d.endereco.id_pessoa_endereco});
        depois.endereco = {...dados, id_familia_endereco: idEndereco};
      }
    }
  } else if (atendidoAntes) {
    const endereco = copiaEndereco(false);
    if (endereco) {
      const idEndereco = sync.novoProvisorio();
      const dados = {...endereco, id_pessoa: estado.id, data_inicio: hoje};
      operacoes.push({acao: 'inserir', aba: 'pessoas_enderecos', temp_uuid: idEndereco, dados});
      depois.endereco = {...dados, id_pessoa_endereco: idEndereco};
    }
  }
  // Titular passando entre socorrido e assistido: todos os moradores mudam junto (decisão de 14/11/2026).
  const efeitos = [{id: estado.id, papeis: [novo]}];
  let efeitoFamilia;
  let aviso = d.pessoa.nome_exibicao + ' agora é ' + nomeNovo.toLowerCase() + '.';
  const familia = atendidoNovo ? await familiaDoTitular(sessaoAtual.id_conferencia, estado.id) : null;
  if (familia) {
    const outros = Object.values(familia.moradores_ids).map((m) => m.id_pessoa).filter((p) => p !== estado.id);
    const papeis = await operacoesDePapeis(sessaoAtual.id_conferencia, outros, novo,
        'Titular passou para ' + nomeNovo.toLowerCase(), sync.novoProvisorio);
    operacoes.push(...papeis.operacoes);
    efeitos.push(...papeis.efeitos);
    efeitoFamilia = {id: familia.id, situacao: novo};
    if (papeis.efeitos.length) {
      aviso += ' A família ' + familia.nome + ' e os moradores mudaram junto.';
    }
  }
  await porNaFila(area.querySelector('#btnConfirmarPapel'), msg, {tipo: 'papel',
    descricao: d.pessoa.nome_exibicao + ' para ' + nomeNovo.toLowerCase(), operacoes, efeito: efeitos,
    efeito_familia: efeitoFamilia}, aviso, depois);
}

/** @param {!HTMLElement} area */
async function desativar(area) {
  const msg = area.querySelector('#msgDesativar');
  const motivo = area.querySelector('#iptMotivo').value.trim();
  if (!motivo) {
    mostrar(msg, 'Escreva o motivo.');
    area.querySelector('#iptMotivo').focus();
    return;
  }
  const nome = estado.dados.pessoa.nome_exibicao;
  await porNaFila(area.querySelector('#btnConfirmarDesativar'), msg, {tipo: 'desativar',
    descricao: 'Desativação de ' + nome,
    operacoes: [{acao: 'desativar', aba: 'pessoas', id_registro: estado.id, motivo}],
    efeito: {id: estado.id, removida: true}},
  nome + ' foi desativado(a).', null);
}

/** @return {string} O que o modo Ouvir lê. */
function textoParaOuvir() {
  const d = estado.dados;
  const envio = (estado.fila || []).length ? ' ' + textoDoEstado(estadoNaFila(),
      ((estado.fila.find((i) => i.estado === sync.ESTADOS.RECUSADO) || {}).ultimo_erro) || '') + '.' : '';
  if (sync.ehProvisorio(estado.id)) {
    return (estado.resumo ? estado.resumo.nome + '. ' : '') + 'Cadastro feito neste celular.' + envio;
  }
  if (!d) {
    return 'Buscando os dados da pessoa.';
  }
  const papeis = d.papeis.map((s) => NOME_DO_PAPEL[s] || s).join(' e ');
  const partes = [d.pessoa.nome_exibicao, papeis];
  if (d.cargo) {
    partes.push(CARGOS[String(d.cargo.id_cargo).toUpperCase()] || '');
  }
  if (veContatos() && d.pessoa.celular) {
    partes.push('celular ' + formatarCelular(d.pessoa.celular));
  }
  if (veContatos() && d.endereco) {
    partes.push('endereço: ' + textoEndereco(d.endereco));
  }
  if (!veContatos()) {
    partes.push('Os dados pessoais e o endereço estão protegidos pela LGPD. ' +
        'Só os vicentinos registrados nesta conferência podem vê-los');
  }
  return partes.filter(Boolean).join('. ') + '.';
}
