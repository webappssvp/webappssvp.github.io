# MVP do WebApp SSVP (versão 1.0)

**Criado em:** 10/11/2026
**Status:** Em construção

Esta pasta junta o que foi decidido para montar o MVP na raiz do site. Cada tela tem um arquivo em [`telas/`](telas/), onde ficam as decisões dela.

| Arquivo | Conteúdo |
| :--- | :--- |
| [`arquitetura.md`](arquitetura.md) | Princípios, estrutura de arquivos da raiz, roteador, banco local e API do CC |
| [`telas/00_casca.md`](telas/00_casca.md) | Casca do app: barras superior e inferior, menu, voz, PWA, aviso de versão |
| [`telas/01_conexao.md`](telas/01_conexao.md) | Escolha da conferência, login, primeiro acesso e "esqueci a senha" |
| [`telas/02_pessoas.md`](telas/02_pessoas.md) | Tela inicial: pessoas da conferência, com o que cada papel pode ver e fazer |
| [`telas/03_familias.md`](telas/03_familias.md) | Lista de famílias assistidas |
| [`telas/04_importar_pessoas.md`](telas/04_importar_pessoas.md) | Importar pessoas de uma planilha que a conferência já tem |
| [`telas/05_sincronizacao.md`](telas/05_sincronizacao.md) | Fila de envio offline, ícones de situação dos dados e a aba Sincronização |
| [`telas/06_visitas.md`](telas/06_visitas.md) | Agenda, registro da visita (4 toques, relato por voz, auxílios, OMS) e alertas de famílias sem visita (1.1) |
| [`telas/_modelo.md`](telas/_modelo.md) | Modelo para o arquivo de uma tela nova |

---

## 1. O que entra no MVP

Do [`roadmap.md`](../dev_local/implement/roadmap.md):

- App instalável (PWA) que abre sem internet.
- Escolha do Central, do Particular e da Conferência; login com primeiro acesso por código enviado por e-mail.
- Listas de vicentinos e de famílias guardadas no celular para uso offline.
- Dados fictícios para treino (marca **EXEMPLO**).

Fica para depois (sem arquivo de tela por enquanto):

| Versão | Telas |
| :--- | :--- |
| 1.1 – Visitas | Registro de visita offline, relato por voz, participantes, 4 toques de deslocamento, fila de sincronização |
| 1.2 – Promoção humana | Plano de promoção e acompanhamento |
| 1.3 – Indicadores | Painel do presidente da conferência |
| 2.0 – Regra da SSVP | Leitor da Regra offline |

## 2. Como se trabalha até o MVP

1. **Desde 10/11/2026 a raiz é o app.** A casca (barras, menus, configurações, ajuda, conexão) está no `index.html` da raiz, e cada tela nova entra direto nela, como um arquivo em `js/telas/` registrado no roteador (`js/app.js`).
2. **[`testes/`](../testes/) fica para experimentos** que precisam ser comparados antes de decidir (ex.: duas formas de um botão). O que for escolhido passa para a raiz com a frase combinada **"vamos usar [nome do teste]"** ([`.agents/AGENTS.md`](../.agents/AGENTS.md); chat de 18/09/2026).
3. **Cada tela exporta `renderizar(area, sessao)`** e devolve o texto que o modo Ouvir lê. O protótipo antigo da raiz está em `testes/legado_raiz/`.
4. **Toda decisão sobre uma tela vai para o arquivo dela** em `telas/`, com data. Decisões gerais continuam em [`decisoes.md`](../dev_local/implement/decisoes.md).
5. Branch local `mvp`. Backup só no repositório privado (`git push privado mvp`); o envio ao público está bloqueado.
6. Testes em `localhost` (Live Server ou `npx serve`); no Android, por USB com `chrome://inspect` → Port forwarding.

## 3. Publicação no dia do MVP

Nunca enviar o branch `mvp` inteiro ao público: o histórico dele tem o `dev_local/`. O passo a passo (merge com `--squash`, troca do `.gitignore`, conferência de que `dev_local` e `privado/` ficaram de fora) está em [`roadmap.md`](../dev_local/implement/roadmap.md), seção "Backup e publicação".

**Atenção:** esta pasta `mvp/` **vai junto** para o site público. Não escrever aqui nada que não possa ser público (segredos, e-mails reais, ids de script, dados de pessoas).

## 4. Pré-requisitos (do roadmap)

| # | Pré-requisito | Situação em 10/11/2026 |
| :--- | :--- | :--- |
| 1 | AES-GCM e PBKDF2 medidos no Apps Script real | Pendente (`ITERACOES_SENHA` = 100.000 provisório) |
| 2 | Script do CC na conta de teste (pastas, cadastro, login, CRUD, numeração) | Feito nos CCs de teste Sudeste e Leste |
| 3 | Planilha modelo atualizada (ids de 6 dígitos, `ficticio`, abas do sistema) | Feito (planilha gerada pelo `Modelo.gs`) |
| 4 | `url_api` dos CCs de teste em `siglas/siglas_conselhos_centrais.json` | Feito (SUD e LES) |
