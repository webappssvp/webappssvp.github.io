# Registro de Chat - Arquitetura Firebase Multi-Site, Homologação e Estimativa de Tráfego

**Data:** 26 de Outubro de 2026  
**Participantes:** Desenvolvedor (Usuário) & Antigravity (Arquiteto de Software AI)

---

## 1. Contexto e Motivação

O usuário apresentou uma visão arquitetural abrangente para a sustentabilidade, escalabilidade e governança de testes do WebApp da SSVP Brasil:
* **Backend descentralizado:** Google Sheets nas contas de Google Drive institucionais dos Conselhos Centrais (CC), governados pela planilha mestre `_indice_conferencias` e acionados via endpoints seguros do Google Apps Script.
* **Frontend regionalizado por Conselho Metropolitano (CM):** Hospedagem no Firebase Hosting com endereços dedicados por estado/região — por exemplo: `ssvpsp.web.app`, `ssvprj.web.app`, `ssvpbh.web.app`.
* **Repositório único no GitHub:** Manutenção de um repositório centralizado capaz de atualizar todos os sites metropolitanos simultaneamente via automação de CI/CD.
* **Metropolitano de Testes (Homologação / *Sandbox*):** Criação de um ambiente dedicado (`ssvpteste.web.app`) para que desenvolvedores apresentem melhorias, novas telas e refinamentos de ergonomia a um grupo piloto de vicentinos antes da publicação oficial em produção.
* **Dimensionamento de Rede:** Estimativa detalhada da necessidade de transferência de dados (banda/rede) de cada Metropolitano, avaliando o enquadramento na gratuidade da infraestrutura.

---

## 2. Decisões Arquiteturais de Frontend e Deploy

### 2.1. Matriz Comparativa de Abordagens de Hospedagem

| Critério | Opção A: Firebase Hosting Multi-Site (1 Projeto, Vários Alvos) | Opção B: Domínio PWA Único Canônico | Opção C: Múltiplos Projetos Firebase Separados |
| :--- | :--- | :--- | :--- |
| **URLs de Acesso** | `ssvpsp.web.app`, `ssvprj.web.app`, `ssvpbh.web.app` | Link único: `app.ssvpbrasil.org.br` ou `webappssvp.web.app` | `ssvpsp.web.app`, `ssvprj.web.app` (contas distintas) |
| **Pipeline GitHub** | **Automatizado em 1 passo** via GitHub Actions | **Automatizado em 1 passo** | Complexo (múltiplas credenciais/segredos no Git) |
| **Custo de Hospedagem** | **R$ 0,00** (Plano gratuito Spark do Firebase) | **R$ 0,00** (Firebase ou GitHub Pages) | R$ 0,00 (múltiplos consoles para administrar) |
| **Isolamento de Cache** | Cada URL tem seu próprio cache e banco `IndexedDB` | Um único cache e banco local no aparelho | Cada URL tem seu próprio cache e banco |
| **Ergonomia 60+** | Excelente: link regional divulgado pelo próprio CM | Máxima: link universal para qualquer vicentino | Igual à Opção A |
| **Manutenibilidade** | Muito Alta: 1 repositório, 1 projeto Firebase | Máxima: estrutura mais simples possível | Baixa: risco de versões divergentes entre estados |

### 2.2. Adoção da Opção A (Firebase Multi-Site)
Ficou validada a **Opção A**:
* Um único projeto no Firebase Console com múltiplos sites de hospedagem vinculados.
* Um único repositório no GitHub contendo o código-fonte auditável.
* Automação de publicação contínua (CI/CD) disparada via GitHub Actions.

---

## 3. Metropolitano de Testes e Homologação (`ssvpteste.web.app`)

A introdução de um Conselho Metropolitano exclusivo para testes foi avaliada e aprovada como um pilar essencial para a segurança psicológica dos voluntários idosos e para a validação de novas funcionalidades.

### 3.1. Matriz Comparativa de Ambientes de Homologação

