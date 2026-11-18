#!/bin/bash
set -e

# Restore script for Eventox SQLite Database
BACKUP_FILE="$1"
DB_PATH="${DATABASE_PATH:-./data/eventox.db}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Uso: ./scripts/restore-db.sh <caminho_do_arquivo_backup.db ou .db.gz>"
    exit 1
fi

echo "⚠️  ATENÇÃO: A base de dados atual será substituída pelo backup: $BACKUP_FILE"
read -p "Tem a certeza que deseja restaurar? (s/N): " CONFIRM
if [ "$CONFIRM" != "s" ] && [ "$CONFIRM" != "S" ]; then
    echo "Operação cancelada."
    exit 0
fi

# Criar backup de segurança do estado antes da restauração
if [ -f "$DB_PATH" ]; then
    cp "$DB_PATH" "${DB_PATH}.pre_restore_bak"
    echo "✔ Cópia de segurança criada em: ${DB_PATH}.pre_restore_bak"
fi

if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" > "$DB_PATH"
else
    cp "$BACKUP_FILE" "$DB_PATH"
fi

echo "✅ Base de dados restaurada com sucesso!"
