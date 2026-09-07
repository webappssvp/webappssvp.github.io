# Padrão de SEO, Compartilhamento Social e Metadados (Google Search Essentials)

Este documento reúne as diretrizes oficiais de **Otimização para Mecanismos de Busca (SEO)** baseadas no **Google Search Essentials** (antigo *Google Webmasters / SEO Starter Guide*), com foco na indexação correta da aplicação pública e na **proteção rigorosa de dados privados e sensíveis (LGPD)** no WebApp SSVP.

---

## 1. Princípio Fundamental: Separação entre Público e Privado

Em um sistema vicentino de acolhimento social, a política de SEO divide o aplicativo em duas zonas rígidas:

### A. Zona Pública (Indexável e Otimizada para o Google)
* **Páginas:** Tela de apresentação institucional, página inicial de boas-vindas, orientações sobre a SSVP, informações sobre como ser voluntário ou como solicitar apoio de uma conferência.
* **Objetivo:** Facilitar que pessoas necessitadas e vicentinos encontrem o aplicativo institucional no Google e recebam uma apresentação visual atraente ao compartilhar o link em aplicativos como o **WhatsApp**.

### B. Zona Privada e Confidencial (Bloqueio Total de Indexação - LGPD)
* **Páginas:** Módulos de identificação/PIN, painéis de conferências, cadastros de famílias assistidas, registros de visitas domiciliares, endereços, composições familiares e relatórios de carência.
* **Regra Obrigatória:** Toda página, tela ou rota interna que exiba dados pessoais **DEVE conter expressamente a diretiva de bloqueio**:
  ```html
  <meta name="robots" content="noindex, nofollow, noarchive">
  ```
* **Finalidade:** Impedir terminantemente que o robô do Google armazene em cache (*cache* de busca) ou indexe nomes e situações de vulnerabilidade de famílias assistidas.

---

## 2. Metadados Essenciais de Cabeçalho (`<head>`)

Toda página pública deve declarar com precisão os metadados canônicos recomendados pela Google:

```html
<!-- Codificação e Escala Responsiva -->
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">

<!-- Título Canônico: Claro, único e contendo a entidade institucional -->
<title>WebApp SSVP - Sociedade de São Vicente de Paulo no Brasil</title>

<!-- Meta Descrição: Entre 140 e 160 caracteres, informativa e sem palavras-chave artificiais -->
<meta name="description" content="Aplicativo de gestão e apoio fraterno às conferências vicentinas da Sociedade de São Vicente de Paulo (SSVP). Servindo na esperança e caridade.">

<!-- URL Canônica: Evita penalizações por conteúdo duplicado -->
<link rel="canonical" href="https://webappssvp.github.io/">

<!-- Idioma e Autor -->
<meta name="author" content="Sociedade de São Vicente de Paulo - Brasil">
```

---

## 3. Compartilhamento Social e Cards do WhatsApp (Open Graph)

Quando voluntários ou coordenadores vicentinos compartilham o link do WebApp em grupos de WhatsApp, redes sociais ou e-mails, o aplicativo deve gerar automaticamente um card com imagem, título e descrição nítidos.

Para isso, utilize as tags do protocolo Open Graph com as cores e imagens oficiais da SSVP:

```html
<!-- Metatags Open Graph (WhatsApp, Facebook, LinkedIn) -->
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="SSVP Brasil - WebApp">
<meta property="og:title" content="WebApp SSVP - Apoio e Gestão Vicentina">
<meta property="og:description" content="Plataforma de gestão das visitas fraternas e assistência às famílias da Sociedade de São Vicente de Paulo.">
<meta property="og:url" content="https://webappssvp.github.io/">

<!-- Imagem de Destaque (Tamanho recomendado Google/Facebook: 1200x630px) -->
<meta property="og:image" content="https://webappssvp.github.io/img/home_app_logo.svg">
<meta property="og:image:alt" content="Logotipo Oficial da Sociedade de São Vicente de Paulo">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">

<!-- Twitter Cards -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="WebApp SSVP - Gestão Vicentina">
<meta name="twitter:description" content="Servindo na esperança: apoio digital às conferências da SSVP Brasil.">
<meta name="twitter:image" content="https://webappssvp.github.io/img/home_app_logo.svg">
```

---

## 4. Estrutura Semântica e Hierarquia de Cabeçalhos

A Google avalia a clareza textual de um site por meio de sua árvore semântica:

1. **Apenas um único `<h1>` por tela:** O `<h1>` representa o tema mestre da página (ex: `<h1>Sociedade de São Vicente de Paulo - Portal da Conferência</h1>`).
2. **Subtítulos hierárquicos ordenados:**
   * `<h2>`: Para as seções principais da página.
   * `<h3>`: Para blocos temáticos subordinados aos `<h2>`.
   * **Proibição:** Nunca pular níveis (ex: saltar diretamente de um `<h1>` para um `<h3>` apenas para obter um tamanho visual de fonte menor; utilize CSS para ajustar o tamanho da fonte via classes).
3. **Texto Âncora Descritivo em Links (`<a>`):**
   ```html
   <!-- CORRETO (Padrão Google SEO) -->
   <a href="sobre_ssvp.html">Conheça a história e os fundadores da SSVP</a>

   <!-- INCORRETO (Penalizado pelo Google) -->
   <a href="sobre_ssvp.html">Clique aqui</a>
   ```

---

## 5. Dados Estruturados (Schema.org / JSON-LD)

A Google recomenda a injeção de metadados em formato **JSON-LD** para alimentar o *Google Knowledge Graph* e gerar resultados enriquecidos (*Rich Snippets*) na pesquisa orgânica.

No WebApp SSVP, declaramos duas entidades principais:
1. A **Entidade Institucional** (`NonProfitOrganization`)
2. A **Aplicação Web** (`WebApplication`)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "NonProfitOrganization",
      "@id": "https://webappssvp.github.io/#organizacao",
      "name": "Sociedade de São Vicente de Paulo",
      "alternateName": "SSVP Brasil",
      "url": "https://webappssvp.github.io/",
      "logo": "https://webappssvp.github.io/img/home_app_logo.svg",
      "slogan": "Servindo na esperança",
      "foundingDate": "1833",
      "description": "Organização internacional de leigos católicos dedicada ao serviço caritativo, acolhimento e promoção integral dos mais pobres."
    },
    {
      "@type": "WebApplication",
      "@id": "https://webappssvp.github.io/#webapp",
      "name": "WebApp SSVP",
      "applicationCategory": "ProductivityApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "BRL"
      },
      "browserRequirements": "Requer navegador moderno com suporte a HTML5 e Service Workers"
    }
  ]
}
</script>
```

---

## 6. Checklist de Validação SEO para Desenvolvedores

Antes de publicar qualquer página do WebApp, verifique:
- [ ] A página é pública? Se NÃO for (contém dados de famílias ou conferências), possui `<meta name="robots" content="noindex, nofollow">`?
- [ ] Possui `<title>` único e objetivo com até 60 caracteres?
- [ ] Possui `<meta name="description">` com resumo atrativo entre 140 e 160 caracteres?
- [ ] As tags `og:title`, `og:description` e `og:image` estão configuradas para o compartilhamento no WhatsApp?
- [ ] Existe apenas um único `<h1>` na página?
- [ ] Todas as tags `<img>` possuem atributo `alt` preenchido?
- [ ] Os links possuem textos âncora descritivos (sem "clique aqui")?
- [ ] A página foi testada no *Google Rich Results Test* ou *Lighthouse SEO* mantendo nota máxima?
