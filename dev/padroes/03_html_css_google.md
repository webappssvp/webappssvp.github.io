# Padrão de HTML e CSS (Google HTML/CSS Style Guide)

Este documento estabelece as diretrizes de desenvolvimento para a marcação (HTML5) e estilização (CSS3) do WebApp SSVP, baseando-se no **Google HTML/CSS Style Guide** oficial com extensões voltadas à experiência móvel e acessibilidade.

---

## 1. Princípios Gerais

1. **Separação Rígida de Camadas:** Estrutura em HTML, apresentação visual em CSS e interatividade em JavaScript.
2. **Semântica Racional:** O elemento HTML deve expressar o propósito daquele conteúdo, não sua aparência visual.
3. **Prevenção de Estilos Inline:** Proibido utilizar atributos `style="..."` em elementos do HTML de produção.
4. **Performance e Leveza:** CSS puro, modular e organizado via variáveis nativas (`CSS Custom Properties`), dispensando frameworks externos que aumentam o tempo de carregamento.

---

## 2. Padrões Oficiais de HTML5

### Estrutura Base e Declarações
* Todo arquivo HTML deve declarar o doctype HTML5: `<!DOCTYPE html>`.
* A tag raiz deve declarar o idioma oficial do projeto: `<html lang="pt-BR">`.
* O conjunto de caracteres deve ser UTF-8 no início do `<head>`: `<meta charset="UTF-8">`.
* Metatag de viewport otimizada para aparelhos modernos (com suporte a *notch* e bordas arredondadas):
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  ```

### Semântica de Elementos e Acessibilidade
* Utilize elementos estruturais semânticos:
  * `<header>`: Para a barra superior e cabeçalhos de seções.
  * `<nav>`: Para áreas de navegação e menus.
  * `<main>`: Para o conteúdo central da tela ativa (único por visualização).
  * `<section>` ou `<article>`: Para blocos temáticos e cards de famílias/visitas.
  * `<footer>`: Para barras inferiores e rodapés.
* **Elementos Interativos:**
  * Use `<button>` para ações que executam scripts na página. Todo `<button>` deve explicitar seu tipo: `<button type="button">` (ou `type="submit"` em formulários).
  * Use `<a>` (âncora) apenas para navegação entre rotas, links externos ou downloads.
  * **Proibido** criar elementos clicáveis em `<div>` ou `<span>` sem semântica e sem foco de teclado.

### Nomenclatura e Formatação HTML
* Todas as tags e nomes de atributos devem ser escritos estritamente em **letras minúsculas** (ex: `<div class="menu">`, nunca `<DIV CLASS="Menu">`).
* **Atributos Booleanos Concisos:** Omita o valor em atributos booleanos nativos:
  ```html
  <!-- CORRETO (Padrão Google) -->
  <input type="text" id="campo-nome" required disabled>

  <!-- INCORRETO -->
  <input type="text" id="campo-nome" required="required" disabled="true">
  ```
* **Acessibilidade em Imagens:** Toda tag `<img>` deve possuir o atributo `alt`. Se a imagem for puramente decorativa, use `alt=""` para não confundir leitores de tela.
* **Formulários Acessíveis:** Todo `<input>` deve ter um `<label>` correspondente com atributo `for` apontando para o `id` do campo.

---

## 3. Padrões Oficiais de CSS

### Nomenclatura de Seletores (Kebab-Case)
* No padrão Google, os nomes de classes CSS devem ser descritivos, curtos e utilizar apenas letras minúsculas separadas por hífen (**kebab-case**).
* **Evite seletores de ID para estilização:** IDs devem ser reservados para identificação de formulários e manipulação via JS. O estilo deve ser acoplado apenas a classes.

```css
/* CORRETO (Padrão Google) */
.card-assistido { ... }
.btn-salvar-visita { ... }
.barra-navegacao { ... }

/* INCORRETO */
.cardAssistido { ... } /* camelCase proibido em CSS */
.card_assistido { ... } /* snake_case proibido em CSS */
#meuCard { ... }        /* Evite estilizar por ID */
```

### Arquitetura de Variáveis CSS (`:root`)
Todas as cores, raios e transições devem residir em variáveis centralizadas no topo do arquivo CSS, facilitando manutenção e suporte a temas:

```css
:root {
  /* Paleta SSVP */
  --cor-ssvp-azul: #0064b6;
  --cor-ssvp-vermelho: #ff0000;
  --cor-ssvp-branco: #ffffff;
  --cor-ssvp-preto: #000000;

  /* Tema Escuro do WebApp */
  --cor-fundo: #0b0f19;
  --cor-barras: #002d62;
  --cor-card-bg: #1e293b;
  --cor-texto: #ffffff;
  --cor-subtexto: #94a3b8;
  --cor-audio: #007fff;

  /* Tokens Estruturais */
  --tempo-transicao: 0.3s;
  --raio-cantos: 1rem;
}
```

### Reset Universal e Box-Sizing
Todo arquivo de estilo deve iniciar com o box-sizing padronizado e a remoção de margens parasitas:

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}
```

---

## 4. Requisitos Específicos Multiplataforma (iOS / Android)

Para garantir compatibilidade universal entre smartphones de diferentes fabricantes, as seguintes regras são obrigatórias:

### 1. Prevenção de Zoom Automático no iPhone (iOS Safari)
O navegador Safari para iOS executa um zoom forçado em qualquer campo de formulário cujo tamanho de fonte seja inferior a `16px`.
* **Regra:** Todo `input`, `textarea` e `select` deve possuir `font-size: 1rem;` (16px) ou superior:
  ```css
  input, textarea, select {
    font-size: 1rem; /* 16px base, previne zoom indesejado */
  }
  ```

### 2. Margens de Segurança (Safe Areas)
Aparelhos modernos possuem o recorte de câmera (*notch*) no topo e a barra de gestos virtuais no rodapé.
* Elementos fixos no topo ou na base da tela devem obrigatoriamente respeitar as variáveis de ambiente:
  ```css
  .bar-sup {
    padding-top: max(1rem, env(safe-area-inset-top));
  }

  .bar-inf {
    padding-bottom: max(1rem, env(safe-area-inset-bottom));
  }
  ```

### 3. Eliminação do Destaque Cinza de Toque
Para dar sensação tátil de app nativo e evitar o flash retangular cinza ao tocar na tela em navegadores móveis:
```css
-webkit-tap-highlight-color: transparent;
```

---

## 5. Ordem e Organização dos Arquivos CSS

Organize os blocos de código CSS sempre na seguinte ordem lógica:
1. **Definição de Variáveis:** `:root { ... }`
2. **Reset e Configurações Globais:** `*`, `html`, `body`
3. **Tipografia Base:** `h1`, `h2`, `p`, links
4. **Layout Macro:** Barra superior (`.bar-sup`), contêiner principal, barra inferior (`.bar-inf`)
5. **Componentes:** Cards, botões, modais, campos de formulário
6. **Utilitários e Acessibilidade:** Classes de visibilidade, estados de foco (`:focus-visible`)
