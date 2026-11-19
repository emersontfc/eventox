import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'eventox.db');
const backupDir = path.join(process.cwd(), 'backups');

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Base de dados não encontrada em: ${dbPath}`);
  process.exit(1);
}

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[-:T]/g, '_').split('.')[0];
const targetFile = path.join(backupDir, `eventox_backup_${timestamp}.db`);

console.log(`📦 Criando backup de ${dbPath}...`);
const db = new Database(dbPath);

db.backup(targetFile)
  .then(() => {
    const stats = fs.statSync(targetFile);
    console.log(`✅ Backup concluído com sucesso: ${targetFile} (${Math.round(stats.size / 1024)} KB)`);
    db.close();
  })
  .catch((err) => {
    console.error(`❌ Erro ao criar backup:`, err);
    db.close();
    process.exit(1);
  });