| Critério | Opção 1: Subdomínio Fixo de Testes (`ssvpteste.web.app`) | Opção 2: Modo Treinamento Embutido na Produção | Opção 3: Canais Temporários (Firebase Preview Channels) |
| :--- | :--- | :--- | :--- |
| **Endereço (URL)** | Fixo: `ssvpteste.web.app` (ou `beta.ssvp.web.app`) | O mesmo de produção (`ssvpsp.web.app`) com chave de teste | Links temporários por PR (ex: `pr-12--ssvp.web.app`) |
| **Origem do Código** | Branch `develop` no GitHub (Deploy automático) | Branch `main` (Produção) | Pull Requests do GitHub |
| **Base de Dados** | **100% Fictícia** (Google Drive e Planilha Mestre de Testes) | Planilhas reais com 1 conferência fictícia misturada | Base de teste ou mockada |
| **Ergonomia 60+ (Campo)** | **Excelente:** link fixo no WhatsApp, permite instalar PWA de teste | **Perigosa:** risco do vicentino lançar visita real achando que é treino | **Péssima para idosos:** link muda sempre e expira em 7 dias |
| **Identidade Visual** | Barra superior com badge âmbar `[LAB / TESTES]` | Idêntico à produção | Idêntico à produção |
| **Risco LGPD** | **Zero:** dados de famílias reais nunca entram aqui | Médio: dados reais e testes convivem na mesma URL | Baixo |

### 3.2. Decisões do Ambiente de Testes (Opção 1 Aprovada):
1. **Fluxo de Branches e Deploy:**
   * **Branch `develop` ➔ `ssvpteste.web.app`:** Novas funcionalidades, melhorias de acessibilidade e ajustes de interface sobem para o endereço de homologação assim que validadas pela equipe de desenvolvimento.
   * **Branch `main` ➔ Produção (`ssvpsp`, `ssvprj`, etc.):** O código só é promovido à `main` após homologação positiva com o grupo de vicentinos de teste.
2. **Segurança Psicológica dos Voluntários 60+:**
   * Em oficinas de formação (ECAFO) e testes de campo, os confrades e consócias podem usar comandos de voz, cadastrar famílias e manipular botões sem qualquer receio de "estragar o sistema" ou corromper dados verídicos.
3. **Blindagem LGPD:**
   * O ambiente de homologação é conectado a uma planilha mestre `_indice_conferencias` e a um Google Drive de laboratório populados exclusivamente com nomes, endereços e relatos fictícios.
4. **Distinção Visual do PWA:**
   * O aplicativo de homologação possui indicação visual discreta no cabeçalho (`[VERSÃO DE TESTES]`) e manifesto com ícone específico (destaque âmbar/laranja), permitindo que o vicentino mantenha o app oficial e o de testes instalados simultaneamente no celular sem confusão.

---

## 4. Estimativa de Transferência de Dados (Bandwidth)

Para garantir sustentabilidade financeira perpétua, o tráfego do sistema foi decomposto em três camadas que operam de forma independente:

### 4.1. Camada 1: Frontend (Firebase Hosting)
* **Tamanho real dos ativos brutos:** ~250 KB (HTML, CSS modular, scripts Vanilla JS e ícones SVG).
* **Tamanho comprimido na rede (Brotli/Gzip):** **~80 KB a 90 KB** na primeira carga.
* **Comportamento PWA / Service Worker:** Utilizando a estratégia *Cache-First*, após o primeiro download o consumo de dados para abrir o app torna-se **0 KB**, pois todo o App Shell passa a ser servido diretamente do cache local do aparelho. Novas transferências só ocorrem quando uma nova versão for publicada no repositório.

#### Cenários de Consumo Mensal por Porte de Metropolitano
*(Considerando 300 KB mensais por usuário: 1 carga inicial + 2 atualizações de versão em segundo plano no mês)*

