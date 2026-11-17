# Tela: Pessoas (tela inicial)

**Hash:** `#pessoas` (o antigo `#vicentinos` abre esta tela) · **Arquivo na raiz:** `js/telas/pessoas.js` · **Protótipo:** [`testes/app/t2_vicentinos.html`](../../testes/app/t2_vicentinos.html)
**Versão do app:** 1.0 · **Status:** Lista, detalhes, edição, desativação, "Novo socorrido" e "Passar para assistido" prontos (v0.4.0, 11/11/2026); "Mudar papel" pronto (v0.5.0); "+ Nova pessoa" com escolha do papel pronto (v0.6.0, 13/11/2026); fonte única e ajustes de formulário (v0.6.1); tirar cargo a fazer

---

## Objetivo
É a primeira tela depois de entrar. Mostra as pessoas da conferência e deixa cadastrar, editar e desativar conforme o que cada um pode fazer.

## Quem vê o quê

| Quem | Vê | Cadastra | Edita | Desativa |
| :--- | :--- | :--- | :--- | :--- |
| Presidente e vice | Todas as pessoas | Qualquer papel; só eles passam um socorrido para assistido | Qualquer pessoa | Qualquer pessoa |
| Vicentino e aspirante | Todas as pessoas | Só socorridos | Só socorridos e a si mesmo | Ninguém |
| Visitante e benfeitor | Todas as pessoas, só pelo nome de exibição; os dados cifrados chegam sem decifrar (menos os próprios) | Ninguém | Só a si mesmo | Ninguém |

A tela não decide pelo cargo. Ela usa a lista `permissoes` que o servidor manda no login, e o servidor confere cada pedido de novo. Se o presidente mudar a aba `permissoes` da planilha, o app segue a mudança sem mexer em código.

## O que mostra e o que faz
- **Topo:** busca por nome e filtros por papel: Todos · Vicentinos · Aspirantes · Assistidos · Socorridos · Visitantes · Benfeitores. Para o visitante e o benfeitor, o cartão mostra só o nome de exibição, sem contatos.
- **Cartão por pessoa:** iniciais, `nome_exibicao`, papel e cargo da diretoria (o cargo provisório do Art. 169 aparece indicado). A diretoria vem em destaque e as pessoas fictícias levam a marca **EXEMPLO**.
- **Toque no cartão:** abre os detalhes. Editar e Desativar só aparecem para quem tem a permissão para o papel daquela pessoa.
- **Botão "+ Nova pessoa"** (no alto da lista):
  - presidente e vice escolhem primeiro o papel da pessoa nova (qualquer papel);
  - o vicentino vai direto para **"Novo socorrido"** (só pode cadastrar socorridos).
- **Socorrido → assistido:** nos detalhes de um socorrido, o presidente e o vice veem o botão **"Passar para assistido"**. O papel muda: o SOC termina (`data_termino`, motivo "Passou para assistido") e começa o AST, num lote só. O assistido pertence a uma família, então esse passo cria a família ou liga a pessoa a uma família já existente.
- **Formulário:** nome, celular e endereço. Para membros (vicentino, aspirante, visitante, benfeitor), também o e-mail, com o qual a pessoa entra no app. Para assistidos e socorridos, o endereço é o da família (com ponto de referência).
- Ações rápidas de ligar e mandar mensagem, e voz ao tocar (decisões de 22/09/2026).

## Dados
| De onde | O quê |
| :--- | :--- |
| Login (`entrar`, `criar_senha`) | `perfil.papeis`, `perfil.cargos`, `perfil.permissoes` |
| Script do CC: `listar` | Abas `pessoas`, `pessoas_papeis`, `pessoas_cargos`, `pessoas_telefones` |
| Script do CC: `cadastrar_pessoa`, `atualizar`, `desativar` | Cadastro (pessoa e papel juntos), edição e encerramento |
| IndexedDB | Cópia da lista na store `config`, chave `pessoas_lista:<conferência>` (só id, nome de exibição, papéis, cargo e marca de fictício). Passa para uma store própria quando as stores dos dados forem definidas (`arquitetura.md` §5) |

