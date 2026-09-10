# Registro de Chat - Modularização do App Shell e Autenticação

**Data:** 10 de Setembro de 2026  
**Participantes:** Desenvolvedor (Usuário) & Antigravity (AI)

---

## 1. Contexto e Demanda
Após a validação bem-sucedida do teste `testes/api/t2_auth.html` (com a nova integração do modelo de planilhas `_indice_conferencias` e a hierarquia cumulativa de códigos `id_ssvp`), o usuário determinou o uso de `t2_auth.html` como a base definitiva para as próximas versões do WebApp SSVP.

Para tanto, solicitou que o `index.html` da raiz do repositório recebesse as mesmas funcionalidades do `t2_auth.html`, porém de forma completamente modular, com CSS e JavaScript desacoplados em arquivos externos separados por funcionalidade.

Durante a fase de discussão, o usuário propôs uma importante refinaria arquitetural de nomenclatura: substituir a convenção `base.css` por `app.css`, estabelecendo simetria direta com `app.js` como o par de entrada (*entry points*) da aplicação.

---

## 2. Decisões de Arquitetura

### A. Simetria de Entrada (`app.js` e `app.css`)
Adotou-se o par `app.js` e `app.css` como pontos de entrada centralizados da aplicação. O `app.css` reúne o Design System oficial da SSVP (`:root`), o reset universal e a estrutura da área central do App Shell.

### B. Modularização do CSS (`css/`)
A folha de estilos foi particionada por responsabilidades visuais com carregamento paralelo no `<head>`:
* **`css/app.css`**: Design System, tokens, variáveis institucionais SSVP, tipografia e cards explicativos da tela principal.
* **`css/barras.css`**: Barra Superior com o Semáforo Vicentino (estados Não Conectado, Não Logado e Logado) e Barra Inferior fixa (Footer com círculos ergonômicos de 48px para acessibilidade 60+).
* **`css/modal.css`**: Modal flutuante de conexão hierárquica, selects em cascata (CC ➔ CP ➔ CF), formulário de login de vicentinos e badges de feedback.

### C. Modularização do JavaScript (`js/` com ES Modules)
A lógica foi estruturada em módulos nativos Vanilla JS sem dependências externas, em conformidade com o Google JavaScript Style Guide:
* **`js/db.js`**: Persistência local segura no IndexedDB (`abrirBanco`, `salvarSessao`, `lerSessao`, `limparSessao`).
* **`js/api.js`**: Cliente HTTP para comunicação assíncrona com o Google Apps Script (`ping`, `get_ccs`, `get_estrutura_cc`, `login`).
* **`js/ui.js`**: Manipulação do DOM, controle de abertura/fechamento do modal, renderização dos selects e atualização reativa do Semáforo.
* **`js/auth.js`**: Orquestrador de regras de negócio, filtragem hierárquica híbrida (CP ➔ CF) e ciclo de vida de autenticação.
* **`js/app.js`**: Ponto de entrada (*Entry Point*), monitoramento de conectividade de rede e ciclo de vida do PWA (Service Worker e atualização em 1 toque).

---

## 3. Arquivos Criados e Atualizados

1. **`index.html` (Raiz):** Atualizado por completo, sem estilos nem scripts inline, preservando metadados de SEO, Open Graph para WhatsApp e dados estruturados Schema.org.
2. **`css/app.css`:** Criado com as variáveis e casca principal.
3. **`css/barras.css`:** Criado com a navegação superior e inferior.
4. **`css/modal.css`:** Criado com o sistema de formulários e feedback.
5. **`js/db.js`:** Criado com a camada isolada de IndexedDB.
6. **`js/api.js`:** Criado com o cliente tipado da API.
7. **`js/ui.js`:** Criado com o controlador de interface.
8. **`js/auth.js`:** Criado com o fluxo de autenticação e seleção.
9. **`js/app.js`:** Atualizado como orquestrador principal ES Module.

---

## 4. Validação
Todos os arquivos JavaScript foram submetidos à verificação sintática via compilador de nós (`node -c`), com zero erros detectados.
