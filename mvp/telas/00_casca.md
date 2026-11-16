# Tela: Casca do app

**Hash:** todas · **Arquivos na raiz:** `index.html`, `js/app.js`, `css/layout.css`, `manifest.json`, `sw.js`
**Versão do app:** 1.0 · **Status:** **Na raiz** desde 10/11/2026 (v0.1). Veio de [`testes/app/t3_casca.html`](../../testes/app/t3_casca.html), cópia ajustada da `testes/material_design/t5_barras_e_ajuda.html`

| Arquivo | O quê |
| :--- | :--- |
| `index.html` | Barras, menu ⋮, gavetas, ajuda, área `#areaConteudo` |
| `css/base.css` | Cores, temas, fonte grande, reduzir animações, daltonismo |
| `css/casca.css` | Barras, menu, gavetas, ajuda, avisos |
| `css/telas.css` | Área de conteúdo, cartões, formulários, painel de conexão |
| `js/app.js` | Início e roteador (`#pessoas`, `#familias`, `#importar`) |
| `js/casca.js` | Menu ⋮, gavetas, configurações, "O que é isso?", Sair |
| `js/core/preferencias.js` | Preferências (IndexedDB) e vibração/som |
| `js/core/voz.js` | Botão Falar/Ouvir |
| `sw.js`, `manifest.json` | App instalável e offline |

---

## Objetivo
Moldura comum a todas as telas: barra superior com a conferência, área de conteúdo, barra inferior com voz e navegação, instalação como app e funcionamento offline.

## O que mostra e o que faz
- **Barra superior:** semáforo de conexão no centro (conferência e pessoa logada). Tocar nele abre o painel de conexão ([`01_conexao.md`](01_conexao.md)).
- **Área de conteúdo:** `<main id="areaConteudo">`, preenchida pelo roteador conforme o `#hash`.
- **Barra inferior fixa:** botão central de voz (56×56 px) e atalhos para as telas.
- **Configurações (gaveta inferior):** preferências do aparelho e ações gerais, como "Ver dados de exemplo" e sair.
- **Aviso de nova versão:** o service worker avisa quando o site foi atualizado.

## Offline
A casca (HTML, CSS, JS e `siglas/`) fica no cache do service worker e abre sem internet.