## Offline
Mostra a última cópia guardada, com a data da última atualização. Atualizar a lista (ou Sincronizar, quando há mudanças esperando; nas Opções) exige internet. O cadastro sem internet fica para a fila de sincronização (1.1).

## Decisões
| Data | Decisão | Origem |
| :--- | :--- | :--- |
| 22/09/2026 | Cartões com letra confortável (60+), voz ao tocar, ações rápidas de ligar e mensagem, botão de atualizar | `definicao_views.md` §3 |
| 28/10/2026 | `nome_exibicao` fica aberto; nome completo, e-mail, celular e CPF são cifrados (decifrados pelo script ao listar) | `decisoes.md` |
| 30/10/2026 | Pessoas fictícias aparecem com a marca EXEMPLO e somem na primeira família real | `dados_ficticios.md` §3 e §4 |
| 05/11/2026 | Pessoa nova só entra junto com o papel (`cadastrar_pessoa`) | `decisoes.md` |
| 06/11/2026 | Vários telefones por pessoa (`pessoas_telefones`), com tipo, WhatsApp e principal | `decisoes.md` (Modelo v2) |
| 06/11/2026 | Estado civil, profissão e escolaridade não entram (LGPD: o app não usa) | `decisoes.md` (Modelo v2) |
| 11/11/2026 | **A tela inicial é "Pessoas"** (todas as pessoas da conferência, com filtro por papel), no lugar de "Vicentinos" | chat de 11/11/2026 |
| 11/11/2026 | **Presidente e vice** veem, cadastram, editam e desativam pessoas de qualquer papel (vice igual ao presidente, como no padrão) | chat de 11/11/2026 |
| 11/11/2026 | **Vicentino** vê todas as pessoas, cadastra e edita só socorridos e **não desativa** ninguém | chat de 11/11/2026 |
| 11/11/2026 | **Toda pessoa atendida entra como socorrida**, por qualquer vicentino. Só o presidente e o vice passam de socorrido para assistido | chat de 11/11/2026 |
| 11/11/2026 | ~~Visitante e benfeitor veem só os membros~~ **Alterada no mesmo dia:** veem o nome de exibição de todos, inclusive assistidos e socorridos; os dados cifrados chegam sem decifrar (já é o padrão: eles não têm `CONTATOS_VER`) | chat de 11/11/2026 |
| 11/11/2026 | **Socorrido → assistido: o papel muda.** O SOC termina e o AST começa | chat de 11/11/2026 |
| 11/11/2026 | **"Novo socorrido" pede nome, celular e endereço** | chat de 11/11/2026 |
| 11/11/2026 | **Cada um edita os próprios dados** (nome, celular, e-mail e endereço) e os vê decifrados, mesmo sem `CONTATOS_VER`. Não muda os próprios papéis e cargos nem se desativa. Na lista, o próprio cartão tem o selo **Você** , fica em destaque (borda e fundo verdes) e sempre no topo da lista | chat de 11/11/2026; script 0.3.8, app v0.4.3 |
| 11/11/2026 | **Salvar a edição volta para a lista**, com o aviso "Dados de <nome> salvos." no pé da tela (desativar também volta, com aviso). Se o servidor recusar, fica no formulário com o erro | chat de 11/11/2026; app v0.4.5 |
| 11/11/2026 | **Presidente e vice mudam o papel de qualquer pessoa** (botão "Mudar papel" nos detalhes; ex.: benfeitor → vicentino, vicentino → assistido). O papel de hoje termina (motivo "Passou para <novo>") e o novo começa hoje. Para assistido ou socorrido: a família passa a ter esse status ou é criada (a pessoa como titular), e o endereço pessoal vai para a família. De assistido ou socorrido para membro: o endereço da família é copiado como pessoal; a família fica como está. Quem tem cargo só pode ser vicentino (o app pede para tirar o cargo antes). "Passar para assistido" virou atalho do mesmo formulário | chat de 11/11/2026; app v0.5.0 |
| 11/11/2026 | **Ninguém muda o próprio papel nem se desativa**, nem o presidente (ficaria trancado fora). O servidor também recusa | script 0.3.9 |
| 11/11/2026 | **Na passagem para assistido, a família também muda de SOC para AST** (direto, sem passar por SIN). Quem faz: presidente e vice | chat de 11/11/2026 |
| 11/11/2026 | Ação `PESSOAS_DESATIVAR` (presidente e vice) no script 0.3.5: desativar pessoa ou encerrar papel, também pelo `atualizar` de `ativa`/`data_termino`. Testado no simulador, inclusive a passagem de socorrido para assistido | `Permissoes.gs` |
| 13/11/2026 | **Botão de atualizar com fundo vermelho enquanto a seta gira** (sincronizando); volta ao normal ao terminar. Com as animações desligadas, a seta para, mas o vermelho continua | chat de 13/11/2026 |
| 13/11/2026 | **Nome de exibição no cadastro:** campo próprio, logo abaixo do nome completo, preenchido sozinho enquanto se digita o nome. Sugestão: só o primeiro nome, se ninguém na conferência começa com ele ("Ana Lúcia" → "Ana"); senão, primeiro + último. Quem cadastra pode trocar; um aviso (sem impedir) aparece se o nome já existir. Sem a lista carregada, primeiro + último | chat de 13/11/2026; script 0.3.10 |

