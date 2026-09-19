# Registro de Chat - Refinamento da Versão 1.0 (Famílias, Visitas, Participantes N:N, Mudança Sistêmica, Acompanhamento Fraterno com Metas/Prazos, Identidade Global por CPF, IDs Universais de 14 Chars, Índice Metropolitano, Voz & Cenário de Teste de 4 Semanas)

**Data:** 17 de Setembro de 2026  
**Participantes:** Desenvolvedor (Usuário) & Antigravity (AI)

---

## 1. Contexto e Demanda

O usuário solicitou o refinamento aprofundado do plano de implementação da Versão 1.0 (`dev_local/implement/plano_v1.0_fundacao_e_pessoas.md`), a criação do script automatizado em Google Apps Script para provisionar a planilha matriz canônica e o planejamento da população de dados de teste realistas.

Itens contemplados e consolidados:
1. **O Lar como Unidade Assistida:** Os vicentinos visitam a **família**, que pode ser composta por múltiplas pessoas (titular, cônjuge, filhos, idosos).
2. **Mudança Sistêmica com Acompanhamento Fraterno:**
   * Registro de metas com **prazo estimado** (ex: ir ao posto marcar consulta esta semana).
   * Na visita seguinte, verificação de cumprimento: se não cumprida, registro da **justificativa/obstáculo real** (ex: netos pequenos sozinhos) e cocriação da **solução combinada** (ex: deixar com a vizinha Rosa na terça).
   * Permite avaliar o empenho e a disposição do assistido em superar as barreiras da vulnerabilidade.
3. **Papel do Benfeitor (`bf`):** Apoiador fundamental que contribui com recursos materiais e que pode, esporadicamente, acompanhar uma visita domiciliar.
4. **Visitas Flexíveis e Análise de Participantes (N:N):**
   * Criação da aba relacional dedicada `visitas_participantes` (3NF) para viabilizar o uso nativo de **Tabelas Dinâmicas** no Google Sheets para contagem de assiduidade e frequência de voluntários.
5. **Governança de Identidade e Trajetória Vicentina:**
   * Definição do **CPF como Chave Natural Global Única e Vitalícia**, permitindo agregar todo o histórico de visitas ao longo da vida do voluntário, independentemente de mudanças de conferência, bairro ou estado.
   * Campo `id_pessoa_origem` e status `transferido` na aba `pessoas`.
6. **Dimensionamento Histórico e Taxonomia Universal de IDs (14 Caracteres):**
   * Análise matemática do acúmulo de registros ao longo de décadas: o teto de 2 dígitos estouraria no 4º ano de vida do sistema.
   * Adoção do **Padrão Universal de 14 Caracteres Fixos** com **4 dígitos sequenciais** para todas as entidades (`FM`, `PS`, `VS`, `VP`, `PL`, `HS`), garantindo durabilidade centenária.
7. **Painel Metropolitano Anti-Duplicidade (Nível CM):**
   * Prevenção da "peregrinação assistencial" e desvio de cestas básicas em metrópoles com transporte urbano integrado, permitindo cruzamento inter-centrais sob a jurisdição do Conselho Metropolitano (CM).
8. **Ergonomia por Voz (Acessibilidade 60+):**
   * Preenchimento por voz (Speech-to-Text) com botão universal na barra inferior que dita no campo em foco ativo (`document.activeElement`).
   * Audição por síntese de voz (Text-to-Speech) dos relatos, sonhos e hábitos anteriores para preparação do vicentino a caminho da residência.
9. **Sincronização Offline Sob Demanda (*On-Demand Sync*):** Modelo de ciclo em 3 tempos (Wi-Fi em casa para baixar dados ➔ Campo 100% offline no IndexedDB ➔ Wi-Fi pós-visita para envio com 1 toque).
10. **Cenário de Testes Realista de 4 Semanas:**
    * Script populador automático com 3 voluntários (Confrade Paulo, Consócia Maria, Benfeitor Carlos), 2 lares assistidos (Dona Neuza e Sr. Antônio), 1 socorrida pontual (Dona Joana), 4 visitas semanais em linha do tempo e histórico de superação de metas.

---

## 2. Decisões de Arquitetura e Modelagem

### A. Acompanhamento Fraterno de Metas em `plano_promocao`
* Adição das colunas:
  * `prazo_estimado`: Data acordada para cumprimento.
  * `justificativa_obstaculo`: Dificuldade real encontrada caso a meta não seja cumprida.
  * `solucao_combinada`: Estratégia pactuada entre vicentino e família para a semana seguinte.
  * `data_conclusao`: Data efetiva da vitória/conquista.
