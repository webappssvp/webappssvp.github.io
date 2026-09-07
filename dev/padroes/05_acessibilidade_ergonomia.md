# Padrão de Acessibilidade, Ergonomia e Usabilidade 60+ (Google Material 3 & Lighthouse a11y)

Este documento estabelece as diretrizes de acessibilidade e ergonomia digital do WebApp SSVP. Como grande parte dos membros das conferências vicentinas é composta por **voluntários com 60 anos ou mais**, a interface deve oferecer conforto visual, alvos de toque generosos e adaptação automática às preferências do sistema operacional.

As normas aqui descritas fundem os princípios do **Google Material Design 3 (M3)**, a auditoria de acessibilidade do **Google Lighthouse** e as regras internacionais **WCAG 2.1 (nível AA/AAA)**.

---

## 1. Padrão de Unidades de Medida CSS: Domínio do `rem`

A escolha correta das unidades de CSS é a primeira linha de defesa da acessibilidade para idosos:

### Regra do `rem` (Root EM) — Padrão Dominante
* **Por que adotamos:** Quando um voluntário idoso altera o tamanho da fonte nas configurações do Android ou iOS para *"Texto Maior"*, o navegador escala automaticamente o elemento raiz (`html`).
* Usando `rem`, os textos, espaçamentos internos (`padding`) e margens (`margin`) crescem de forma proporcional e harmoniosa, sem quebrar o layout nem sobrepor elementos.
* **Onde aplicar:** 
  * Tamanhos de texto (`font-size`).
  * Espaçamentos de botões e cards (`padding`, `margin`).
  * Alturas e larguras de caixas flexíveis (`gap`, `height`, `min-height`).

### Regra do `px` (Pixel Físico) — Precisão Geométrica
* O pixel não se altera com a escala do sistema.
* **Onde aplicar:** Apenas em elementos estruturais milimétricos que ficariam distorcidos ou excessivamente grossos se escalados:
  * Bordas finas (`border: 1px solid ...` até `3px`).
  * Deslocamentos de sombra (`box-shadow: 0 4px 12px ...`).
  * Divisores e linhas de separação decorativas.

### Restrição Severa ao `em`
* O `em` é relativo ao elemento pai imediato. Seu uso aninhado multiplica valores em cascata e gera tamanhos incontroláveis em telas móveis. Use apenas em componentes autocontidos onde o espaçamento deva obrigatoriamente acompanhar a fonte do próprio componente.

### Tabela de Conversão e Referência Rápida

| Pixels Base | Medida em `rem` | Aplicação Recomendada |
| :--- | :--- | :--- |
| `1px` - `3px` | *Manter `px`* | Bordas, divisores finos e deslocamentos de sombra |
| `12px` | `0.75rem` | Legendas secundárias, data/hora e metadados de apoio |
| `16px` | `1.0rem` | **Texto de corpo base** (Mínimo obrigatório para inputs no iOS) |
| `20px` | `1.25rem` | Subtítulos, rótulos de campos e textos destacados |
| `24px` | `1.5rem` | Títulos de cards e seções |
| `32px` | `2.0rem` | Títulos principais de tela e cabeçalhos |
| `12px` - `24px` | `0.75rem` - `1.5rem` | Espaçamentos de preenchimento (`padding`) e margens |

---

## 2. Alvos de Toque e Ergonomia Motora (Google Touch Targets)

O tremor natural das mãos e a perda gradual de precisão motora fina exigem alvos de toque confortáveis:

* **Tamanho Mínimo de Alvo de Toque: `48x48px` (`3rem x 3rem`):** Todo botão, ícone clicável, checkbox ou item de menu deve possuir uma área clicável útil de pelo menos `48x48px`. Se o ícone visual for menor (ex: 24px), utilize `padding` interno para expandir a área de toque invisível.
* **Espaçamento entre Ações Adjacentes:** Mantenha pelo menos `8px` (`0.5rem`) de separação livre entre botões próximos para evitar toques incorretos acidentais.
* **Botões de Ação Ergonômicos:** Botões principais de avanço, confirmação ou registro de visita devem ocupar preferencialmente a largura total do contêiner móvel (`width: 100%`) com altura mínima de `3rem` (`48px`).

```css
/* Exemplo de botão no padrão ergonômico 60+ */
.btn-acao-principal {
  min-height: 3rem;           /* 48px mínimos */
  padding: 0.75rem 1.5rem;
  font-size: 1.125rem;        /* 18px para leitura confortável */
  font-weight: 600;
  border-radius: var(--raio-cantos);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
```

---

## 3. Contraste de Cores e Visibilidade (Lighthouse a11y / WCAG)

* **Relação de Contraste Mínima:**
  * **Texto Normal:** Contraste mínimo de **`4.5:1`** em relação ao fundo.
  * **Texto Grande (acima de 18px / 1.125rem em negrito):** Contraste mínimo de **`3:1`**.
  * **Ícones e Contornos Funcionais:** Contraste mínimo de **`3:1`** contra superfícies adjacentes.
* **Não Depender Apenas de Cor:** Nunca transmita estados críticos (como "Pendente" ou "Sincronizado") unicamente por cor verde/vermelho. Sempre inclua um ícone explícito (ex: checkmark, alerta) acompanhado por um texto explicativo claro.

---

## 4. Feedback Visual e Tátil Imediato

* **Feedback ao Toque:** Todo elemento clicável deve fornecer retorno visual instantâneo ao ser pressionado:
  ```css
  .btn-acao-principal:active {
    transform: scale(0.98);
    filter: brightness(0.9);
  }
  ```
* **Foco Visível para Navegação Assistiva:** Elementos interativos não devem ocultar o anel de foco quando navegados por teclado ou controle assistivo:
  ```css
  :focus-visible {
    outline: 3px solid var(--cor-audio);
    outline-offset: 2px;
  }
  ```

---

## 5. Diretrizes de Áudio, Voz e Mídia Interativa

* **Disparo Exclusivo por Gesto do Usuário:** Funcionalidades de captura por voz (`SpeechRecognition`) ou sintetizador de áudio (`SpeechSynthesis`) devem ser ativadas exclusivamente por clique ou toque voluntário do usuário, nunca de forma automática ao carregar a página.
* **Compatibilidade entre Plataformas:** Sempre declare suporte aos prefixos de navegadores móveis:
  ```javascript
  const ReconhecimentoVoz = window.SpeechRecognition || window.webkitSpeechRecognition;
  ```
* **Rótulos para Leitores de Tela:** Botões que contêm apenas ícones visuais (como o botão de microfone ou lupa) devem obrigatoriamente possuir o atributo `aria-label`:
  ```html
  <button type="button" class="btn-audio" aria-label="Gravar relato da visita por voz">
    <svg ... aria-hidden="true"></svg>
  </button>
  ```

---

## 6. Checklist de Validação Rápida para o Desenvolvedor

Antes de liberar qualquer tela ou componente novo, responda:
- [ ] O texto permanece legível e íntegro se o smartphone estiver em fonte grande?
- [ ] O botão possui pelo menos 48px de altura e largura útil para o toque do dedo?
- [ ] Os campos de formulário (`input`) possuem tamanho mínimo de `16px` (`1rem`)?
- [ ] O contraste entre o texto e o fundo é facilmente legível sob a luz do sol?
- [ ] Botões com apenas ícones têm `aria-label` descritivo?
