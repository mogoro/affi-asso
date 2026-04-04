import os
import psycopg2
DB_URL = os.environ.get('DATABASE_URL', '')
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()
cur.execute("""SELECT email, first_name, last_name, consent_annuaire, is_mentor, status
    FROM members WHERE status='active' ORDER BY last_name""")
for r in cur.fetchall():
    print(f"  {r[1]:15} {r[2]:20} consent={r[3]!s:6} mentor={r[4]!s:6} ({r[0]})")
print()
cur.execute("""SELECT COUNT(*) FROM members WHERE status='active' AND consent_annuaire=TRUE""")
print(f"Visibles annuaire public: {cur.fetchone()[0]}")
conn.close()