## Decisões
| Data | Decisão | Origem |
| :--- | :--- | :--- |
| 29/10/2026 | Single page app em JavaScript puro, sem build; navegação por `#hash` | `frontend_offline_voz.md` §1 |
| 29/10/2026 | PWA offline primeiro: `manifest.json` + `sw.js` com cache da casca e aviso de nova versão | `frontend_offline_voz.md` §6 |
| 18/09/2026 | **Cápsula dupla** (opção B, `testes/material_design/t6_opcao_b_capsula_dupla.html`): o botão central é [🔊 Ouvir]; ao focar um campo de texto, vira [🎙️ Falar] + [⌨️ Teclado]. O botão esquerdo da barra inferior fica | chat `260918_adocao_capsula_dupla…` |
| 18/09/2026 | **Altura da tela:** nada de `100vh` fixo. `body` com `height: calc(var(--vh, 1vh) * 100)`, depois `100svh` e `100dvh`; `--vh` calculado por `window.innerHeight` em `resize` e `orientationchange` (corrige o Moto Z 1). `padding-bottom: 3.5rem` na barra inferior, para a barra virtual do Android não cobrir os textos | chat `260918_adocao_capsula_dupla…` |
| 18/09/2026 | ~~Configurações em gaveta inferior (botão "Config" na barra inferior)~~ **Substituída em 25/09/2026** pela gaveta superior do ⋮ (t5). Fica: preferências no IndexedDB (`config_conferencia`, chave `preferencias_usuario`) | chat `260918_adocao_capsula_dupla…` |
| 29/10/2026 | **Botão de voz:** transcreve em `pt-BR` (Web Speech API) para o campo em foco; sem campo em foco, vai para o campo principal da tela. Repouso: microfone azul SSVP `#0064B6`; ouvindo: vermelho pulsante com "Ouvindo… pode falar" | `frontend_offline_voz.md` §2.1 |
| 29/10/2026 | Leitura em voz alta (`SpeechSynthesis`) só dispara por toque do usuário (exigência do Safari no iOS) | `frontend_offline_voz.md` §2.2 |
| 29/10/2026 | Ergonomia 60+: toque mínimo 48×48 px, `rem`, alto contraste, mensagens simples | `frontend_offline_voz.md` §1 |
| 30/10/2026 | **Dados de exemplo:** pessoas e famílias fictícias aparecem com a marca **EXEMPLO**; somem sozinhas na primeira família real. O interruptor "Ver dados de exemplo" (menu) vale só no próprio celular. "Atualizar" e "Apagar dados de exemplo" são do presidente (`DEMO_ATUALIZAR`, `DEMO_APAGAR`); apagar pede que se digite `APAGAR` | `dados_ficticios.md` §3 e §4 |
| 29/10/2026 | Mensagem padrão de erro de envio: "Seus dados estão salvos no celular e serão enviados depois." | `frontend_offline_voz.md` §3.1 |
| 25/09/2026 | Barra superior: logo SSVP, conferência e CP, botão ⋮. O ⋮ abre Sincronização, Configurações e Ajuda numa gaveta que desce do topo, com abas. Barra inferior: Menu (gaveta de telas), Falar/Ouvir (segurar 0,6 s troca o modo) e Sair. Modo de ajuda "O que é isso?" | `testes/material_design/t5_barras_e_ajuda.html` |
| 10/11/2026 | **A casca parte da t5**, ajustada em `testes/app/t3_casca.html` | conversa |
| 10/11/2026 | **Configurações:** fonte grande, modo canhoto, tema claro/escuro, simulação de daltonismo, **reduzir animações, vibração ao tocar (padrão ligado), som ao tocar (padrão desligado) e sincronizar só em Wi-Fi (padrão desligado)**. Sai a opção "Formato dos botões" (ícone com ou sem texto): os botões sempre têm ícone e texto | conversa |
| 10/11/2026 | **Botões das barras retangulares** (cantos de 6 px), com fundo um tom mais claro que a barra (escuro: barra `#1b263d`, botão `#273655`; claro: barra `#f1f5f9`, botão branco). Na barra inferior, os três repartem a largura (o central um pouco maior), com 3,5 rem de altura e **2 rem (32 px) de espaço entre eles** contra toques acidentais (era 16 px; dobrado no mesmo dia) | conversa |
| 10/11/2026 | **Modo canhoto inverte as duas barras:** embaixo, Sair à esquerda e Menu à direita; em cima, o ⋮ vai para a esquerda e o símbolo da SSVP para a direita (o menu do ⋮ abre do lado esquerdo) | conversa |
| 10/11/2026 | **A casca da raiz sai da `t3_casca`** ("vamos usar t3_casca"). O protótipo antigo da raiz foi para `testes/legado_raiz/`. O conteúdo de exemplo da t5 (formulário de visita e metas) não entrou: volta nas versões 1.1 e 1.2 | conversa |
| 10/11/2026 | O nome da conferência na barra superior abre o painel de conexão (escolha + login, de `t0_conexao`); o botão Sair sai da conferência neste celular | implementação |
| 10/11/2026 | Gaveta superior: as três abas repartem a largura em retângulos (ícone em cima, nome embaixo). Saiu o ✕ do topo, que não deixava caber "Configurações": fecha pelo botão **Fechar** embaixo ou tocando fora | implementação, a confirmar |
| 10/11/2026 | Botão Teclado de cada campo (da t5) fica para as telas com formulário; a casca só dita no último campo tocado | implementação |
| 10/11/2026 | **Service worker no padrão** (`dev/padroes/04_pwa_e_performance.md`): a casca (lista `ARQUIVOS` do `sw.js`) abre do celular primeiro; os demais arquivos do site vão à rede primeiro, desistindo depois de 5 s (sinal fraco) e usando o guardado. **No computador do desenvolvedor** (localhost, 127.0.0.1, 192.168.*), tudo vai à rede primeiro, para cada alteração aparecer na hora. Para publicar uma versão nova da casca, aumentar a `VERSAO` no `sw.js`. Pedidos ao script do CC nunca passam pelo cache | conversa |
| 10/11/2026 | Sem CSS dentro do HTML (`style=""`): tudo em classes nos `.css` (`dev/padroes/03_html_css_google.md`). Os ícones do botão Falar/Ouvir aparecem e somem pelo atributo `hidden`. O nome da conferência na barra superior deixou de ser `<h1>`: o título da tela é o único `<h1>` | conversa |
| 10/11/2026 | Sair: mesmo botão claro, com ícone e texto em vermelho (no lugar do fundo vermelho). Falar/Ouvir mantém a cor do modo (azul falar, verde ouvir, vermelho parar) | proposta, a confirmar |
| 10/11/2026 | "Sincronizar só em Wi-Fi" usa `navigator.connection.type` quando o navegador informa (Chrome no Android). Onde não informa (iPhone), não bloqueia | proposta, a confirmar |
| 11/11/2026 | **Teclado no celular:** `interactive-widget=resizes-content` no viewport (o teclado diminui a tela em vez de cobri-la); se o navegador deslocar a página, o app a devolve ao topo e rola só a área até o campo; formulários não focam o 1º campo ao abrir (o teclado só abre com o toque). Corrige o topo do formulário que sumia sem poder rolar | teste do usuário; `index.html`, `js/app.js`, v0.4.4 |
| 14/11/2026 | **Barra inferior com quatro botões: Menu \| Nuvem \| Falar \| Sair** (canhoto espelha). O botão Nuvem mostra a situação do envio e abre a aba Sincronização. Detalhes em [`05_sincronizacao.md`](05_sincronizacao.md) | chat de 14/11/2026 |
| 14/11/2026 | **Sem sessão, sem barra inferior:** antes de entrar numa conferência (ou ao escolher uma em que ainda não entrou), Menu, Nuvem, Falar e Sair somem; o conteúdo e os avisos descem para o rodapé. Classe `sem-sessao` no `body`, ligada em `js/app.js` | chat de 14/11/2026 |
| 15/11/2026 | **Barra da tela, fixa, abaixo da barra do app:** faixa baixa (cerca de 48px) com o **nome da tela**, a **lupa** (tocar troca o título pelo campo de busca, com seta para fechar) e o **atualizar** (↻), onde a tela tiver. Fica parada enquanto a lista rola: dá para buscar sem voltar ao topo. Os filtros (chips) continuam no conteúdo. Vale para todas as telas, inclusive as novas (Visitas) | chat de 15/11/2026 |
| 15/11/2026 | **Busca com o ícone do Material Design** (`search`). **Com texto, o campo fica aberto** (também ao voltar para a tela) **e com a borda de destaque**, para ninguém esquecer que a lista está filtrada. A seta fecha a busca e limpa; o ✕ só limpa | chat de 15/11/2026 |
| 15/11/2026 | **Busca, filtros e ações num botão "Opções" da barra da tela** (revê a lupa e os chips no conteúdo): o botão abre uma gaveta de baixo, como a do Menu, com três partes: **Buscar** (campo), **Mostrar** (filtros, com o número de cada um; em Famílias, também o bairro) e **Ações** (ex.: Nova pessoa, Atualizar a lista, Limpar busca e filtro). Um `<select>` nativo não comporta o campo de busca, e ação não é escolha que fica marcada. Objetivo: a lista começa no topo da área de conteúdo, em celulares simples | chat de 15/11/2026 |
| 15/11/2026 | **Busca ou filtro ativo, sem depender da cor** (WCAG 1.4.1; quem enxerga em tons de cinza): o funil do botão fica **cheio** (vazado sem filtro), com um **contador** (ex.: "2") e uma **linha de resumo sob o título** ("Vicentinos · busca: ana"). O fundo de destaque só reforça | chat de 15/11/2026 |
| 16/11/2026 | **"O que diz a Regra" e "Combinado na criação do app"** nos pontos em que o app pede ou mostra algo, para o vicentino saber de onde veio cada regra do app. **📖 O que diz a Regra** (ícone `menu_book`): só onde há um trecho exato; a gaveta mostra o texto literal, a referência ("Regulamento da SSVP no Brasil, 2023, Artigo 26, § 2º") e "Ouvir". **🤝 Combinado na criação do app** (ícone `handshake`): escolhas nossas que a Regra não traz (ex.: vermelho aos 14 dias, só o responsável registra a visita agendada); a gaveta mostra o combinado, **os motivos**, a data e que pode mudar. Ícones diferentes (não só a cor) para quem enxerga em tons de cinza. Os textos ficam num arquivo do app, para usar sem internet A gaveta da Regra tem "Ler a Regra inteira", com o link oficial do Conselho Nacional: https://www.ssvpbrasil.org.br/source/files/originals/Regra_SSVP_2023-968691.pdf (o mesmo da Circular 061/2025; é o arquivo de 2023, igual ao de `dev_local`). Citar como "Regulamento da SSVP no Brasil, Edição 2023 (com as alterações de 2025)", como pede a circular. A Instrução Normativa 1/2025 não mexeu nos artigos de visita (25, 26, 118). A própria Regra autoriza o uso por Unidades Vicentinas e associados "para fins didáticos, para uso em reuniões e atividades ordinárias... desde que citada a fonte" | chat de 16/11/2026 |
| 15/11/2026 | **A ação principal sai do conteúdo** e fica só nas Opções (ex.: "+ Nova pessoa") | chat de 15/11/2026 |
| 15/11/2026 | **A gaveta das Opções desce do topo da tela** (não sobe de baixo): ao digitar, ela encolhe para só o campo de busca lá em cima, o teclado fica embaixo e a lista filtrando aparece no meio. Filtros e ações em duas colunas; no máximo 70% da tela | chat de 15/11/2026 |
| 15/11/2026 | **Sem filtro nem busca (filtro "Todos"), o botão diz só "Opções", sem ícone**; com filtro, o **funil**; com busca, a **lupa**; com os dois, **funil e lupa**, ao lado do que está aplicado; **com filtro e busca juntos, o filtro vai abreviado** ("vic · “ana”", "ass", "soc", "ben"; o bairro fica inteiro; o leitor de tela lê o nome completo) | chat de 15/11/2026 |
| 15/11/2026 | **Atualizando a lista** (ao abrir a tela, quando ela busca o que mudou, ou pelo "Atualizar a lista"): o botão da barra fica **vermelho**, com **"Atualizando"** e a **seta girando**; sem outro ícone ao lado | chat de 15/11/2026 |
| 15/11/2026 | **Tocar numa opção da gaveta fecha a gaveta** e mostra a lista (filtro, bairro, ação, "Limpar"); sem botão "Ver a lista". A busca filtra a cada letra: **ao digitar, a gaveta fica só com o campo e o fundo escuro some**, e a lista filtrando aparece atrás (dá para rolar e tocar num nome); apagando o texto, filtros e ações voltam. A lupa ou o "Ir" do teclado fecham. **O botão da barra mostra o que está aplicado** ("Vicentinos", "“ana”") no lugar de "Opções"; a linha de resumo sob o título saiu | chat de 15/11/2026 |
| 15/11/2026 | **Nos detalhes, a barra da tela mostra a seta de voltar e o nome da pessoa ou da família** (sem busca). Substitui o botão grande "Voltar para…" antes do título (`botaoVoltar` em `js/telas/comum.js`). O Voltar do celular continua funcionando | chat de 15/11/2026 |
| 13/11/2026 | **Espera pelo servidor:** as mensagens ("Buscando os dados", "Salvando", "Aguarde"…) terminam num card vermelho com a seta girando, no lugar das reticências (`js/componentes/carregando.js`, classe `.card-carregando`). Com as animações desligadas, a seta para e o card fica | chat de 13/11/2026 |

## Pendências
| # | Pergunta |
| :--- | :--- |
| 1 | Quais atalhos ficam na barra inferior no MVP (vicentinos, famílias, menu)? |
| 2 | O que o [🔊 Ouvir] lê em cada tela do MVP (resumo da lista? o cartão em foco?) |
| 3 | Aviso de sincronização (verde, âmbar, vermelho) já no MVP ou só na 1.1, com as visitas? |
| 5 | A cápsula dupla de 18/09 (Falar + Teclado no botão central) foi substituída pelo botão único da t5 (segurar troca Falar/Ouvir)? A casca da raiz usa o da t5 |
| 4 | Ícone e nome do app no `manifest.json` (padrões em `dev/padroes/01_marca_ssvp.md`) |
