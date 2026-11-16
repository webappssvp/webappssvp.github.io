/**
 * @fileoverview Confere o endereço na base dos Correios enquanto o vicentino preenche (decisões de 15/11/2026,
 * dev_local/implement/frontend_offline_voz.md §2.4). Usado em Nova pessoa, Editar pessoa e Editar família.
 *
 * - Rua: ao sair do campo (ou um instante depois de ditar), mostra as ruas com esse nome na cidade, com bairro,
 *   faixa de números e CEP. Tocar numa preenche rua (grafia oficial), bairro, cidade, UF e CEP: **conferido**.
 *   "Nenhuma destas" deixa como está: **a conferir**.
 * - CEP: com 8 números, preenche rua, bairro, cidade e UF: **conferido**.
 * - Mexer depois na rua, no CEP, na cidade ou na UF volta para "a conferir". Sem internet, fica "a conferir".
 * O formulário grava o resultado em endereco_conferido (SIM ou NÃO), coluna do modelo v4 da planilha.
 */

import {formatarCep, porCep, ruas} from '../core/cep.js';
import {vibrar} from '../core/preferencias.js';

/** @param {*} t @return {string} */
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
  '\'': '&#39;'}[c]));

/**
 * @param {!HTMLElement} form
 * @param {string} prefixo Dos ids dos campos ("novo_", "end_", "fam_").
 * @param {{conferido: (boolean|undefined)}=} opcoes conferido: o endereço que veio da planilha já estava conferido.
 * @return {{conferido: function(): string}} 'SIM' ou 'NÃO', para gravar em endereco_conferido.
 */
