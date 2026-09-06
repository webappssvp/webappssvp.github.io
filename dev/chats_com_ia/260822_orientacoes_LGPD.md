# Registro de Discussão: Orientações de LGPD para o App da SSVP

**Data:** 22 de Agosto de 2026
**Participantes:** Desenvolvedor (Usuário) & Antigravity (IA)

---

## 1. Contexto da Discussão
O desenvolvedor manifestou preocupação com a possibilidade de advogados utilizarem a Lei Geral de Proteção de Dados (LGPD) para mover processos judiciais de má-fé contra a Sociedade de São Vicente de Paulo (SSVP) a partir do uso do aplicativo em desenvolvimento. Como o desenvolvedor não é advogado, ele solicitou orientações sobre quais pontos técnicos e arquiteturais da LGPD devem ser observados durante o desenvolvimento do aplicativo para mitigar esses riscos.

---

## 2. Pontos Críticos de LGPD Identificados para a SSVP
A SSVP realiza assistência social ativa e, por sua natureza de atuação, trata dados pessoais de pessoas em situação de vulnerabilidade, incluindo dados sensíveis e dados de crianças e adolescentes. Os principais pontos de atenção discutidos foram:

### A. Gestão e Registro de Consentimento
*   **Dados de Crianças e Adolescentes (Art. 14 da LGPD):** Frequentes em fichas de famílias assistidas. O app precisa garantir que haja o consentimento de pelo menos um dos pais ou responsável legal.
*   **Dados Sensíveis (Art. 11 da LGPD):** Relatórios de saúde, deficiências físicas/mentais, pedidos de remédios ou informações religiosas/filiação à SSVP. Exigem consentimento explícito e destacado do titular.
*   **Geração de Provas (Logs de Consentimento):** Para defesa da SSVP, o app deve armazenar um histórico auditarível de quando, como e por quem o consentimento foi fornecido (IP, data/hora, id do usuário e a versão exata do termo de privacidade assinado).

### B. Minimização de Dados (Art. 6º, III - Princípio da Necessidade)
*   Coleta restrita ao estritamente necessário para prestar a assistência social. Campos desnecessários (como orientação sexual, preferência política ou tipo sanguíneo) devem ser eliminados do escopo para evitar alegações de coleta invasiva ou desvio de finalidade.

### C. Controle de Acesso Estrito (Segurança da Informação)
*   **Níveis de Acesso (RBAC - Role-Based Access Control):** Vicentinos devem possuir acesso limitado aos dados dos assistidos vinculados à sua própria Conferência. O acesso indiscriminado de membros a dados de todo o Conselho ou cidade configura vulnerabilidade legal de vazamento e invasão de privacidade.
*   **Mascaramento de Interface:** Exibição parcial de documentos (como CPF e RG) nas telas do aplicativo para evitar capturas de tela desnecessárias ou exposição acidental de dados.

### D. Trilha de Auditoria (Logs de Acesso)
*   Registro imutável de todas as ações de leitura, escrita, edição e exportação de dados realizadas por qualquer usuário vicentino no sistema. Em caso de vazamento, isso permite à SSVP rastrear e demonstrar que a falha não foi do sistema em si, mas sim de um desvio de conduta de usuário específico (responsabilidade civil subjetiva).

### E. Direitos do Titular (Art. 18 da LGPD)
*   O assistido tem direito a consultar quais dados a SSVP armazena a seu respeito e exigir a exclusão ou revogação do consentimento.
*   O app deve disponibilizar ferramentas internas para exportar os dados do assistido em formato legível e um processo seguro de inativação/anonimização dos dados quando o atendimento for encerrado (substituindo campos identificáveis por dados genéricos ou hashes, preservando apenas dados numéricos para estatísticas).

---

## 3. Deliberações
*   Criar um checklist formal de requisitos técnicos de conformidade com a LGPD a ser armazenado de forma segura na pasta `dev_local/seguranca/requisitos_lgpd.md` para orientar o desenvolvimento das próximas fases do aplicativo.
