# Registro de Projeto - PIN Seguro com Repetição Espaçada - 11/08/2026

Este documento especifica a estratégia de segurança e acessibilidade cognitiva projetada para mitigar o risco de roubo físico de aparelhos (celular + carteira contendo CPF/documentos) através de PINs complexos e um sistema de memorização assistida por Repetição Espaçada (Spaced Repetition) com foco em acessibilidade para idosos.

---

## 🛡️ O Problema do Roubo Físico e da Acessibilidade
* **Cenário de Risco:** Um assaltante rouba o celular e a carteira física do vicentino. Ele possui acesso ao aparelho e ao CPF (documento). Caso o login dependa de dados fáceis ou CPF, a segurança é facilmente quebrada.
* **Solução:** Exigir um PIN de segurança complexo (6 ou mais caracteres mistos).
* **O Desafio Humano:** Vicentinos (muitos da terceira idade) têm dificuldade para reter senhas complexas e tendem a anotá-las em papéis na carteira (o que anula a segurança em caso de roubo).
* **A Resposta Cognitiva:** Integrar no próprio webapp um sistema de **Repetição Espaçada (Spaced Repetition System - SRS)** para guiar e treinar a fixação do PIN na memória de longo prazo do usuário de forma amigável, científica e adaptada.

---

## 🧠 A Escala de Revisões Espaçadas Otimizada para Idosos

Para o público idoso, a escala é projetada para ser **gradual** (evitando saltos abruptos de tempo) e focada em **rotinas diárias** (eliminando cobranças em termos de "horas" que interrompem o cotidiano):

* **Nível 1 (Fixação Imediata):** 15 segundos após criar o PIN, o app faz um teste de "redigitação rápida" para garantir que a memória imediata e a digitação foram gravadas corretamente.
* **Nível 2:** 1 dia (revisar no dia seguinte)
* **Nível 3:** 2 dias
* **Nível 4:** 4 dias
* **Nível 5:** 7 dias (1 semana)
* **Nível 6:** 14 dias (2 semanas)
* **Nível 7:** 30 dias (1 mês - Intervalo máximo de segurança mantido permanentemente)

### Lógica de Regressão Suave (Anti-Frustração):
Diferente dos algoritmos tradicionais que resetam a memorização ao menor erro, adotamos a **Regressão Suave**:
* **Acerto sem ajuda:** Sobe 1 nível na escala temporal.
* **Erro ou clique em "Revelar Senha/Esqueci" (Ícone de Olho):** O webapp exibe a senha para ele ler e digitar (reforço visual), mas o progresso de fixação **retrocede apenas 1 nível** (ex: se estava no Nível 5, cai para o Nível 4). O usuário só retorna ao Nível 1 caso erre sucessivas vezes nos níveis mais baixos, reduzindo a sensação de punição ou incapacidade.

---

## 💻 Especificações Técnicas de Implementação

### 1. Modelo de Dados de Progresso (Google Sheets)
Para garantir que a limpeza de cache/histórico do navegador não apague o progresso do usuário, os parâmetros de revisão de cada vicentino serão armazenados em colunas adicionais na planilha de diretório central:

* `PIN_Hash` (Hash Bcrypt da senha complexa)
* `Revisao_Nivel` (Nível atual de 1 a 7)
* `Revisao_Proxima` (Data e hora limite da próxima cobrança)

### 2. Fluxo no Frontend (JavaScript):
```javascript
const INTERVALOS_NIVEIS = {
  1: 15 * 1000,                   // 15 segundos
  2: 24 * 60 * 60 * 1000,         // 1 dia
  3: 2 * 24 * 60 * 60 * 1000,     // 2 dias
  4: 4 * 24 * 60 * 60 * 1000,     // 4 dias
  5: 7 * 24 * 60 * 60 * 1000,     // 7 dias
  6: 14 * 24 * 60 * 60 * 1000,    // 14 dias
  7: 30 * 24 * 60 * 60 * 1000     // 30 dias
};

function responderDesafio(acertouDePrimeira) {
  let dadosProgresso = obterProgressoUsuario(); // Lê do local / Sheets

  if (acertouDePrimeira) {
    if (dadosProgresso.nivelAtual < 7) {
      dadosProgresso.nivelAtual++;
    }
  } else {
    // Regressão Suave: cai 1 nível em vez de resetar ao início
    if (dadosProgresso.nivelAtual > 1) {
      dadosProgresso.nivelAtual--;
    }
  }

  dadosProgresso.dataProximaRevisao = Date.now() + INTERVALOS_NIVEIS[dadosProgresso.nivelAtual];
  salvarProgressoUsuario(dadosProgresso); // Salva de volta no Sheets
}
```

---

## 🔔 Lembretes e Alertas em Segundo Plano

Para ajudar o usuário a lembrar de efetuar o treino de revisão na hora certa, avaliamos as seguintes soluções para lembretes em segundo plano:

### Opção A: PWA (Service Workers + Notification API)
* **Como funciona:** O webapp es instalado como aplicativo móvel (PWA) e agenda alertas nativos do navegador.
* **Som do Alerta:** O sinal toca o **som de notificação padrão do celular** (não é possível tocar sons/músicas personalizadas em segundo plano com o app fechado por motivos de segurança do SO).
* **Avaliação:** Excelente usabilidade no Android. No iOS, exige que o usuário adicione o app à Tela de Início.

### Opção B: Lembretes Automatizados via Google Apps Script (Recomendado)
* **Como funciona:** Como a `Revisao_Proxima` está gravada no Sheets, configuramos um gatilho de tempo diário (ex: todo dia às 9h) no Apps Script para rodar em nuvem de graça.
* **Envio:** O script dispara um e-mail de lembrete da SSVP para os usuários que possuem revisões agendadas para aquele dia.
* **Avaliação:** **Altamente recomendada.** Independe do modelo/marca de celular do vicentino, é 100% confiável e extremamente fácil de dar manutenção por voluntários de TI sem depender de APIs de push de terceiros.
