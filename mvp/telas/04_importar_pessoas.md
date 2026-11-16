# Tela: Importar pessoas

**Hash:** `#importar` · **Arquivo na raiz:** `js/telas/importar_pessoas.js` · **Protótipo:** ainda não existe
**Versão do app:** 1.0 · **Status:** Em definição

---

## Objetivo
O presidente traz para o app a planilha de vicentinos que a conferência já tem, sem digitar tudo de novo.

## Quem vê
Quem tem `VICENTINOS_CADASTRAR` (padrão: presidente e vice).

## O que mostra e o que faz
1. Escolher o arquivo (.xlsx ou .csv), lido no próprio navegador.
2. **De/para das colunas:** qual coluna do arquivo é nome, e-mail, celular, data de nascimento…
3. **De/para dos valores:** ex.: "Confrade" → papel VIC; "Presidente" → cargo PRE.
4. **Prévia:** o que vai ser cadastrado e os problemas encontrados (linha sem nome, e-mail repetido, data inválida).
5. Envio em lotes pelo `cadastrar_pessoa`, com o andamento na tela.

## Dados
| De onde | O quê |
| :--- | :--- |
| Arquivo do usuário | Lido no navegador; **não vai para o Drive** |
| Script do CC: `cadastrar_pessoa` | Cria a pessoa junto com o papel |

## Offline
Exige internet para enviar. A leitura e a prévia podem ser feitas offline.

## Decisões
| Data | Decisão | Origem |
| :--- | :--- | :--- |
| 06/11/2026 | Tela de de/para no app (colunas e valores), lendo .xlsx ou .csv no navegador, com prévia e envio em lotes pelo `cadastrar_pessoa`. O arquivo não vai para o Drive | `decisoes.md` |
| 06/11/2026 | **Primeiro só pessoas**; famílias depois de ver exemplos reais (fictícios) | `decisoes.md` |
| 06/11/2026 | Estado civil, profissão e escolaridade não são importados (LGPD) | `decisoes.md` (Modelo v2) |

## Relação com a importação CNB
A importação do arquivo de CP no Modelo CNB é feita pela conta do CC (menu "⚙️ WebApp" do índice), não por esta tela. As regras dela (ingresso = início de ASP, proclamação = início de VIC; presidente = encargo "Presidente") podem servir de base para o de/para de valores aqui. Detalhes em `appscript_cc/LEIAME.md`.

## Pendências
| # | Pergunta |
| :--- | :--- |
| 1 | Biblioteca para ler .xlsx no navegador (ex.: SheetJS pela CDN, com versão fixa) ou só .csv no MVP? |
| 2 | O que fazer com pessoa que já existe (mesmo e-mail): pular, atualizar ou perguntar? |
| 3 | Importar já manda o convite de primeiro acesso por e-mail, ou o presidente avisa depois? |
| 4 | Tamanho do lote e o que acontece se a internet cair no meio (retomar de onde parou) |
