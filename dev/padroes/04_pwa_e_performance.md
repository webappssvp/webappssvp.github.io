# Padrão de PWA, Offline e Performance (Google Web Fundamentals & Core Web Vitals)

Este documento estabelece a arquitetura de **Progressive Web App (PWA)**, estratégias de resiliência offline e padrões de performance (Core Web Vitals) baseados nas diretrizes técnicas oficiais da Google (**web.dev**).

---

## 1. Contexto Operacional no WebApp SSVP

O trabalho voluntário dos vicentinos envolve visitas domiciliares a famílias em periferias, áreas rurais ou locais com cobertura de sinal de celular precária. 
* O aplicativo **não pode depender de conexão contínua com a internet** para funcionar.
* A interface deve carregar instantaneamente mesmo offline.
* As fichas de visitas preenchidas sem sinal devem ser armazenadas com segurança no dispositivo do voluntário e sincronizadas automaticamente assim que a conexão for restabelecida.

---

## 2. Checklist PWA Oficial da Google

Para ser reconhecido como um PWA de excelência e permitir a instalação na tela inicial sem necessidade de loja de aplicativos (Google Play / App Store), o projeto deve cumprir:

| Requisito | Como é Atendido no WebApp SSVP |
| :--- | :--- |
| **1. Conexão Segura** | Hospedagem estrita em **HTTPS** (GitHub Pages ou servidor local com certificado SSL). |
| **2. Responsividade** | Layout adaptável a qualquer tela (smartphones compactos, telas modernas e tablets). |
| **3. Manifesto Válido** | Arquivo `manifest.json` vinculado no `<head>` de todas as páginas públicas. |
| **4. Service Worker Registrado** | Service Worker ativo gerenciando requisições e persistindo o App Shell. |
| **5. Ícones Maskable** | Ícones de 192x192px e 512x512px com margem de segurança para corte adaptativo no Android. |

### Especificação do Manifesto (`manifest.json`)
```json
{
  "name": "WebApp SSVP - Brasil",
  "short_name": "SSVP Web",
  "description": "Aplicativo de Apoio e Gestão das Conferências Vicentinas da SSVP",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0B0F19",
  "theme_color": "#002D62",
  "icons": [
    {
      "src": "img/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "img/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

---

## 3. Estratégias de Cache no Service Worker

A Google define padrões de cache para cada tipo de recurso do sistema:

### Estratégia A: Cache-First (App Shell)
* **Recursos:** Arquivos HTML base, CSS (`style.css`), fontes externas (`Montserrat`, `Garamond`), SVGs da marca SSVP e ícones da interface.
* **Comportamento:** O Service Worker atende a requisição diretamente do cache local, garantindo tempo de abertura abaixo de 1 segundo. Se não estiver no cache, busca na rede e guarda uma cópia.

### Estratégia B: Network-First com Fallback Offline (Dados Dinâmicos)
* **Recursos:** Requisições de API para o Google Apps Script / Google Sheets (dados das conferências, relatórios e membros).
* **Comportamento:** O Service Worker tenta buscar os dados mais recentes na rede. Se a rede falhar ou o dispositivo estiver sem sinal, entrega imediatamente a última versão persistida no banco local (IndexedDB / LocalStorage).

```javascript
// Exemplo de interceptação no Service Worker (sw.js)
self.addEventListener('fetch', (evento) => {
  const url = new URL(evento.request.url);

  // Se for recurso estático do App Shell: Cache-First
  if (evento.request.destination === 'style' || 
      evento.request.destination === 'font' || 
      evento.request.destination === 'image') {
    evento.respondWith(
      caches.match(evento.request).then((respostaCache) => {
        return respostaCache || fetch(evento.request).then((respostaRede) => {
          return caches.open('ssvp-shell-v1').then((cache) => {
            cache.put(evento.request, respostaRede.clone());
            return respostaRede;
          });
        });
      })
    );
  }
});
```

### Limpeza no Ciclo de Ativação (`activate`)
Toda vez que a versão do cache for incrementada (ex: de `v1` para `v2`), o Service Worker deve remover caches defasados para economizar memória do smartphone do usuário:

```javascript
self.addEventListener('activate', (evento) => {
  const versoesAtivas = ['ssvp-shell-v2'];
  evento.waitUntil(
    caches.keys().then((chaves) => {
      return Promise.all(
        chaves.map((chave) => {
          if (!versoesAtivas.includes(chave)) {
            return caches.delete(chave);
          }
        })
      );
    })
  );
});
```

---

## 4. Métricas Core Web Vitals (web.dev)

O WebApp SSVP deve ser auditado via **Google Lighthouse** mantendo pontuação superior a 90 nos seguintes pilares:

### 1. LCP (Largest Contentful Paint) - Alvo: < 2.5 segundos
* O maior elemento visual da tela (título ou card principal) deve estar desenhado e legível em menos de 2,5 segundos no carregamento inicial móvel em rede 3G/4G.
* **Medida Adotada:** Fontes carregadas com `<link rel="preconnect">` e compressão de vetores SVG.

### 2. INP (Interaction to Next Paint) - Alvo: < 200 milissegundos
* Substitui o antigo FID. Mede a agilidade da interface em responder ao toque do usuário.
* **Medida Adotada:** Não travar a *thread* principal do JavaScript com loops pesados; processamentos longos de sincronização devem usar `setTimeout` fracionado ou Promises assíncronas.

### 3. CLS (Cumulative Layout Shift) - Alvo: < 0.1 (Zero Pulos Visuais)
* Elementos não podem empurrar o conteúdo para baixo enquanto carregam (muito comum quando imagens ou banners abrem repentinamente).
* **Medida Adotada:** Sempre definir `width` e `height` explícitos em ícones e imagens, e reservar a altura dos cards durante o estado de carregamento (*skeleton loading*).

---

## 5. Otimização de Fontes e Recursos Externos

As fontes oficiais da SSVP são carregadas com pré-conexão e política de troca suave (`swap`):

```html
<!-- Pré-conexão aos servidores de fonte da Google -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- font-display: swap garante que o texto apareça imediatamente com fonte de sistema até a Montserrat carregar -->
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## 6. Monitoramento de Conexão na Interface

A aplicação deve informar discretamente ao usuário o estado da conexão para dar segurança durante o uso em campo:

```javascript
// Notificação sutil de status de rede
window.addEventListener('online', () => {
  console.log('Conexão restabelecida. Iniciando sincronização em segundo plano...');
  processarFilaSincronizacaoOffline();
});

window.addEventListener('offline', () => {
  console.log('Dispositivo desconectado. Entrando em modo offline seguro.');
});
```