export function ligarEndereco(form, prefixo, opcoes = {}) {
  const campo = (nome) => form.querySelector('#' + prefixo + nome);
  const rua = campo('logradouro');
  if (!rua) {
    return {conferido: () => 'NÃO'};
  }
  let conferido = Boolean(opcoes.conferido);
  let preenchendo = false; // o próprio componente está preenchendo (não conta como mexer)
  let ultimaBusca = '';
  let ultimoCep = '';
  let espera = 0;

  const caixa = document.createElement('div');
  caixa.className = 'endereco-correios';
  caixa.setAttribute('role', 'status');
  rua.closest('.form-grupo').insertAdjacentElement('afterend', caixa);

  const nota = (texto, tipo) => {
    caixa.innerHTML = texto ? `<p class="endereco-nota endereco-${tipo}">${texto}</p>` : '';
  };
  const mostrarSituacao = () => {
    if (conferido) {
      nota('✓ Endereço conferido nos Correios.', 'conferido');
    } else if (rua.value.trim()) {
      nota('Endereço a conferir.', 'conferir');
    } else {
      nota('', '');
    }
  };

  const preencher = (r) => {
    preenchendo = true;
    const por = {logradouro: r.logradouro, bairro: r.bairro, cidade: r.cidade, estado_uf: r.estado_uf,
      cep: formatarCep(r.cep)};
    Object.keys(por).forEach((nome) => {
      const c = campo(nome);
      if (c && por[nome]) {
        c.value = por[nome];
        c.dispatchEvent(new Event('input', {bubbles: true}));
      }
    });
    preenchendo = false;
    conferido = true;
    ultimaBusca = rua.value.trim();
    mostrarSituacao();
  };

  async function buscarRuas() {
    const nome = rua.value.trim();
    const cidade = campo('cidade') ? campo('cidade').value.trim() : '';
    const uf = campo('estado_uf') ? campo('estado_uf').value.trim() : '';
    if (conferido || nome.length < 3 || nome === ultimaBusca) {
      return;
    }
    ultimaBusca = nome;
    if (!navigator.onLine) {
      nota('Sem internet: o endereço fica a conferir.', 'conferir');
      return;
    }
    if (cidade.length < 3 || uf.length !== 2) {
      nota('Escreva a cidade e a UF para conferir a rua nos Correios.', 'conferir');
      return;
    }
    nota('Procurando a rua nos Correios…', 'procurando');
    const lista = await ruas(uf, cidade, nome);
    if (rua.value.trim() !== nome || conferido) {
      return; // mudou enquanto procurava
    }
    if (lista === null) {
      nota('Não deu para consultar os Correios agora: o endereço fica a conferir.', 'conferir');
      return;
    }
    if (!lista.length) {
      nota('Os Correios não acharam esta rua em ' + esc(cidade) + '. Confira o nome; se estiver certo, fica a conferir.',
          'conferir');
      return;
    }
    const opcoesRua = lista.slice(0, 8);
    caixa.innerHTML = `
      <p class="endereco-nota">É uma destas? (grafia dos Correios)</p>
      <div class="endereco-opcoes">${opcoesRua.map((r, i) => `
        <button type="button" class="endereco-opcao" data-opcao="${i}">
          <span class="endereco-opcao-rua">${esc(r.logradouro)}</span>
          <span class="endereco-opcao-mais">${esc([r.bairro, r.faixa, 'CEP ' + formatarCep(r.cep)].filter(Boolean).join(' · '))}</span>
        </button>`).join('')}
        <button type="button" class="endereco-opcao endereco-nenhuma" data-opcao="nenhuma">Nenhuma destas (fica a conferir)</button>
      </div>`;
    caixa.querySelectorAll('[data-opcao]').forEach((b) => b.addEventListener('click', () => {
      vibrar();
      if (b.dataset.opcao === 'nenhuma') {
        conferido = false;
        nota('Endereço a conferir.', 'conferir');
        return;
      }
      preencher(opcoesRua[Number(b.dataset.opcao)]);
    }));
  }

  async function buscarCep() {
    const c = campo('cep');
    const digitos = c ? c.value.replace(/\D/g, '') : '';
    if (digitos.length !== 8 || digitos === ultimoCep || !navigator.onLine) {
      return;
    }
    ultimoCep = digitos;
    nota('Procurando o CEP nos Correios…', 'procurando');
    const r = await porCep(digitos);
    if (c.value.replace(/\D/g, '') !== digitos) {
      return;
    }
    if (r) {
      preencher(r);
    } else {
      ultimoCep = ''; // deixa tentar de novo
      nota('Os Correios não acharam este CEP. Confira os números.', 'conferir');
    }
  }

  // Mexer na rua, no CEP, na cidade ou na UF volta para "a conferir".
  ['logradouro', 'cep', 'cidade', 'estado_uf'].forEach((nome) => {
    const c = campo(nome);
    if (!c) {
      return;
    }
    c.addEventListener('input', () => {
      if (preenchendo) {
        return;
      }
      if (conferido) {
        conferido = false;
        mostrarSituacao();
      }
      if (nome === 'cep' && c.value.replace(/\D/g, '').length === 8) {
        buscarCep(); // não espera sair do campo
      }
      if (nome === 'logradouro') {
        // Ditado ou digitação: procura um instante depois de parar.
        clearTimeout(espera);
        espera = setTimeout(buscarRuas, 1500);
      }
    });
  });
  rua.addEventListener('change', () => {
    clearTimeout(espera);
    buscarRuas();
  });
  // Cidade e UF vêm depois da rua no formulário: preenchidas depois, procura a rua de novo.
  ['cidade', 'estado_uf'].forEach((nome) => {
    const c = campo(nome);
    if (c) {
      c.addEventListener('change', () => {
        ultimaBusca = '';
        buscarRuas();
      });
    }
  });
  const cep = campo('cep');
  if (cep) {
    cep.addEventListener('change', buscarCep);
    const dica = document.createElement('p');
    dica.className = 'detalhe-nota';
    dica.textContent = 'Sabe o CEP? Digite e o app preenche a rua, o bairro e a cidade. Não sabe? Escreva a rua.';
    cep.insertAdjacentElement('afterend', dica);
  }
  mostrarSituacao();
  return {conferido: () => (conferido ? 'SIM' : 'NÃO')};
}
