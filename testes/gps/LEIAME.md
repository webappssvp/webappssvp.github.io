# Teste GPS offline

PWA que grava 4 pontos de um percurso (início, chegada, saída, término) com o GPS,
sem internet, no IndexedDB. Com internet, abre a rota no Google Maps.

## Endereço publicado (GitHub Pages)

`https://webappssvp.github.io/testes/gps/`

## Abrir no celular a partir do Live Server

O Live Server já abre em https (ver `dev_local/certificados_https/LEIAME.md`).
No celular, com a CA local instalada, abra:

`https://192.168.15.87:5500/testes/gps/index.html`

- Confira que o cadeado aparece sem aviso. Se o Chrome mostrar aviso de certificado,
  a CA não está instalada no celular: o service worker não registra e o app não abre offline.
- Instale pelo menu do Chrome (*Instalar app* / *Adicionar à tela inicial*).
- Antes de sair, teste: feche tudo, ligue o modo avião e abra o app pelo ícone.
- O aviso amarelo na tela indica que a página não está em endereço seguro.

## Cuidados no teste

- Dê a permissão de localização em casa, antes de sair.
- Em modo avião o GPS continua funcionando, mas a primeira posição pode demorar
  (de 30 s a alguns minutos), porque o celular não baixa a ajuda da internet.
  Abra o app um pouco antes, em céu aberto, e espere a precisão ficar verde.
- Dentro de prédio o sinal é fraco: a portaria pode dar precisão ruim.
- O GPS só lê com o app aberto e a tela ligada. Não há registro do caminho entre os toques.
- A rota do Google Maps é calculada pelo Google entre os 4 pontos, a pé.
  Não é o caminho que você fez de fato.

## Versão nova

Aumente a `VERSAO` em `sw.js`. O app pega a versão nova ao abrir de novo com internet.
