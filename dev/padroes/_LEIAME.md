# Padrões Técnicos e Diretrizes de Engenharia - WebApp SSVP

Esta pasta centraliza os manuais, normas técnicas e padrões de código adotados oficialmente para o desenvolvimento do **WebApp SSVP**. 

A arquitetura combina as diretrizes de identidade visual da Sociedade de São Vicente de Paulo (SSVP) com os padrões de engenharia de software da Google e boas práticas internacionais de acessibilidade para a terceira idade (60+).

---

## Índice dos Padrões Oficiais

| Código | Documento | Foco Principal | Referência Base |
| :---: | :--- | :--- | :--- |
| **01** | [**01_marca_ssvp.md**](01_marca_ssvp.md) | Identidade visual, paleta de cores (#0064B6), tipografia (Garamond/Montserrat), área de segurança e regras de uso do logotipo | *Manual da Marca SSVP Brasil* |
| **02** | [**02_javascript_google.md**](02_javascript_google.md) | Padrão de código JavaScript (Vanilla ES6+), eliminação do `var`, nomenclatura, `async/await`, erros com `Error` e tipagem via JSDoc | *Google JavaScript Style Guide* |
| **03** | [**03_html_css_google.md**](03_html_css_google.md) | Semântica HTML5, nomenclatura de classes CSS em kebab-case, design tokens em `:root`, ausência de inline styles e prevenção de auto-zoom no iOS | *Google HTML/CSS Style Guide* |
| **04** | [**04_pwa_e_performance.md**](04_pwa_e_performance.md) | Arquitetura PWA, manifesto, estratégias de Service Worker (Cache-First e Network-First), operação offline e métricas Core Web Vitals | *Google Web Fundamentals / web.dev* |
| **05** | [**05_acessibilidade_ergonomia.md**](05_acessibilidade_ergonomia.md) | Usabilidade e ergonomia para voluntários 60+, domínio de unidades `rem`, touch targets de 48px, contraste WCAG AA e feedback tátil | *Google Material 3 / Lighthouse a11y* |
| **06** | [**06_seo_e_compartilhamento.md**](06_seo_e_compartilhamento.md) | Metadados de busca, cards do WhatsApp/Open Graph, hierarquia de títulos, dados estruturados Schema.org e bloqueio de dados sensíveis (LGPD) | *Google Search Essentials* |

---

## Princípio Norteador

> *"Toda linha de código, componente visual ou decisão de arquitetura deve priorizar a simplicidade, a rapidez de execução e a facilidade de uso para os vicentinos em campo."*
