import * as schema from "./schema";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _db: any = null;
let _sqliteInstance: InstanceType<typeof Database> | null = null;

export function getDatabasePath(): string {
  const custom = process.env.DATABASE_PATH;
  if (custom) return path.resolve(custom);
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, "eventox.db");
}

function applyMigrations(sqlite: InstanceType<typeof Database>) {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS _eventox_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    applied_at TEXT NOT NULL
  )`);

  const drizzleDir = path.resolve(process.cwd(), "drizzle");
  if (!fs.existsSync(drizzleDir)) return;

  const files = fs.readdirSync(drizzleDir).filter(f => f.endsWith(".sql")).sort();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appliedRows = sqlite.prepare("SELECT name FROM _eventox_migrations").all() as any[];
  const applied = new Set(appliedRows.map(r => r.name));

  for (const file of files) {
    if (applied.has(file)) continue;
    const content = fs.readFileSync(path.join(drizzleDir, file), "utf-8");
    const statements = content.split("--> statement-breakpoint");
    sqlite.transaction(() => {
      for (const raw of statements) {
        const stmt = raw.trim();
        if (!stmt) continue;
        try {
          sqlite.exec(stmt);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (err: any) {
          // If table or column already exists, proceed safely
          if (!err.message?.includes("already exists")) {
            console.warn(`[migração ${file}]: ${err.message}`);
          }
        }
      }
      sqlite.prepare("INSERT INTO _eventox_migrations (name, applied_at) VALUES (?, ?)").run(
        file,
        new Date().toISOString()
      );
    })();
  }
}

export function getDb() {
  if (_db) return _db;

  // Node.js environment (VPS Standalone / Production / CLI)
  if (typeof process !== "undefined" && (process.versions?.node || process.env.NODE_ENV)) {
    const dbPath = getDatabasePath();
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    _sqliteInstance = new Database(dbPath);
    _sqliteInstance.pragma("journal_mode = WAL");
    _sqliteInstance.pragma("busy_timeout = 5000");

    applyMigrations(_sqliteInstance);

    _db = drizzle(_sqliteInstance, { schema });
    return _db;
  }

  throw new Error("Base de dados indisponível (Node SQLite).");
}

export function getRawSqlite(): InstanceType<typeof Database> | null {
  if (!_sqliteInstance) getDb();
  return _sqliteInstance;
}
