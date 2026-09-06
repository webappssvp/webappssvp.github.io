# Registro de Discussão: Soluções de LGPD para o App da SSVP

**Data:** 24 de Agosto de 2026  
**Participantes:** Desenvolvedor (Usuário) & Antigravity (IA)  

---

## 1. Introdução
Este chat destina-se a propor, discutir e detalhar as soluções técnicas para atender aos requisitos de privacidade de dados e conformidade com a LGPD no aplicativo da SSVP. O objetivo principal é proteger as informações sensíveis de assistidos (famílias carentes, incluindo crianças/adolescentes) e resguardar a SSVP e seus voluntários de eventuais contestações jurídicas.

## 2. Escopo de Soluções a Debater
Abaixo estão as propostas arquiteturais iniciais para debate:

### A. Solução para Gestão de Consentimento
*   **Abordagem Híbrida (Recomendada):** O vicentino colhe a assinatura física no termo impresso de consentimento e faz o upload de uma foto do termo no aplicativo.
*   **Fluxo de Sincronização Offline:**
    *   **Captura e Armazenamento Local:** Em campo (offline ou rede móvel ruim), o app captura a foto e a armazena temporariamente no **IndexedDB** do navegador (evitando a galeria pública de fotos do dispositivo por razões de segurança e LGPD).
    *   **Compactação no Cliente:** Redimensiona a foto localmente via JavaScript/Canvas para diminuir o tamanho (ex: largura máxima de `1200px` em JPEG com `70%` de qualidade, reduzindo de ~8MB para ~200KB) antes de salvar e enviar.
    *   **Upload sob Demanda (Wi-Fi):** O app gerencia uma fila local de sincronização. Quando o vicentino estiver em casa no Wi-Fi, ele realiza o upload do termo para a nuvem.
    *   **Exclusão Automática:** A foto temporária no IndexedDB é obrigatoriamente deletada após a confirmação de upload pelo backend.
*   **Padrão de Nomenclatura dos Arquivos de Upload:**
    *   O nome do arquivo gerado para upload deve ser descritivo, no padrão: `consent_[assunto]_[nome].jpg` (ex: `consent_menores_joao_silva.jpg`). O nome deve ser normalizado (letras minúsculas, sem acentos, e espaços substituídos por underscores).
*   **Tratamento de Menores:** Mecanismo de validação de parentesco ou representação legal atrelado ao consentimento.

### B. Solução para Trilha de Auditoria (Logs)
*   **Modelo de Logs Inalterável:** Como registrar logs de leitura/escrita na planilha ou banco de dados sem que o próprio usuário possa apagá-los ou alterá-los.
*   **Campos mínimos de auditoria:** Timestamp, ID do operador, tipo de ação, ID do registro afetado, IP/dispositivo.

### C. Solução para Controle de Acesso (RBAC) e Mascaramento
*   **Filtros no Backend/Appscript:** Garantir que o aplicativo só receba do servidor os dados dos assistidos vinculados à Conferência do vicentino logado (evitando baixar a base completa para o celular).
*   **Mascaramento de Dados Sensíveis:** Exibir apenas partes de documentos (ex: CPF `***.456.789-**`) e só revelar mediante ação explícita gravada no log (ex: botão "Visualizar Documento Completo").
*   **Isolamento de Diretórios de Conferências (LGPD):**
    *   **Subpastas por Conferência:** Cada conferência possui sua própria subpasta no Google Drive do Conselho Central (sob a propriedade e controle da conta `assistentessvp@gmail.com`), seguindo o padrão de nomenclatura `conf_[Código_Conferencia]_[Nome_Normalizado]` (ex: `conf_027_santo_antonio`).
    *   **Isolamento da Planilha:** A planilha operacional com os dados dos assistidos de cada Conferência é mantida dentro de sua respectiva subpasta, permitindo herança simples de permissões para os vicentinos daquele grupo e mitigando vazamentos de dados em escala.

### D. Solução para Direitos do Titular (Exportação/Anonimização)
*   **Rotina de Anonimização:** Substituição de dados identificadores por hashes ou exclusão lógica, mantendo apenas dados estatísticos (ex: idade, bairro, número de filhos) para relatórios de assistência social sem identificar a pessoa física.

### E. Arquitetura de Contas e Consolidação (Hub and Spoke)
*   **Contas Criadas:**
    *   `assistentessvp@gmail.com` (Conta Hub/Admin - Gerenciadora central do sistema).
    *   `cc_teste_a@gmail.com` (Conta Spoke - Operacional para testes da Conferência A).
    *   `cc_teste_b@gmail.com` (Conta Spoke - Operacional para testes da Conferência B).
*   **Fluxo de Consolidação de Dados:**
    *   **Propriedade do Script:** O Apps Script de consolidação e o painel de estatísticas (Planilha Master) ficam centralizados no Google Drive institucional da conta de serviço/admin do Conselho Central (`assistentessvp@gmail.com`).
    *   **Permissões Compartilhadas:** As planilhas operacionais das conferências (`cc_teste_a`, `cc_teste_b`) concedem permissão apenas de **Leitor** para `assistentessvp@gmail.com`.
    *   **Agendamento da Consolidação:** Um gatilho temporal (Time-driven trigger) na conta `assistentessvp@gmail.com` executa a leitura das planilhas das subpastas, compila estatísticas gerais livres de dados sensíveis e atualiza o painel consolidado do Conselho Central, sem que vicentinos de conferências diferentes tenham acesso direto aos dados uns dos outros.

---

## 3. Próximos Passos e Conclusões
*   **Requisitos Formais Criados:** O checklist técnico e as diretrizes arquiteturais foram consolidados e salvos no arquivo de segurança local [requisitos_lgpd.md](file:///c:/github/ssvpweb.github.io/dev_local/seguranca/requisitos_lgpd.md).
*   **Desenvolvimento das Soluções:** Nas próximas fases de desenvolvimento, a implementação deve seguir as diretrizes estabelecidas para criptografia seletiva, estrutura de pastas no Drive, sincronização de consentimento offline no IndexedDB e logs imutáveis.
