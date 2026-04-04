#!/usr/bin/env python3
"""Backup securise de la base de donnees Neon PostgreSQL."""
import psycopg2
import datetime
import os
import sys

# SECURITE: ne JAMAIS mettre le DATABASE_URL en dur
DB_URL = os.getenv('DATABASE_URL')
if not DB_URL:
    print("ERREUR: Variable d'environnement DATABASE_URL requise.")
    print("Usage: DATABASE_URL='postgresql://...' python backup_db.py")
    sys.exit(1)

BACKUP_DIR = os.path.join(os.path.dirname(__file__), 'backups')
os.makedirs(BACKUP_DIR, exist_ok=True)

conn = psycopg2.connect(DB_URL, sslmode='require', connect_timeout=10)
cur = conn.cursor()

date = datetime.datetime.now().strftime('%Y%m%d_%H%M')
filename = os.path.join(BACKUP_DIR, f'backup_neon_{date}.sql')

# Lister toutes les tables
cur.execute("""SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename""")
tables = [row[0] for row in cur.fetchall()]

# Tables sensibles: ne pas inclure les password_hash en clair dans le backup
REDACT_COLUMNS = {'members': ['password_hash']}

total_rows = 0
with open(filename, 'w', encoding='utf-8') as f:
    f.write(f"-- Backup AFFI-ASSO Neon DB — {date}\n")
    f.write(f"-- Tables: {len(tables)}\n")
    f.write(f"-- ATTENTION: les password_hash sont masques pour securite\n\n")
    f.write("BEGIN;\n\n")

    for table in tables:
        cur.execute(f"SELECT * FROM {table}")
        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        redacted = REDACT_COLUMNS.get(table, [])
        total_rows += len(rows)

        f.write(f"\n-- ========================================\n")
        f.write(f"-- Table: {table} ({len(rows)} rows)\n")
        f.write(f"-- ========================================\n")

        for row in rows:
            values = []
            for i, v in enumerate(row):
                col_name = cols[i]
                # Masquer les colonnes sensibles
                if col_name in redacted:
                    values.append("'[REDACTED]'")
                elif v is None:
                    values.append('NULL')
                elif isinstance(v, bool):
                    values.append('TRUE' if v else 'FALSE')
                elif isinstance(v, (int, float)):
                    values.append(str(v))
                elif isinstance(v, list):
                    arr = ', '.join(f"'{str(x)}'" for x in v)
                    values.append(f"ARRAY[{arr}]")
                else:
                    escaped = str(v).replace("'", "''")
                    values.append(f"'{escaped}'")
            f.write(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(values)}) ON CONFLICT DO NOTHING;\n")

        print(f"  {table}: {len(rows)} rows")

    f.write("\nCOMMIT;\n")

conn.close()

# Supprimer les backups de plus de 30 jours
for old_file in os.listdir(BACKUP_DIR):
    path = os.path.join(BACKUP_DIR, old_file)
    if os.path.isfile(path) and (datetime.datetime.now().timestamp() - os.path.getmtime(path)) > 30 * 86400:
        os.remove(path)
        print(f"  Ancien backup supprime: {old_file}")

print(f"\nBackup sauvegarde: {filename}")
print(f"Total: {len(tables)} tables, {total_rows} rows")
