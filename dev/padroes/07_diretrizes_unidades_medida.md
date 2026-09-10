# Diretrizes de Unidades de Medida CSS (Foco em Acessibilidade 60+)

Este documento estabelece o padrão de uso de unidades de medida CSS (`px`, `rem` e `em`) no desenvolvimento do aplicativo web da SSVP. O objetivo é garantir um layout visualmente consistente e **altamente acessível**, que se adapte automaticamente às configurações de escala de texto de vicentinos idosos.

---

## 1. Unidade Padrão Dominante: `rem` (Root EM)

A unidade `rem` calcula dimensões com base no tamanho da fonte do elemento raiz (`html`). No padrão dos navegadores, `1rem = 16px`.

### Por que adotamos?
* **Acessibilidade Móvel:** Se um usuário idoso configurar o sistema operacional do smartphone (iOS ou Android) para usar **"Fontes Grandes"**, o navegador móvel escalará o tamanho da fonte raiz.
* **Elasticidade do Layout:** Ao utilizar `rem`, os textos, espaçamentos e caixas de conteúdo aumentam de forma proporcional e automática, mantendo o layout íntegro (sem quebras de texto ou sobreposições).

### Onde deve ser usada:
* **Tamanhos de Fonte (`font-size`):** Ex: `font-size: 1rem;` (tamanho base), `font-size: 1.25rem;` (títulos médios).
* **Espaçamentos Internos (`padding`):** Para caixas de texto, botões ergonômicos e cards. Ex: `padding: 0.75rem 1.25rem;`.
* **Margens (`margin`):** Espaçamento entre cards e blocos de conteúdo para garantir consistência. Ex: `margin-bottom: 1.5rem;`.
* **Dimensões Ergonômicas:** Altura de linha (`line-height`) e raios de botões de controle que precisam crescer caso o tamanho de dedo/visão do usuário exija botões maiores.

---

## 2. Unidade de Precisão Geométrica: `px` (Pixel)

O pixel é uma unidade de medida absoluta que corresponde aos pixels físicos da tela e não sofre alteração com a escala do sistema.

### Por que adotamos?
* **Estabilidade Visual:** Evita que detalhes estruturais muito finos sofram distorção ou fiquem excessivamente largos quando o texto é escalado.

### Onde deve ser usada:
* **Bordas (`border`):** Espessura de contornos. Ex: `border: 2px solid var(--cor-barras);`.
* **Sombras (`box-shadow` e `text-shadow`):** Deslocamento e desfoque. Ex: `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);`.
* **Linhas e Divisores:** Elementos decorativos finos de 1px ou 2px.

---

## 3. Unidade Modular Local: `em`

A unidade `em` é calculada com base no tamanho da fonte do elemento pai imediato.

### Por que adotamos com restrições?
* **Risco de Cascata:** O uso excessivo e aninhado de `em` faz com que os tamanhos se multipliquem, tornando o cálculo de dimensões complexo e imprevisível.

### Onde deve ser usada (Com Moderação):
* **Componentes Encapsulados:** Apenas em micro-componentes isolados (como um botão especial) onde o espaçamento interno deva ser proporcional ao tamanho da fonte daquele próprio botão.

---

## Tabela de Conversão e Referência Rápida

| Pixels (px) | Unidade (rem) | Contexto de Uso Recomendado |
| :--- | :--- | :--- |
| `1px` - `3px` | N/A (Usar `px`) | Bordas, divisores finos e sombras |
| `12px` | `0.75rem` | Textos secundários ou de legenda |
| `16px` | `1rem` | **Texto de corpo base** (mínimo recomendado para inputs iOS) |
| `20px` | `1.25rem` | Subtítulos ou textos destacados |
| `24px` | `1.5rem` | Títulos de cards ou seções menores |
| `32px` | `2rem` | Títulos grandes e cabeçalhos principais |
| `12px` - `24px` | `0.75rem` - `1.5rem`| Espaçamentos de padding e margens de layout |
