/**
 * @fileoverview Textos dos tutoriais de cada tela (pedido de 20/11/2026; o mecanismo está em tutorial.js).
 *
 * Cada tela tem uma lista de passos: {alvo, titulo, texto} ou {secao, titulo, texto}.
 * - alvo: seletor CSS (o primeiro visível); perto: destaca o grupo em volta dele (ex.: 'fieldset').
 * - secao: o cartão cujo título (.detalhe-titulo) começa com este texto ("Moradores", "Endereço"); em: 'section' ou
 *   'fieldset', quando a visualização e a edição têm cartões com o mesmo título.
 * O passo cujo elemento não está na tela (sem permissão, lista vazia, outro modo da tela) é pulado: por isso uma
 * tela pode ter passos da visualização e da edição juntos.
 * Escrever como se fala com quem usa pouco o celular: frases curtas, o que o botão faz e quando usar.
 */

/** Passos da barra de baixo e do alto do app (entram no tutorial da tela Pessoas, a primeira). */
const CASCA = [
  {alvo: '#statusHeaderBtn', titulo: 'Sua conferência',
    texto: 'Aqui aparece a conferência em que você entrou e o seu nome. Toque para trocar de conferência ou para ' +
      'entrar de novo.'},
  {alvo: '#btnFooterMenu', titulo: 'Menu',
    texto: 'Abre as outras telas do app: Famílias, Visitas, Sugestões e as demais.'},
  {alvo: '#btnFooterNuvem', titulo: 'Nuvem',
    texto: 'Mostra se o que você gravou já chegou à planilha da conferência. Nuvem verde: tudo enviado. Com número: ' +
      'mudanças guardadas no celular, esperando para enviar. Vermelha: algo precisa de você. Toque para conferir.'},
  {alvo: '#btnAudioHub', titulo: 'Falar e Ouvir',
    texto: 'No Falar, toque num campo de texto e depois aqui para ditar, sem digitar. No Ouvir, toque para o app ler ' +
      'a tela em voz alta. Segure o botão para trocar entre Falar e Ouvir.'},
  {alvo: '#btnFooterSair', titulo: 'Sair',
    texto: 'Sai da conferência neste celular, para proteger os dados das famílias. Para voltar, entre de novo com o ' +
      'e-mail e a senha.'},
];

const VOLTAR = {alvo: '.barra-tela-voltar', titulo: 'Voltar',
  texto: 'Volta para a tela anterior. O botão Voltar do celular faz o mesmo.'};

const AJUDA = {alvo: '[data-barra="ajuda"]', titulo: 'Ajuda em toda tela',
  texto: 'Em cada tela, toque em Ajuda para ver de novo o que cada parte faz.'};

const ICONES_DO_CARTAO = (oQue) => ({alvo: '.botao-item', titulo: 'Os ícones do cartão',
  texto: 'O primeiro mostra se os dados ' + oQue + ' estão guardados no celular para usar sem internet. A nuvem ' +
    'mostra se a última mudança já chegou à planilha: com ✓, chegou; com seta, está esperando a internet. Toque ' +
    'nos ícones para guardar ou enviar só este.'});

const REGRA = {alvo: '.origem-regra', titulo: 'O que diz a Regra',
  texto: 'Estes botões mostram o trecho da Regra da SSVP que explica o porquê de cada parte.'};

const SEM_INTERNET = (onde) => ({alvo: onde, titulo: 'Sem internet',
  texto: 'Os dados guardados no celular ficam trancados. Digite a sua senha do app para abri-los.'});

