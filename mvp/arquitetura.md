# Arquitetura do MVP

**Atualizado em:** 10/11/2026
**Consolida:** [`frontend_offline_voz.md`](../dev_local/implement/frontend_offline_voz.md) §1 e §6, [`definicao_views.md`](../testes/app/privado/definicao_views.md) §4 (de 22/09/2026), [`decisoes.md`](../dev_local/implement/decisoes.md) e o código atual de [`testes/app/`](../testes/app/)

---

## 1. Princípios (decididos)

| Data | Decisão |
| :--- | :--- |
| 29/10/2026 | **Single page app em JavaScript puro**, com módulos ES, sem frameworks e sem etapa de build. Navegação por `#hash` |
| 29/10/2026 | **Offline primeiro:** o app abre sem internet; os dados ficam no IndexedDB e são sincronizados depois |
| 29/10/2026 | **Ergonomia 60+:** toque de no mínimo 48×48 px, medidas em `rem`, alto contraste, mensagens simples, voz |
| 29/10/2026 | **Nenhum segredo no front-end:** o repositório é público; chave e cifra ficam só no script do CC (o app nunca cifra nem decifra) |
| 28/10/2026 | **Regras de negócio no front-end:** uma regra nova vale para todos os CCs quando o site é publicado |
| 28/10/2026 | **O celular fala direto com o script do CC** escolhido. Sem conta central |
| 28/10/2026 | Sempre `POST` com `Content-Type: text/plain` (o navegador não faz pré-consulta de CORS) |

## 2. Estrutura de arquivos da raiz

**Em uso desde 10/11/2026** (casca v0.1). Atualiza a seção 6 do `frontend_offline_voz.md`.

```
index.html              Casca do app (barra superior, <main id="areaConteudo">, barra inferior)
manifest.json           PWA
sw.js                   Service worker: rede primeiro, cache sem internet
css/
  base.css              Cores, temas, fonte grande, daltonismo, reset   ← t3_casca
  casca.css             Barras, menu ⋮, gavetas, ajuda, avisos          ← t3_casca
  telas.css             Área de conteúdo, cartões, formulários, painel de conexão
js/
  app.js                Início e roteador (#hash)
  casca.js              Menu ⋮, gavetas, configurações, "O que é isso?", Sair
  core/
    api_cc.js           chamarCC(url, acao, dados)                 ← testes/app/js/api_cc.js
    conselhos.js        Metropolitanos, centrais e url_api          ← testes/app/js/conselhos.js
    db.js               IndexedDB "ssvp_app" (só a store config por enquanto)
    preferencias.js     Configurações do aparelho, vibração e som
    voz.js              Botão Falar/Ouvir                           ← t3_casca
    sync.js             Fila de sincronização (versão 1.1, ainda não existe)
  componentes/
    barra_conexao.js    Escolha da conferência e login             ← testes/app/js/barra_conexao.js
  telas/
    comum.js            Peças comuns (tela em construção, pedir conexão)
    pessoas.js          Uma tela por arquivo: renderizar(area, sessao)
    familias.js
    importar_pessoas.js
siglas/                 Catálogos JSON (já na raiz)
```

**Banco separado dos protótipos:** a raiz usa o IndexedDB `ssvp_app`, e os protótipos usam o `webappssvp_db`. No localhost os dois dividem a mesma origem, e um não pode mudar a estrutura do outro. Por isso, uma conferência em que se entrou no `t0_conexao` precisa de um novo login na raiz.

**O que saiu da raiz:** o protótipo de setembro/outubro (`index.html`, `css/`, `js/`, `sw.js`, `manifest.json`) está em `testes/legado_raiz/`. O `api.js` dele aponta para a conta perdida, e o `visitas_ui.js` gera números de 4 dígitos no app.

**O que não veio de `testes/app/`:** `api.js` e `auth.js` (do índice antigo, antes do script por CC) e `ui_comum.js` (a casca nova assume o papel).

## 3. Roteador

O `<main id="areaConteudo">` recebe a tela do `#hash` atual. **Proposta:**

