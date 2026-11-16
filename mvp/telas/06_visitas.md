# Tela: Visitas

**Hash:** `#visita/<id_familia>` (registrar, etapa 1), `#visitas` (agenda e alertas, etapa 2), `#familias/<id_familia>` (histórico e "Registrar visita") · **Arquivos na raiz:** `js/telas/visita.js` (feito), `js/telas/visitas.js` (agenda, a criar) · **Protótipo:** nenhum (o `t4_visitas.html` previsto em `testes/app/privado/definicao_views.md` não foi feito)
**Versão do app:** 1.1 · **Status:** Etapa 1 feita (16/11/2026); etapas 2 e 3 em definição

> **Etapa 1 (16/11/2026):** `#visita/<id_familia>` em `js/telas/visita.js`, aberta pelo botão "Registrar visita" no cartão Visitas da família (`familia_detalhe.js`), que mostra as últimas visitas (as da fila com "no celular") e "Ouvir a última visita" (combinados primeiro, depois o relato). A tela tem: oração antes da visita (Orações 2.7) e "Ouvir a última visita"; os 4 toques, com "Desfazer o último toque" e, passadas 3 horas do último toque, a pergunta da hora aproximada; "Vou de" (vem da última visita); dupla (um registra pelos dois: mesmos horários e meio); relato (relato_origem VOZ se foi ditado) e "O que combinamos"; auxílios (tipo e quantidade, unidade do catálogo); fé (rezou, falou_de_fe); OMS com 5 rostinhos. A visita em andamento fica cifrada no cofre (`visita_andamento:<cf>|<id>`), e a família mostra "Continuar a visita em andamento". "Registrar uma visita que já aconteceu" troca os toques por data, hora de chegada e duração. Salvar põe na fila um item só (visita, participantes e auxílios). O celular guarda as visitas dos 2 meses dentro de cada família (`VERSAO_COPIA` 3). Script do CC 0.4.5: modelo v5 e filtro `data_visita_desde`.

---

## Objetivo
A visita semanal à família é o centro da obra (Regra, Art. 26). A tela ajuda a dupla a **se preparar** (ouvir a última visita), **registrar sem atrapalhar a conversa** (relato por voz, 4 toques de deslocamento) e **não esquecer ninguém** (famílias sem visita). Tudo funciona sem internet.

**Depende da tela Famílias** (`03_familias.md`), que ainda é um esboço: a visita é sempre de uma família. As duas são desenhadas juntas.

## Quem vê
| Papel | Vê | Faz |
| :--- | :--- | :--- |
| Presidente e vice | Tudo | Agendam (`VISITAS_AGENDAR`; sindicância: `SINDICANCIA_AGENDAR`) e registram |
| Vicentino e aspirante | Agenda, histórico e **relatos** | Registram (`VISITAS_REGISTRAR`) |
| Visitante e benfeitor | Que houve visita e a data, **nunca o relato** | Nada |

## O que mostra e o que faz

### Agenda (`#visitas`)
- **Minhas visitas:** as programadas em que sou da dupla, com família, data e parceiro. Tocar abre a visita para registrar.
- **Precisam de visita:** famílias assistidas há mais de 7 dias sem visita (amarelo) e mais de 14 (vermelho), do alerta de `indicadores_presidentes.md` §4.1. Presidente e vice têm "Agendar" em cada uma.
- **Recentes:** as últimas visitas realizadas, com o ícone de sincronização em cada uma (`05_sincronizacao.md`).

### Agendar (presidente e vice)
- Família, data (e hora, opcional) e a dupla (dois ou mais vicentinos ou aspirantes; o Art. 118, § 3º, pede dupla).
- Grava a visita com `id_status_visita = PRG` e os participantes. **A visita agendada já tem um id**, então registrar depois só atualiza a mesma visita, sem criar outra.
- Reagendar (`REG`) e cancelar (`CAN`, com motivo) pelo mesmo cartão.

### Sindicância (visita especial)
- É o **levantamento socioeconômico** em que a conferência decide se adota a família socorrida como assistida (Regulamento, Art. 118, V, e nota 60). Não é uma situação da família (`03_familias.md`).
- Presidente e vice a agendam numa família socorrida (`SINDICANCIA_AGENDAR`). Enquanto está aberta, a família mostra o selo **"Em sindicância"**.
- Ao registrar, além do relato, a dupla responde **"Recomenda adotar como assistida?"** (sim, não ou ainda não sei). O relato vai para a reunião (Art. 118, V). **Quem decide a passagem para assistida é o presidente ou o vice**, depois, em "Mudar a situação" da família.
- Na planilha: a mesma aba `visitas`, com o tipo de visita marcado (coluna a definir; ver pendências).

