# Registro de Chat - Consolidação da Opção B (Cápsula Dupla), Correção de Viewport para Moto Z 1 e Gaveta de Configurações M3 (Bottom Sheet)

**Data:** 18 de Setembro de 2026  
**Participantes:** Desenvolvedor (Usuário) & Antigravity (AI)

---

## 1. Contexto e Demanda

O usuário realizou testes físicos simultâneos da barra de navegação inferior e dos modos de voz em três smartphones representativos:
1. **iPhone 8:** iOS com tela 16:9 e botão físico Touch ID (sem barra de sistema na tela).
2. **Moto E7:** Android moderno (10+) com navegação padrão por gestos e viewport dinâmico.
3. **Moto Z 1 (2016, Android 7/8):** Tela 16:9 com barra virtual clássica de 3 botões na tela (*Voltar*, *Home*, *Recentes*).

### Problemas Identificados e Sanados no Moto Z 1:
1. **Desaparecimento Completo da Barra Inferior (na raiz index.html):**
   Ao aplicar a estrutura App Shell com `height: 100vh` e `overflow: hidden` no `body`, o navegador Chrome no Moto Z (que não suporta `100svh`/`100dvh`) utilizou o `100vh` estático (que ignora os ~56px da barra de URL superior). Com isso, o `body` extrapolou a tela visível em ~104px, e o `overflow: hidden` cortou o rodapé inteiramente para fora do campo de visão.
   * *Solução aplicada:* Injeção dinâmica da variável `--vh` via `window.innerHeight * 0.01` em `js/app.js` e eliminação do `100vh` estático em `css/app.css`.
2. **Ocultação dos Textos dos Botões pela Barra Virtual:**
   Após a barra reaparecer, os ícones ficaram visíveis mas os textos permaneceram escondidos pela barra preta do sistema de 48px.
   * *Solução aplicada:* Elevação do `padding-bottom` de `.bar-inf` para `3.5rem` (~56px) com fallback explícito em `css/barras.css`.

### Padrão de Trabalho Estabelecido:
O usuário instituiu uma convenção ágil de desenvolvimento:
* A pasta `testes/` funciona como laboratório de validação e tomada de decisão através de protótipos isolados.
* A instrução **"vamos usar [nome do teste]"** configura a autorização direta para consolidar o recurso escolhido na aplicação principal da raiz (`index.html` e seus módulos `css/` e `js/`).
* A escolha vencedora foi a **Opção B: Cápsula Dupla** (`testes/material_design/t6_opcao_b_capsula_dupla.html`), que preserva o botão esquerdo na barra inferior e divide o botão central em `[ 🎙️ Falar ]` e `[ ⌨️ Teclado ]` ao focar em qualquer campo de texto.
* Em seguida, o usuário solicitou integrar as **Configurações do teste t3** (`testes/material_design/t3_navegacao.html`), com o botão localizado na barra inferior operando como **Bottom Sheet** (gaveta que desliza de baixo para cima).

---

## 2. Decisões de Arquitetura e Implementação

### A. Correção Definitiva de Viewport Dinâmico (`--vh`) e Elevação Ergonômica 60+
* **Eliminação do `100vh` estático:** O `height: 100vh` foi substituído por uma cadeia de fallbacks resiliente no `body`:
  `height: 100%; height: calc(var(--vh, 1vh) * 100); height: 100svh; height: 100dvh;`.
* **Injeção de Altura Real (`js/app.js`):** A função `ajustarAlturaRealViewport()` calcula em tempo de execução `window.innerHeight * 0.01` e injeta a variável CSS `--vh`, recalculando em eventos de `resize` e `orientationchange`. O `body` passa a ter exatamente os pixels visíveis disponíveis no Moto Z 1, impedindo que qualquer elemento seja empurrado para fora da tela.
* **Elevação do Padding Inferior:** `padding-bottom: 3.5rem` (~56px) em `css/barras.css`, garantindo que os 48px da barra de sistema do Moto Z 1 cubram apenas o respiro vazio, deixando ícones e textos totalmente visíveis.

### B. Integração da Cápsula Dupla na Raiz
1. **`index.html`:** Inserção do container `#capsulaDupla` ao lado do botão central simples `#btn_voz` dentro do `<footer class="bar-inf">`.
2. **`css/barras.css`:** Estilização de `.capsula-dupla-container` e dos sub-botões `.btn-capsula-falar` e `.btn-capsula-teclado`, com pulsos vicentinos (Azul SSVP, Vermelho SSVP, Gravação e Reprodução).
3. **`js/voz.js`:** Orquestração da alternância entre o botão simples [🔊 Ouvir] e a Cápsula Dupla ao receber foco (`focusin`) em inputs/textareas.

### C. Gaveta Inferior de Configurações M3 (Bottom Sheet)
1. **`js/config.js` (Novo Módulo Modular):**
   * Controle de estado reativo com persistência instantânea no `localStorage` (cache) e no `IndexedDB` (store `config_conferencia` com chave `preferencias_usuario`).
   * Gerenciamento de 6 switches M3:
     - **Modo Escuro / Claro:** Alternância dinâmica de tema (`body.tema-claro`).
     - **Fonte Grande:** Acessibilidade 60+ na raiz (`html.fonte-grande { font-size: 118% !important; }`).
     - **Reduzir Animações:** Otimização para celulares lentos (`body.sem-animacoes`).
     - **Vibração ao Tocar:** Confirmação tátil háptica via Vibration API (`navigator.vibrate(15)`).
     - **Som ao Tocar:** Sintetizador harmônico suave via Web Audio API (onda senoidal D5 de 587Hz por 80ms, 100% offline).
     - **Sincronizar em Wi-Fi:** Preferência de economia de dados móveis (3G/4G).
   * Abertura/fechamento do Bottom Sheet com transição suave e card de status da conferência conectada integrado.
2. **`css/modal.css`:** Estilos do Bottom Sheet M3 (`.scrim-overlay-bottom`, `.bottom-sheet`) e dos switches táteis M3 (`.m3-switch-row`, `.m3-switch-track`, `.m3-switch-thumb`).
3. **`index.html`:** Botão `#btn_config` renomeado para "Config" no rodapé e marcação semântica da gaveta `#scrimBottomSheetConfig`.

---

## 3. Arquivos Criados e Atualizados

1. **`index.html` (Raiz):** Atualizado integralmente com o Bottom Sheet M3 e Cápsula Dupla no footer.
2. **`css/barras.css`:** Atualizado com a elevação de padding inferior (3.5rem) e design system da Cápsula Dupla.
3. **`css/app.css`:** Atualizado com a cadeia de fallback de altura dinâmico (`--vh`) e temas de acessibilidade (`fonte-grande`, `tema-claro`, `sem-animacoes`).
4. **`css/modal.css`:** Atualizado com os estilos completos da Gaveta Inferior M3 e switches táteis.
5. **`js/config.js` (Novo):** Criado com a lógica de preferências, sons, vibração e controle do Bottom Sheet.
6. **`js/app.js`:** Atualizado para inicializar `ajustarAlturaRealViewport()` e `inicializarConfiguracoes()`.
7. **`js/voz.js`:** Atualizado com a orquestração completa STT/TTS e reatividade da Cápsula Dupla.

---

## 4. Validação Sintática
Todos os módulos JavaScript (`js/config.js`, `js/voz.js`, `js/app.js`, `js/visitas_ui.js`, `js/auth.js`, `js/db.js`, `js/api.js`) foram validados via compilador de nós (`node -c`), com 100% de conformidade e zero erros.
