# Padrão de Identidade Visual e Manual da Marca SSVP

Este documento consolida as diretrizes oficiais do **Manual da Marca da SSVP Brasil** aplicadas diretamente à arquitetura visual e desenvolvimento de interface do WebApp SSVP. O objetivo é garantir consistência institucional, legibilidade e respeito às diretrizes da Sociedade de São Vicente de Paulo.

---

## 1. Escopo e Propósito

* **Identidade Oficial:** A marca da SSVP representa uma organização laica católica internacional com séculos de história. Sua representação gráfica deve transmitir credibilidade, acolhimento e compromisso com os mais vulneráveis.
* **Consistência em Módulos:** O mesmo padrão visual aplica-se a todas as telas do aplicativo (cabeçalhos, rodapés, telas de autenticação/PIN, cards de famílias e painéis de relatórios).
* **Proibição de Descaracterização:** É estritamente vedada a criação de variações visuais amadoras, distorções de cores ou logotipos independentes para conferências, comissões ou conselhos locais.

---

## 2. Significado Institucional dos Elementos

O logotipo é composto por elementos com forte valor simbólico que orientam o design:
* **O Peixe:** Símbolo tradicional do cristianismo primitivo e referência a Jesus Cristo, centro da ação vicentina.
* **O Círculo Azul:** Representa a universalidade da Igreja e o abraço fraterno a toda a humanidade.
* **O Laço / Nó Central:** Simboliza a união fraterna, caridade e solidariedade vicentina.
* **O Lema:** *"Servindo na esperança"*, que reflete a missão da SSVP junto aos pobres e necessitados.

---

## 3. Paleta Oficial de Cores

As cores da marca devem ser respeitadas com fidelidade na interface, mapeadas em variáveis de CSS (`:root`):

| Cor Oficial | Código HEX | Código RGB | Variável CSS Sugerida | Uso na Interface |
| :--- | :--- | :--- | :--- | :--- |
| **Azul Principal** | `#0064B6` | `rgb(0, 100, 182)` | `--cor-ssvp-azul` | Identidade primária, cabeçalhos institucionais e ações principais |
| **Vermelho** | `#FF0000` | `rgb(255, 0, 0)` | `--cor-ssvp-vermelho` | Destaques pontuais, alertas críticos e ações de alta atenção |
| **Branco** | `#FFFFFF` | `rgb(255, 255, 255)` | `--cor-ssvp-branco` | Fundo de leitura clara, superfícies de cards e textos contrastantes |
| **Preto** | `#000000` | `rgb(0, 0, 0)` | `--cor-ssvp-preto` | Tipografia em modo claro e elementos de alto contraste |

### Cores de Interface do WebApp (Tokens Complementares)
Para suporte a modo escuro e interfaces de longa visualização em campo, os seguintes tons institucionais complementares são adotados:
* **Azul Escuro / Barras:** `#002D62` (`--cor-barras`) — variação tonal sóbria para barras de navegação superior e inferior.
* **Fundo de Tela (Dark Theme):** `#0B0F19` (`--cor-fundo`) — reduz o cansaço visual e economiza bateria em telas OLED.
* **Superfície de Cards:** `#1E293B` (`--cor-card-bg`) — elevação de conteúdo contra o fundo.
* **Texto de Apoio / Neutro:** `#94A3B8` (`--cor-subtexto`) — legendas, rótulos secundários e metadados.

---

## 4. Tipografia Institucional

O manual oficial estabelece duas famílias: Garamond para títulos institucionais e Montserrat para interface e textos.

**No WebApp, usamos só a Montserrat** (decisão de 13/11/2026). Ela é muito legível em telas pequenas, e uma família só deixa o app mais leve e mais uniforme.

### Aplicação Prática no WebApp:
* **Montserrat (`font-family: var(--font-ui)`, em `css/base.css`)** em todos os textos: títulos, nome da conferência na barra, campos de formulário, botões, cards e listas.
* **Destaque é sempre em bold (`font-weight: 700`).** O texto comum fica em `400`. Não usamos outros pesos (500, 600, 800).
* Carregada pelo Google Fonts só com os pesos `400` e `700`.
* A Garamond fica para materiais fora do app, como documentos impressos ou apresentações institucionais, quando o manual pedir.

---

## 5. Área de Segurança e Proporções

* **Regra do Respiro:** Ao redor do logotipo da SSVP deve ser mantida uma área de respiro livre de textos, botões ou outros elementos visuais equivalente a **1/5 da altura do símbolo**.
* **Alinhamento:** Em barras de cabeçalho (`.bar-sup`), o logotipo deve ter destaque central ou alinhamento harmônico à esquerda, mantendo distância de segurança das bordas da tela e de botões de menu/ação.
* **Dimensões Mínimas:** Em dispositivos móveis, a marca não deve ser reduzida a ponto de tornar ilegível o lema ou o laço do peixe (altura mínima recomendada de `32px` / `2rem` para ícones de cabeçalho).

---

## 6. Aplicação em Componentes de Tela

### A. Cabeçalho (Header / Barra Superior)
* Manter fundo institucional sólido (`--cor-barras` ou `--cor-ssvp-azul`).
* Logotipo ou ícone oficial posicionado sem sobreposições decorativas.
* Preservar contraste de pelo menos `4.5:1` entre ícones de navegação e o fundo.

### B. Tela de Autenticação / Boas-Vindas
* Logotipo apresentado em tamanho de destaque com o nome institucional completo *"Sociedade de São Vicente de Paulo"*.
* Título principal em Montserrat bold.
* Evitar papéis de parede fotográficos complexos atrás da marca que prejudiquem o contraste.

### C. Ícone de Lançamento (PWA & Favicon)
* O ícone do aplicativo deve utilizar o símbolo oficial estilizado com fundo azul institucional e o símbolo em branco, garantindo visibilidade na tela inicial do celular Android e iOS.
* Devem ser fornecidas versões normais e *maskable* (adaptáveis aos formatos circulares e quadrados dos sistemas operacionais).

---

## 7. O Que NÃO Fazer (Regras Restritivas)

1. **NÃO** alterar as cores originais da marca (ex: peixe verde, amarelo ou com gradientes fluorescentes).
2. **NÃO** distorcer a proporção horizontal ou vertical (esticar ou amassar a marca).
3. **NÃO** aplicar sombras projetadas pesadas, contornos brilhantes ou efeitos 3D no símbolo.
4. **NÃO** criar versões caseiras do logo juntando brasões locais de cidades ou nomes de conferências misturados ao símbolo original.
5. **NÃO** posicionar o logo colado em bordas de telas sem o espaçamento mínimo de 1/5.

---

## 8. Arquivos e Referências Oficiais no Projeto

* **Manual Completo (PDF Oficial):** [`dev_local/Manual_da_Marca_SSVP_Brasil.pdf`](file:///c:/github/webappssvp.github.io/dev_local/Manual_da_Marca_SSVP_Brasil.pdf)
* **Vetor Original da Marca:** [`dev_local/marca_ssvp.svg`](file:///c:/github/webappssvp.github.io/dev_local/marca_ssvp.svg)
* **Ícone de Interface:** [`img/home_app_logo.svg`](file:///c:/github/webappssvp.github.io/img/home_app_logo.svg)
* **Ícone PWA:** [`testes/pwa/icon.png`](file:///c:/github/webappssvp.github.io/testes/pwa/icon.png)