### Visita em andamento (`#visitas/<id>`, também sem agendamento a partir da família)
1. **Ouvir a última visita** (botão de alto-falante): lê o relato e os combinados da última vez, antes de bater na porta (`frontend_offline_voz.md` §2.2).
2. **Botão grande dos 4 toques:** "Estou saindo" → "Cheguei à casa da família" → "Saí da casa da família" → "Cheguei de volta" (`indicadores_presidentes.md` §4.7). Vibração e confirmação grande a cada toque. Sem GPS. O meio de transporte e a origem vêm da última visita àquela família. Várias famílias no mesmo dia: no toque 3, "Ir para a próxima família".
3. **Dupla:** quem registra e o parceiro (já preenchido se a visita foi agendada).
4. **Relato:** campo principal da tela, ditado pelo botão Falar (`relato_origem` = voz ou teclado).
5. **Auxílios entregues:** tipo (`siglas_auxilios.json`), quantidade e unidade padrão.
6. **Como a família está (OMS), opcional:** os 6 domínios (físico, psicológico, independência, relações, ambiente, espiritual), de 1 a 5, com desenhos simples. Pode pular; a visita fica "sem avaliação" e o app lembra depois.
7. **Salvar:** a visita passa a `REA` e vai para a fila como um item só (visita, participantes e auxílios), com ids provisórios. Volta para a agenda e avisa.

## Dados
| De onde | O quê |
| :--- | :--- |
| Planilha: `visitas` | `id_familia`, `id_status_visita` (PRG, REA, REG, CAN), `data_visita`, `hora_visita`, `duracao_minutos` (calculada dos toques), `relato_cifrado`, `relato_origem`, `relato_status`, `oms_*` |
| Planilha: `visitas_participantes` | Uma linha por vicentino: `id_pessoa`, os 4 horários, `meio_transporte`, `origem_deslocamento`, `origem_horarios` |
| Planilha: `visitas_auxilios` | `id_tipo_auxilio`, `quantidade`, `unidade_medida`, `valor_estimado`, `observacao_cifrado` |
| Catálogos | `siglas_status_visita.json`, `siglas_auxilios.json`, `siglas_meios_transporte.json`, `siglas_origens_deslocamento.json` |
| IndexedDB | Famílias e as últimas visitas de cada uma, na cópia **cifrada** (cofre, `05_sincronizacao.md`): o relato é o dado mais sensível do app. A fila leva as visitas novas até o envio |

## Offline
Agenda, histórico, "Ouvir a última visita" e registrar funcionam sem internet. Agendar também (entra na fila). O que foi agendado em outro celular só aparece depois de sincronizar.

## Mudanças no script do CC
1. ~~Permissão `RELATOS_VER` nova~~ Não é preciso: decifrar o relato exige `CONTATOS_VER`, e **o aspirante passou a ter `CONTATOS_VER` no padrão** (script 0.4.1, 14/11/2026). Nas conferências que já têm a aba `permissoes`, o presidente troca na planilha a célula `CONTATOS_VER` × `papel_asp` para SIM.
2. **Registrar uma visita agendada:** `atualizar` da visita (PRG → REA) e dos participantes já criados no agendamento, sem inserir de novo.
3. Conferir a permissão de `visitas_participantes` e `visitas_auxilios` no `lote` junto com a visita de id provisório (o mesmo caminho dos cadastros de pessoa).