/** @type {!Object<string, {titulo: string, passos: !Array<!Object>}>} */
export const TUTORIAIS = {
  pessoas: {
    titulo: 'Pessoas',
    passos: [
      {alvo: '.barra-tela-titulo', titulo: 'A tela Pessoas',
        texto: 'Aqui estão os membros da conferência e o responsável de cada família atendida. Os outros moradores ' +
          'ficam na tela Famílias. Use as setas para ver cada parte da tela.'},
      {alvo: '[data-barra="opcoes"]', titulo: 'Opções',
        texto: 'Toque para buscar alguém pelo nome, mostrar só um grupo (por exemplo, só os vicentinos), cadastrar ' +
          'uma pessoa nova ou atualizar a lista.'},
      {alvo: '#listaPessoas .cartao-pessoa', titulo: 'Cada pessoa',
        texto: 'O cartão mostra o nome, o papel e o cargo. Toque no cartão para ver os dados da pessoa e mudar o que ' +
          'for preciso.'},
      {alvo: '#listaPessoas .selo-voce', titulo: 'Você',
        texto: 'O selo "Você" marca o seu próprio cadastro. Toque nele para conferir os seus dados.'},
      {alvo: '#listaPessoas .sinal-acesso', titulo: 'Quem usa o app',
        texto: 'Só a diretoria vê. Verde: usou o app nos últimos 15 minutos. Amarelo: já entrou, com o dia do último ' +
          'acesso. Vermelho: ainda não entrou; talvez precise de ajuda no primeiro acesso. Em Opções dá para mostrar ' +
          'só um dos grupos.'},
      {...ICONES_DO_CARTAO('da pessoa'), alvo: '#listaPessoas .botao-item'},
      ...CASCA,
      AJUDA,
    ],
  },

  pessoa_detalhe: {
    titulo: 'Pessoas (detalhes)',
    passos: [
      VOLTAR,
      {alvo: '.barra-tela-compartilhar', titulo: 'Compartilhar',
        texto: 'Manda o link desta pessoa por WhatsApp ou e-mail para outro vicentino da conferência. A mensagem não ' +
          'leva nenhum dado: quem abre o link precisa ter entrado no app.'},
      {alvo: '.detalhe-papeis', titulo: 'Papel e cargo',
        texto: 'O papel da pessoa na conferência (vicentino, assistido…) e o cargo, se tiver.'},
      SEM_INTERNET('#formDesbloquear'),
      {secao: 'Dados pessoais', em: 'section', titulo: 'Dados pessoais',
        texto: 'Nome completo, celular e e-mail. Toque no celular para ligar e no e-mail para escrever.'},
      {secao: 'Endereço', em: 'section', titulo: 'Endereço',
        texto: 'Onde a pessoa mora. O botão do mapa abre o caminho até lá.'},
      {alvo: '.cartao-lgpd', titulo: 'Dados protegidos',
        texto: 'O cadeado aparece quando o seu papel não abre estes dados. Eles ficam guardados com segurança, como ' +
          'pede a LGPD.'},
      {alvo: '[data-acao-detalhe="editar"]', titulo: 'Editar',
        texto: 'Para mudar o nome, o celular, o e-mail ou o endereço.'},
      {alvo: '[data-acao-detalhe="promover"]', titulo: 'Passar para assistido',
        texto: 'Quem recebeu ajuda pontual (socorrido) passa a ser acompanhado pela conferência, com uma família.'},
      {alvo: '[data-acao-detalhe="papel"]', titulo: 'Mudar papel',
        texto: 'Por exemplo, um aspirante que se tornou vicentino.'},
      {alvo: '[data-acao-detalhe="desativar"]', titulo: 'Desativar',
        texto: 'Tira a pessoa da lista, quando ela deixa a conferência. Nada é apagado: o histórico fica na planilha.'},
      // Editando
      {alvo: '#ed_nome_exibicao', titulo: 'Nome de exibição',
        texto: 'Como a pessoa aparece na lista. Pode ser o primeiro nome ou um apelido.'},
      {alvo: '#ed_nome', titulo: 'Nome completo', texto: 'O nome como está no documento.'},
      {alvo: '#ed_celular', titulo: 'Celular', texto: 'Com o DDD. Pode digitar só os números: o app arruma.'},
      {alvo: '#ed_email', titulo: 'E-mail',
        texto: 'É com ele que a pessoa entra no app. Se mudar, escreva de novo no campo que aparece embaixo, para ' +
          'conferir.'},
      {alvo: '#end_cep', titulo: 'CEP',
        texto: 'Digite o CEP e o app preenche a rua, o bairro e a cidade. Depois, só o número e o complemento.'},
      {alvo: '#btnSalvarPessoa', titulo: 'Salvar',
        texto: 'Grava no celular na hora e envia para a planilha assim que houver internet. A Nuvem, embaixo, mostra ' +
          'quando chegou.'},
      // Mudando o papel ou desativando
      {alvo: '#formPapelPessoa', titulo: 'Novo papel', texto: 'Escolha o papel novo e toque em Mudar papel.'},
      {alvo: '#iptMotivo', titulo: 'Motivo',
        texto: 'Conte por que a pessoa está saindo (mudou de cidade, por exemplo). Fica registrado na planilha.'},
      AJUDA,
    ],
  },

  pessoa_nova: {
    titulo: 'Pessoas (cadastro)',
    passos: [
      VOLTAR,
      {secao: 'Papel', titulo: 'Papel',
        texto: 'O que a pessoa é na conferência. Vicentino, aspirante, visitante e benfeitor entram no app; ' +
          'assistido e socorrido são atendidos pela conferência.'},
      {alvo: '#novo_nome', titulo: 'Nome completo', texto: 'O nome como está no documento.'},
      {alvo: '#novo_nome_exibicao', titulo: 'Nome de exibição',
        texto: 'O app sugere a partir do nome completo. É como a pessoa aparece na lista: pode trocar por um ' +
          'apelido.'},
      {alvo: '#novo_celular', titulo: 'Celular', texto: 'Com o DDD. Pode digitar só os números.'},
      {alvo: '#novo_email', titulo: 'E-mail',
        texto: 'Para quem entra no app: a pessoa recebe neste e-mail o código do primeiro acesso.'},
      {alvo: '#novo_email_confirma', titulo: 'Confirme o e-mail',
        texto: 'Escreva o mesmo e-mail de novo. Assim um erro de digitação não impede a pessoa de entrar.'},
      {alvo: '#novo_cep', titulo: 'CEP',
        texto: 'Digite o CEP e o app preenche a rua, o bairro e a cidade.'},
      {alvo: '#novo_numero', titulo: 'Número', texto: 'O número da casa. Sem número? Escreva "s/n".'},
      {alvo: '#novo_ponto_referencia', titulo: 'Ponto de referência',
        texto: 'Algo perto da casa (uma padaria, uma igreja). Ajuda a dupla a achar o endereço.'},
      {alvo: '#btnCadastrarPessoa', titulo: 'Cadastrar',
        texto: 'Grava no celular na hora e envia para a planilha assim que houver internet.'},
      AJUDA,
    ],
  },

  familias: {
    titulo: 'Famílias',
    passos: [
      {alvo: '.barra-tela-titulo', titulo: 'A tela Famílias',
        texto: 'Todas as famílias que a conferência acompanha.'},
      {alvo: '[data-barra="opcoes"]', titulo: 'Opções',
        texto: 'Buscar uma família pelo nome, mostrar só as assistidas, as em sindicância, as promovidas ou as ' +
          'encerradas, escolher um bairro ou atualizar a lista.'},
      {alvo: '#listaFamilias .cartao-familia', titulo: 'Cada família',
        texto: 'O cartão mostra o nome, a situação, o bairro e quantos moram na casa. Toque para ver os detalhes.'},
      {alvo: '#listaFamilias .familia-moradores', titulo: 'Quem mora na casa',
        texto: 'O responsável vem primeiro. Depois, os outros moradores e o vínculo de cada um. A busca também acha ' +
          'a família pelo nome de um morador.'},
      {alvo: '#listaFamilias .familia-visita', titulo: 'Última visita',
        texto: 'Quando foi a última visita. Verde: até 7 dias. Amarelo: mais de 7 dias. Vermelho: mais de 14 dias.'},
      {...ICONES_DO_CARTAO('da família'), alvo: '#listaFamilias .botao-item'},
      AJUDA,
    ],
  },

  familia_detalhe: {
    titulo: 'Famílias (detalhes)',
    passos: [
      VOLTAR,
      {alvo: '.barra-tela-compartilhar', titulo: 'Compartilhar',
        texto: 'Manda o link desta família para outro vicentino da conferência, por exemplo para combinar a visita. ' +
          'A mensagem não leva nenhum dado.'},
      {alvo: '.detalhe-papeis', titulo: 'Situação',
        texto: 'Em sindicância (a conferência está conhecendo a família), assistida, promovida ou encerrada, e desde ' +
          'quando.'},
      SEM_INTERNET('#formDesbloquearFamilia'),
      {secao: 'Endereço', em: 'section', titulo: 'Endereço',
        texto: 'Onde a família mora. O botão do mapa abre o caminho até lá.'},
      {secao: 'Moradores', titulo: 'Moradores',
        texto: 'Quem mora na casa e o vínculo de cada um (titular, filho…). Toque no nome para ver a pessoa.'},
      {alvo: '.btn-adicionar-morador', titulo: 'Adicionar morador',
        texto: 'Alguém novo passou a morar na casa: cadastre aqui.'},
      {alvo: '.btn-retirar', titulo: 'Retirar', texto: 'Quando alguém deixa de morar na casa.'},
      {alvo: '.btn-registrar-visita', titulo: 'Registrar visita',
        texto: 'Abre o registro da visita a esta família. Dá para começar antes de sair de casa.'},
      {alvo: '[data-acao-familia="ouvir-visita"]', titulo: 'Ouvir a última visita',
        texto: 'O app lê em voz alta o que foi combinado e o relato da última visita. Bom de ouvir antes de bater na ' +
          'porta.'},
      {alvo: '.visita-acrescentar', titulo: 'Acrescentar ao relato',
        texto: 'Lembrou de algo depois? Acrescente ao relato de uma visita que você fez.'},
      {alvo: '[data-acao-familia="editar"]', titulo: 'Editar', texto: 'Para mudar o nome ou o endereço da família.'},
      {alvo: '.btn-promover', titulo: 'Família promovida',
        texto: 'A família conquistou a autonomia e não precisa mais da ajuda da conferência.'},
      {alvo: '[data-acao-familia="situacao"]', titulo: 'Mudar a situação',
        texto: 'Por exemplo, de em sindicância para assistida.'},
      {alvo: '[data-acao-familia="encerrar"]', titulo: 'Encerrar',
        texto: 'Termina o acompanhamento (a família mudou de cidade, por exemplo). Nada é apagado.'},
      AJUDA,
    ],
  },

  visitas: {
    titulo: 'Visitas',
    passos: [
      {alvo: '.barra-tela-titulo', titulo: 'A tela Visitas',
        texto: 'As famílias organizadas pela visita: as que estão em andamento, as que precisam de visita e as já ' +
          'visitadas.'},
      {secao: 'Visitas em andamento', titulo: 'Em andamento',
        texto: 'Visitas que você começou a registrar e ainda não salvou. Toque em Continuar a visita.'},
      {secao: 'Precisam de visita', titulo: 'Precisam de visita',
        texto: 'Famílias sem visita há mais de 7 dias (amarelo) ou mais de 14 dias (vermelho), ou ainda sem nenhuma.'},
      {alvo: '.visitas-registrar', titulo: 'Registrar visita', texto: 'Abre o registro da visita a esta família.'},
      {secao: 'Visitadas nos últimos 7 dias', titulo: 'Já visitadas', texto: 'As famílias visitadas nesta semana.'},
      REGRA,
      AJUDA,
    ],
  },

  visita: {
    titulo: 'Registrar visita',
    passos: [
      VOLTAR,
      {secao: 'Antes de bater na porta', titulo: 'Antes de bater na porta',
        texto: 'A oração antes da visita e, se houver, o que aconteceu na última visita.'},
      {alvo: '.btn-ouvir-visita', titulo: 'Ouvir a última visita',
        texto: 'O app lê o que foi combinado e o relato da última visita.'},
      {alvo: '.btn-toque', titulo: 'Os 4 toques',
        texto: 'Toque ao sair de casa, ao chegar na família, ao sair da família e ao chegar de volta. O app anota a ' +
          'hora de cada um: é o tempo de deslocamento e da visita.'},
      {alvo: '[data-meio]', perto: '.visita-chips', titulo: 'Vou de',
        texto: 'Como você vai até a família: a pé, de ônibus, de carro…'},
      {alvo: '[data-visita="passada"]', titulo: 'Visita que já aconteceu',
        texto: 'Esqueceu de registrar na hora? Toque aqui para escrever a data e o horário de uma visita já feita.'},
      {alvo: '#vis_data', titulo: 'Data da visita', texto: 'O dia em que a visita aconteceu.'},
      {secao: 'Dupla', titulo: 'Dupla',
        texto: 'Marque quem foi com você. Quem registra é você; a visita aparece para os dois.'},
      {alvo: '#vis_relato', titulo: 'Relato',
        texto: 'Como foi a visita e o que a família contou. Toque no campo e depois em Falar para ditar. Só os ' +
          'vicentinos da conferência leem.'},
      {alvo: '#vis_combinados', titulo: 'O que combinamos',
        texto: 'O que ficou combinado para a próxima visita. Ela começa lendo isto.'},
      {alvo: '[data-visita="auxilio"]', titulo: 'Auxílios entregues',
        texto: 'Cesta básica, remédio, roupa… Escolha o tipo e a quantidade.'},
      {secao: 'Fé', titulo: 'Fé', texto: 'Se rezaram juntos e se falaram de fé.'},
      {secao: 'Como a família está', titulo: 'Como a família está',
        texto: 'Opcional. Escolha o rosto que mostra como a família está em cada parte da vida. Ajuda a ver, com o ' +
          'tempo, se a vida da família melhora.'},
      {alvo: '[data-visita="salvar"]', titulo: 'Salvar a visita',
        texto: 'Grava no celular e envia assim que houver internet. Enquanto não salvar, o que você escreveu fica ' +
          'guardado neste celular.'},
      {alvo: '[data-visita="descartar"]', titulo: 'Descartar', texto: 'Apaga este registro, se começou por engano.'},
      AJUDA,
    ],
  },

  sugestoes: {
    titulo: 'Sugestões e opiniões',
    passos: [
      {alvo: '.tela-sugestoes .tela-texto', titulo: 'Sugestões e opiniões',
        texto: 'O app está em teste. O que você contar aqui vai para o Conselho Central, que lê todas as mensagens.'},
      {alvo: 'input[name="tipoSugestao"]', perto: 'fieldset', titulo: 'É uma…',
        texto: 'Escolha se é uma sugestão, uma opinião ou algo que não funcionou.'},
      {alvo: '#textoSugestao', titulo: 'O que você quer contar',
        texto: 'Escreva ou dite com o Falar. Não escreva nomes nem dados das famílias.'},
      {alvo: '#btnEnviarSugestao', titulo: 'Enviar', texto: 'Precisa de internet. Sem ela, o texto fica na tela.'},
      AJUDA,
    ],
  },
};

