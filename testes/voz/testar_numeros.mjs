// Uso: node testes/voz/testar_numeros.mjs
import {converter} from './converter.js';
import {CASOS} from './casos_numeros.js';
let falhas = 0;
for (const [campo, falado, esperado] of CASOS) {
  const obtido = converter(campo, falado);
  const ok = obtido === esperado;
  falhas += ok ? 0 : 1;
  console.log((ok ? 'OK    ' : 'FALHA ') + campo.padEnd(12) + JSON.stringify(falado).padEnd(42) + '→ ' + JSON.stringify(obtido) + (ok ? '' : '  (esperado ' + JSON.stringify(esperado) + ')'));
}
console.log(falhas ? falhas + ' falha(s)' : 'TUDO OK');
process.exit(falhas ? 1 : 0);
