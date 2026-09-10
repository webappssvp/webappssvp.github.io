# Regras de Codificação e Organização do Workspace

## Registro de Histórico de Chats
* **Chats Gerais e Técnicos (`dev/chats_com_ia/`):** Discussões sobre arquitetura, layout, padrões de desenvolvimento, PWA, regras de negócio gerais e protótipos devem ser salvas na pasta pública `dev/chats_com_ia/` para versionamento no repositório.
* **Segurança e Dados Sensíveis (`dev_local/chats/`):** Qualquer discussão que envolva segurança de dados, autenticação, criptografia, chaves de API, senhas, tokens, PINs, credenciais ou privacidade de dados pessoais de assistidos (LGPD) deve ser mantida estritamente na pasta `dev_local/chats/` (ignorada pelo Git).
* **Regra de Nomenclatura e Modificação:** 
  Se um arquivo de chat na pasta `dev/chats_com_ia/` ou `dev_local/chats/` for modificado, ele deve ser renomeado para incluir a data da última modificação como prefixo no formato `AAMMDD_nome_do_arquivo.md` (onde AA é o ano com 2 dígitos, MM é o mês e DD é o dia). 
  * Exemplo: `nome_do_arquivo.md` ou `260810_nome_do_arquivo.md` vira `260811_nome_do_arquivo.md` se for editado em 11 de Agosto de 2026.
* **Exceção para Protótipos e Testes:** Para quaisquer atividades, protótipos ou refinamentos realizados dentro de qualquer subpasta de `testes/` (ex: `testes/sincronizacao/`), o agente **NÃO** deve criar, registrar ou atualizar arquivos de históricos de chat.


## Otimização de Processamento em Desenvolvimento
* **NÃO use o browser automatizado (subagente) para tirar capturas de tela ou screenshots**.
* Em vez de rodar simulações no navegador de IA, instrua o usuário a abrir a página com o Live Server local dele.
* Sempre detalhe no chat o que o usuário deve testar e analisar manualmente.
* **Escopo de Modificação Restrito:** Durante o desenvolvimento e teste de novas funcionalidades em protótipos, o agente deve alterar e criar exclusivamente os arquivos dentro da subpasta específica de testes em `testes/` com a qual estiver trabalhando ativamente (ex: `testes/sincronizacao/`). A SPA principal (`testes/spa/index.html`), outros arquivos de produção, protótipos de outras subpastas de teste ou arquivos da raiz do projeto devem permanecer intocados, servindo como base estável até autorização explícita de consolidação.


## Organização de Planos de Implementação
* **Planos de Implementação e Arquitetura (`dev_local/implement/`):** Todos os planos de implementação (específicos de features, segurança, fluxos de login, modelagem de dados ou o plano geral de versões do webapp) devem ser salvos na pasta `dev_local/implement/` para mantê-los protegidos de exposição pública no Git.
* **Ajustes Simples, Protótipos e Testes:** Para tarefas triviais, pequenos ajustes de layout, correções de sintaxe, ou para quaisquer arquivos e protótipos de teste dentro de subpastas da pasta `testes/` (como `testes/sincronizacao/`, `testes/internet/` e similares), o agente **NÃO deve criar planos de implementação (`implementation_plan.md`), listas de tarefas (`task.md`) ou walkthroughs (`walkthrough.md`)**. Nesses casos, o agente deve fazer as alterações e propor os snippets diretamente.


## Conformidade com os Padrões Técnicos do Projeto (`dev/padroes/`)
Toda e qualquer criação, refatoração ou manutenção de arquivos do WebApp deve aderir estritamente às diretrizes documentadas na pasta `dev/padroes/`:
* **Identidade Visual e Marca SSVP (`dev/padroes/01_marca_ssvp.md`):** Seguir as cores oficiais (`#0064B6`, `#FF0000`, tons de interface), tipografia institucional (**Garamond** para títulos e **Montserrat** para interface), área de segurança de 1/5 e respeito à integridade do logotipo.
* **Padrão Google JavaScript (`dev/padroes/02_javascript_google.md`):** Uso exclusivo de `const` e `let` (eliminação total de `var`), nomenclatura rigorosa (`camelCase`, `PascalCase`, `UPPER_SNAKE_CASE`), chaves `{}` obrigatórias em qualquer bloco condicional/repetição, tratamento de erros estrito com `new Error(...)`, e anotações JSDoc completas (`@param`, `@return`, `@typedef`) em todas as funções públicas.
* **Padrão Google HTML e CSS (`dev/padroes/03_html_css_google.md`):** Semântica HTML5 estrita, classes em *kebab-case*, centralização de variáveis em `:root`, ausência absoluta de CSS inline e tags de botões `<button type="button">` explícitas.
* **PWA, Resiliência Offline e Performance (`dev/padroes/04_pwa_e_performance.md`):** Cache-First para recursos estáticos do App Shell, Network-First com persistência local de dados, manifest.json completo com ícones *maskable*, monitoramento de status de conexão e métricas Core Web Vitals (LCP < 2.5s, INP < 200ms, CLS < 0.1).
* **Acessibilidade e Ergonomia 60+ (`dev/padroes/05_acessibilidade_ergonomia.md`):** Domínio da unidade `rem` para adaptação automática a fontes grandes, alvos de toque mínimos de `48x48px` (`3rem x 3rem`), contraste de texto WCAG AA (mínimo de 4.5:1), feedback visual/tátil em `:active` e `:focus-visible`, e acionamento voluntário de mídia/áudio.
* **SEO, Metadados e Privacidade (`dev/padroes/06_seo_e_compartilhamento.md`):** Metadados canônicos no `<head>`, tags Open Graph para compartilhamento em cards no WhatsApp, hierarquia única de `<h1>`, dados estruturados Schema.org e diretiva `<meta name="robots" content="noindex, nofollow">` obrigatória em telas com dados sensíveis de famílias (LGPD).


## Compatibilidade Multiplataforma (Android & iOS)
* **Prevenção de Zoom Automático (iPhone):** Todos os campos de formulário (`input`, `textarea`, `select`) devem ter tamanho de fonte mínimo de `16px` (ou `1rem`) em visualizações móveis para evitar que o Safari dê zoom de foco indesejado.
* **Margens de Segurança (Safe Areas):** Elementos fixados nas extremidades da tela (barras inferiores ou superiores) devem usar variáveis CSS `env(safe-area-inset-...)` para não serem cobertos pela barra de navegação virtual ou pelo entalhe (Notch) do iOS.
* **Políticas de Captura/Execução de Mídia:** Funcionalidades de Speech Recognition (Reconhecimento de Voz) ou áudio retorno (Speech Synthesis) devem ser acionadas estritamente de dentro de um evento de clique ou interação física activa do usuário na tela, suportando os prefixos `window.webkitSpeechRecognition`.
* **Padrões de Dimensionamento (Unidades CSS):** Para garantir a acessibilidade de escala móvel para idosos, utilize preferencialmente a unidade `rem` para tamanhos de texto (`font-size`), espaçamentos (`padding`, `margin`) e alturas dinâmicas. Use `px` apenas para elements de precisão física que não devem distorcer (como bordas de até `3px`, divisores e deslocamentos de sombra `box-shadow`). Evite o uso aninhado e complexo de `em`.


## Identificação de Versão nos Protótipos de Teste
* **Versão no Topo:** Em todos os arquivos de testes/protótipos que sofrerem modificações ou forem criados, adicione de forma sutil e discreta a identificação da versão correspondente (como o nome do arquivo ou número da versão) na barra superior ou no topo do layout.