/** Tutoriais das telas restantes: o botão Ajuda fica em todas (22/11/2026). */
Object.assign(TUTORIAIS, {
  login: {
    titulo: 'Entrar',
    passos: [
      {alvo: '#selCm', titulo: 'Conselho Metropolitano', texto: 'Comece por aqui: toque e escolha o seu Metropolitano.'},
      {alvo: '#selCc', titulo: 'Conselho Central', texto: 'Depois, escolha o Conselho Central.'},
      {alvo: '#selCp', titulo: 'Conselho Particular', texto: 'Escolha o Conselho Particular.'},
      {alvo: '#selCf', titulo: 'Conferência',
        texto: 'Escolha a sua conferência. Os campos ficam vermelhos até dar para usar, amarelos quando falta ' +
          'preencher e verdes quando já estão escolhidos.'},
      {alvo: '#iptEmail', titulo: 'Seu e-mail', texto: 'Escreva o e-mail cadastrado na conferência.'},
      {alvo: '#iptSenha', titulo: 'Sua senha', texto: 'Escreva a sua senha. Toque no olho para ver o que digitou.'},
      {alvo: '#btnEntrar', titulo: 'Entrar', texto: 'Com tudo preenchido, toque aqui.'},
      {alvo: '#btnPrimeiroAcesso', titulo: 'Primeiro acesso ou esqueci a senha',
        texto: 'Escreva o e-mail e toque aqui. Você recebe um código por e-mail para criar a senha. Pode levar alguns ' +
          'minutos; olhe também o spam.'},
      {alvo: '#btnPerdiCelular', titulo: 'Perdi o celular', texto: 'Mostra como tirar a sua conta do aparelho perdido.'},
      {alvo: '#btnOQueE', titulo: 'O que é este app?', texto: 'Explica para que serve o app e onde ficam os dados.'},
      {alvo: '#btnFecharPainel', titulo: 'Continuar', texto: 'Volta para a tela em que você estava.'},
      {alvo: '#btnSair', titulo: 'Sair desta conferência', texto: 'Sai da conferência neste celular.'},
      {alvo: '#btnSairTodos', titulo: 'Sair de todos os aparelhos',
        texto: 'Se perdeu um celular, tira a sua conta de todos os aparelhos.'},
    ],
  },
  sobre: {
    titulo: 'O que é este app',
    passos: [
      {alvo: '.sobre-intro', titulo: 'Para que serve', texto: 'Um resumo do app, que ajuda nas visitas às famílias.'},
      {alvo: '.sobre-aviso', titulo: 'Importante',
        texto: 'Este é um ambiente de teste, com dados fictícios. Não cadastre pessoas nem famílias reais.'},
      {alvo: '.sobre-entrar', titulo: 'Entrar', texto: 'Toque aqui para ir à tela de entrada.'},
      {alvo: '.sobre-ouvir', titulo: 'Ouvir', texto: 'O app lê esta página em voz alta.'},
      {alvo: '.sobre-perguntas', titulo: 'Perguntas', texto: 'Toque numa pergunta para abrir a resposta.'},
      AJUDA,
    ],
  },
  cuidados: {
    titulo: 'Cuidados',
    passos: [
      {alvo: '.cuidados-aviso', titulo: 'Em revisão', texto: 'As fichas ainda estão sendo revisadas por profissionais.'},
      {alvo: '.cuidados-lista', titulo: 'Os cinco cuidados',
        texto: 'Toque num cuidado para ver as fichas. Em cada ficha, você pode ler ou tocar em Ouvir.'},
      {alvo: '.cuidados-encaminhar', titulo: 'Onde encaminhar',
        texto: 'Para quem ligar ou aonde levar a pessoa quando a situação não é com o vicentino.'},
      {alvo: '.cuidados-principios', titulo: 'Como conversar', texto: 'O jeito de falar com a família, sem cobrar nem culpar.'},
      AJUDA,
    ],
  },
  como_funciona: {
    titulo: 'Como o app guarda e envia',
    passos: [
      {alvo: '.cf-intro', titulo: 'Esta página', texto: 'Explica o caminho do que você grava e o que quer dizer cada ícone.'},
      {alvo: '.cf-ouvir', titulo: 'Ouvir', texto: 'O app lê esta página em voz alta.'},
      {alvo: '.cf-passo', titulo: 'Passo a passo', texto: 'Role a tela para ler os passos, um de cada vez.'},
      {alvo: 'input[name="cfEnvio"]', perto: 'fieldset', titulo: 'Como enviar',
        texto: 'Escolha se as mudanças vão na hora ou só quando você mandar. O relato de visita vai sempre na hora.'},
      {alvo: '.cf-entendi', titulo: 'Entendi', texto: 'Volta para a tela de pessoas.'},
      AJUDA,
    ],
  },
  importar: {
    titulo: 'Importar pessoas',
    passos: [
      {alvo: '.selo-construcao', titulo: 'Em construção',
        texto: 'Esta tela ainda não funciona. Aqui o presidente vai trazer a planilha de vicentinos da conferência.'},
      AJUDA,
    ],
  },
  visita_completar: {
    titulo: 'Completar a visita',
    passos: [
      VOLTAR,
      {alvo: '#vis_acrescimo', titulo: 'O que faltou contar',
        texto: 'Escreva ou dite o que ficou de fora. O relato anterior não é apagado.'},
      {alvo: '#vis_combinados', titulo: 'O que combinamos', texto: 'O que ficou combinado para a próxima visita.'},
      {alvo: '[data-completar="auxilio"]', titulo: 'Auxílio esquecido', texto: 'Inclua um auxílio entregue nessa visita.'},
      {alvo: '[data-completar="salvar"]', titulo: 'Salvar', texto: 'Grava no celular e envia quando houver internet.'},
      AJUDA,
    ],
  },
});

