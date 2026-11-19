# 🌟 EVENTOX LIVE 2.0 — Manual Operacional e Guia de Campo

Guia oficial para organização, equipa de protocolo/recepção, operadores audiovisuais (AV), fotografia, catering e administração técnica em eventos solenes e galas.

---

## 📑 Índice
1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Procedimentos da Recepção e Protocolo](#2-procedimentos-da-recepção-e-protocolo)
3. [Operação Audiovisual (Mesa de Controlo AV)](#3-operação-audiovisual-mesa-de-controlo-av)
4. [Modo Ecrã 16:9 (Projecção em TV/Projector/LED)](#4-modo-ecrã-169-projecção-em-tvprojectorled)
5. [Mural dos Convidados e Experiências Criativas](#5-mural-dos-convidados-e-experiências-criativas)
6. [Matriz de Funções e Permissões (RBAC)](#6-matriz-de-funções-e-permissões-rbac)
7. [Resolução de Problemas em Tempo Real](#7-resolução-de-problemas-em-tempo-real)
8. [Procedimentos de Backup, Publicação e Rollback](#8-procedimentos-de-backup-publicação-e-rollback)

---

## 1. Visão Geral da Arquitetura

O **Eventox 2.0** opera com uma stack moderna de alta disponibilidade:
- **Runtime:** Node.js 22 Standalone (`dist/standalone/server.js`) gerido por PM2 no porto `3050`.
- **Servidor Web / Reverse Proxy:** Nginx com SSL Let's Encrypt para `evento.kazix.site` e `eventox.kazix.site`.
- **Base de Dados:** SQLite nativo via `better-sqlite3` (`data/eventox.db`) com isolamento multi-evento e transações seguras.
- **Sincronização em Tempo Real:** Server-Sent Events (SSE) via `/api/screen/[slug]/stream` com fallback automático para polling (3s) caso haja interrupção de rede.
- **Armazenamento:** Compatibilidade S3/R2 para galerias multimédia com tokens seguros no servidor.

---

## 2. Procedimentos da Recepção e Protocolo

### 2.1 Acesso da Equipa de Recepção
1. Aceder a `https://evento.kazix.site/dashboard` ou `https://evento.kazix.site/[slug]`.
2. Iniciar sessão com a conta atribuída com função `recepcao` ou código administrativo do evento.
3. Clicar no módulo **Convidados** no menu lateral.

### 2.2 Fluxo de Entrada e Check-in
1. **Localização do Convidado:**
   - Digitar o nome ou apelido na barra de pesquisa rápida.
   - Confirmar a mesa atribuída e o número do lugar.
2. **Efectuar Check-in:**
   - Clicar no botão verde **Entrada**.
   - O estado do convidado passa imediatamente a `Presente` / `No Salão`.
   - **Gatilho Automático:** É gerada uma mensagem de boas-vindas categorizada na fila AV (`screen_messages`).
3. **Categorias Inteligentes de Boas-Vindas:**
   - **Casal:** Deteta automaticamente nomes compostos com "e" / "&" (ex.: *"Bem-vindos, Dr. Alberto e Dra. Maria!"*).
   - **Família:** Deteta termos de família (ex.: *"Que alegria receber a Família Silveira!"*).
   - **Honra:** Atribuído a docentes, directores e entidades oficiais.
   - **Individual:** Boas-vindas calorosas personalizadas.
4. **Proteção Anti-Duplicação:**
   - O sistema bloqueia automaticamente emissões repetidas caso o botão seja clicado mais de uma vez para o mesmo convidado.

---

## 3. Operação Audiovisual (Mesa de Controlo AV)

Aceder à mesa de controlo em:
```
https://evento.kazix.site/[slug]/screen/control
```

### 3.1 Painel de Controlo Master
- **Pausar Rotação (Fixar Cena):** Bloqueia a transição automática de cenas. Ideal para manter o *Countdown* fixo nos últimos 5 minutos antes da entrada solene.
- **Retomar Rotação Automática:** Restaura o carrossel de cenas respeitando a duração de cada uma (10–15 segundos).
- **Ativar Modo de Emergência:** Dispara uma tela de alta visibilidade vermelha com mensagem urgente configurável para todo o salão.
- **Seletor de Temas:**
  - `Midnight Gold`: Preto obsidiana com dourado elegante e brilhos quentes (padrão solene).
  - `Royal Wine`: Borgonha profundo com tons champanhe e rosé gold.
  - `Cinematic Dark`: Preto titânio com detalhes prata e azul gelo.

### 3.2 Seletor Directo de Cenas (Jump)
Basta um clique no cartão da cena desejada para que o projector transite instantaneamente para:
- `welcome`: Boas-vindas oficiais com anfitrião e dados solenes.
- `countdown`: Contagem decrescente com mostradores em tempo real.
- `arrivals`: Lista de recém-chegados (apenas nomes públicos higienizados).
- `fun_quote`: Citações de formatura médica, juramento e humor inteligente.
- `gallery_mural`: Mural dinâmico de fotos e dedicatórias dos convidados.
- `qr_code`: QR Code gigante de alta nitidez para os convidados interagirem.
- `schedule`: Ordem de trabalhos oficial (programa da gala).
- `tribute`: Homenagem aos pais, familiares e corpo docente.
- `gratitude`: Agradecimento final e brinde da noite.

### 3.3 Fila de Boas-Vindas (AV Queue)
- O operador pode:
  - **Exibir Agora:** Interrompe momentaneamente a rotação para projetar a faixa de recepção de honra no topo do ecrã.
  - **Aprovar:** Coloca a mensagem na rotação normal.
  - **Descartar:** Cancela mensagens impróprias ou duplicadas.

### 3.4 Emissão Instantânea no Ecrã (Live Broadcast)
No campo de emissão direta, escreva qualquer aviso pontual (ex.: *"Atenção: A sessão de fotos no jardim começa em 5 minutos"*) e clique em **Projectar no Ecrã**. O banner surgirá imediatamente no topo do projector.

---

## 4. Modo Ecrã 16:9 (Projecção em TV/Projector/LED)

Aceder ao ecrã público em:
```
https://evento.kazix.site/[slug]/screen
```

### 4.1 Configuração na Sala / Projector
1. Abrir a página no navegador do computador ligado à saída HDMI do projector ou painel LED.
2. Pressionar a tecla **`F`** ou clicar no botão flutuante no canto superior direito para entrar em **Ecrã Inteiro (Fullscreen 16:9)**.
3. Os controlos flutuantes ocultam-se automaticamente após 3 segundos de inatividade do cursor.

### 4.2 Atalhos de Teclado
| Tecla | Acção |
| :--- | :--- |
| **`F`** | Alternar modo de ecrã inteiro (Fullscreen) |
| **`→`** (Seta Direita) | Avançar imediatamente para a próxima cena |
| **`←`** (Seta Esquerda) | Voltar para a cena anterior |

### 4.3 Garantia de Privacidade (Zero Leaks)
O ecrã público é estritamente **read-only**:
- **Nunca** exibe números de telefone, endereços de email, restrições alimentares ou notas privadas.
- O ecrã higieniza todos os dados antes de projetar (mostra apenas o nome de exibição e mesa quando aplicável).

---

## 5. Mural dos Convidados e Experiências Criativas

Aceder ao mural interativo em:
```
https://evento.kazix.site/[slug]/mural
```

1. **Acesso Fácil:** Os convidados acedem através do QR Code projetado no ecrã ou partilhado nas mesas.
2. **Envio de Felicitações:**
   - Nome completo e relação (Família, Colega de Medicina, Amigo, Docente).
   - Mensagem de parabéns (até 450 caracteres).
3. **Moderação:**
   - Mensagens entram em estado pendente até aprovação pela equipa AV ou comissão organizadora.
   - Mensagens aprovadas surgem em cartões elegantes no mural e são incorporadas na cena `gallery_mural` do ecrã gigante.

---

## 6. Matriz de Funções e Permissões (RBAC)

| Função | Visualizar | Gestão Convidados | Recepção Check-in | Operar Ecrã AV | Catering/Bar | Gerir Equipa |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Proprietário** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Coorganizador** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Recepção / Protocolo** | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Audiovisual (AV)** | ✅ | Apenas Nomes | ❌ | ✅ | ❌ | ❌ |
| **Catering & Bar** | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Fotografia** | ✅ | ❌ | ❌ | Moderação Galeria | ❌ | ❌ |
| **Comissão Organizadora** | ✅ | ✅ (Tarefas) | ❌ | ❌ | ❌ | ❌ |

---

## 7. Resolução de Problemas em Tempo Real

### 7.1 O ecrã não atualiza em tempo real
- **Causa:** Queda temporária de Wi-Fi ou firewall local a bloquear WebSockets/SSE.
- **Solução:** O ecrã possui fallback automático via polling (a cada 3-4 segundos). Se necessário, pressione `F5` para recarregar o navegador do projector.

### 7.2 A contagem decrescente terminou antes da hora
- **Causa:** Fuso horário incorreto nas configurações do evento.
- **Solução:** No painel de administração (`/settings`), verifique a data e hora do evento (`Africa/Maputo` GMT+2).

### 7.3 Mensagem indevida foi projetada
- **Solução Imediata:** Na mesa de controlo AV (`/screen/control`), localize a mensagem na fila e clique em **Descartar**. Alternativamente, force a mudança para outra cena (`welcome` ou `tribute`).

---

## 8. Procedimentos de Backup, Publicação e Rollback

### 8.1 Criar Backup da Base de Dados
Execute a qualquer momento no servidor VPS:
```bash
node scripts/backup-db.mjs
```
O backup nativo SQLite é gerado em `backups/eventox_backup_YYYY_MM_DD_HH_mm_ss.db`.

### 8.2 Executar Testes Automatizados
```bash
node scripts/test-eventox-live.mjs
```

### 8.3 Compilação e Reinício da Aplicação
```bash
npm run build:vps
pm2 reload ecosystem.vps.config.cjs --update-env
```

### 8.4 Procedimento de Rollback
Em caso de anomalia grave:
1. Restaurar o último backup da base de dados:
   ```bash
   cp backups/eventox_backup_ULTIMO.db data/eventox.db
   ```
2. Reverter para o commit anterior:
   ```bash
   git checkout HEAD~1
   npm run build:vps
   pm2 reload eventox-app
   ```