| Porte do Metropolitano | Conferências Ativas | Vicentinos Ativos (Usuários) | Transferência Mensal Estimada | Média Diária | % da Cota Gratuita (Spark) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Pequeno** (interior) | ~50 a 100 | ~300 vicentinos | **~90 MB / mês** | ~3 MB / dia | **~0,8%** |
| **Médio** (regional) | ~200 a 400 | ~1.200 vicentinos | **~360 MB / mês** | ~12 MB / dia | **~3,3%** |
| **Grande** (ex: SP, BH, RJ) | ~800 a 1.200 | ~4.000 vicentinos | **~1,2 GB / mês** | ~40 MB / dia | **~11,1%** |
| **Homologação (`ssvpteste`)** | Pilotos / Treinos | ~50 a 100 testadores | **~30 MB / mês** | ~1 MB / dia | **~0,3%** |

* **Margem de Segurança:** O plano gratuito *Spark* do Firebase Hosting fornece **360 MB por dia (~10,8 GB/mês)** e **10 GB de armazenamento**. Mesmo o maior Conselho Metropolitano do país operará com mais de 88% de folga dentro da faixa de custo zero.

### 4.2. Camada 2: Backend e Sincronização (Google Sheets & Apps Script)
* Esta comunicação ocorre diretamente entre o navegador do vicentino e a conta Google do Conselho Central, **sem trafegar pelo Firebase**.
* **Download de famílias assistidas:** Pacote JSON de 20 a 40 lares consome entre **25 KB e 40 KB**.
* **Envio de relatos de visitas:** Cargas de texto puro consomem de **2 KB a 5 KB** por visita.
* **Volume total por conferência:** Menos de **1,5 MB / mês**, permanecendo amplamente abaixo dos limites diários de execução de scripts do Google Apps Script (20.000 chamadas/dia gratuitas ou 100.000/dia no Workspace institucional).

### 4.3. Camada 3: Imagens e Fotos (Google Drive dos CCs)
* As fotos de relatórios, laudos ou consentimentos da LGPD são pré-compactadas no navegador do usuário via elemento `<canvas>` antes do envio, caindo de 5 MB para **~150 KB a 250 KB**.
* Os uploads são gravados diretamente na subpasta `fotos/` da respectiva conferência no Google Drive do Conselho Central, sem passar pelo servidor de hospedagem.

---

## 5. Estrutura Conceitual de Configuração de Deploy

### 5.1. Arquivo de Configuração do Firebase (`firebase.json`)
```json
{
  "hosting": [
    {
      "target": "teste",
      "public": ".",
      "ignore": ["firebase.json", "**/.*", "dev/**", "dev_local/**"]
    },
    {
      "target": "sp",
      "public": ".",
      "ignore": ["firebase.json", "**/.*", "dev/**", "dev_local/**"]
    },
    {
      "target": "rj",
      "public": ".",
      "ignore": ["firebase.json", "**/.*", "dev/**", "dev_local/**"]
    },
    {
      "target": "bh",
      "public": ".",
      "ignore": ["firebase.json", "**/.*", "dev/**", "dev_local/**"]
    }
  ]
}
```

### 5.2. Pipeline de Integração e Entrega Contínua (GitHub Actions)
* **Gatilho na branch `develop`:** Executa `firebase deploy --only hosting:teste` (alimenta imediatamente `ssvpteste.web.app`).
* **Gatilho na branch `main`:** Executa `firebase deploy --only hosting:sp,hosting:rj,hosting:bh` (atualiza simultaneamente todos os metropolitanos de produção oficiais).

---

## 6. Síntese e Próximos Passos

1. **Aprovação Consolidada:** Fica aprovada a arquitetura Multi-Site no Firebase com canal fixo de homologação (`ssvpteste.web.app`) e canais de produção regionais, mantidos por um único repositório GitHub com branches `develop` e `main`.
2. **Próximos Passos:**
   * Configuração das chaves de CI/CD do Firebase no repositório do GitHub quando for iniciada a fase de publicação em nuvem.
   * Criação do ambiente piloto com o Conselho Central de demonstração já existente no projeto.
