# Tela: Sincronização (fila de envio)

**Hash:** nenhum (aba "Para enviar" da gaveta superior, aberta pelo botão Nuvem; antes "Sincronização") e `#como-funciona` (a explicação) · **Arquivos na raiz:** `js/core/sync.js` (fila), `js/componentes/icone_sync.js` (ícone por item), `js/casca.js` (aba), `js/componentes/carregando.js` (buscando/enviando) · **Protótipo:** nenhum
**Versão do app:** 1.0 · **Status:** Em implementação (14/11/2026)

**Andamento (17/11/2026, casca v0.11.0, script do CC 0.5.0):** o bloco **"Você mudou e ainda não enviou"** (`js/componentes/bloco_mudanca.js`) na folhinha do item e nos detalhes da pessoa e da família: compara a sua mudança com a planilha, avisa quem mudou depois de você e deixa escolher "Enviar a minha" ou "Ficar com a da planilha". O script grava `atualizado_por` (modelo v7), implantado no Sudeste e no Leste. Conferido no Chrome headless com servidor falso (a comparação, o aviso com o nome e o "Ficar com a da planilha" esvaziando a fila); o simulador do script passou inteiro.

**Andamento (17/11/2026, casca v0.10.0):** a aba "Sincronização" virou **"Para enviar"** (cada mudança com Desfazer, as não aceitas no topo, "Enviar tudo"); a preferência **"Enviar: na hora | quando eu mandar"** (Configurações e passo 7 da tela nova), com o relato de visita sempre na hora e o lembrete depois de um dia; e a tela **"Como o app guarda e envia"** (`#como-funciona`, `js/telas/como_funciona.js`), primeiro item do menu de telas. A fila foi testada no Node (24 casos, 6 novos do "quando eu mandar"); as telas, no Chrome headless a 360px.

**Andamento (17/11/2026, casca v0.9.0):** dois ícones por item (celular e planilha) em Pessoas, Famílias e Visitas, e a folhinha do item (`js/componentes/folha_item.js`). Cada cópia guardada leva `guardado_em`; as de antes ficam com a hora do último "Guardar" da conferência. Conferido no Chrome headless a 360px, sem internet (as mensagens de "sem internet") e com internet e cofre fechado (pede a senha). Falta conferir o Guardar e o Enviar agora com o servidor de verdade.

**Andamento (14/11/2026, casca v0.7.0):**
- Feito: a fila está ligada às telas de pessoas. Cadastrar, editar, mudar papel e desativar vão pela fila. A lista vem da store `pessoas` com a fila por cima, e cada cartão mostra o ícone de estado. Nos detalhes aparecem a situação do envio e, quando o item é recusado, as opções Tentar de novo e Descartar. A tela `#pessoas/tmp-…` passa para o id definitivo assim que o servidor confirma. "Sincronizar agora" envia a fila. Ao sair com itens na fila, o app tenta enviar e, se não conseguir, pergunta (por enquanto com o `confirm` do navegador). A lógica da fila foi testada no Node, com banco em memória e servidor falso (18 casos).
- Feito: o botão Nuvem na barra inferior (Menu | Nuvem | Falar | Sair), com os cinco estados da tabela, e a aba Sincronização (`js/componentes/painel_sync.js`). A aba mostra os recusados (Tentar de novo, Abrir, Descartar), o que falta enviar (agrupado por tipo e por conferência, com o tamanho) e a última sincronização. Tocar no Nuvem abre a aba e envia. Nos dados móveis com "só Wi-Fi", o app pergunta antes. "Sincronizar agora" envia e baixa a lista de novo. O item "Sincronização" saiu do menu ⋮. Para caber o quarto botão, o espaço entre os botões da barra caiu de 2rem para 1,25rem. Conferido no Chrome headless a 360px, com itens de exemplo na fila.
- Feito: dados para usar sem internet, cifrados com a senha do login (`js/core/cofre.js`, `js/telas/pessoa_dados.js`, store `detalhes`, banco v3). O cofre foi testado no Node (17 casos: senha certa, errada, trocada e Sair).
- Falta: o "Corrigir" dos recusados (abrir o formulário com os dados guardados; por enquanto "Abrir" leva à pessoa) e medir quanto tempo o script leva para baixar e decifrar uma conferência inteira.

