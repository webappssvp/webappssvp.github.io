# Registro de Chat - Adoção dos Padrões Google e Marca SSVP

**Data:** 07 de Setembro de 2026  
**Participantes:** Desenvolvedor (Usuário) & Antigravity (AI)

---

## 1. Contexto e Demanda
O usuário expressou o desejo de adotar padrões de desenvolvimento formais para o projeto do WebApp SSVP. O primeiro deles foi o alinhamento com o Manual da Marca da SSVP (do qual já havia um resumo preliminar em `dev_local/`). 

Além disso, solicitou a identificação e incorporação de padrões recomendados pela Google (como o *JavaScript Style Guide* e diretrizes de SEO/Google Search Essentials), determinando a criação dos resumos oficiais na pasta `dev/padroes/`.

Em etapas subsequentes de limpeza e governança do repositório:
1. Reorganizou-se a pasta `img/`, movendo 106 SVGs não utilizados para `dev_local/img/`.
2. Avaliou-se e realizou-se a remoção da pasta `node_modules/` (que continha quase 9.500 arquivos rastreados sem uso no código).

---

## 2. Análise Arquitetural dos Padrões Google Aplicáveis

Como Arquiteto de Software, foram consolidados 6 grandes pilares técnicos com aplicação direta ao WebApp SSVP:

1. **Google JavaScript Style Guide:**
   * Eliminação completa de `var` em favor de `const` e `let`.
   * Nomenclatura uniforme (`camelCase`, `PascalCase`, `UPPER_SNAKE_CASE`).
   * Chaves `{}` obrigatórias em todas as estruturas de repetição e decisão.
   * Tratamento de exceções com `new Error(...)`.
   * Uso de JSDoc (`@param`, `@return`, `@typedef`) para tipagem estática e intellisense no VS Code sem TypeScript compilado.
2. **Google HTML/CSS Style Guide:**
   * Semântica rigorosa (HTML5: `<header>`, `<nav>`, `<main>`, `<button type="button">`).
   * Nomenclatura CSS em kebab-case (`.card-assistido`).
   * Tokens centralizados em variáveis `:root`.
   * Ausência de estilos inline e prevenção de zoom automático em inputs no iOS (font-size >= 16px).
3. **Google PWA Checklist & web.dev:**
   * Resiliência offline e Service Worker com estratégias Cache-First (App Shell) e Network-First com fallback (dados).
   * Manifesto web completo (`manifest.json`) com suporte a ícones maskable.
4. **Google Material Design 3 (Ergonomia e Acessibilidade):**
   * Alvos de toque (touch targets) mínimos de `48x48px` para evitar erros de clique.
   * Feedback tátil imediato (`:active`, `:focus-visible`).
5. **Core Web Vitals & Ergonomia 60+:**
   * Domínio de unidades relativas `rem` para escalonamento automático de fontes de acordo com o sistema operacional do idoso.
   * Unidade `px` reservada estritamente para precisão geométrica (bordas finas e sombras).
6. **Google Search Essentials & SEO / Compartilhamento:**
   * Metadados no `<head>` (`<title>`, `<meta description>`, tags Open Graph/WhatsApp).
   * Estrutura semântica com `<h1>` único e Schema.org JSON-LD (`NonProfitOrganization` e `WebApplication`).
   * **Privacidade e LGPD:** Obrigatoriedade de `<meta name="robots" content="noindex, nofollow">` para todas as telas com dados sensíveis de famílias atendidas.

---

## 3. Deliberação e Aprovação
O usuário aprovou integralmente a proposta estruturada para os documentos da pasta `dev/padroes/`. Em seguida, aprovou a criação da regra de conformidade dentro de `.agents/AGENTS.md`, a separação dos chats públicos (armazenados em `dev/chats_com_ia/`) dos chats confidenciais (armazenados em `dev_local/chats/`), a consolidação do padrão de SEO, a reorganização da pasta de imagens e a remoção definitiva do `node_modules`.

---

## 4. Arquivos Criados na Pasta `dev/padroes/`

1. [`dev/padroes/_LEIAME.md`](../padroes/_LEIAME.md) — Índice geral e princípios norteadores da pasta de padrões.
2. [`dev/padroes/01_marca_ssvp.md`](../padroes/01_marca_ssvp.md) — Diretrizes da marca SSVP Brasil, cores (#0064B6), tipografia (Garamond/Montserrat) e regras de aplicação.
3. [`dev/padroes/02_javascript_google.md`](../padroes/02_javascript_google.md) — Padrão Google JavaScript adaptado para Vanilla ES6+ e JSDoc.
4. [`dev/padroes/03_html_css_google.md`](../padroes/03_html_css_google.md) — Padrão Google HTML/CSS, semântica, kebab-case e compatibilidade móvel.
5. [`dev/padroes/04_pwa_e_performance.md`](../padroes/04_pwa_e_performance.md) — Arquitetura PWA, Service Worker, funcionamento offline e Core Web Vitals.
6. [`dev/padroes/05_acessibilidade_ergonomia.md`](../padroes/05_acessibilidade_ergonomia.md) — Diretrizes de acessibilidade para voluntários 60+, unidades `rem`, touch targets de 48px e WCAG.
7. [`dev/padroes/06_seo_e_compartilhamento.md`](../padroes/06_seo_e_compartilhamento.md) — Otimização para busca Google, cards de compartilhamento social (WhatsApp) e bloqueio de dados sensíveis (LGPD).

---

## 5. Atualização da Governança do Agente

O arquivo oficial de regras [`.agents/AGENTS.md`](../../.agents/AGENTS.md) foi atualizado para:
1. Conter a seção **"Conformidade com os Padrões Técnicos do Projeto (`dev/padroes/`)"**, tornando mandatória a observância de todos os 6 documentos em qualquer ciclo de desenvolvimento.
2. Formalizar a separação de históricos de conversas: chats técnicos e de arquitetura em `dev/chats_com_ia/` (públicos) e chats com informações confidenciais em `dev_local/chats/` (privados).

---

## 6. Otimização e Limpeza da Pasta de Imagens (`img/`)

Foi realizada uma análise estática em todo o projeto mapeando as referências dos 117 arquivos da pasta `img/`:
* **Arquivos Ativos (11):** Mantidos na pasta pública `img/` (`chevron_left.svg`, `description.svg`, `groups.svg`, `home.svg`, `home_app_logo.svg`, `location_on.svg`, `marca_ssvp.svg`, `menu.svg`, `mic.svg`, `person.svg`, `target.svg`).
* **Arquivos Não Utilizados (106):** Movidos com sucesso para a pasta local reservada `dev_local/img/`, reduzindo o peso do repositório público e eliminando poluição visual.

---

## 7. Eliminação do `node_modules` e Ajuste do `.gitignore`

Após confirmação de que o pacote `firebase` (única dependência) não era utilizado em nenhum ponto da aplicação Vanilla JS:
1. O arquivo [`.gitignore`](../../.gitignore) foi atualizado para ignorar `node_modules/` e `package-lock.json`.
2. A pasta `node_modules` (com 9.479 arquivos rastreados) foi totalmente removida do Git e do disco local.
3. Os arquivos `package.json` e `package-lock.json` foram eliminados, aliviando o repositório e acelerando a sincronização com o GitHub.