* Na visita seguinte, a família comemora a conquista ou renegocia o obstáculo sem sentimento de culpa, promovendo agência e dignidade.

### B. Taxonomia Canônica Universal de IDs (Tamanho Fixo de 14 Caracteres)
* `[CONFERENCIA (8)]` + `[SIGLA (2)]` + `[SEQUENCIAL (4)]`:
  * `FM` (Famílias): `SPSDITICFM0001` a `FM9999`.
  * `PS` (Pessoas): `SPSDITICPS0001` a `PS9999`.
  * `VS` (Visitas): `SPSDITICVS0001` a `VS9999`.
  * `VP` (Participantes da Visita): `SPSDITICVP0001` a `VP9999`.
  * `PL` (Plano de Promoção): `SPSDITICPL0001` a `PL9999`.
  * `HS` (Histórico / Auditoria): `SPSDITICHS0001` a `HS9999`.

### C. População Automatizada do Cenário de 4 Semanas
* Implementada a função `popularCenarioTeste4Semanas()` no Apps Script, que carrega instantaneamente:
  * 2 lares e 8 pessoas com papéis e cargos;
  * 4 visitas cobrindo as últimas 3 semanas (inclusive a presença de um benfeitor);
  * 1 meta médica com obstáculo superado na semana 3 (que será ouvida por voz);
  * 1 micro-hábito em andamento para a visita de hoje.

---

## 3. Arquivos Atualizados e Criados

1. **`dev_local/implement/plano_v1.0_fundacao_e_pessoas.md`:**
   * Atualizado por completo com o modelo de 9 abas, acompanhamento fraterno de metas com prazos e obstáculos, taxonomia de 14 caracteres e painel metropolitano.
2. **`dev_local/gas/gerar_modelo_conferencia.js`:**
   * Script automatizado completo em Google Apps Script para criar ou formatar a planilha modelo com as 9 abas canônicas e função `popularCenarioTeste4Semanas()`.
   * Validado sintaticamente via Node.js (`node -c`), com zero erros.
3. **`js/db.js`:**
   * Atualizado para IndexedDB v3, provisionando os 9 stores canônicos, índices relacionais e a fila de sincronização sob demanda (`fila_sincronizacao`).
   * Adicionada a função `carregarCenarioTesteLocal()` para carregar os dados de exemplo no navegador sem depender de rede.
4. **`js/voz.js`:**
   * Implementado módulo universal de voz com Reconhecimento de Fala (STT em `document.activeElement`) e Síntese de Voz (TTS a 0.95x para ergonomia 60+).
   * Orquestrador da linguagem cromática SSVP: alterna dinamicamente o botão central e o foco entre **Azul SSVP** (Ouvir) e **Vermelho SSVP** (Falar).
   * Controle de teclado virtual com `inputmode="none"` ao focar para voz, e função `alternarTecladoVirtual()` para digitação manual opcional.
   * **Correção de Ditado:** Desativação de `interimResults` e injeção limpa de frase final para eliminar duplicações parciais de fala.
5. **`css/barras.css`:**
   * Substituição completa de botões circulares por botões retangulares ergonômicos com disposição vertical (ícone em cima, texto embaixo com `flex-direction: column`, altura mínima de ~54px, cantos arredondados e borda delimitadora sutil).
   * Animações de pulso suave sincronizado: `.pulso-ouvir-azul` (Azul SSVP) e `.pulso-falar-vermelho` (Vermelho SSVP).
   * Estilização dos botões `.btn-abrir-teclado` para abrir/recolher teclado virtual.
6. **`js/visitas_ui.js`:**
   * Remoção de botões de áudio individuais espalhados pela interface.
   * Cartões de relatos interativos (`[data-leitura="true"]`) com pulso sincronizado em Azul SSVP.
   * Botões `[Teclado]` sóbrios (sem emojis) em cada campo de texto da visita, permitindo digitação manual com os dedos sob demanda sem cobrir a tela na fala por voz.
7. **`js/app.js` & `index.html`:**
   * Integração unificada no ciclo de vida DOM, barra inferior reestruturada com botões retangulares verticais `[ ⚙️ Conexão ]`, `[ 🔊 Ouvir / 🎙️ Falar ]` e `[ ❓ Ajuda ]`, e identificador discreto `v1.0`.
