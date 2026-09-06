# Registro de Chat - Criação do Template de Teste Padrão

**Data:** 14 de Agosto de 2026  
**Participantes:** Desenvolvedor (Usuário) & Antigravity (AI)

---

## Primeiro Alinhamento
O usuário solicitou a criação de um template padrão (`teste_padrao.html`) localizado na raiz da pasta `testes/` para agilizar e padronizar a exibição das funcionalidades testadas pelos Vicentinos.

### Requisitos Definidos:
1. **Identificação do Teste**: Versão do teste no topo em fonte normal e nome da funcionalidade em destaque.
2. **Instruções**: Um card expansível contendo os passos a passos para a realização do teste.
3. **Área de Teste**: Área central com placeholder adaptável.
4. **Acessibilidade e Barra Inferior**: Barra inferior fixa com botão de microfone redondo e centralizado (ergonômico).
5. **Estilo e Identidade Visual**: Cores baseadas no manual de marca da SSVP com arquivo CSS externo básico (`teste_padrao.css`).

---

## Segundo Alinhamento (Ajustes de Acessibilidade no Celular)
Buscando garantir que os vicentinos saibam com certeza absoluta qual teste estão executando e tenham mais fluidez ao ler as instruções, foram adicionadas as seguintes melhorias:

1. **Destaque Visual da Funcionalidade**:
   - O título da funcionalidade foi envolvido em um card dedicado (`.card-funcionalidade`) com fundo azul escuro (`--ssvp-navy`), borda de realce em azul royal (`--ssvp-blue`) e texto contrastante em branco. Isso dá maior destaque visual na tela mobile.
2. **Estado das Instruções**:
   - As instruções passam a carregar **abertas por padrão** para leitura imediata.
   - Quando o card for fechado/recolhido, ele encolhe por completo por meio da transição suave, mantendo na tela somente o cabeçalho "Instruções do Teste" (com a seta indicadora), liberando espaço para o teste em si.

---

## Terceiro Alinhamento (Simetria e Simplificação)
Ajustes adicionais foram aplicados para garantir maior polimento visual:
1. **Remoção de Rótulos Redundantes**:
   - O texto "Funcionalidade" que rotulava o cabeçalho foi removido por ser desnecessário, mantendo o visual limpo e focado no nome da funcionalidade em si (ex: "Google Maps").
2. **Centralização e Simetria**:
   - Os textos da versão ("teste v1.2") e do título da funcionalidade dentro do card foram configurados com alinhamento centralizado (`text-align: center`).
   - A borda azul royal da lateral esquerda do card foi removida para garantir uma composição perfeitamente simétrica no mobile.

---

## Quarto Alinhamento (Correção do Fechamento do Card)
O usuário percebeu que, ao fechar o card de instruções, o primeiro passo ("instrução 1") continuava parcialmente visível na tela devido ao vazamento do padding.
- **Correção Aplicada**: Adição de uma tag intermediária `<div class="card-content">` (filho direto do Grid CSS) com a propriedade `min-height: 0` no CSS, servindo de contêiner e contornando o comportamento de vazamento do padding de `.card-body` no Grid. O card agora recolhe a altura 100% de forma limpa.

---

## Quinto Alinhamento (Migração dos Testes Existentes - Google Maps)
O usuário solicitou iniciar a aplicação do novo padrão aos testes existentes no projeto, começando pela pasta do Google Maps.
- **Ação Executada**: O arquivo `testes/google_maps/google_maps_v1.html` (renomeado posteriormente pelo desenvolvedor para `google_maps_t1.html`) foi modificado para herdar o template padrão. Ele agora importa `../teste_padrao.css`, carrega a fonte `Inter`, possui o cabeçalho e instruções simétricos, e o card da "Família Santos" com o botão verde de rota do Maps fica embutido perfeitamente no container `.teste-container` padrão. A barra inferior de acessibilidade e o botão de microfone também foram integrados.

---

## Sexto Alinhamento (Ampliação de Famílias e UBSs Geográficas)
Buscando enriquecer o teste geográfico móvel, as seguintes atualizações foram feitas em `google_maps_t1.html`:
1. **Mais Famílias**: A listagem foi expandida de 1 para 5 famílias fictícias.
2. **Endereços Reais de UBS**: Mapeados 5 endereços reais de Unidades Básicas de Saúde (Sigmund Freud, Vila Olímpia, Vila Mariana, Campo Belo, Itaim Bibi) próximas de Moema, SP. Isso facilita simulações reais de rotas em campo.
3. **Notas Informativas**: O card de instruções agora avisa explicitamente que os nomes dos assistidos são fictícios e os endereços são de UBSs reais.
4. **Simplificação de Botões**: O texto dos botões de ação foi reduzido para simplesmente **"🗺️ Abrir Rota"** para uma interface mais limpa e focada no mobile.

---

## Sétimo Alinhamento (Foco Visual: Remoção de Microfone e Simulação de Voz)
Para maximizar o foco do teste do Google Maps em rotas de navegação (evitando elementos de simulação de voz que pudessem distrair os vicentinos), realizou-se a seguinte simplificação:
1. **Remoção de Barra e Botão de Áudio**: A barra inferior com o botão de microfone foi retirada tanto do protótipo `google_maps_t1.html` quanto do template base `teste_padrao.html`.
2. **Instruções Limpas**: Removido das instruções dos arquivos o passo que sugeria o uso do microfone.
3. **CSS Padrão Otimizado**: O estilo `teste_padrao.css` foi atualizado para remover o padding-bottom padrão de 100px no `body`, mantendo essa folga de layout apenas condicionalmente através da nova classe utilitária `body.has-barra-inferior { padding-bottom: 100px; }`.