## Feito na v0.2.0 do app (11/11/2026)
- Lista com três `listar` em paralelo (`pessoas`, `pessoas_papeis`, `pessoas_cargos`, só ativos), sem pedir nada decifrado.
- Diretoria primeiro (presidente, vice, secretário, tesoureiro), depois por nome.
- Busca sem acento e filtros por papel que mostram só os papéis presentes, com a contagem.
- Cartão com iniciais (cor por papel), nome, papéis, cargo (provisório indicado) e EXEMPLO.
- Abre com a cópia guardada e atualiza em seguida; sem internet, avisa e mostra a cópia com a data.
- Testado no navegador automatizado com respostas simuladas do CC (lista, filtro, busca, sem internet).
- v0.2.1: `chamarComSessao` passou a mandar o `id_conferencia` (sem ele o script recusava o token: "Sua sessão terminou"). Se o script recusar a sessão de verdade, o app esquece o token e abre o painel para entrar de novo.

## Feito na v0.3.0 do app (11/11/2026)
- **Detalhes** em `#pessoas/<id_pessoa>`, com o botão **Voltar para pessoas** no alto (o Voltar do celular também volta para a lista): papéis, cargo, nome completo, celular (toque liga), e-mail e endereço. Contatos e endereço abertos só para quem tem `CONTATOS_VER` (no padrão, desde 14/11/2026, também o aspirante); os outros (visitante, benfeitor) veem os mesmos campos com um texto de exemplo cifrado no navegador (AES-256-GCM do Web Crypto, chave descartável da sessão), só como ilustração, e um cartão explicando a LGPD (12/11/2026). O script não manda nada cifrado.
- **Endereço:** membros em `pessoas_enderecos`; assistidos e socorridos no endereço atual da família (`familias_pessoas` → `familias_enderecos`, com ponto de referência).
- **Editar** (mesma regra do servidor: a ação de cadastro de cada papel da pessoa): nome de exibição, nome completo, celular, e-mail e endereço. Vai **só o que mudou**, num `lote`. Quem não tem `CONTATOS_VER` só edita o nome de exibição (os campos cifrados não aparecem, para não serem apagados).
- **Desativar** (presidente e vice): pede o motivo, grava `ativa = NÃO` e volta para a lista atualizada.
- Testado no navegador automatizado com respostas simuladas: presidente edita e desativa; vicentino edita socorrido, não desativa e não edita vicentino.

