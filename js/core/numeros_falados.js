/**
 * @fileoverview Números falados → algarismos, para o ditado dos campos de endereço (testes t2 e t3, 13 e 15/11/2026).
 * Usado pelo ditado do app (js/core/voz.js) e pelos testes de testes/voz/.
 *
 * "cento e um" → "101"; "ap trinta e dois" → "ap 32"; "um zero um" → "101" (dígito a dígito);
 * "dois mil e quinhentos" → "2500"; "bloco b ap 12" fica igual (o reconhecedor às vezes já manda algarismos).
 *
 * Ruas: o app grava a grafia oficial dos Correios, por extenso ("av 23 de maio" → "Avenida Vinte e Três de Maio";
 * decisão de 15/11/2026); o modo "algarismos" fica para buscas e testes.
 * rua só com número ("Rua Dois") fica como o reconhecedor mandou: "Rua 2" e "Rua Dois" podem ser ruas diferentes.
 *
 * Sem dependências: roda no navegador e no Node (node testes/voz/testar_numeros.mjs).
 */

/** Valor de cada palavra. Masculino e feminino ("duas casas", "duzentas"). */
const UNIDADES = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, meia: 6, sete: 7, oito: 8, nove: 9,
};
const DE_10_A_19 = {
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezasseis: 16,
  dezessete: 17, dezassete: 17, dezoito: 18, dezenove: 19, dezanove: 19,
};
const DEZENAS = {vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90};
const CENTENAS = {
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400,
  quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700,
  setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
};
const VALORES = {...UNIDADES, ...DE_10_A_19, ...DEZENAS, ...CENTENAS};

/** Sem acento e em minúsculas, para comparar ("três" = "tres"). */
const chave = (palavra) => palavra.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * @param {string} palavra
 * @return {?{valor: number, tipo: string}} tipo: unidade, dezena (10 a 90), centena, mil ou algarismo.
 */
function lerPalavra(palavra) {
  const k = chave(palavra);
  if (/^\d+$/.test(k)) {
    return {valor: Number(k), tipo: 'algarismo', texto: k};
  }
  if (k === 'mil') {
    return {valor: 1000, tipo: 'mil'};
  }
  if (k in VALORES) {
    const v = VALORES[k];
    return {valor: v, tipo: v < 10 ? 'unidade' : v < 100 ? 'dezena' : 'centena'};
  }
  return null;
}

/**
 * Um trecho de números seguidos (já sem as palavras de fora) → algarismos.
 * @param {!Array<{valor: number, tipo: string, texto: (string|undefined)}>} itens
 * @param {boolean} comE Se havia "e" entre eles ("trinta e dois"), é soma; sem "e" e só dígitos, é dígito a dígito.
 * @return {string}
 */
function juntar(itens, comE) {
  const soDigitos = itens.every((i) => i.tipo === 'unidade' || (i.tipo === 'algarismo' && !comE));
  if (itens.length > 1 && !comE && soDigitos) {
    // "um zero um" → 101; "3 2" → 32
    return itens.map((i) => (i.tipo === 'algarismo' ? i.texto : String(i.valor))).join('');
  }
  let total = 0;
  let grupo = 0;
  for (const i of itens) {
    if (i.tipo === 'mil') {
      total += (grupo || 1) * 1000;
      grupo = 0;
    } else {
      grupo += i.valor;
    }
  }
  return String(total + grupo);
}

/**
 * Cabe somar o próximo ao trecho? Só se for de ordem menor que o último ("trinta" + "dois" sim; "dois" + "trinta" não),
 * ou "mil" depois de algo menor que mil.
 * @param {!Array<!Object>} trecho
 * @param {!Object} proximo
 * @return {boolean}
 */
function cabeNaSoma(trecho, proximo) {
  const ultimo = trecho[trecho.length - 1];
  if (proximo.tipo === 'mil') {
    return !trecho.some((i) => i.tipo === 'mil');
  }
  if (ultimo.tipo === 'mil') {
    return true;
  }
  const ordem = (v) => (v >= 100 ? 3 : v >= 10 ? 2 : 1);
  // "dezena" de 10 a 19 não aceita unidade depois ("doze três" não é 15).
  if (ultimo.valor >= 10 && ultimo.valor < 20) {
    return false;
  }
  return ordem(proximo.valor) < ordem(ultimo.valor) && proximo.valor < (ultimo.valor >= 100 ? 100 : 10);
}

/**
 * Troca os números por extenso do texto por algarismos. O resto do texto fica igual.
 * @param {string} texto
 * @return {string}
 */