---

## Objetivo
O app é usado em campo, muitas vezes sem internet. Tudo o que o vicentino grava fica primeiro no celular e vai para a planilha da conferência quando houver conexão. Esta tela e os ícones nas listas mostram, sem ambiguidade, **se o servidor já tem cada dado**.

## Quem vê
Todos os que entraram numa conferência. Cada um vê só a própria fila (o que foi gravado neste celular).

## Estados de cada item

Cada item das listas (Pessoas, Famílias, Visitas) leva **dois ícones lado a lado** (17/11/2026), cada um responde a uma pergunta. A cor só reforça. Cada estado tem um desenho próprio, para quem não distingue amarelo de verde (WCAG 1.4.1).

**Banco de dados: o celular. "Dá para abrir sem internet?"**

| Estado | Ícone | Cor | Quando |
| :--- | :--- | :--- | :--- |
| Guardado no celular | banco de dados (`database`) | verde | Os detalhes estão cifrados no celular (stores `detalhes` e `detalhes_familias`), com a hora em `guardado_em` |
| Não guardado | banco de dados riscado | cinza | Sem a cópia: sem internet, o item não abre |

**Nuvem: a planilha. "A planilha já tem a minha versão deste item?"**

| Estado | Ícone | Cor | Quando |
| :--- | :--- | :--- | :--- |
| Falta enviar | contorno de nuvem com seta parada | azul | Gravado no IndexedDB, esperando na fila. Até 16/11/2026 era o banco de dados; mudou para o banco ter um sentido só |
| Enviando | nuvem com seta subindo, animada | amarelo | Pedido em andamento |
| Enviado, sem confirmação | nuvem com relógio | amarelo | A conexão caiu ou o tempo acabou depois do envio. O app reenvia sem risco de duplicar (ver Decisões) |
| Confirmado | nuvem com ✓ (`cloud_done`) | verde | O script respondeu `success`, ou o item veio da planilha e não foi mexido neste celular |
| Recusado | nuvem com ! | vermelho | O servidor recusou (sem permissão, e-mail já usado, registro desativado). Precisa de alguém |

- **Tocar no par de ícones abre a folhinha do item** (`js/componentes/folha_item.js`), sem agir sozinho: em campo, um toque sem querer é comum, e o resto do cartão abre o item. A folhinha mostra os dois lados e uma ação para cada um:
  - **No celular:** "Guardado no celular hoje às 14:32" com **Atualizar**, ou "Não guardado" com **Guardar no celular**. Precisa de internet e da senha (se o cofre está fechado, a folhinha pede). O item que ainda não chegou à planilha (id `tmp-`) só pode ser guardado depois.
  - **Na planilha:** "Falta enviar" ou "sem confirmação" com **Enviar agora** (a fila vai em ordem: o que foi gravado antes vai junto, e assim a visita não chega antes da família cadastrada sem internet); "Recusado: motivo" com **Tentar de novo**.
  - **Abrir** e **Fechar** embaixo.