## Decisões
| Data | Decisão | Origem |
| :--- | :--- | :--- |
| 29/10/2026 | Deslocamento com 4 toques (ida, chegada, saída, volta), por vicentino, sem GPS | `indicadores_presidentes.md` §4.7 |
| 14/11/2026 | **A 1.1 inclui agendar:** presidente e vice agendam (família, data, dupla); o vicentino vê as visitas dele e registra a partir delas. Registrar sem agendamento continua possível, pela família | chat de 14/11/2026 |
| 14/11/2026 | **Um registra pelos dois:** quem registra marca o parceiro; os horários do parceiro vêm iguais aos seus, com opção de ajustar. Funciona offline e não duplica a visita | chat de 14/11/2026 |
| 14/11/2026 | **OMS opcional, com lembrete:** aparece no fim, pode pular; a visita fica "sem avaliação" e o app lembra depois | chat de 14/11/2026 |
| 14/11/2026 | **Relato:** vicentinos e aspirantes leem (precisam do histórico para visitar); visitantes e benfeitores veem só que houve visita e a data. Para isso, **o aspirante ganha `CONTATOS_VER`** no padrão (script 0.4.1) | chat de 14/11/2026 |
| 14/11/2026 | **Só o responsável registra a visita agendada:** o primeiro da dupla no agendamento. O parceiro vê "Quem registra: Fulano". Evita que os dois celulares, sem internet, registrem a mesma visita | chat de 14/11/2026 |
| 14/11/2026 | **OMS com 5 rostinhos** em cada domínio (1 = muito mal … 5 = muito bem) | chat de 14/11/2026 |
| 14/11/2026 | **Sindicância é uma visita especial**, agendada numa família socorrida; a dupla registra a recomendação, e o presidente ou o vice decidem a passagem para assistida | chat de 14/11/2026; Regulamento, Art. 118, V, nota 60 |
| 14/11/2026 | **No celular, as visitas dos últimos 2 meses** de cada família (por enquanto), na cópia cifrada | chat de 14/11/2026 |
| 16/11/2026 | **Oração antes da visita:** botão com a oração 2.7 do Regulamento ("antes da visita domiciliar aos assistidos"), na tela e lida em voz alta | chat de 16/11/2026; Regra 1.7, Art. 26 |
| 16/11/2026 | **Pergunta espiritual no registro**, curta e opcional ("Rezamos juntos? Falamos de fé?"), além do domínio espiritual da OMS: a visita não pode ser "mero atendimento material" e a reunião ouve o "progresso na evangelização" | chat de 16/11/2026; Art. 26, § 2º; Art. 118, V |
| 16/11/2026 | **Designar na reunião:** uma tela para montar várias duplas de uma vez, na mesa da reunião, além do agendar família por família | chat de 16/11/2026; Art. 118, VI; Regra 3.3 f |
| 16/11/2026 | **Relato para a reunião:** lista das visitas desde a última reunião (família, dupla, auxílios, uma linha de resumo), para o item V | chat de 16/11/2026; Art. 118, V |
| 16/11/2026 | **Vicentino sem visita na semana** e **indicador do Art. 25** (famílias atendidas × metade mais um dos membros ativos), para o presidente | chat de 16/11/2026; Art. 25; Instruções 3.3, c |
| 16/11/2026 | **Visitas fora da família** (idosos sós, enfermos, encarcerados, confrades enfermos) ficam para a 1.2: a visita deixaria de exigir uma família (muda o modelo) | chat de 16/11/2026; Art. 25, parágrafo único; Art. 118, VI |
| 16/11/2026 | **Em etapas:** (1) registrar a visita a partir da família, com oração, ouvir a última visita, 4 toques, dupla, relato, combinados, auxílios, pergunta espiritual e OMS, e o histórico na família; (2) agenda `#visitas`, agendar e designar na reunião; (3) relato para a reunião, indicadores e sindicância | chat de 16/11/2026 |
| 16/11/2026 | **Pergunta espiritual: duas perguntas sim/não**, opcionais: "Rezamos juntos?" e "Falamos de fé?". Colunas novas `rezou` e `falou_de_fe` (SIM, NÃO ou vazio) em `visitas` | chat de 16/11/2026 |
| 16/11/2026 | **"O que combinamos" é um campo próprio** (pendência 4), curto, ditado ou digitado, cifrado: coluna nova `combinados_cifrado` em `visitas`. "Ouvir a última visita" lê primeiro os combinados, depois o relato. Liga depois com os planos de promoção (1.2) | chat de 16/11/2026 |
| 16/11/2026 | **Os 4 toques entram na etapa 1.** A visita em andamento fica guardada no celular (cifrada) entre os toques, sem internet. Esqueceu um toque: ao abrir a visita, o app pergunta a hora aproximada (pendência 6) | chat de 16/11/2026 |
| 16/11/2026 | **Item "Visitas" no menu**, antes da agenda: a tela #visitas (js/telas/visitas.js) mostra as famílias atendidas em três grupos (visitas em andamento, precisam de visita: mais de 7 dias ou nenhuma, visitadas nos últimos 7 dias), cada uma com "Registrar visita" ou "Continuar a visita". A agenda entra nesta tela na etapa 2 | chat de 16/11/2026 |
| 16/11/2026 | **Completar uma visita já salva** ("+ Acrescentar ao relato" em cada visita do cartão da família; js/telas/visita_completar.js, #visita/<família>/<visita>): **só quem foi à visita** (participante). O relato **não muda**: o texto novo entra no fim, "Acrescentado em 16/11 por Luiz: ...", e o servidor junta ao que está na planilha (relato_acrescimo), para dois da dupla não se apagarem. Também dá para mudar "O que combinamos" e acertar os auxílios (incluir o esquecido, tirar o lançado por engano: visitas_auxilios.ativa, modelo v6). Os outros campos da visita registrada não mudam. Script do CC 0.4.6 | chat de 16/11/2026 |

## Pendências
| # | Pergunta |
| :--- | :--- |
| 1 | ~~Dois celulares registrando a mesma visita~~ Decidido: só o responsável |
| 2 | ~~Escala do OMS~~ Decidido: 5 rostinhos |
| 3 | ~~Quantas visitas guardar~~ Decidido: as de 2 meses, por enquanto |
| 8 | Como marcar a visita de sindicância e a recomendação na planilha: coluna nova em `visitas` (ex.: `id_tipo_visita` = SIN ou VIS, e `recomendacao_sindicancia`), ou outra aba? Mudança no `Modelo.gs` (`VERSAO_MODELO`) |
| 7 | O responsável não foi à visita (doença, imprevisto): o parceiro pode "assumir o registro"? Só com internet, para não haver dois registros? |
| 4 | ~~"Combinados" da última visita~~ Decidido: campo próprio. Antes: (o que ficou combinado com a família): campo próprio na visita ou parte do relato? Liga com os planos de promoção (1.2) |
| 5 | Entrega de cesta **sem visita** (na paróquia): `visitas_auxilios` hoje exige `id_visita` (`decisoes.md`, pergunta 18) |
| 6 | ~~Hora de lembrar o "esqueceu de tocar"~~ Decidido: ao abrir a visita, o app pergunta a hora aproximada. Antes:: na próxima abertura do app, ou só ao abrir aquela visita? |
