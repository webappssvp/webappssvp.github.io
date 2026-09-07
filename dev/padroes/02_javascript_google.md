# Padrão de Código JavaScript (Google JavaScript Style Guide)

Este documento adapta e sintetiza o **Google JavaScript Style Guide** oficial para o desenvolvimento do WebApp SSVP. Como este projeto adota Vanilla JavaScript (ES6+) sem transpilação pesada (sem Babel/TypeScript), a disciplina de código e as anotações JSDoc são indispensáveis para garantir estabilidade, segurança e legibilidade a longo prazo.

---

## 1. Princípios Fundamentais

1. **Clareza acima de brevidade:** Código legível e previsível é preferível a atalhos sintáticos complexos.
2. **Imutabilidade por padrão:** Sempre declarar valores como imutáveis a menos que sua reatribuição seja estritamente necessária.
3. **Erros Explícitos:** Falhar de forma controlada e previsível com mensagens explicativas para facilitar a depuração.
4. **Sem Poluição Global:** Proibido injetar variáveis e funções soltas no objeto global `window`.

---

## 2. Declaração de Variáveis e Escopo

### Regra do `const` e `let`
* **Proibido o uso de `var`:** O uso da palavra-chave `var` é terminantemente vedado devido ao içamento (*hoisting*) e escopo de função flexível que geram falhas sutis.
* **Prefira `const`:** Se uma variável não precisa ser reatribuída, ela deve ser `const`. Isso se aplica a objetos, arrays e funções referenciadas.
* **Use `let` com parcimônia:** Apenas para contadores de repetição (`for`) ou estados que sofrem reatribuição explícita.

```javascript
// CORRETO (Padrão Google)
const tempoSincronizacaoMs = 5000;
const listaFamilias = ['Família Silva', 'Família Souza'];
let tentativasEnvio = 0;
tentativasEnvio++;

// INCORRETO
var tempo = 5000; // PROIBIDO
let total = 10;   // Incorreto se total nunca for reatribuído; use const
```

---

## 3. Convenções de Nomenclatura (Naming Conventions)

| Tipo de Identificador | Convenção | Exemplos no WebApp SSVP |
| :--- | :--- | :--- |
| **Variáveis e Propriedades** | `camelCase` | `nomeAssistido`, `totalCestasEntregues`, `estaConectado` |
| **Funções e Métodos** | `camelCase` (verbo) | `salvarRelatorio()`, `carregarDadosOffline()`, `calcularIdade()` |
| **Classes e Construtores** | `PascalCase` | `GerenciadorVisitas`, `SincronizadorSheets`, `ClienteStorage` |
| **Constantes Globais/Config** | `UPPER_SNAKE_CASE` | `INTERVALO_PING_MS`, `CHAVE_BANCO_LOCAL`, `URL_APPS_SCRIPT` |
| **Tipos / Typedefs JSDoc** | `PascalCase` | `RegistroVisita`, `FichaFamilia`, `OpcoesSincronizacao` |
| **Arquivos de Código** | `snake_case.js` | `banco_dados.js`, `sincronizacao_service.js` |

* **Valores Booleanos:** Devem iniciar com prefixos que indiquem estado, como `esta...`, `tem...`, `deve...` ou `possui...` (ex: `estaAutenticado`, `possuiPendencias`).

---

## 4. Estruturas de Controle e Formatação

### Chaves Obrigatórias
No padrão Google, blocos de controle **devem sempre usar chaves `{}`**, mesmo quando contiverem apenas uma única linha. O estilo de abertura é K&R (mesma linha).

```javascript
// CORRETO
if (respostaRede.status === 200) {
  atualizarInterfaceSucesso();
} else {
  exibirAvisoFalha();
}

// INCORRETO (Proibido)
if (respostaRede.status === 200) atualizarInterfaceSucesso();
if (respostaRede.status === 200)
  atualizarInterfaceSucesso();
```

### Comparações Estritas
* Utilize sempre igualdade estrita (`===` e `!==`). O uso de `==` ou `!=` é vedado devido à coerção de tipos imprevisível do JavaScript.

---

## 5. Funções e Programação Assíncrona

### Declaração de Funções
* Use **funções declaradas nomeadas** para lógicas estruturais e serviços do app.
* Use **Arrow Functions (`=>`)** prioritariamente para funções de retorno (*callbacks*), mapeamentos de array (`.map()`, `.filter()`) ou quando for necessário preservar o contexto lexical do `this`.

