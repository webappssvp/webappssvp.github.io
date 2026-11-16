# Registro de Chat - Metodologia de Micro-hábitos, Superação Fraterna de Barreiras e Schema de Promoção na Planilha

**Data:** 08 de Outubro de 2026  
**Participantes:** Desenvolvedor (Usuário) & Antigravity (AI)  
**Arquivo Atualizado:** `dev_local/schema_planilha_conferencia.json`

---

## 1. Contexto e Motivação Filosófica

O propósito principal da Sociedade de São Vicente de Paulo (SSVP) transcende o socorro emergencial (como a entrega de cestas básicas): visa a **promoção integral da pessoa humana** rumo à dignidade, saúde e autonomia duradoura.

### A Conexão com a Ciência Comportamental (*Small Wins* e *Tiny Habits*):
* **Metas de Saúde:** A Organização Mundial da Saúde (OMS) preconiza 150 minutos semanais de atividade física aeróbica moderada (ex: 30 minutos por dia, 5 vezes por semana).
* **O Desafio da Vulnerabilidade:** Para famílias em vulnerabilidade social, exigir 30 minutos de caminhada na rua gera barreiras impeditivas (falta de vestimenta e calçados adequados, dores crônicas, vergonha social e sensação de incapacidade).
* **A Estratégia dos Micro-hábitos:** Iniciar com micro-passos sem atrito (ex: 5 a 10 minutos de marcha no mesmo lugar, dentro de casa).
* **O Papel dos Prêmios como Ferramenta de Capacitação:** O incentivo vicentino não é mero agrado, mas a alavanca que destrava o próximo degrau:
  * Meta de 1 mês de marcha em casa $\rightarrow$ Prêmio: Tênis de caminhada (habilita caminhar na rua com segurança).
  * Meta de 1 mês de caminhada na rua $\rightarrow$ Prêmio: Bermuda e camiseta dry-fit (proporciona conforto e dignidade para atingir os 30 minutos diários).

---

## 2. Acolhimento Fraterno e Superação de Barreiras (Não-Culpabilização)

Quando uma família assistida não consegue cumprir uma etapa ou meta pontual (ex: ir à consulta médica no posto de saúde):
1. **Origem na Vulnerabilidade Estrutural:** Quase sempre se deve a entraves reais da pobreza (falta de dinheiro para passagem de ônibus, sobrecarga materna sem rede de apoio para deixar as crianças, dores ou burocracia do posto).
2. **Postura Vicentina:** O vicentino atua como mentor e parceiro de resolução fraterna, nunca como fiscal.
3. **Pactuação de Soluções:** Construção conjunta de arranjos sociais (ex: ajuda da vizinha com as crianças) e ativação de auxílios pontuais da conferência (ex: recarga de Bilhete Único / passagem).
4. **Integração Financeira:** O apoio vicentino que envolve custos conecta-se nativamente à tabela contábil de auxílios (`visitas_auxilios`).

---

## 3. Decisão de Nomenclatura em Português

Para garantir a acessibilidade e ergonomia cognitiva dos vicentinos (muitos na faixa 60+), evitou-se estrangeirismos tecnológicos (como *check-in*).

* **Nome Adotado:** `promocao_acompanhamento` (no singular, harmonizando com o vocabulário caritativo e a escuta ativa periódica da conferência).
* **Par de Tabelas de Promoção:**
  1. `promocao_planos`: Define a meta pontual ou a trilha de micro-hábito, degraus e prêmios prometidos.
  2. `promocao_acompanhamento`: Registra o histórico temporal das semanas, dias cumpridos, justificativas, soluções pactuadas e conquistas.

---

## 4. Atualização do Schema da Planilha (`dev_local/schema_planilha_conferencia.json`)

Foram incorporadas duas novas tabelas horizontais de 15 colunas cada ao modelo de dados oficial da conferência:

### 4.1. Tabela `promocao_planos`
1. `id_promocao_plano` (PK)
2. `num_sequencial` (Número de controle na conferência)
3. `id_familia` (FK $\rightarrow$ `familias`)
4. `id_pessoa` (FK $\rightarrow$ `pessoas`)
5. `tipo_acao` (`META_PONTUAL` ou `TRILHA_HABITO`)
6. `categoria` (`SAUDE`, `TRABALHO`, `EDUCACAO`, `CIDADANIA`, `HABITACAO`, `OUTRA`)
7. `titulo`
8. `degrau_atual`
9. `meta_semanal_dias`
10. `premio_prometido`
11. `status_premio` (`NAO_APLICAVEL`, `EM_CONQUISTA`, `LIBERADO`, `ENTREGUE`)
12. `data_inicio`
13. `data_previsao_conclusao`
14. `data_conclusao_real`
15. `status_plano` (`ATIVO`, `CONCLUIDO`, `PAUSADO`, `CANCELADO`)

### 4.2. Tabela `promocao_acompanhamento`
1. `id_promocao_acompanhamento` (PK)
2. `num_sequencial`
3. `id_promocao_plano` (FK $\rightarrow$ `promocao_planos`)
4. `id_visita` (FK $\rightarrow$ `visitas`)
5. `data_acompanhamento`
6. `status_cumprimento` (`CUMPRIDO`, `PARCIAL`, `NAO_CUMPRIDO_COM_JUSTIFICATIVA`, `REPACTUADO`)
7. `dias_cumpridos_semana` (0 a 7 dias)
8. `progresso_acumulado_dias`
9. `categoria_barreira` (`NENHUMA`, `TRANSPORTE_CONDUCAO`, `CUIDADO_DEPENDENTES`, `SAUDE_LIMITACAO_FISICA`, `BUROCRACIA_DOCUMENTAL`, `OUTRO_MOTIVO`)
10. `detalhe_obstaculo`
11. `solucao_pactuada`
12. `apoio_vicentino_tipo` (`NENHUM`, `AUXILIO_TRANSPORTE`, `ACOMPANHAMENTO_PRESENCIAL`, `ARTICULACAO_REDE`, `OUTRO_AUXILIO`)
13. `id_visita_auxilio` (FK $\rightarrow$ `visitas_auxilios`)
14. `atingiu_degrau` (Booleano)
15. `observacao`
