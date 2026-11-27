# EventoX

O EventoX ajuda a organizar eventos desde o envio dos convites até à partilha das recordações. A organização gere convidados, mesas e programa. No dia do evento, os convidados acompanham o programa e participam pelo telemóvel, enquanto a equipa controla o ecrã pelo Estúdio Live.

[Abrir o EventoX](https://eventox.kazix.site/)

## Antes do evento

- **Convites digitais** para convidados individuais ou casais, com confirmação de presença, data, local e contagem decrescente.
- **Organização da sala** com lista de convidados e distribuição de lugares por mesa.
- **Preparação do evento** com programa, cardápio e permissões para a equipa de organização.

## No dia do evento

- **Receção** com pesquisa de convidados e registo de entradas. O lugar à mesa fica disponível no convite após a entrada.
- **Programa ao vivo** com o momento atual e o seguinte no convite pessoal. O cardápio também fica disponível no dia.
- **Galeria e mural** com álbuns de fotos e vídeos, dedicatórias com foto e moderação antes da publicação.
- **Estúdio Live** com fila e pré-visualização de conteúdos para projeção. A equipa pode abrir votações no telemóvel e decidir quando mostrar os resultados no ecrã.

## Depois do evento

- **Livro de Recordações** em PDF com dedicatórias e fotografias aprovadas.

## Stack e publicação

A versão publicada usa TypeScript, React e Vinext, com Node.js, SQLite e Drizzle. A aplicação corre numa VPS com PM2 e Nginx.

[Código da versão publicada](https://github.com/emersontfc/eventox/tree/deploy/vps-node) · [Manual de publicação na VPS](https://github.com/emersontfc/eventox/blob/deploy/vps-node/DEPLOY_VPS.md)