### Padrão Async / Await
Evite encadeamento aninhado de `.then().catch()`. Prefira a sintaxe moderna e limpa de `async/await` encapsulada em blocos `try...catch`:

```javascript
/**
 * Envia o relatório de visita ao backend do Google Sheets.
 * @param {RegistroVisita} visita Objeto contendo os dados da visita.
 * @return {Promise<boolean>} Retorna verdadeiro caso o envio seja bem-sucedido.
 */
async function enviarVisitaParaNuvem(visita) {
  try {
    const resposta = await fetch(URL_APPS_SCRIPT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visita),
    });

    if (!resposta.ok) {
      throw new Error(`Falha HTTP na sincronização: ${resposta.status}`);
    }

    const resultado = await resposta.json();
    return resultado.sucesso === true;
  } catch (erro) {
    console.error('Erro ao sincronizar visita:', erro.message);
    throw erro; // Re-lança ou trata conforme a estratégia de persistência offline
  }
}
```

---

## 6. Tratamento Rigoroso de Erros

* **Sempre instancie `Error`:** Nunca lance tipos primitivos como strings, números ou objetos planos (`throw 'erro'` é proibido pela Google).
* Lançar instâncias reais de `Error` preserva a pilha de chamadas (*stack trace*) e a linha exata onde ocorreu a exceção no navegador.

```javascript
// CORRETO
if (!idConferencia) {
  throw new Error('Identificador da conferência é obrigatório para registrar a visita.');
}

// INCORRETO
if (!idConferencia) {
  throw 'ID inválido'; // NUNCA FAÇA ISSO
}
```

---

## 7. Documentação Estruturada com JSDoc (Padrão Google)

Como não usamos o compilador TypeScript, todo o autocompletar e a verificação estática de tipos no editor (VS Code) dependem da anotação com **JSDoc**. 

A Google estabelece as seguintes diretrizes para o JSDoc:
* Descrever claramente `@param` e `@return`.
* Definir estruturas de dados complexas via `@typedef`.

```javascript
/**
 * @typedef {Object} RegistroVisita
 * @property {string} idVisita Identificador único no formato UUID.
 * @property {string} nomeFamilia Nome da família assistida.
 * @property {string} dataVisita Data no formato ISO (AAAA-MM-DD).
 * @property {number} quantidadeMembros Total de pessoas residentes no lar.
 * @property {boolean} necessidadeEmergencial Flag de atenção urgente.
 */

/**
 * Registra localmente uma visita no IndexedDB.
 * @param {RegistroVisita} dadosVisita
 * @return {Promise<void>}
 * @throws {Error} Se os dados obrigatórios estiverem ausentes.
 */
async function salvarVisitaLocalmente(dadosVisita) {
  if (!dadosVisita.idVisita || !dadosVisita.nomeFamilia) {
    throw new Error('Dados incompletos para gravação local da visita.');
  }
  // Lógica de persistência
}
```

---

## 8. Manipulação Segura do DOM

1. **Checagem Defensiva:** Antes de anexar eventos em elementos da interface, verifique se o elemento realmente existe no DOM atual (evita erros em SPAs durante transições de tela).
2. **Remoção de Listeners Órfãos:** Em telas dinâmicas, assegure que referências não causem vazamento de memória (*memory leaks*).

```javascript
// CORRETO (Defensivo)
const botaoGravarVoz = document.getElementById('btn-gravar-voz');
if (botaoGravarVoz) {
  botaoGravarVoz.addEventListener('click', iniciarReconhecimentoVoz);
}
```

---

## 9. Resumo Rápido para Desenvolvimento Diário

| O Que Fazer | O Que Evitar |
| :--- | :--- |
| `const` para tudo que for fixo | Usar `var` em qualquer circunstância |
| `===` e `!==` para comparações | `==` e `!=` com coerção oculta |
| `try/catch` com `async/await` | `new Promise` aninhado com `.then` longo |
| `throw new Error("msg")` | `throw "msg"` |
| Chaves `{}` em qualquer `if` | `if (x) fazerAlgo();` sem chaves |
| Bloco JSDoc em todas as funções públicas | Funções sem documentação de parâmetros |
