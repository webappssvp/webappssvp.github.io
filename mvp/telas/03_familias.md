# Tela: Famílias

**Hash:** `#familias` (lista), `#familias/<id_familia>` (detalhe) · **Arquivos na raiz:** `js/telas/familias.js` (lista), `familia_detalhe.js`, `familia_acoes.js`, `familia_dados.js` · **Protótipo:** nenhum (o `t3_familias.html` previsto em `definicao_views.md` não foi feito)
**Versão do app:** 1.0 (histórico de visitas e "Registrar visita" na 1.1, `06_visitas.md`) · **Status:** Em implementação (14/11/2026)

**Andamento:**
- **Etapa 1 (feita em 14/11/2026):** lista e detalhe só para ver (`js/telas/familias.js`, `familia_detalhe.js`, `familia_dados.js`). Stores `familias` (sem cifra) e `detalhes_familias` (cofre), banco v4. "Só o que mudou" com `listar` + `desde`. Os detalhes das famílias são baixados junto com os das pessoas. O Sair apaga também as listas de pessoas e famílias da conferência. A lista foi testada no Node (8 casos).
- **Etapa 2 (feita em 14/11/2026, `familia_acoes.js`):** mudar o endereço ("a família se mudou" ou "corrigir o atual"), adicionar morador (pessoa nova ou da conferência), retirar morador (com novo titular), mudar a situação, **Família promovida** (só o presidente) e encerrar (afastada ou transferida). Tudo pela fila, num item só, com a lista e a cópia guardada mostrando a mudança antes da confirmação. Em Pessoas, mudar o papel do titular entre socorrido e assistido muda a família e todos os moradores. As operações de papel foram testadas no Node (7 casos); no CC real, ainda não.
- **Retirar morador encerra também o papel de atendimento dele** nesta versão (decisão de 14/11/2026). Ver a pendência 9.

---

## Objetivo
Mostrar as famílias atendidas pela conferência, para o vicentino consultar antes e durante a visita, **mesmo sem internet**, e cuidar do cadastro delas: endereço, moradores e situação. É a tela mais usada no campo.

## Quem vê
| Papel | Vê | Faz |
| :--- | :--- | :--- |
| Presidente | Tudo, decifrado | Tudo, e **só ele promove a família** (`FAMILIAS_PROMOVER`, fixa) |
| Vice | Tudo, decifrado | Tudo, menos promover (`ASSISTIDOS_CADASTRAR`, `SOCORRIDOS_CADASTRAR`, `PESSOAS_DESATIVAR`) |
| Vicentino e aspirante | Tudo, decifrado (`CONTATOS_VER`) | Cuidam das famílias socorridas (`SOCORRIDOS_CADASTRAR`) |
| Visitante e benfeitor | A lista (nome de referência, situação, bairro, moradores e última visita), **sem endereço nem detalhes decifrados**, como em Pessoas | Nada |

## O que mostra e o que faz

### Lista (`#familias`)
- **Cartão por família:** nome de referência, **selo da situação** (ícone e texto, não só cor; `siglas_status_familias.json`), bairro, "4 moradores" e **"Última visita há 9 dias"**: amarelo acima de 7 dias, vermelho acima de 14 (Art. 26; alerta de `indicadores_presidentes.md` §4.1). Sem visita: "Nenhuma visita registrada".
- **Ícone da nuvem** em cada cartão, como em Pessoas (`05_sincronizacao.md`).
- **Filtros:** **Todas | Assistidas | Socorridas | Promovidas | Encerradas** (decisão de 14/11/2026). "Todas" são as atendidas hoje (assistidas e socorridas), e é o filtro ao abrir. **Promovidas é o filtro mais importante**: a conferência existe para aumentar o número delas. Por isso aparece sempre, mesmo com zero, e o cartão mostra "Promovida em…" com destaque. "Encerradas" são as afastadas e transferidas.
- **Selo "Em sindicância"** na família socorrida com sindicância aberta (ver `06_visitas.md`).
- **Busca** pelo nome de referência e **filtro por bairro**.
- Famílias fictícias com o selo **EXEMPLO**.
- **Modo Ouvir:** lê os nomes, a situação e há quantos dias foi a última visita.

