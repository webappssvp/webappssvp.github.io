# Registro de Chat - Metodologia de Análise de Eficiência em Promoção Social, Hábitos Angulares e Catálogo de Protocolos no Drive Central

**Data:** 28 de Setembro de 2026  
**Participantes:** Desenvolvedor (Usuário) & Antigravity (AI)

---

## 1. Contexto e Motivação

O objetivo da discussão foi estabelecer as bases metodológicas e arquiteturais para que a Sociedade de São Vicente de Paulo (SSVP) possa **analisar a eficiência de métodos de promoção humana com base em dados concretos**, permitindo que Conferências e Conselhos façam escolhas estratégicas fundamentadas em evidências e possam compartilhar iniciativas de sucesso comprovadas.

### Desafio Central:
Como mensurar o ganho em "qualidade de vida" e "autonomia" das famílias assistidas ao longo do tempo (ex: ciclos de 6 meses), mantendo a coleta leve e viável para vicentinos idosos (60+) no aplicativo móvel, garantindo a conformidade estrita com a LGPD e estruturando um ecossistema de compartilhamento de métodos para toda a rede de Conselhos e Conferências.

---

## 2. As 5 Dimensões do Registro Histórico para Análise de Eficiência

Para analisar e comparar intervenções sociais, definiu-se a necessidade de registrar dados históricos em cinco pilares fundamentais:

1. **Linha de Base (O "Antes" / Ponto de Partida - Mês 0):**
   * Fotografia socioeconômica inicial: renda *per capita*, situação de trabalho dos membros aptos, dependência mensal de cestas básicas.
   * Diagnóstico de vulnerabilidades e saúde inicial (dores, sono, mobilidade, saneamento do lar).
2. **Tipologia do Método / Intervenção:**
   * Classificação padronizada da estratégia adotada (ex: Hábitos de Saúde/Rotina, Fomento ao Trabalho/Microcrédito, Qualificação Profissional, Regularização de Benefícios Públicos, Salubridade Habitacional).
   * Escopo da ação: se direcionada ao lar como um todo (`id_familia`) ou a um membro específico (`id_pessoa`).
3. **Esforço, Custo e Tempo (O Investimento):**
   * Investimento financeiro direto alocado na promoção (equipamentos, taxas, reformas) vs. custo de manutenção emergencial (cestas durante o processo).
   * Carga de acompanhamento vicentino (visitas dedicadas, voluntários envolvidos).
   * *Lead Time*: prazo estimado vs. data de conclusão real.
4. **Linha do Tempo da Execução (Adesão e Obstáculos):**
   * Acompanhamento de frequência e adesão aos micro-hábitos semana a semana.
   * Registro fraterno de obstáculos reais (chuva, falta de condução, doença) e renegociação de estratégias sem sentimento de culpa.
5. **Linha de Chegada e Sustentabilidade Longitudinal (O "Depois" e Longo Prazo):**
   * Desfecho: Promoção alcançada, desistência com causa-raiz ou substituição de estratégia.
   * Deltas ($\Delta$): Variação mensurável de renda, redução permanente na dependência de cestas.
   * Taxa de reincidência aos 6, 12 e 24 meses pós-promoção para verificar a perenidade da autonomia.

---

## 3. Estudo de Caso Prático: Promoção por Hábitos Angulares (*Keystone Habits*)

Analisou-se a viabilidade de aplicar o modelo a hábitos de rotina com custo financeiro zero, fundamentados em ciências comportamentais:

* **Exemplo A — Caminhada Diária de 20 minutos:**
  * Impacto comprovado: Elevação da disposição física, melhora do sono, alívio de dores corporais, reinserção social com vizinhos e redução do consumo de medicamentos para dor.
* **Exemplo B — Refeições sempre no mesmo horário:**
  * Impacto comprovado: Redução do estresse tóxico infantil pela previsibilidade, maior harmonia e diálogo à mesa, e aumento de até 40% na durabilidade da cesta de alimentos da Conferência pelo fim do desperdício desordenado.
* **Exemplo C — Limpeza diária do banheiro:**
  * Impacto comprovado: Resgate da autoestima e da dignidade do lar, eliminação da vergonha em receber visitas e saúde preventiva (redução drástica de infecções, verminoses e diarreias em crianças).

### O Protocolo dos 3 Momentos de Medição:
1. **Mês 0 (Linha de Base):** Check-in de 4 perguntas com escala de 1 a 5 (Disposição, Dores, Sono, Harmonia/Dignidade). Coleta em menos de 2 minutos na visita.
2. **Semanas 1 a 24 (Adesão Contínua):** 1 pergunta rápida de 5 segundos: *"Quantos dias conseguiu cumprir nos últimos 7 dias? (0 a 7)"* e registro de eventuais obstáculos.
3. **Mês 3 e Mês 6 (Checkpoints de Impacto):** Reavaliação das 4 perguntas idênticas para cálculo do delta percentual, checagem de impactos no orçamento/saúde e gravação de depoimento qualitativo por voz da família.

---

## 4. Arquitetura de Governança, Catálogo Central e Privacidade (LGPD)

Para viabilizar a colaboração entre Conselhos sem expor a intimidade das famílias atendidas:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   DRIVE COMPARTILHADO DO WEBAPP (Nível Central / CM)                   │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  📚 CONHECIMENTO PÚBLICO E COMPARTILHADO (Acesso de Leitura para todas as CFs)         │
│                                                                                        │
│  1. Catálogo Oficial de Protocolos (`catalogo_protocolos.sheet`)                       │
│     • Nome do método, passos, categoria, perguntas de impacto do Mês 0/3/6             │
│     • Quem adiciona/edita: Presidentes de CC e Coordenadores de Promoção               │
│                                                                                        │
│  2. Repositório de Evidências e Resultados Agregados (`impacto_geral.sheet`)           │
│     • "Conferência A testou Caminhada com 12 assistidos ➔ +68% disposição"            │
│     • TOTALMENTE ANÔNIMO: Nenhum nome, nenhum CPF, nenhuma intimidade exposta (LGPD)   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ (Conferências consom o catálogo)
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│               COFRES DIGITAIS ISOLADOS DE CADA CONFERÊNCIA (Pastas Privadas)          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  🔒 DADOS PRIVADOS E PROTEGIDOS (Apenas a própria conferência acessa)                  │
│                                                                                        │
│  • Nome da família, endereço, CPF, relatos de visitas, notas individuais              │
│  • O Conselho Central NÃO ENXERGA a intimidade nem os nomes de quem faz cada hábito    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Papéis e Fluxo de Inovação:
* **Presidente de Conselho Central / Coordenador de Promoção:**
  * Possui permissão de escrita e curadoria no `catalogo_protocolos` do Drive Central.
  * Avalia os pilotos bem-sucedidos das conferências e concede o selo de *"Protocolo Homologado/Recomendado pela SSVP"*.
* **Presidentes de Conferência / Vicentinos:**
  * Podem criar protocolos livres em status `piloto_local` para experimentação em suas famílias.
  * No aplicativo de visitas, escolhem protocolos prontos do catálogo com as perguntas de avaliação já pré-configuradas.
* **Segurança e LGPD:**
  * Os dados pessoais permanecem restritos à planilha privada da Conferência.
  * Apenas taxas percentuais, médias consolidadas e aprendizados metodológicos são compartilhados no Drive Central.