/**
 * Treinos: a pessoa faz cada passo de verdade (22/11/2026). O treino grava: a conferência de teste volta ao estado inicial
 * pelo presidente. Passo: {alvo, tipo: 'tocar'|'escrever'|'fim', titulo, pede, erro, pularEm?, pularSeExiste?,
 * textoDoBotao?, opcional?, semAlvo?, exemplo?, espera?}.
 */
export const TREINOS = {
  visita: {
    titulo: 'Registrar uma visita',
    passos: [
      {alvo: '#btnFooterMenu', tipo: 'tocar', pularEm: ['#visitas', '#visita'], titulo: 'Abra o Menu',
        pede: 'Toque em Menu, na barra de baixo.',
        erro: 'O Menu é o primeiro botão da barra de baixo, à esquerda, com três traços. Toque nele.'},
      {alvo: '#bottomSheet a[href="#visitas"]', tipo: 'tocar', pularEm: ['#visitas', '#visita'], titulo: 'Abra Visitas',
        pede: 'Toque em Visitas.', erro: 'Na lista de telas, procure "Visitas", com o desenho de uma pessoa andando.'},
      {alvo: '.visitas-registrar', tipo: 'tocar', pularEm: ['#visita'], titulo: 'Escolha uma família',
        pede: 'Toque em Registrar visita, embaixo da família.',
        erro: 'Cada família tem um botão "Registrar visita" logo abaixo do cartão. Toque no botão destacado.',
        semAlvo: 'Não encontrei uma família para visitar. Visitantes e benfeitores não registram visitas: entre com a ' +
          'conta de um vicentino.'},
      {alvo: '.btn-toque', tipo: 'tocar', textoDoBotao: 'Estou saindo', titulo: 'Saindo de casa',
        pede: 'Toque em Estou saindo. O app anota a hora.',
        erro: 'É o botão azul grande, em Deslocamento. Na visita de verdade, toque nele ao sair de casa.'},
      {alvo: '[data-meio]', perto: '.visita-chips', tipo: 'tocar', pularSeExiste: '[data-meio][aria-pressed="true"]', titulo: 'Como você vai',
        pede: 'Toque em como você vai até a família: a pé, de ônibus, de carro…',
        erro: 'Escolha uma das opções destacadas, abaixo de "Vou de".'},
      {alvo: '.btn-toque', tipo: 'tocar', textoDoBotao: 'Cheguei à casa da família', titulo: 'Chegando à família',
        pede: 'Toque em Cheguei à casa da família.',
        erro: 'O mesmo botão azul grande mudou de nome. Toque nele ao chegar.'},
      {alvo: '[data-parceiro]', perto: '.visita-chips', tipo: 'tocar', opcional: true, pularSeExiste: '[data-parceiro][aria-pressed="true"]',
        titulo: 'Sua dupla', pede: 'Toque no nome de quem foi com você.',
        erro: 'Em "Dupla", toque no nome de um vicentino. A Regra pede a visita de preferência em dupla.'},
      {alvo: '#vis_relato', tipo: 'escrever', titulo: 'O relato',
        pede: 'Toque no campo e escreva como foi a visita, ou use o botão Falar. Depois, toque em Continuar.',
        erro: 'Toque dentro do campo destacado e escreva uma frase curta. Ex.: A família está bem.',
        exemplo: 'Visita de treino: a família está bem.'},
      {alvo: '[data-simnao="rezou"]', perto: '.visita-chips', tipo: 'tocar', pularSeExiste: '[data-simnao="rezou"][aria-pressed="true"]',
        titulo: 'Fé', pede: 'Vocês rezaram juntos? Toque em Sim ou Não.',
        erro: 'Em "Rezamos juntos?", toque em Sim ou em Não.'},
      {alvo: '.btn-toque', tipo: 'tocar', textoDoBotao: 'Saí da casa da família', titulo: 'Saindo da família',
        pede: 'Toque em Saí da casa da família.', erro: 'Suba um pouco a tela: é o botão azul grande, em Deslocamento.'},
      {alvo: '.btn-toque', tipo: 'tocar', textoDoBotao: 'Cheguei de volta', titulo: 'De volta',
        pede: 'Toque em Cheguei de volta.', erro: 'É o mesmo botão azul grande, em Deslocamento.'},
      {alvo: '[data-visita="salvar"]', tipo: 'tocar', espera: 'salvar', titulo: 'Salvar',
        pede: 'Toque em Salvar a visita.', erro: 'Role até o fim da tela: é o botão azul "Salvar a visita".'},
      {alvo: '#btnFooterNuvem', tipo: 'fim', titulo: 'Parabéns!',
        pede: 'Você registrou uma visita. A Nuvem, na barra de baixo, mostra quando ela chegou à planilha.'},
    ],
  },
};

/**
 * Qual tutorial vale para o #hash.
 * @param {string} hash
 * @return {string} '' se a tela ainda não tem tutorial.
 */
export function chaveDoTutorial(hash) {
  const [base, id, extra] = String(hash || '').split('/');
  let chave = '';
  if (base === '' || base === '#pessoas' || base === '#vicentinos') {
    chave = !id ? 'pessoas' : id === 'novo' ? 'pessoa_nova' : 'pessoa_detalhe';
  } else if (base === '#familias') {
    chave = id ? 'familia_detalhe' : 'familias';
  } else if (base === '#visitas') {
    chave = 'visitas';
  } else if (base === '#visita' && id) {
    chave = extra ? 'visita_completar' : 'visita';
  } else if (base === '#sugestoes') {
    chave = 'sugestoes';
  } else if (base === '#sobre') {
    chave = 'sobre';
  } else if (base === '#cuidados') {
    chave = 'cuidados';
  } else if (base === '#como-funciona') {
    chave = 'como_funciona';
  } else if (base === '#importar') {
    chave = 'importar';
  }
  return TUTORIAIS[chave] ? chave : '';
}
