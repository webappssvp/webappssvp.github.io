// Teste (13/11/2026): o Google acha a mesma rua escrita de duas formas? ("Av. 23 de Maio" × "Avenida Vinte e Três de Maio")
//
// Uso (na raiz do repositório):
//   node testes/voz/geocodificar_formas.mjs
//
// A chave da Geocoding API vem de GOOGLE_GEOCODING_KEY ou do arquivo dev_local/seguranca/geocoding_key.txt
// (pasta fora do git). Só manda nomes de ruas públicas, sem número de casa nem dado de pessoa.
// Cada execução gasta 2 pedidos por par (cota dos CCs de teste: 300 por dia).

import fs from 'node:fs';

const ARQUIVO_CHAVE = new URL('../../dev_local/seguranca/geocoding_key.txt', import.meta.url);
const chave = process.env.GOOGLE_GEOCODING_KEY ||
  (fs.existsSync(ARQUIVO_CHAVE) ? fs.readFileSync(ARQUIVO_CHAVE, 'utf8').trim() : '');
if (!chave) {
  console.error('Falta a chave: crie dev_local/seguranca/geocoding_key.txt com a chave da Geocoding API.');
  process.exit(1);
}

/** [o que testa, forma A, forma B]. A cidade vai junto, como o app faria. */
const PARES = [
  ['data, SP', 'Avenida 23 de Maio, São Paulo, SP', 'Avenida Vinte e Três de Maio, São Paulo, SP'],
  ['data, SP', 'Rua 25 de Março, São Paulo, SP', 'Rua Vinte e Cinco de Março, São Paulo, SP'],
  ['data, SP', 'Rua 15 de Novembro, São Paulo, SP', 'Rua Quinze de Novembro, São Paulo, SP'],
  ['data, SP', 'Rua 7 de Abril, São Paulo, SP', 'Rua Sete de Abril, São Paulo, SP'],
  ['data, SP', 'Avenida 9 de Julho, São Paulo, SP', 'Avenida Nove de Julho, São Paulo, SP'],
  ['data, SP', 'Rua 11 de Junho, São Paulo, SP', 'Rua Onze de Junho, São Paulo, SP'],
  ['dia 1', 'Rua 1º de Março, Rio de Janeiro, RJ', 'Rua Primeiro de Março, Rio de Janeiro, RJ'],
  ['romano', 'Rua XV de Novembro, Curitiba, PR', 'Rua Quinze de Novembro, Curitiba, PR'],
  ['abreviado', 'Av. 23 de Maio, São Paulo, SP', 'Avenida Vinte e Três de Maio, São Paulo, SP'],
  ['com número', 'Avenida 23 de Maio, 1000, São Paulo, SP', 'Avenida Vinte e Três de Maio, 1000, São Paulo, SP'],
  ['rua numerada', 'Rua 2, Cidade Tiradentes, São Paulo, SP', 'Rua Dois, Cidade Tiradentes, São Paulo, SP'],
  ['rua numerada', 'Rua 10, Guaianases, São Paulo, SP', 'Rua Dez, Guaianases, São Paulo, SP'],
  ['rodovia', 'Rodovia BR-116, km 230, São Paulo, SP', 'Rodovia BR cento e dezesseis, km 230, São Paulo, SP'],
];

async function geocodificar(endereco) {
  const url = 'https://maps.googleapis.com/maps/api/geocode/json?language=pt-BR&region=br&address=' +
    encodeURIComponent(endereco) + '&key=' + encodeURIComponent(chave);
  const r = await (await fetch(url)).json();
  if (r.status !== 'OK') {
    return {status: r.status, erro: r.error_message || ''};
  }
  const g = r.results[0];
  return {status: 'OK', endereco: g.formatted_address, lat: g.geometry.location.lat, lon: g.geometry.location.lng,
    tipo: g.geometry.location_type, parcial: Boolean(g.partial_match), resultados: r.results.length,
    rota: (g.address_components.find((c) => c.types.includes('route')) || {}).long_name || '(sem rua)'};
}

/** Distância em metros (haversine). */
function distancia(a, b) {
  const rad = (g) => (g * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
}

const linha = (rotulo, g) => g.status !== 'OK' ? `   ${rotulo}: ${g.status} ${g.erro}` :
  `   ${rotulo}: rua "${g.rota}" | ${g.endereco} | ${g.tipo}${g.parcial ? ' | PARCIAL' : ''}`;

for (const [oQue, a, b] of PARES) {
  const [ga, gb] = [await geocodificar(a), await geocodificar(b)];
  let veredito = '';
  if (ga.status === 'OK' && gb.status === 'OK') {
    const d = distancia(ga, gb);
    veredito = d < 50 ? `mesmo lugar (${d} m)` : `LUGARES DIFERENTES (${d} m)`;
  } else {
    veredito = 'uma das formas não foi achada';
  }
  console.log(`\n[${oQue}] ${veredito}\n   A = ${a}\n${linha('A', ga)}\n   B = ${b}\n${linha('B', gb)}`);
  if (ga.status === 'REQUEST_DENIED' || ga.status === 'OVER_QUERY_LIMIT') {
    break;
  }
}
