# Tela: Conexão (escolha da conferência e login)

**Hash:** nenhum (painel da barra superior, em todas as telas) · **Arquivo na raiz:** `js/componentes/barra_conexao.js` · **Protótipo:** [`testes/app/t0_conexao.html`](../../testes/app/t0_conexao.html)
**Versão do app:** 1.0 · **Status:** Na raiz desde 10/11/2026: abre ao tocar no nome da conferência na barra superior. Testado com o CC Sudeste (lista de CPs e conferências)

---

## Objetivo
O vicentino escolhe a sua conferência e entra com e-mail e senha. Na primeira vez, ou se esqueceu a senha, recebe um código por e-mail e cria a senha.

## Quem vê
Todos. Entram só pessoas com papel ativo de vicentino (VIC), aspirante (ASP), visitante (VIS) ou benfeitor (BEN). Assistidos (AST), socorridos (SOC) e pessoas fictícias nunca entram.

## O que mostra e o que faz
1. **Escolha:** Central → Particular → Conferência (selects). O metropolitano vem do endereço do site; fora dos sites conhecidos, também é escolhido.
2. **Entrar:** e-mail e senha.
3. **Primeiro acesso / Esqueci a senha:** informa o e-mail, recebe o código de 6 dígitos, digita o código e a senha nova, e já entra.
4. **Depois de entrar:** os selects somem e o nome da conferência fica na barra superior. Tocar nele mostra os selects de novo, para trocar de conferência ou sair.

## Dados
| De onde | O quê |
| :--- | :--- |
| `siglas/siglas_conselhos_centrais.json` | Metropolitanos (com `sites`) e centrais (com `url_api`). Central sem `url_api` não aparece |
| Script do CC: `conferencias` (sem sessão) | CPs e conferências do CC |
| Script do CC: `entrar`, `pedir_codigo`, `criar_senha` | Login; devolve token e perfil |
| IndexedDB `config_conferencia` | `conexao_escolha`, `conexao_lista:<CM>_<CC>`, `conexao_sessoes` |

## Offline
A lista de CPs e conferências fica guardada e aparece na hora; é atualizada em segundo plano quando há internet. Entrar, pedir código e criar senha exigem internet ("Sem internet agora. Tente de novo quando estiver conectado.").

## Decisões
| Data | Decisão | Origem |
| :--- | :--- | :--- |
| 28/10/2026 | A lista de CCs com a `url_api` de cada um vem embutida no app | `decisoes.md` |
| 28/10/2026 | Link do presidente com `?cc=SUD` (e, opcional, `&cf=SP_SUD_ITA_ICO`) já deixa a escolha feita | `estrategia_dados_ccs.md` §3.1; `barra_conexao.js` |
| 30/10/2026 | Primeiro acesso e "esqueci a senha" por **código de 6 dígitos** no e-mail; ninguém conhece a senha de outra pessoa | `login_e_senhas.md` §4 |
| 05/11/2026 | Código vale 30 min, 5 tentativas, 1 envio por minuto. **Resposta sempre igual**, exista ou não o e-mail | `login_e_senhas.md` §0 |
| 05/11/2026 | 5 erros (senha ou código) bloqueiam por 15 min: "Muitas tentativas. Tente de novo em 15 minutos." | `login_e_senhas.md` §4.4 |
| 05/11/2026 | Sessão de 30 dias, renovada a cada uso; vale só na conferência em que foi emitida | `login_e_senhas.md` §0 |
| 09/11/2026 | **Sem conta do metropolitano.** Os centrais vêm do JSON; CPs e conferências vêm da ação `conferencias` do CC e ficam no IndexedDB, atualizados a cada abertura | `decisoes.md` |
| 09/11/2026 | **Uma sessão por conferência:** quem atua em várias troca sem digitar a senha de novo | `decisoes.md`; `barra_conexao.js` |
| 09/11/2026 | **Em teste** (localhost, 192.168.*, *.github.io): aparecem todos os metropolitanos e dá para informar o endereço do script de cada Central (guardado no `localStorage`) | `conselhos.js` |
| 11/11/2026 | Criar/redefinir senha: campo **"Confirme a nova senha"** (o app só chama o CC se as duas forem iguais) e **botão de olho** que mostra/esconde as duas de uma vez. O login ("Sua senha") também tem o olho | pedido do usuário; `barra_conexao.js`, `telas.css` |
| 11/11/2026 | Assunto do e-mail do código: **"Código de acesso SP_SUD_ITA_ICO_Pessoa1"** (conferência + primeiro nome), para achar na caixa | pedido do usuário; `Sessao.gs` 0.3.3 |
| 11/11/2026 | **Só em desenvolvimento** (`localhost`, `127.0.0.1`, `192.168.*`; o `*.github.io` fica de fora por ser o site público): cada login que dá certo guarda e-mail e senha **sem cifrar** no IndexedDB (`config`, chave `dev_logins`, por conferência). No painel de entrar, um select "Contas salvas" preenche e-mail e senha; ~~a última opção apaga as lembradas~~ **13/11/2026:** a primeira opção, "Esquecer", apaga as lembradas e esconde as do arquivo (o arquivo não muda; uma conta escondida volta quando se entra com ela de novo). Também lê as contas escritas à mão em `dev_local/seguranca/logins_dev.json` (pasta fora do git, até do repositório privado), que valem mais que as lembradas | pedido do usuário; `js/componentes/logins_dev.js`, v0.4.7 |
| 11/11/2026 | Senha conferida com a `@noble/hashes` e **fora da trava** do script: o login caiu de ~70 s para ~3 s. Aviso de erro rola para a vista (ficava fora da tela no celular) | teste do usuário; `Cripto.gs`/`Sessao.gs` 0.3.4, `barra_conexao.js` |
| 12/11/2026 | **Senhas diferentes:** o aviso aparece logo abaixo de "Confirme a nova senha", com a borda do campo em vermelho (no pé do painel, ficava sob o teclado). Avisa ao sair do campo e ao tocar em "Criar senha e entrar"; some assim que as duas ficam iguais. A confirmação não tem mais `minlength`, para o navegador não trocar esse aviso pelo de tamanho | teste do usuário; `barra_conexao.js`, `telas.css` |

## Pendências
| # | Pergunta |
| :--- | :--- |
| 1 | O e-mail do código chegou com o texto "corpo do email", sem código (teste de 09/11/2026). O código publicado está certo; conferir assunto e remetente do e-mail recebido e se a pessoa está cadastrada com e-mail |
| 2 | Medir o tempo do `entrar` no Apps Script real com 100.000 repetições do PBKDF2 |
| 3 | PIN além da senha? Login pelo celular? (`decisoes.md`, pergunta 4) |
| 4 | Login dos presidentes de CP e CC no app (`decisoes.md`, pergunta 16) |
| 5 | Mostrar "Sair de todos os aparelhos" (`sair_de_todos`) nesta tela ou nas configurações? |
| 6 | **Antes do MVP:** apagar `js/componentes/logins_dev.js` e o que o usa em `barra_conexao.js` (select `#selDevLogin`, `lembrarLogin`), a regra `.grupo-dev` do `telas.css` e a linha do `sw.js` |