| Hash | Tela | Arquivo |
| :--- | :--- | :--- |
| `#pessoas` (a inicial; `#vicentinos` também abre) | Pessoas | [`telas/02_pessoas.md`](telas/02_pessoas.md) |
| `#familias` | Famílias | [`telas/03_familias.md`](telas/03_familias.md) |
| `#importar` | Importar pessoas | [`telas/04_importar_pessoas.md`](telas/04_importar_pessoas.md) |

A conexão não é uma tela do roteador: é um painel da barra superior, presente em todas ([`telas/01_conexao.md`](telas/01_conexao.md)).

Cada tela exporta uma função `renderizar<Tela>(area, sessao)`. Sem sessão, a tela mostra o convite para conectar e abre o painel de conexão.

## 4. Conversa com o script do CC

| Ação | Sessão | Uso no MVP |
| :--- | :--- | :--- |
| `ping` | Não | Testar se o script do CC responde |
| `conferencias` | Não | Lista de CPs e conferências do CC (painel de conexão) |
| `entrar`, `pedir_codigo`, `criar_senha` | Não | Login, primeiro acesso e "esqueci a senha" |
| `perfil` | Sim | Quem entrou, papéis e permissões |
| `listar`, `obter` | Sim | Listas de vicentinos e famílias |
| `cadastrar_pessoa`, `inserir`, `atualizar`, `desativar`, `lote` | Sim | Cadastro e importação de pessoas |
| `sair_de_todos` | Sim | Encerrar as sessões em todos os aparelhos |

- Com sessão, as telas usam `chamarComSessao(acao, dados)` do `barra_conexao.js`, que junta o token da conferência escolhida (o token só vale na conferência em que foi emitido) e guarda o token renovado.
- O app manda os campos em claro pelo nome base; o script decide o que cifra, o que vira hash e o que fica aberto, e recusa campos desconhecidos.
- Detalhes: [`api_crud.md`](../dev_local/implement/api_crud.md) e [`appscript_cc/LEIAME.md`](../dev_local/implement/appscript_cc/LEIAME.md).

## 5. Banco local (IndexedDB)

- Banco `ssvp_app`, versão 3 (14/11/2026). A store `config` guarda `conexao_escolha`, `conexao_lista:<CM>_<CC>`, `conexao_sessoes` (uma sessão por conferência, com o e-mail de quem entrou), `preferencias_usuario`, `cofre:<conferência>`, `pessoas_atualizada:<conferência>` e `detalhes_baixados:<conferência>`.
- Stores dos dados, todas com o índice `conferencia` (`telas/05_sincronizacao.md`):
  - `pessoas`: a lista da tela Pessoas, sem cifra (nome de exibição, papéis, cargo);
  - `fila`: o que foi gravado e ainda não foi confirmado pelo servidor;
  - `detalhes`: os detalhes de cada pessoa para usar sem internet, **cifrados com a senha do login** (`js/core/cofre.js`).
- **Os dados chegam decifrados ao celular.** Os contatos e endereços só ficam guardados cifrados. Tudo de uma conferência sai do celular ao sair dela ou quando a sessão vence.

## 6. Pendências

| # | Pergunta |
| :--- | :--- |
| 1 | ~~Confirmar a estrutura de pastas da seção 2~~ Em uso desde 10/11/2026 |
| 2 | Qual é a tela inicial depois de entrar: vicentinos, famílias ou um início com atalhos? |
| 3 | ~~Stores do IndexedDB para o MVP~~ Decidido em 14/11/2026: uma store por tela, com o que ela mostra (`telas/05_sincronizacao.md`) |
| 4 | ~~Quando apagar os dados do celular?~~ Decidido em 14/11/2026: os dados guardados (cofre e detalhes) saem ao sair da conferência e quando a sessão vence. A fila sai ao sair, depois de perguntar. Trocar de conferência não apaga |
| 5 | ~~Os dados de cada conferência ficam separados?~~ Sim (14/11/2026): todas as stores têm o índice `conferencia`, e cada conferência tem o seu cofre |
