# Registro de Chat - Consolidação do Teste t5 (Central de Ajuda "O que é isso?", Daltonismo WCAG e Viewport Dinâmico Multiplataforma)

**Data:** 18 de Setembro de 2026  
**Participantes:** Desenvolvedor (Usuário) & Antigravity (AI)

---

## 1. Contexto e Demanda

1. **Validação Multiplataforma de Viewport e Barra Inferior:**
   - O usuário identificou que no **Moto E7** (Android 10+ com navegação por gestos), o rodapé com espaçamento de `1rem` ficou perfeito ("ficou bom").
   - No **Moto Z 1** (Android 7/8 com tela 16:9 e barra virtual de 3 botões de 48px), os textos dos botões estavam sendo cobertos pela barra de sistema preta quando o padding era reduzido a `1rem`.
   - Diagnóstico: O Android 7/8 não suporta `env(safe-area-inset-bottom)` e renderiza a janela física sobreposta pela barra de 48px.

2. **Adoção do Teste t5 (`testes/material_design/t5_barras_e_ajuda.html`):**
   - O usuário aprovou a integração com a instrução: *"ok. vamos incluir as funcionalidades que testamos em testes/material_deisign/t5_barras_e_ajuda"*.
   - Módulos a integrar:
     1. **Central de Ajuda Interativa "O que é isso?":** ativação pelo botão `[ ❓ Ajuda ]` no rodapé e pela gaveta de configurações. Exibe um banner superior âmbar, destaca todos os elementos explicáveis da tela (`.ajuda-alvo`) com borda tracejada âmbar, e ao toque abre um modal com linguagem clara e acessível para a terceira idade.
     2. **Simulação de Daltonismo / Acessibilidade Visual (WCAG 1.4.1):** filtros SVG matriciais injetados dinamicamente para Deuteranopia, Protanopia, Tritanopia, Monocromia e Alto Contraste, controlados por seletor M3 na gaveta de configurações com persistência local.
     3. **Compensação Dinâmica de Barra de Sistema no JS (`--espaco-barra-sistema`):** detecção inteligente em tempo de execução para aplicar automaticamente o respiro necessário no Moto Z 1 sem afastar o rodapé no Moto E7 nem no iPhone 8.

---

## 2. Decisões de Arquitetura e Implementação

### A. Compensação Adaptativa de Viewport (`js/app.js` e `css/barras.css`)
* **Medição Exata com `visualViewport`:** No `js/app.js`, `ajustarAlturaRealViewport()` prioriza `window.visualViewport.height` para a variável `--vh`.
* **Detecção de Barra de Sistema Clássica:** Identifica dispositivos Android em formato 16:9 clássico (`ratio <= 1.92` e diferença entre altura física e visível `>= 36px`).
* **Injeção de Variável Dinâmica:**
  - **Moto Z 1:** Injeta `--espaco-barra-sistema: 2.2rem;` e classe `.com-barra-sistema-antiga`.
  - **Moto E7 e iPhone 8:** Mantém `--espaco-barra-sistema: 0px;`.
* **Aplicação no CSS (`css/barras.css`):**
  ```css
  padding-bottom: max(1rem, calc(var(--padding-vertical-barras) + env(safe-area-inset-bottom, 0px) + var(--espaco-barra-sistema, 0px)));
  ```
  Isso garante `1rem` justo e confortável no Moto E7 e iPhone 8, e eleva a barra para ~`3.2rem` no Moto Z 1, mantendo textos e ícones totalmente visíveis acima dos 3 botões virtuais.

### B. Módulo Modular de Ajuda (`js/ajuda.js`)
* Criado módulo desacoplado gerenciando o estado `modoAjudaAtivo`.
* Intercepta eventos de clique em fase de captura (`capture: true`) para que o toque em qualquer componente com a classe `.ajuda-alvo` abra o modal explicativo `#modalAjudaOverlay` com `data-ajuda-titulo` e `data-ajuda-texto`, em vez de disparar a ação normal do botão.
* Fornece feedback sonoro (Web Audio API) e tátil (Vibration API) ao abrir e fechar a ajuda.

### C. Simulação de Daltonismo e Percepção Visual (`js/config.js`)
* Inclusão da chave `simulacaoVisual` no estado e no schema de persistência do `IndexedDB` e `localStorage`.
* Criação da função `aplicarSimulacaoVisual(tipo)` que gerencia classes de filtros SVG no elemento `html` (`simular-deuteranopia`, `simular-protanopia`, `simular-tritanopia`, `simular-monocromia`, `simular-alto-contraste`).
* Adição do seletor M3 dropdown dentro da gaveta de configurações.

### D. Enriquecimento Semântico dos Componentes
* Todos os botões, cards explicativos, cabeçalhos, formulários de visita e campos de anotação de campo receberam os atributos de acessibilidade `ajuda-alvo`, `data-ajuda-titulo` e `data-ajuda-texto`.

---

## 3. Arquivos Criados e Atualizados

1. **`js/ajuda.js` (Novo Módulo):** Orquestração completa do Modo de Ajuda "O que é isso?".
2. **`js/config.js`:** Adição da simulação de daltonismo e vinculação do seletor M3.
3. **`js/app.js`:** Algoritmo de detecção adaptativa de viewport para Moto Z 1 / Moto E7 / iPhone 8 e inicialização do sistema de ajuda.
4. **`css/app.css`:** Estilização dos filtros de daltonismo, banner superior de ajuda, bordas destacadas e modal explicativo M3.
5. **`css/barras.css`:** Ajuste da barra inferior com suporte à variável `--espaco-barra-sistema`.
6. **`css/modal.css`:** Estilos do seletor de daltonismo e cards informativos da gaveta.
7. **`index.html`:** Filtros SVG, banner de ajuda, modal explicativo, marcação `.ajuda-alvo` e seletor na gaveta de configurações.
8. **`js/visitas_ui.js`:** Enriquecimento dos cards dinâmicos de famílias e visitas com suporte nativo ao modo ajuda.

---

## 4. Validação e Qualidade

* Todos os módulos JavaScript foram validados via `node -c`, passando com 0 erros de sintaxe.
* Cumprimento estrito da política de código completo sem omissões.