### Detalhe (`#familias/<id>`)
- **Situação** e desde quando.
- **Endereço** (decifrado, para quem tem `CONTATOS_VER`), com **"Abrir no mapa"**: só quando o vicentino toca, o endereço vai ao Google Maps do celular dele, para chegar à casa.
- **Moradores:** cada um com o vínculo (`siglas_vinculos.json`: titular, cônjuge, filho, inquilino…). Tocar abre a pessoa (`#pessoas/<id>`).
- **Última visita** (data) na 1.0; **histórico de visitas e "Registrar visita"** na 1.1.
- **Ações** (cada uma com a permissão do servidor; todas pela fila, também sem internet):
  - **Editar** (o mesmo padrão de Pessoas, decisão de 14/11/2026): um formulário com os cartões **Dados da família** (nome de referência) e **Endereço**, botão Salvar, e só o que mudou vai para a nuvem. No Endereço, a caixa **"A família se mudou para este endereço"** grava um endereço novo e encerra o anterior (`data_termino`), guardando o histórico (decisão de 31/10/2026). Sem marcar, corrige o endereço atual. Quem não tem `CONTATOS_VER` edita só o nome de referência.
  - **Adicionar morador** (botão "+ Adicionar morador" no cartão Moradores, junto do "Retirar" de cada um; 15/11/2026): pessoa nova, cadastrada **com o papel da situação da família** (AST ou SOC), e o vínculo. Ou uma pessoa que já está na conferência.
  - **Retirar morador** (mudou-se): `data_termino` no vínculo.
  - **Mudar a situação** (presidente e vice).
  - **Família promovida** (só o presidente): situação PRM com a data. Botão próprio, com tom de conquista.
  - **Encerrar a família** (afastada ou transferida): `data_termino` e motivo. Família não se apaga (decisão de 23/10/2026).

### Cadastrar família
Não há botão "Nova família": a família nasce ao cadastrar um assistido ou socorrido em **Nova pessoa** (`02_pessoas.md`), com a pessoa como titular.

## Dados
| De onde | O quê |
| :--- | :--- |
| Planilha: `familias` | `nome_referencia`, `id_status_familia`, `data_inicio`, `data_termino`, `motivo_termino` |
| Planilha: `familias_pessoas` | Um morador por linha: `id_pessoa`, `id_vinculo`, `detalhes_vinculo_cifrado`, `data_inicio`, `data_termino` |
| Planilha: `familias_enderecos` | Endereço atual e histórico (cifrados), `bairro`, `cidade`, `lat_aprox`/`lon_aprox` (~1 km) |
| Planilha: `visitas` | Só a data da última visita realizada (1.0) |
| IndexedDB, store `familias` (nova) | A lista, sem cifra: nome de referência, situação, bairro, número de moradores, data da última visita |
| IndexedDB, store `detalhes` (cofre) | Endereço, moradores e vínculos, **cifrados** com a senha (`05_sincronizacao.md`); na 1.1, as visitas dos últimos 2 meses |
| Script do CC: `listar` com `desde` | Só o que mudou desde a última vez, como em Pessoas |

## Offline
Lista e detalhe abrem sem internet (o detalhe pede a senha uma vez, como em Pessoas). As ações entram na fila e vão quando a internet voltar.