- **Nas listas, todo item leva os dois ícones**, inclusive o confirmado e o guardado. Antes de sair para uma visita, o banco verde em cada família é o que tranquiliza. Depois de uma visita são no máximo uns 15 itens para enviar, e a nuvem com ✓ em cada um mostra que o dado foi enviado e recebido: não precisa de atenção. O que não está com ✓ verde se destaca sozinho.
- **Botão Nuvem na barra inferior**, entre Menu e Falar (**Menu | Nuvem | Falar | Sair**; o modo canhoto espelha a ordem). É ele que diz se dá para fechar o app tranquilo. Ícone e rótulo mudam com a situação:

  | Situação | Ícone | Rótulo | Pulsa? |
  | :--- | :--- | :--- | :--- |
  | Tudo enviado | nuvem com ✓ verde | Enviado | Não |
  | Itens guardados, sem internet | banco de dados com o número | Enviar 3 | Não: não há o que fazer |
  | Enviando | nuvem com seta subindo (animada) | Enviando | Animação de envio |
  | Itens guardados **com** internet, mas não foram (falha, sessão vencida) | banco de dados com o número | Enviar 3 | **Sim:** toque para enviar |
  | Algum item recusado | nuvem com ! vermelha | Ver erro | **Sim:** precisa de alguém |

  Tocar abre esta aba e, se houver internet, já começa a enviar. Com "Reduzir animações", nada pulsa (o ícone e o rótulo bastam).
- **Leitor de tela e modo Ouvir:** cada ícone tem texto ("Guardado no celular, falta enviar", "Enviado, esperando confirmação", "Recusado: <motivo>").
- **Buscando e enviando:** nuvem com seta descendo ou subindo no card vermelho (feito em 14/11/2026, casca v0.6.2).

## O que mostra e o que faz
- **Conexão:** a rede de agora (já existe).
- **Para enviar:** quantos itens e quanto ocupam no celular ("3 itens para enviar · 12 KB"), a fila agrupada ("2 cadastros, 1 edição") e o ícone de cada item. Tocar num item abre o registro. O tamanho é o dos pedidos guardados na fila (o que vai pela internet), não do banco inteiro.
- **Recusados:** cada um com a mensagem do servidor e duas saídas: **Corrigir** (abre o formulário com os dados guardados) ou **Descartar** (pede confirmação; apaga do celular).
- **Última sincronização:** "Enviado hoje às 14:32 · Lista baixada hoje às 08:10".
- **Botão "Sincronizar agora":** envia a fila e depois baixa as listas. Respeita "Sincronizar só em Wi-Fi".
- **Ao sair da conta com a fila cheia:** aviso "Há 3 itens que ainda não foram enviados. Se sair agora, eles se perdem." com **Enviar e sair** e **Sair mesmo assim**.

## Dados
| De onde | O quê |
| :--- | :--- |
| IndexedDB, store `fila` (nova) | Uma operação por registro: `id_operacao`, `conferencia`, `acao`, `pedido`, `estado`, `tentativas`, `ultimo_erro`, `criado_em`, `enviado_em` |
| IndexedDB, stores dos dados | Cada registro gravado offline leva `_sync: {estado, id_operacao}` para as listas desenharem o ícone |
| Script do CC: `lote` | Envio da fila, até 50 operações por pedido |
| Planilha: aba `_ids_provisorios` (nova) | `temp_uuid`, `id_gerado`, `aba`, `criado_em`: a troca de ids provisórios que vale entre um envio e outro |

## Offline
Cadastrar, ver, editar, mudar papel e desativar funcionam sem internet e entram na fila. Continua exigindo internet o que depende da resposta do servidor na hora: entrar, primeiro acesso, "esqueci a senha", importar planilha e baixar a lista atualizada.

