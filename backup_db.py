#!/usr/bin/env python3
"""Backup de la base de donnees Neon PostgreSQL en fichier SQL."""
import psycopg2
import datetime
import os

DB_URL = os.getenv('DATABASE_URL',
    'postgresql://neondb_owner:npg_jBZhGekb5l3t@ep-holy-grass-anqa8ub6-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require')

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

date = datetime.datetime.now().strftime('%Y%m%d_%H%M')
filename = f'backup_neon_{date}.sql'

# Lister toutes les tables
cur.execute("""SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename""")
tables = [row[0] for row in cur.fetchall()]

total_rows = 0
with open(filename, 'w', encoding='utf-8') as f:
    f.write(f"-- Backup AFFI-ASSO Neon DB — {date}\n")
    f.write(f"-- Tables: {len(tables)}\n\n")

    for table in tables:
        cur.execute(f"SELECT * FROM {table}")
        rows = cur.fetchall()
        cols = [desc[0] for desc in cur.description]
        total_rows += len(rows)

        f.write(f"\n-- ========================================\n")
        f.write(f"-- Table: {table} ({len(rows)} rows)\n")
        f.write(f"-- ========================================\n")
        f.write(f"DELETE FROM {table} CASCADE;\n")

        for row in rows:
            values = []
            for v in row:
                if v is None:
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
            f.write(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(values)});\n")

        print(f"  {table}: {len(rows)} rows")

conn.close()
print(f"\nBackup sauvegarde: {filename}")
print(f"Total: {len(tables)} tables, {total_rows} rows")
