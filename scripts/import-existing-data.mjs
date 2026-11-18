import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const targetDbPath = process.env.DATABASE_PATH || path.resolve(process.cwd(), "data/eventox.db");
const sourceArg = process.argv[2];

let sourceDbPath = sourceArg;
if (!sourceDbPath) {
  // Try locating Wrangler SQLite state automatically
  const wranglerDir = path.resolve(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  if (fs.existsSync(wranglerDir)) {
    const candidates = fs.readdirSync(wranglerDir).filter(f => f.endsWith(".sqlite") && f !== "metadata.sqlite");
    if (candidates.length > 0) {
      sourceDbPath = path.join(wranglerDir, candidates[0]);
    }
  }
}

if (!sourceDbPath || !fs.existsSync(sourceDbPath)) {
  console.log("Nenhum ficheiro fonte de dados encontrado para importar. A base de dados atual mantém-se.");
  process.exit(0);
}

console.log(`[Importação] Fonte: ${sourceDbPath}`);
console.log(`[Importação] Destino: ${targetDbPath}`);

const source = new Database(sourceDbPath, { readonly: true });
const target = new Database(targetDbPath);

const tables = [
  "events",
  "guest_tables",
  "guests",
  "menu_items",
  "orders",
  "playlist",
  "committee_members",
  "committee_tasks",
  "gallery_media",
  "settings",
];

target.transaction(() => {
  for (const table of tables) {
    try {
      const rows = source.prepare(`SELECT * FROM ${table}`).all();
      if (!rows.length) continue;

      const sample = rows[0];
      const cols = Object.keys(sample);
      const colList = cols.map(c => `\`${c}\``).join(", ");
      const valPlaceholders = cols.map(() => "?").join(", ");

      const insertStmt = target.prepare(
        `INSERT OR IGNORE INTO \`${table}\` (${colList}) VALUES (${valPlaceholders})`
      );

      let count = 0;
      for (const row of rows) {
        insertStmt.run(...Object.values(row));
        count++;
      }
      console.log(`✔ Tabela ${table}: ${count} registo(s) verificado(s)/importado(s).`);
    } catch (err) {
      console.warn(`Aviso na tabela ${table}:`, err.message);
    }
  }
})();

console.log("✅ Importação concluída com sucesso sem sobrescrever registos existentes.");