## Feito na v0.4.0 do app (11/11/2026)
- **"+ Novo socorrido"** na lista (para quem tem `SOCORRIDOS_CADASTRAR`), em `#pessoas/novo`: nome completo, celular e endereço (UF já vem SP). Usa a ação `cadastrar_socorrido` do script: pessoa SOC (nome de exibição = primeiro + último nome), família SOC de uma pessoa (ela como titular, `id_vinculo` TIT) e o endereço na família, num pedido só. Depois abre os detalhes da pessoa nova.
- **"Passar para assistido"** nos detalhes de um socorrido (só presidente e vice): num `lote`, encerra o papel SOC (motivo "Passou para assistido"), começa o AST e muda a família para AST. Se a pessoa não tiver família, cria uma (AST, ela como titular). Se o lote gravar só uma parte, o app recarrega e avisa.
- Testado no navegador automatizado com respostas simuladas: cadastro, detalhes do novo socorrido, passagem para assistido e lista.

## Feito na v0.6.0 do app (13/11/2026)
- O botão da lista passou a ser **"+ Nova pessoa"** e aparece para quem pode cadastrar algum papel. Os papéis oferecidos vêm das permissões do login: `SOCORRIDOS_CADASTRAR` → socorrido; `ASSISTIDOS_CADASTRAR` → assistido; `VICENTINOS_CADASTRAR` → vicentino, aspirante, visitante e benfeitor. Com um papel só (o vicentino, no padrão), a tela continua sendo "Novo socorrido", sem a escolha.
- **Socorrido:** `cadastrar_socorrido`, como antes.
- **Membro:** `cadastrar_pessoa` com o papel, nome de exibição (primeiro + último nome), celular, e-mail e o endereço pessoal (`pessoas_enderecos`, sem ponto de referência).
- **Assistido:** `cadastrar_pessoa` (AST) e, em seguida, um `lote` com a família (status AST, a pessoa como titular) e o endereço da família. Se a família falhar, a pessoa já está gravada: o app avisa, trava o botão (para não cadastrar duas vezes) e indica o "Mudar papel" para criar a família.
- Testado no Chrome headless com a conexão simulada (vicentino, presidente com cada papel, e-mail inválido, falha na família) e no simulador do script (presidente cadastra aspirante e assistido com a família; vicentino recusado para vicentino, assistido e benfeitor). O servidor não mudou.

## Feito na v0.6.1 do app (13/11/2026)
- **Só Montserrat** em todo o app (sai a Garamond dos títulos e do nome da conferência); destaque sempre em bold (700).
- Botão de atualizar com **fundo vermelho enquanto a seta gira**.
- **Nome de exibição** no formulário de nova pessoa, com sugestão (só o primeiro nome, se for único na conferência) e aviso de nome repetido. O `cadastrar_socorrido` passou a aceitar o nome informado (script 0.3.10).
- Mensagens de espera ("Buscando as pessoas da conferência", "Buscando os dados", "Salvando", "Cadastrando", "Mudando", "Desativando") com o card da seta girando no lugar das reticências.
- Formulários de nova pessoa e de edição com `autocomplete="off"` em todos os campos, para o Chrome não abrir os dados salvos do aparelho no lugar do teclado.

## Mudanças no script do CC
1. **Feito (0.3.5):** `PESSOAS_DESATIVAR` separa desativar de editar.
4. **Feito (0.3.7):** ação `cadastrar_socorrido` (exige `SOCORRIDOS_CADASTRAR`).
3. **Feito (0.3.6):** `listar` aceita `filtros.id_pessoa` e `filtros.id_familia` (os detalhes decifram só o endereço daquela pessoa) e o e-mail repetido é recusado (`EMAIL_EM_USO`) ao cadastrar e editar pelo app. Falta conferir e-mails repetidos na importação.
2. **Não é preciso filtrar** o `listar` para visitantes e benfeitores: sem `CONTATOS_VER`, eles já recebem só os dados abertos e os cifrados sem decifrar.

## Pendências
| # | Pergunta |
| :--- | :--- |
| 1 | Ordem da lista: diretoria primeiro e depois por nome? |
| 2 | Mostrar ao presidente quem já tem acesso ao app (conta ativa, convite enviado)? |
| 3 | Cadastro e edição já no MVP, ou primeiro só a lista? |
