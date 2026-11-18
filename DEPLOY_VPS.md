# Manual de Alojamento de Produção na VPS (Node.js 22 + PM2 + Nginx)

Este guia documenta a arquitetura, procedimentos de migração, publicação, backups, rollback e segurança do **Eventox** no ambiente de produção VPS Ubuntu.

---

## 1. Arquitetura da Solução

- **Runtime de Produção:** Node.js 22 LTS executando o bundle `standalone` gerado pelo Vinext (`dist/standalone/server.js`).
- **Servidor:** Servidor HTTP nativo Node em `127.0.0.1:3050`. **Wrangler não é utilizado em produção.**
- **Gestor de Processos:** PM2 configurado exclusivamente em `ecosystem.vps.config.cjs` (sem conflitar com AgentX ou outras aplicações na porta 3000).
- **Base de Dados:** SQLite persistente de alto desempenho (`data/eventox.db`) com `better-sqlite3` e WAL mode (`journal_mode = WAL`). As migrações (`0000` a `0005`) e o seed são aplicados de forma segura e idempotente.
- **Armazenamento de Mídia:** Adaptador compatível com a API S3 (Cloudflare R2), com credenciais isoladas no servidor e fallback automático em disco local (`data/uploads`).
- **Autenticação Segura:** Sessões assinadas com HMAC-SHA256 em cookies HTTP-only, senhas com hash `scrypt` e salting criptográfico. Códigos fixos, cookies em texto claro e bypasses de desenvolvimento foram removidos.
- **Reverse Proxy:** Nginx encaminhando o domínio `evento.kazix.site` (e `eventox.kazix.site`) para `http://127.0.0.1:3050` com suporte HTTP/1.1, WebSockets e SSL (Let's Encrypt / Certbot).
- **Google Drive OAuth:** Callback configurado para `https://evento.kazix.site/api/drive/callback` com tokens encriptados via AES-GCM.

---

## 2. Requisitos da VPS

- Ubuntu 22.04 LTS ou 24.04 LTS
- Node.js >= 22.13.0 LTS
- NPM >= 10.x
- PM2 (`sudo npm install -g pm2`)
- Nginx & Certbot (`sudo apt install -y nginx certbot python3-certbot-nginx`)
- Portas 80 e 443 abertas na firewall (UFW)

---

## 3. Procedimento de Instalação Inicial na VPS

### 3.1. Clonar e Aceder à Branch de Produção

```bash
cd /var/www
# Se for o primeiro clone:
git clone -b deploy/vps-node https://github.com/emersontfc/eventox.git
cd eventox

# Ou se já tinha a pasta clonada:
cd /var/www/eventox
git fetch origin
git checkout deploy/vps-node
git pull origin deploy/vps-node
```

### 3.2. Configurar Variáveis de Ambiente (`.env`)

Crie o ficheiro de ambiente de produção:

```bash
cp .env.example .env
nano .env
```

Conteúdo recomendado para o `.env`:

```env
NODE_ENV=production
HOST=127.0.0.1
PORT=3050
DATABASE_PATH=./data/eventox.db

# Segredo criptográfico para assinar sessões (gere com: openssl rand -hex 32)
SESSION_SECRET=cria_uma_chave_longa_e_aleatoria_com_openssl_32_bytes

# Google Drive OAuth (conforme requisito 7)
GOOGLE_DRIVE_CALLBACK_URL=https://evento.kazix.site/api/drive/callback
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY=
GOOGLE_DRIVE_SYNC_SECRET=

# Cloudflare R2 (API S3 compatível - opcional se usar disco local)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
```

### 3.3. Compilação e Deploy com o Script Automatizado

```bash
chmod +x deploy-vps.sh
./deploy-vps.sh
```

O script `deploy-vps.sh` executa:
1. Validação do Node.js 22 LTS.
2. `npm install`.
3. `npm run build:vps` (compila o bundle Node standalone em `dist/standalone`).
4. Criação da pasta `data/` e migração/seed automático da base de dados.
5. Início do serviço no PM2 através de `ecosystem.vps.config.cjs` na porta 3050.

---

## 4. Configuração do Nginx e SSL

### 4.1. Ativar o VirtualHost do Nginx

```bash
sudo cp nginx-eventox.conf /etc/nginx/sites-available/eventox
sudo ln -sf /etc/nginx/sites-available/eventox /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4.2. Emitir Certificado SSL com Certbot

```bash
sudo certbot --nginx -d evento.kazix.site -d eventox.kazix.site
```

O Certbot configurará automaticamente o redirecionamento HTTP -> HTTPS e os certificados com renovação automática.

---

## 5. Gestão do Serviço com PM2

- **Verificar estado do Eventox:**
  ```bash
  pm2 status
  ```
- **Ver logs em tempo real:**
  ```bash
  pm2 logs eventox
  ```
- **Reiniciar a aplicação:**
  ```bash
  pm2 restart eventox
  ```
- **Parar a aplicação:**
  ```bash
  pm2 stop eventox
  ```
- **Garantir inicialização após reboot do servidor:**
  ```bash
  pm2 startup
  pm2 save
  ```

---

## 6. Procedimentos de Backup e Restauração da Base de Dados

A base de dados é um ficheiro SQLite localizado em `data/eventox.db`.

### 6.1. Realizar Backup

Para criar um backup consistente online (com WAL ativo) compactado em gzip:

```bash
# Via script bash:
./scripts/backup-db.sh

# Ou via npm:
npm run db:backup
```

Os backups são gravados em `./backups/eventox_backup_YYYYMMDD_HHMMSS.db.gz`. O script remove automaticamente backups com mais de 15 dias para poupar disco.

### 6.2. Agendar Backup Automático Diário (Crontab)

Adicione ao crontab do utilizador `ubuntu` (`crontab -e`):

```cron
0 3 * * * cd /var/www/eventox && ./scripts/backup-db.sh >> /var/log/eventox-backup.log 2>&1
```

### 6.3. Restaurar um Backup (Rollback de Dados)

```bash
# 1. Parar o serviço para fechar locks:
pm2 stop eventox

# 2. Executar o restauro:
./scripts/restore-db.sh backups/eventox_backup_20261118_230000.db.gz

# 3. Reiniciar o serviço:
pm2 start eventox
```

*(O script cria automaticamente uma cópia `eventox.db.pre_restore_bak` antes de sobrescrever).*

### 6.4. Importar Dados Existentes do Wrangler/D1

Se tiver uma cópia antiga do SQLite do Miniflare/Wrangler e quiser migrar registos sem apagar dados:

```bash
npm run db:import [caminho_do_sqlite_antigo]
```

---

## 7. Procedimento de Atualização Contínua (Sem Downtime)

Quando existirem novidades ou commits no repositório:

```bash
cd /var/www/eventox
git pull origin deploy/vps-node
npm install
npm run build:vps
pm2 reload eventox
```

O comando `pm2 reload` reinicia o processo graciosamente sem derrubar conexões ativas.

---

## 8. Rollback de Versão de Código

Caso uma nova versão apresente falhas:

```bash
cd /var/www/eventox

# 1. Voltar ao commit anterior estável:
git log -n 5 --oneline
git checkout <HASH_DO_COMMIT_ANTERIOR>

# 2. Recompilar o bundle:
npm run build:vps

# 3. Recarregar no PM2:
pm2 reload eventox
```

---

## 9. Auditoria de Segurança Realizada

| Ponto de Risco Anterior | Correção Implementada |
|---|---|
| Master passcode fixo (`emerson2026`) | Removido. Autenticação validada exclusivamente contra a base de dados. |
| Passcodes em texto plano na BD | Hashing automático transparente com algoritmo `scrypt` e salting de 16 bytes. |
| Cookie de administração não assinado (`authenticated`) | Substituído por cookie assinado criptograficamente com HMAC-SHA256 (`eventox_session_${slug}`). |
| Bypass de desenvolvimento (`if (NODE_ENV !== 'production') return true;`) | Removido. Autorização no servidor obrigatória em todos os ambientes. |
| Revelação de passcodes no endpoint de gestão | O campo `passcode` foi omitido de respostas de leitura (`GET`). |
| Callback OAuth antigo | Atualizado para `https://evento.kazix.site/api/drive/callback`. |
| Conflito de portas com AgentX (porta 3000) | Eventox isolado com sucesso na porta dedicada `3050`. |
