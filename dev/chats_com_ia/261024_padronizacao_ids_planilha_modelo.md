# Registro de Chat - Padronização Taxonômica de IDs Curtos na Planilha Modelo (Namespaces PPA, PCA, PEN)

**Data:** 24 de Outubro de 2026  
**Participantes:** Desenvolvedor (Usuário) & Antigravity (AI)  
**Documentos Atualizados:** `dev_local/implement/decisoes_api.md` e `testes/crud/privado/decisoes_api.md`

---

## 1. Contexto e Motivação

Durante a atualização da **planilha modelo de conferência**, buscou-se encurtar os identificadores de registros para favorecer a ergonomia visual de voluntários idosos (60+) e a compactação de dados no smartphone, sem perder a capacidade relacional e a rastreabilidade das entidades no ecossistema descentralizado do Google Sheets.

### Proposta Inicial vs. Refinamento de Engenharia:
* **Discussão de Chaves Compostas (`PES_0001_PAP_0001`):**
  * *Pró:* Leitura direta da pessoa titular no próprio ID do papel.
  * *Contras:* Chave longa (17 chars locais, até 32 chars ao consolidar com o código da conferência); quebra o princípio de 3ª Forma Normal (3NF); exige fórmulas complexas no Sheets e parsing por split de strings.
* **Solução Adotada (Namespaces de Domínio com Chaves Ortogonais de 8 Caracteres):**
  * Mantém-se o tamanho estrito de **8 caracteres fixos** (`XXX_0000`).
  * Em vez de misturar a chave da pessoa dentro do ID do papel, adota-se o prefixo de domínio raiz **`P`** para todas as tabelas satélites de pessoas:
    * `PES_0001`: Indivíduo / Pessoa (`pessoas`)
    * `PPA_0001`: Papel da Pessoa (`pessoas_papeis`)
    * `PCA_0001`: Cargo na Diretoria (`pessoas_cargos`)
    * `PEN_0001`: Endereço Residencial do Voluntário/Membro (`pessoas_enderecos`)

---

## 2. Matriz Comparativa Avaliada

| Critério Técnico / Prático | Chave Composta (`PES_0001_PAP_0001`) | Namespacing Taxonômico (`PPA_0001`) [Adotado] |
| :--- | :--- | :--- |
| **Geração via `ARRAYFORMULA`** | Complexa (depende de múltiplas colunas). | **Atômica:** `=ARRAYFORMULA(IF(ISBLANK(B:B); ""; "PPA_" & TEXT(B:B; "0000")))`. |
| **Atomicidade da API (`LockService`)** | Requer agrupamentos por pessoa. | **Instantânea:** `max(num_sequencial) + 1` na coluna B da aba alvo. |
| **Ergonomia Mobile (Smartphones 60+)** | Ruim: quebra linhas e é truncada com reticências. | **Excelente:** Enxuta, limpa e legível. |
| **Consolidação em Conselhos Superiores** | `SP_SUD_ITA_ICO_PES_0001_PAP_0001` (32 caracteres). | `SP_SUD_ITA_ICO_PPA_0001` (23 caracteres). |
| **IndexedDB e Tráfego JSON** | Payloads e índices maiores. | Otimizado para SQLite / IndexedDB e baixo tráfego 4G/3G. |

---

## 3. Mapa Geral da Taxonomia por Domínio

A padronização foi estendida aos outros domínios da planilha de conferência para garantir coerência global:

* **Domínio Pessoas (`P`):**
  * `PES_0001`: Pessoas (assistidos, vicentinos, benfeitores)
  * `PPA_0001`: Papéis das Pessoas (`pessoas_papeis`)
  * `PCA_0001`: Cargos de Diretoria (`pessoas_cargos`)
  * `PEN_0001`: Endereços de Pessoas (`pessoas_enderecos`)
* **Domínio Famílias (`F`):**
  * `FAM_0001`: Famílias / Lares assistidos (`familias`)
  * `FEN_0001`: Endereço do Lar / Domicílio (`familias_enderecos`)
  * `FPE_0001`: Composição Familiar / Parentesco (`familias_pessoas`)
* **Domínio Visitas (`V`):**
  * `VIS_0001`: Visitas Domiciliares (`visitas`)
  * `VPA_0001`: Presença de Participantes na Visita (`visitas_participantes`)
* **Domínio Ações e Promoção Humana:**
  * `AUX_0001`: Auxílios e Doações Entregues (`auxilios`)
  * `PLA_0001`: Plano de Promoção e Metas Fraternas (`plano_promocao`)

---

## 4. Próximos Passos
* Aplicar a nova convenção de colunas e fórmulas na planilha modelo oficial do Google Sheets.
* Assegurar que a coluna B de todas as abas seja `num_sequencial`, permitindo a geração atômica da chave primária na coluna A via `ARRAYFORMULA`.
