#!/bin/bash
set -e

# Backup script for Eventox SQLite Database
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_PATH="${DATABASE_PATH:-./data/eventox.db}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_PATH" ]; then
    echo "❌ Base de dados não encontrada em: $DB_PATH"
    exit 1
fi

TARGET_FILE="$BACKUP_DIR/eventox_backup_$TIMESTAMP.db"

# Usar .backup do sqlite3 se disponível para consistência WAL online, ou cp com segurança
if command -v sqlite3 &> /dev/null; then
    sqlite3 "$DB_PATH" ".backup '$TARGET_FILE'"
else
    cp "$DB_PATH" "$TARGET_FILE"
fi

gzip -k "$TARGET_FILE"
echo "✅ Backup concluído com sucesso: $TARGET_FILE.gz"

# Manter apenas os últimos 15 backups para poupar espaço
find "$BACKUP_DIR" -type f -name "eventox_backup_*.db.gz" -mtime +15 -delete 2>/dev/null || true
