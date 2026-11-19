import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

let dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'eventox.db');
const backupDir = path.join(process.cwd(), 'backups');

// Fallback: check if database exists in alternate deployment directory (e.g. eventox-vps)
if (!fs.existsSync(dbPath)) {
  const altPath = path.resolve(process.cwd(), '../eventox-vps/data/eventox.db');
  if (fs.existsSync(altPath)) {
    console.log(`ℹ️ Base de dados detectada em caminho alternativo: ${altPath}`);
    dbPath = altPath;
  } else {
    console.log(`ℹ️ Nenhuma base de dados existente em: ${dbPath}`);
    console.log(`💡 Para inicializar a base de dados com as tabelas e seeds, execute: node scripts/migrate-db.mjs`);
    process.exit(0);
  }
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