**Dados guardados para usar sem internet (decisão de 14/11/2026, revê a de "sem contatos no celular"):**
- Ao entrar, o app baixa os detalhes de todas as pessoas ativas da conferência (contatos e endereço só para quem tem `CONTATOS_VER`) e guarda **cifrados** na store `detalhes`. Respeita "só Wi-Fi".
- **A chave sai da senha do login** (PBKDF2-SHA-256, 600 mil rodadas, sal da conferência) e embrulha a chave dos dados (AES-256-GCM). A senha não é guardada. Depois que a senha é digitada (login, desbloqueio ou "Atualizar"), **a chave dos dados fica lembrada por 12 horas**, mesmo se o app fechar (decisão de 14/11/2026): fica no IndexedDB como uma `CryptoKey` que não pode ser exportada. Passado o prazo, ou no Sair, é esquecida (`js/core/cofre.js`).
- **Sem internet, depois das 12 horas**, ao abrir os detalhes, o app pede a senha de novo, com o botão de mostrar a senha. Senha errada não abre nada.
- **Com internet e o cofre aberto**, os detalhes abrem direto da cópia guardada, sem esperar o servidor (decisão de 14/11/2026). Sem cópia ou com o cofre fechado, vêm do servidor e a cópia daquela pessoa é atualizada.
- **Só o que mudou:** a lista e a cópia perguntam ao servidor as linhas alteradas desde a última vez (`listar` com `desde`, sobre `atualizado_em`, com 2 minutos de folga). Se nada mudou, nada é baixado nem decifrado. Até 15 pessoas mudadas, o app busca só elas; acima disso, baixa tudo. A lista confere ao abrir, depois de cada envio aceito e no "Sincronizar agora"; os detalhes conferem ao abrir uma pessoa, no máximo uma vez por minuto.
- **O botão de atualizar da lista baixa tudo**, a lista e a cópia. É o jeito de pegar o que foi mudado à mão na planilha, que não marca `atualizado_em`: as planilhas das conferências não têm gatilho.
- **Na lista:** "Para usar sem internet: dados de 12/11 às 10:00 · Atualizar" (ou "Guardar", se ainda não há cópia). Tocar pede a senha, que é conferida no servidor, e baixa tudo de novo. A cópia também se atualiza sozinha sempre que a senha é digitada (login ou desbloqueio).
- **Senha trocada** ("esqueci a senha"): o cofre antigo não abre com a nova, então é refeito e a cópia é baixada de novo.
- **Sair** e a sessão vencida apagam o cofre e a cópia da conferência.
- Continuam sem cifra: a lista de pessoas (nome de exibição, papel, cargo), para abrir o app sem senha, e a fila de envio, que precisa sair sozinha quando a internet volta e é apagada ao ser confirmada.
- Cada mudança feita sem internet também atualiza a cópia guardada (registros novos com o id provisório), para a pessoa aparecer certa se for aberta de novo antes do envio.

## Como a fila envia
1. Gravar = guardar no IndexedDB + pôr na fila. **O mesmo caminho com ou sem internet:** com internet, o envio começa na hora, e o ícone passa de "só no celular" a "confirmado" em segundos.
2. A fila envia **em ordem**, em lotes de até 50, com a sessão da conferência do item. Um item só sai da fila quando o servidor confirma.
3. A resposta traz `temp_uuid → id_gerado`. O app troca o id no IndexedDB, nas operações que ainda estão na fila e no `#hash` da tela aberta (`#pessoas/tmp-…` vira `#pessoas/PES-…`).
4. Falha de rede ou tempo esgotado: o item fica "enviado, sem confirmação" e volta na próxima tentativa. Recusa do servidor: o item fica "recusado" e **não trava** os seguintes, salvo os que dependem dele (mesmo `temp_uuid`).
5. Sessão vencida (30 dias) com fila cheia: a fila espera, e a aba pede para entrar de novo.

## Mudanças no script do CC
Cada CC tem o seu Apps Script: as mudanças só valem depois de atualizar o script de cada CC.

1. **Aba `_ids_provisorios`** criada pelo script na primeira vez.
2. **`inserir_` não duplica:** antes de gravar, procura o `temp_uuid` na aba. Se já existe, devolve o `id_gerado` guardado sem gravar de novo. Se não existe, grava a linha e registra a troca.
3. **`trocarProvisorios` do `lote_`** procura também na aba quando o id provisório não foi criado no próprio lote (fila dividida em mais de um lote).
4. **`cadastrar_pessoa` e `cadastrar_socorrido` dentro do `lote`:** hoje o lote só aceita `inserir`, `atualizar` e `desativar`. Com o `temp_uuid`, eles também passam a não duplicar.
5. `atualizar_` e `desativar_` já gravam o mesmo resultado se repetidos (campos com o mesmo valor), então não precisam da aba. Conferido em 14/11/2026: `desativar_` de um registro já desativado não dá erro, só grava `ativa = NÃO` de novo.