## Decisões
| Data | Decisão | Origem |
| :--- | :--- | :--- |
| 22/09/2026 | Selo colorido de situação, resumo de moradores ("4 moradores"), voz ao tocar, filtro por bairro e busca por nome | `definicao_views.md` §3 |
| 31/10/2026 | Endereço sempre com histórico em `familias_enderecos` (desde a sindicância). A lista mostra o endereço atual | `decisoes.md` |
| 01/11/2026 | Coordenadas precisas só cifradas; abertas só aproximadas (2 casas, ~1 km) | `decisoes.md` |
| 30/10/2026 | A primeira família real esconde os dados de exemplo; o app avisa: "Os dados de exemplo foram escondidos. Para vê-los, use o menu → Ver dados de exemplo" | `dados_ficticios.md` §4.1 |
| 23/10/2026 | Família não se apaga, se encerra (`data_termino`, `motivo_termino`) | `decisoes.md` |
| ~~05/11/2026~~ | ~~Visitantes e benfeitores só veem pessoas e visitas~~ Substituída em 14/11/2026 (linha abaixo) | `login_e_senhas.md` §0 |
| 12/11/2026 | **Família = quem mora no endereço**, com qualquer vínculo (parente, inquilino, amigo etc.). Quem não mora na casa não entra. Cada linha de `familias_pessoas` é um morador; `id_vinculo` diz a relação; quem se muda recebe `data_termino` | chat de 12/11/2026 |
| 14/11/2026 | **Visitantes e benfeitores veem a lista** (nome de referência, situação, bairro), sem nada decifrado, como em Pessoas. Fica valendo `PESSOAS_VER` ("Ver pessoas e famílias") | chat de 14/11/2026 |
| 14/11/2026 | **Morador recebe o papel da situação da família** (AST ou SOC): aparece em Pessoas com papel, e a contagem de assistidos fica certa | chat de 14/11/2026 |
| 14/11/2026 | **"Abrir no mapa" com o endereço**, só com o toque do vicentino, no celular dele | chat de 14/11/2026 |
| 14/11/2026 | **Na 1.0: lista e detalhe com as ações** (endereço, moradores, situação, encerrar). A 1.1 acrescenta o histórico de visitas e "Registrar visita" | chat de 14/11/2026 |
| 14/11/2026 | **Sem "Nova família":** a família nasce com o cadastro do assistido ou socorrido | chat de 14/11/2026 |
| 14/11/2026 | **Mudar a situação da família muda o papel dos moradores:** socorrida → assistida passa todos os moradores de SOC para AST (e o contrário). **Encerrar a família encerra os papéis de atendimento** (AST, SOC) dos moradores, com o mesmo motivo. Moradores que são membros (VIC, ASP…) não mudam | chat de 14/11/2026 |
| 14/11/2026 | **Mudar o papel do titular (responsável) muda o papel de todos os moradores** e a situação da família, pela tela de Pessoas também ("Mudar papel" e "Passar para assistido"). Ex.: titular socorrido → assistido passa a família e todos os moradores para AST | chat de 14/11/2026 |
| 14/11/2026 | **Morador que já é membro** (ex.: vicentino) fica só com o papel de membro, sem o papel da família (provisório; ver pendência 7) | chat de 14/11/2026 |
| 14/11/2026 | **Titular que se muda ou falece:** ao retirar o titular, o app pede para escolher o novo titular entre os moradores que ficam (ou encerrar a família, se não sobrar ninguém) | chat de 14/11/2026 |
| 14/11/2026 | **Família Vicentina (FVC) fica fora desta versão** | chat de 14/11/2026 |
| 14/11/2026 | **Sindicância não é situação da família:** é o levantamento socioeconômico em que a conferência decide se adota a família socorrida como assistida (Regulamento, Art. 118, V, e nota 60). Vira uma visita especial (`06_visitas.md`). Situações nesta versão: socorrida, assistida e as encerradas. Família com `SIN` na planilha (dados antigos) aparece entre as socorridas, com o selo "Em sindicância" | chat de 14/11/2026; `Regra_SSVP_2023.pdf` |
| 14/11/2026 | ~~Filtros: Todas \| Assistidas \| Socorridas \| Encerradas~~ Alterada no mesmo dia (linha abaixo) | chat de 14/11/2026 |
| 14/11/2026 | **Retirar morador encerra o papel de atendimento dele**, nesta versão. Como tratar quem casou ou foi morar em outra casa fica para depois (pendência 9) | chat de 14/11/2026 |
| 14/11/2026 | **Edição da família como a de Pessoas:** botão "Editar" junto das outras ações; formulário com os cartões Dados da família e Endereço; "A família se mudou" guarda o endereço anterior no histórico | chat de 14/11/2026 |
| 14/11/2026 | **Só a família assistida pode ser promovida** (a socorrida passa antes a assistida). O botão só aparece na assistida, e o servidor recusa as outras com "Só a família assistida pode ser promovida." (script 0.4.3) | chat de 14/11/2026 |
| 14/11/2026 | **Só o presidente promove a família** (e desfaz a promoção): ação `FAMILIAS_PROMOVER`, fixa como `CARGOS_ATRIBUIR` (não muda na aba `permissoes`). O servidor confere (script 0.4.2). No app, o botão **"Família promovida"** é separado de "Encerrar" (que fica para afastada e transferida) e só aparece para o presidente | chat de 14/11/2026 |
| 14/11/2026 | **Filtros: Todas \| Assistidas \| Socorridas \| Promovidas \| Encerradas.** A promoção é a meta da conferência: o filtro aparece sempre e o cartão da promovida tem destaque ("Promovida em…"). Encerradas = afastadas e transferidas | chat de 14/11/2026 |
| 16/11/2026 | **De onde vem cada regra** (`js/componentes/de_onde_vem.js`, textos em `siglas/regra_trechos.json`; ver `00_casca.md`): em **Mudar a situação**, "Combinado na criação do app" (socorrida e assistida: a palavra "socorrida" não está na Regra, vem das planilhas dos CCs) e "Sindicância: o que diz a Regra" (Art. 118, V, § 4º e nota 60); em **Família promovida**, "O que diz a Regra" (Regra 1.10, Regulamento Art. 1º, Requisito Básico nº 6) e um "Combinado" com os dois combinados (só o presidente promove; só a assistida pode ser promovida); no selo **"Em sindicância"**, o trecho da sindicância | chat de 16/11/2026 |
| 14/11/2026 | **Guardada como Pessoas:** lista sem cifra numa store própria; detalhes no cofre; só o que mudou desde a última vez | chat de 14/11/2026 |