---

## Oitavo Alinhamento (Criação de Alternativas de UX - T2, T3 e T4)
Com o objetivo de apresentar aos vicentinos diferentes abordagens de visualização e navegação de rotas para que eles possam avaliar e escolher o melhor fluxo, foram gerados três novos protótipos de teste sob o padrão SSVP:
1. **`google_maps_t2.html` (Abordagem de Mapa Local Embutido)**: Mapa inline em iframe abaixo do card da família ao tocar em "📍 Ver Mapa Local".
2. **`google_maps_t3.html` (Abordagem de Planejamento Logístico Geral)**: Mapa Leaflet.js no topo com os marcadores de todas as 5 UBSs. Clicar no card desloca o mapa e abre o balão de dados.
3. **`google_maps_t4.html` (Abordagem de Seleção Focada por Dropdown)**: Dropdown de seleção para exibir apenas uma família por vez, poupando a rolagem do celular.

---

## Nono Alinhamento (Integração de Comandos de Voz com Mapas)
O usuário propôs um novo teste voltado ao controle por voz para pesquisas locais e rotas de mapas (ex: "buscar padarias num raio de 2km" ou "rota até a padaria mais próxima").
- **Ação Executada**: Criação do novo teste `testes/google_maps/google_maps_voz.html` (renomeado posteriormente para `google_maps_voz_t1.html`) sob o template padrão.

---

## Refinamentos e Sincronização de Voz e OpenStreetMap (Alinhamentos 10 a 19)
Documentados todos os refinamentos das Regex de áudio de comandos de voz (removendo falsos positivos do artigo indefinido "um/uma" do comando de abertura), a quebra de transcrição em 3 linhas robusta, e a criação do teste do OpenStreetMap (`open_street_maps_t1.html`) com restrição geográfica estrita baseada em viewbox com raio de busca configurável e alinhamento vertical das caixas de dropdowns e botões de rota no mobile.

---

## Vigésimo Alinhamento (Visitas Vicentinas: Sincronização Offline e Google Sheets)
O usuário propôs um teste interativo cobrindo o ciclo de visitas em campo (offline) e a sincronização com as Planilhas de Conferência integradas via Google Apps Script (padrão de CRUD v2).
- **Ação Executada**: Criação do novo teste `testes/sincronizacao/sincronizacao_t1.html` e do guia de configuração `testes/sincronizacao/CONEXAO_PLANILHA.md`.

---

## Vigésimo Primeiro Alinhamento (Criação de Arquivo CSV Físico de Testes)
O usuário solicitou a geração física do arquivo CSV contendo os dados de visitas para simplificar o processo de importação direta no Google Sheets.
- **Ação Executada**: Criação do arquivo `testes/sincronizacao/visitas_teste_24_semanas.csv` contendo 28 relatos históricos de 24 semanas para popular a planilha de teste.

---

## Vigésimo Segundo Alinhamento (Embutir a URL Padrão do Apps Script de Produção)
O usuário disponibilizou a URL real de execução da API do Google Apps Script que implantou para a sua nova planilha de visitas.
- **Ação Executada**: A URL do Apps Script foi injetada diretamente como valor padrão inicial (default) no carregamento de `testes/sincronizacao/sincronizacao_t1.html`.

---

## Vigésimo Terceiro Alinhamento (Embutir o Link Padrão do Google Sheets de Produção)
O usuário disponibilizou o link visual da planilha real do Google Sheets que criou e populou no Google Drive.
- **Ação Executada**: O link da planilha foi injetado diretamente como valor padrão inicial (default) de carregamento da tela em `testes/sincronizacao/sincronizacao_t1.html`.

---

## Vigésimo Quarto Alinhamento (Nomenclatura Amigável: Mudar para Banco de Dados do Navegador)
O usuário sugeriu substituir os termos técnicos e de armazenamento local pelo termo simplificado "Banco de dados do navegador".
- **Ação Executada**: Substituição total das strings e alertas em `sincronizacao_t1.html`.

---

## Vigésimo Quinto Alinhamento (Ocultamento de Painel de Configurações e Links Técnicos)
O usuário sugeriu remover o painel que continha os campos de texto de URLs do Apps Script e link da Planilha, bem como o botão azul de visualização da planilha da tela para focar o teste puramente na experiência dos vicentinos.
- **Ação Executada**: Ocultamento de painéis visuais no HTML e encapsulamento em constantes de JavaScript.

---

## Vigésimo Sexto Alinhamento (Botão de Visualização do Sheets abaixo de Instruções)
O usuário indicou que a exibição do botão de visualização da planilha é fundamental para confirmar a gravação dos dados sincronizados.
- **Ação Executada**: Reinserido o botão de abrir planilha abaixo de instruções.

---

## Vigésimo Sétimo Alinhamento (Correção do Erro de Escopo de Variável no Loop de Sincronização)
O usuário relatou uma falha de sincronização ao enviar os relatos pendentes.
- **Correções Executadas em `sincronizacao_t1.html`**:
  1. Identificado um erro de escopo de variável onde o `fetch` da requisição POST na função `sincronizarFila` tentava ler a variável `urlScript` (que havia sido excluída do escopo ao remover os inputs visuais da tela).
  2. Substituído o parâmetro da requisição `fetch` de `urlScript` para a constante global correta **`URL_API`**, restaurando a integração automática com a nuvem em background.
  3. Atualizado o tratamento de erros no bloco `catch` para exibir diagnósticos detalhados na tela do celular (CORS, internet desativada ou permissões do Google), auxiliando na depuração.