## Decisões
| Data | Decisão | Origem |
| :--- | :--- | :--- |
| 30/10/2026 | Offline, o app cria um `temp_uuid`; na sincronização, o script devolve o id definitivo e o app troca as referências | `ids_e_numeracao.md` §5 |
| 14/11/2026 | **Ícones de buscar e enviar:** nuvem com seta descendo ou subindo no lugar da seta girando | chat de 14/11/2026; casca v0.6.2 |
| 14/11/2026 | **Ícone por item:** banco de dados (só no celular), nuvem amarela (enviando ou sem confirmação), nuvem verde (confirmado), nuvem vermelha (recusado). Desenho diferente em cada estado, cor como reforço | chat de 14/11/2026 |
| 14/11/2026 | **Todo item mostra o ícone, inclusive o confirmado** (nuvem verde com ✓). Depois de uma visita são no máximo uns 15 itens; o ✓ em cada um diz que não precisa de atenção | chat de 14/11/2026 |
| 14/11/2026 | **Ids offline: o servidor troca.** Id provisório `tmp-<uuid>` no celular; o script numera e devolve o definitivo. Volume esperado: menos de 100 cadastros offline por vez | chat de 14/11/2026 |
| 14/11/2026 | **A troca fica gravada na planilha** (aba `_ids_provisorios`): vale entre lotes e impede duplicar quando o celular reenvia | chat de 14/11/2026 |
| 14/11/2026 | **Um caminho só para gravar:** sempre pela fila, com ou sem internet | chat de 14/11/2026 |
| 17/11/2026 | **Dois ícones por item: banco de dados (o celular) e nuvem (a planilha).** O banco responde "dá para abrir sem internet?" (verde, guardado; riscado, não guardado); a nuvem, "a planilha já tem a minha versão?". O "falta enviar" deixa de ser o banco e vira contorno de nuvem com seta parada, para o banco ter um sentido só | chat de 17/11/2026 |
| 17/11/2026 | **"Enviar: na hora \| quando eu mandar"** (preferência `envio`, padrão na hora). Para editar várias coisas em casa, conferir e enviar de uma vez. No "quando eu mandar", o automático leva só o **relato de visita** (a dupla e o presidente precisam ver logo), com o que ele precisa antes (a família cadastrada sem internet); o resto espera o "Enviar tudo". Mudanças paradas há mais de **um dia** fazem o app lembrar ao abrir; o Sair continua avisando | chat de 17/11/2026 |
| 17/11/2026 | **Com mudança sua esperando, qual vale: a sua ou a da planilha.** O bloco "Você mudou e ainda não enviou" mostra só os campos que você mudou, lado a lado ("No celular" e "Na planilha agora", buscado com internet; os cifrados só para quem vê contatos), e dois botões: **Enviar a minha** e **Ficar com a da planilha** (pede confirmação, desfaz a sua no celular com as que dependem dela e baixa a versão da planilha). Cadastro feito no celular: Enviar ou Desfazer o cadastro. Não aceita: Tentar de novo ou Ficar com a da planilha. Na folhinha do item e nos detalhes da pessoa e da família. O "Atualizar" do lado do celular sozinho não resolvia: a sua mudança continuava na fila e ia por cima da planilha | chat de 17/11/2026 |
| 17/11/2026 | **Quem mudou depois de você, pelo nome de exibição** (os vicentinos da conferência se conhecem). O script grava `atualizado_por` (id de quem entrou no app) em toda gravação: modelo v7, script 0.5.0. O app mostra "⚠ Maria Lima mudou na planilha depois de você (hoje às 15:02)"; sem o nome (mudança direto na planilha ou de antes desta versão), "Mudado na planilha depois de você"; o próprio, "A planilha já tem uma mudança sua"; quem saiu da lista, "Alguém da conferência". Vale para a ficha inteira, não campo a campo | chat de 17/11/2026 |
| 17/11/2026 | **A última ação das Opções (Pessoas e Famílias) muda com a fila:** com mudanças esperando nesta conferência, **"Sincronizar"** com fundo azul e o número ao lado (envia e busca a lista inteira de novo); sem nenhuma, **"Atualizar a lista"**, sem destaque (só busca, pegando também o que foi mudado à mão na planilha) | chat de 17/11/2026 |
| 17/11/2026 | **Filtros das Opções com mudanças esperando ganham destaque:** borda azul e um selo com a nuvem de "falta enviar" no canto de cima. Sem o número ao lado (cortaria o nome do filtro); o leitor de tela diz quantas | chat de 17/11/2026 |
| 17/11/2026 | **A aba Sincronização vira "Para enviar", mais enxuta:** cada mudança numa linha com **Desfazer**; as não aceitas no topo, com o motivo; o botão **Enviar tudo (N)**; "Tudo enviado hoje às 14:32" quando não há nada. Saem o tamanho em KB, o resumo por tipo e o cartão de Conexão. Fica porque os ícones das listas não mostram tudo num lugar só, nem o que não tem cartão (visita, auxílio), nem as outras conferências | chat de 17/11/2026 |
| 17/11/2026 | **Tela "Como o app guarda e envia" (`#como-funciona`), primeiro item do menu de telas**, para ver e rever sempre. Abre sozinha uma vez (na primeira entrada, e para quem já usava o app). Uma página rolando, com Ouvir e sete passos com os desenhos do app; o passo 7 é a escolha de envio. Links "O que são esses ícones?" no "Para enviar" e na folhinha do item. O vermelho é "não foi aceito: precisa de você", sem a palavra "erro" | chat de 17/11/2026 |
| 17/11/2026 | **O toque no par de ícones abre a folhinha do item, sem agir sozinho:** Guardar ou Atualizar no celular, Enviar agora ou Tentar de novo na planilha. "Enviar agora" envia a fila em ordem (o que veio antes vai junto) | chat de 17/11/2026 |
| 14/11/2026 | **Botão Nuvem na barra inferior, entre Menu e Falar.** Nuvem e não o logo do Google Drive (marca do Google; o vicentino acharia que abre o Drive dele; mesmo desenho dos ícones dos itens). Longe do Sair, para o botão que pulsa não ficar ao lado do que pode fazer perder dados. Pulsa só quando dá para agir (há internet e algo não foi) ou quando há item recusado: sem internet, mostra o número parado | chat de 14/11/2026 |
| 14/11/2026 | **Conflito: o último que chegar vale**, campo a campo. O app manda só os campos alterados (já é assim hoje), então duas pessoas mexendo em campos diferentes não se atrapalham | chat de 14/11/2026 |
| 14/11/2026 | **Envio automático** ao abrir o app, ao voltar a internet (evento `online`) e logo depois de gravar. Sem envio em segundo plano (o iOS não permite). **Com "Sincronizar só em Wi-Fi" ligado, nos dados móveis não envia sozinho** (ex.: abriu o app na rua, voltando da visita): o botão Nuvem mostra "Enviar 3" parado, sem pulsar. Onde o navegador não informa o tipo de rede (iPhone), não bloqueia (decisão de 10/11/2026 em `00_casca.md`) | chat de 14/11/2026 |
| 14/11/2026 | **Na 1.0, a fila leva só pessoas:** cadastrar, editar, desativar e mudar papel (inclui criar a família do assistido). Famílias e visitas entram com as telas delas (1.1) | chat de 14/11/2026 |
| 14/11/2026 | **Dados da fila apagados depois de sincronizados:** ficam em claro no celular até o envio (o app nunca cifra) e saem da fila assim que o servidor confirma. O registro continua na lista guardada, como os que vieram da planilha. Sair da conta com a fila cheia pede confirmação | chat de 14/11/2026 |
| 14/11/2026 | **Aba `_ids_provisorios` é limpa** depois de um prazo (proposto: 90 dias) | chat de 14/11/2026 |
| 14/11/2026 | **Cada vicentino vê só as filas das conferências de que faz parte**, separadas por conferência | chat de 14/11/2026 |
| 14/11/2026 | **O item "Sincronização" sai do menu ⋮** quando o botão Nuvem entrar | chat de 14/11/2026 |
| 14/11/2026 | **"Só Wi-Fi" e toque no botão Nuvem nos dados móveis: perguntar** "Você está nos dados móveis. Enviar mesmo assim?" (Enviar agora / Esperar o Wi-Fi) | chat de 14/11/2026 |
| 14/11/2026 | **Uma store por tela, com o que ela mostra.** Na 1.0, a store `pessoas` (chave: conferência + id) guarda um registro por pessoa, com papéis, cargo e `_sync`, no lugar do pacote `pessoas_lista:<conferência>` da store `config` | chat de 14/11/2026 |
| 14/11/2026 | **A chave fica lembrada por 12 horas** depois de digitar a senha, mesmo com o app fechado (um dia de visitas). Passado o prazo, ou no Sair, o app esquece e volta a pedir a senha sem internet | chat de 14/11/2026 ("estou logado: por que digitar a senha de novo?") |
| 14/11/2026 | **Dados para usar sem internet, cifrados com a senha do login** (revê a linha seguinte). Ao entrar, os detalhes da conferência ficam cifrados no celular; sem internet, o app pede a senha para abrir. Atualizar pela lista ("Atualizar" pede a senha). Sair apaga. Ver a seção Offline | chat de 14/11/2026 (teste em modo avião: editar um assistido não funcionava) |
| 14/11/2026 | ~~**Sem contatos guardados no celular na 1.0.** Cadastrar, desativar e mudar papel funcionam offline. Editar celular, e-mail e endereço exige internet, porque os detalhes decifrados não ficam no celular (LGPD, `arquitetura.md` §5).~~ Substituída pela linha anterior. O que guardar das famílias continua para a 1.1, com as visitas | chat de 14/11/2026 |

