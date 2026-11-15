# Eventox — continuação no Antigravity

Código exportado da plataforma Gestão de Convidados, versão de origem d3faea5969a63f96d924aab7b78d43266c646595.

## Abrir localmente

```sh
git clone https://github.com/emersontfc/eventox.git
cd eventox
npm run install:ci
npm run dev
```

Requer Node.js >=22.13.0. Consulte README.md para configuração portable, build e migrações D1 locais.

## Estado da exportação

Inclui código, recursos versionados, lockfile, esquema e migrações SQL. Não inclui registos da base de dados de produção, fotografias/vídeos do R2, credenciais, tokens nem configuração secreta do Google Drive. O site publicado continua independente deste repositório: commits aqui não o atualizam automaticamente.

## Dependências a adaptar antes de alojar fora do Sites

- Base de dados Cloudflare D1 (binding DB), Drizzle e migrações em drizzle/.
- Ficheiros Cloudflare R2 (binding BUCKET).
- Administração: app/admin-auth.ts e app/chatgpt-auth.ts dependem da identidade autenticada injetada pelo Sites. Para outra hospedagem implementar autenticação real e autorização no servidor; nunca confiar em headers fornecidos pelo visitante.
- Google Drive: configurar GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY no ambiente. Alterar callbackUrl em app/drive-oauth.ts e a URI autorizada no Google para o domínio escolhido.
- .openai/hosting.json conserva a identidade do site de origem; não reutilizar esse project_id para criar outro Site.

## Primeiro pedido ao Antigravity

Analisa este repositório antes de alterar. Preserva a interface e as funcionalidades existentes de convidados, importação de listas, mesas, confirmações, comissão, hospitalidade e galeria. Prepara execução local e apresenta as dependências externas ainda necessárias. Não substituas o projeto por um template. Planeia a migração da autenticação, D1 e R2 para o destino escolhido, sem simular sucesso nem apagar dados. Não faças deploy sem o destino estar definido.