export function numerosEmAlgarismos(texto) {
  const palavras = String(texto).trim().split(/\s+/).filter(Boolean);
  const saida = [];
  let trecho = [];
  let comE = false;
  let eSolto = false; // "e" que ainda não sabemos se liga dois números
  const fechar = () => {
    if (trecho.length) {
      saida.push(juntar(trecho, comE));
    }
    if (eSolto) {
      saida.push('e');
    }
    trecho = [];
    comE = false;
    eSolto = false;
  };
  for (const palavra of palavras) {
    const item = lerPalavra(palavra);
    if (!item) {
      if (chave(palavra) === 'e' && trecho.length && !eSolto) {
        eSolto = true;
        continue;
      }
      fechar();
      saida.push(palavra);
      continue;
    }
    if (!trecho.length) {
      trecho.push(item);
      continue;
    }
    const digitoADigito = !comE && !eSolto && item.tipo === 'unidade' &&
        trecho.every((i) => i.tipo === 'unidade');
    if (eSolto ? cabeNaSoma(trecho, item) : (digitoADigito || cabeNaSoma(trecho, item))) {
      comE = comE || eSolto;
      eSolto = false;
      trecho.push(item);
    } else {
      fechar();
      trecho.push(item);
    }
  }
  fechar();
  return saida.join(' ');
}

/**
 * Campo "Número" do endereço: só o número ("número cento e um" → "101"); "sem número" → "S/N".
 * @param {string} texto
 * @return {string}
 */
export function paraNumeroDoEndereco(texto) {
  const t = chave(String(texto)).trim();
  if (/^(sem numero|s\/?n|esse ene)$/.test(t)) {
    return 'S/N';
  }
  const convertido = numerosEmAlgarismos(String(texto).replace(/^\s*(n[uú]mero|n[º°o]\.?)\s+/i, ''));
  // Sobrou só um número: devolve só ele (sem ponto ou "e" que o reconhecedor tenha posto).
  // "101 a" → "101A" (casa com letra).
  const soNumero = convertido.replace(/[.,;!?]+$/, '').trim().replace(/^(\d+)\s+([a-z])$/i, '$1$2');
  return /^\d+[a-z]?$/i.test(soNumero) ? soNumero.toUpperCase() : convertido;
}

// ---------------------------------------------------------------------------
// Logradouro: datas no nome da rua ("23 de Maio", "Quinze de Novembro") e tipo da via (13/11/2026)
// ---------------------------------------------------------------------------

const MESES = 'janeiro|fevereiro|marco|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';

/** Tipo da via abreviado → por extenso (só a 1ª palavra do logradouro). */
const TIPOS_DE_VIA = {
  'r': 'Rua', 'av': 'Avenida', 'avda': 'Avenida', 'al': 'Alameda', 'pc': 'Praça', 'pca': 'Praça', 'pç': 'Praça',
  'pça': 'Praça', 'praca': 'Praça', 'trav': 'Travessa', 'tv': 'Travessa', 'estr': 'Estrada', 'est': 'Estrada',
  'rod': 'Rodovia', 'lgo': 'Largo', 'lg': 'Largo', 'vl': 'Vila', 'vla': 'Viela', 'pq': 'Parque', 'jd': 'Jardim',
  'cj': 'Conjunto', 'q': 'Quadra', 'qd': 'Quadra',
};

/** Palavras que ficam em minúsculas no meio do nome ("Rua Quinze de Novembro"). */
const MINUSCULAS = ['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'na', 'no'];

/** 1 a 999 por extenso (para os dias: 1 → "primeiro", como em "Rua Primeiro de Março"). */
function porExtenso(n) {
  const u = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const d10 = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const d = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const c = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos',
    'novecentos'];
  if (n === 100) {
    return 'cem';
  }
  const partes = [];
  if (n >= 100) {
    partes.push(c[Math.floor(n / 100)]);
  }
  const resto = n % 100;
  if (resto >= 10 && resto < 20) {
    partes.push(d10[resto - 10]);
  } else {
    if (resto >= 20) {
      partes.push(d[Math.floor(resto / 10)]);
    }
    if (resto % 10) {
      partes.push(u[resto % 10]);
    }
  }
  return partes.join(' e ');
}