## Pendências
| # | Pergunta |
| :--- | :--- |
| 1 | ~~Aprovar as propostas~~ Aprovadas em 14/11/2026 |
| 2 | ~~Limpar a aba `_ids_provisorios`?~~ **Limpar** (decidido em 14/11/2026). Prazo proposto: 90 dias, bem mais que qualquer celular fica sem internet |
| 3 | Conflito mais forte depois da 1.0: mandar o `atualizado_em` que o celular conhecia e o servidor avisar se outro mudou o mesmo campo no meio? |
| 4 | ~~Fila de várias conferências?~~ Decidido em 14/11/2026: o vicentino vê só as filas das conferências de que faz parte, separadas por conferência |
| 5 | ~~Stores dos dados no IndexedDB?~~ Decidido em 14/11/2026: uma store por tela (ver Decisões) |
| 6 | ~~Item "Sincronização" do menu ⋮?~~ **Sai do menu** (decidido em 14/11/2026), quando o botão Nuvem entrar. A aba continua na gaveta, aberta pelo botão Nuvem |
| 7 | ~~Tocar no botão Nuvem nos dados móveis com "só Wi-Fi"?~~ **Perguntar** (decidido em 14/11/2026): "Você está nos dados móveis. Enviar mesmo assim?" com **Enviar agora** e **Esperar o Wi-Fi**. O "só Wi-Fi" continua valendo para envio e download automáticos |