## Pendências
| # | Pergunta |
| :--- | :--- |
| 1 | ~~Situações e cores~~ Usa `siglas_status_familias.json`: SIN, AST, SOC, PRM, AFA, TRF. **FVC ("Família Vicentina") fica fora desta versão** (14/11/2026): não aparece nos filtros nem em "Mudar a situação" |
| 2 | ~~"Última visita" no MVP~~ Sim: só a data, lida de `visitas` (os fictícios já têm 6 meses de visitas) |
| 3 | ~~Detalhe no MVP~~ Sim, com ações |
| 4 | ~~Cadastro de família no MVP~~ Pela Nova pessoa (assistido ou socorrido) |
| 5 | ~~Endereço decifrado no celular~~ Sim, cifrado no cofre |
| 6 | ~~Mudar a situação muda o papel dos moradores?~~ Decidido: sim (ver Decisões) |
| 7 | **Morador que já tem outro papel** (ex.: um vicentino que mora com a família assistida): por enquanto **fica só como vicentino**, sem receber o papel da família. Pensar melhor depois (dois papéis? como contar nos indicadores?) |
| 8 | ~~Novo titular~~ Decidido: sim (ver Decisões) |
| 9 | **Morador que sai da família** (casou, foi morar em outra casa, foi para um abrigo…): nesta versão o papel de atendimento é encerrado junto. Depois, decidir: virar uma família nova (com ele como titular), mudar para outra família já atendida, ou continuar atendido sozinho? |