/** "XV" → 15 (até 39, o que basta para os dias). */
function romano(texto) {
  const t = texto.toUpperCase();
  if (!/^X{0,3}(IX|IV|V?I{0,3})$/.test(t) || !t) {
    return null;
  }
  const v = {I: 1, V: 5, X: 10};
  let total = 0;
  for (let i = 0; i < t.length; i++) {
    const atual = v[t[i]];
    const proximo = v[t[i + 1]] || 0;
    total += atual < proximo ? -atual : atual;
  }
  return total;
}

/** "rua quinze de novembro" → "Rua Quinze de Novembro"; siglas (BR, SP, XV) ficam como vieram. */
function capitalizar(texto) {
  return texto.split(' ').map((p, i) => {
    if (/\d/.test(p) || (p.length > 1 && p === p.toUpperCase() && /[A-Z]/.test(p))) {
      return p;
    }
    const minuscula = p.toLowerCase();
    return i > 0 && MINUSCULAS.includes(minuscula) ? minuscula : minuscula.charAt(0).toUpperCase() + minuscula.slice(1);
  }).join(' ');
}

/**
 * Campo "Logradouro".
 * - Tipo da via abreviado vira por extenso: "av. 23 de maio" → "Avenida ...".
 * - Datas ("23 de maio", "vinte e três de maio", "XV de novembro", "1º de março"): conforme `datas`:
 *   'extenso' → "Vinte e Três de Maio", "Primeiro de Março" (como na base de CEP dos Correios);
 *   'algarismos' → "23 de Maio", "1º de Março".
 * - Os outros números ficam como foram ditos: "Rua Dois Irmãos", "Rua Sete Quedas", "Rua 2", "Rodovia BR 116".
 * @param {string} texto
 * @param {{datas: string}=} opcoes
 * @return {string}
 */
export function paraLogradouro(texto, opcoes = {datas: 'extenso'}) {
  let t = String(texto).trim().replace(/\s+/g, ' ').replace(/[.]+$/, '');
  // Tipo da via: "av." / "av" / "R." no começo.
  t = t.replace(/^([a-zçã]+)\.?(?=\s)/i, (inteiro, p) => TIPOS_DE_VIA[chave(p)] || TIPOS_DE_VIA[p.toLowerCase()] || inteiro);
  const palavras = capitalizar(t).split(' ');
  const ehMes = (p) => p !== undefined && new RegExp('^(' + MESES + ')$', 'i').test(p);
  for (let i = 1; i < palavras.length - 1; i++) {
    if (palavras[i].toLowerCase() !== 'de' || !ehMes(palavras[i + 1])) {
      continue;
    }
    // Volta a partir do "de" enquanto houver palavras do dia: "vinte e três", "23", "XV", "primeiro", "1º".
    let j = i;
    while (j > 0) {
      const p = palavras[j - 1];
      const k = chave(p);
      const ehNumero = lerPalavra(p) || /^(primeiro|1[ºo°])$/.test(k) || romano(p) ||
          (k === 'e' && j - 1 > 0 && lerPalavra(palavras[j - 2]));
      if (!ehNumero) {
        break;
      }
      j--;
    }
    if (j === i) {
      continue;
    }
    const trecho = palavras.slice(j, i);
    const so = trecho.length === 1 ? chave(trecho[0]) : '';
    const dia = /^(primeiro|1[ºo°])$/.test(so) ? 1 :
      trecho.length === 1 && romano(trecho[0]) && trecho[0] === trecho[0].toUpperCase() ? romano(trecho[0]) :
        Number(numerosEmAlgarismos(trecho.join(' ').toLowerCase()));
    if (!(dia >= 1 && dia <= 31)) {
      continue;
    }
    const mes = palavras[i + 1].toLowerCase();
    palavras[i + 1] = mes === 'marco' ? 'Março' : mes.charAt(0).toUpperCase() + mes.slice(1);
    const novo = opcoes.datas === 'algarismos' ? (dia === 1 ? '1º' : String(dia)) :
      capitalizar(dia === 1 ? 'primeiro' : porExtenso(dia));
    palavras.splice(j, i - j, ...novo.split(' '));
    i = j + novo.split(' ').length; // continua depois do "de"
  }
  return palavras.join(' ');
}

/**
 * Campo "Complemento": números em algarismos e "apartamento"/"apê"/"apto" como "ap" ("apartamento trinta e dois" → "ap 32").
 * @param {string} texto
 * @return {string}
 */
export function paraComplemento(texto) {
  return numerosEmAlgarismos(texto)
      .replace(/\b(apartamento|apto\.?|ap[eê]|ap\.)(?=\s|$)/gi, 'ap')
      .replace(/[.]+$/, '');
}
