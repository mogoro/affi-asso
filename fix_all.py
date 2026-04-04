import os
import psycopg2
DB_URL = os.environ.get('DATABASE_URL', '')
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Fix doublons: garder les bons comptes, supprimer les anciens
# Mogoro: garder jj.mogoro@gmail.com (id 26), supprimer mogoro@gmail.com
cur.execute("SELECT id FROM members WHERE email='mogoro@gmail.com'")
r = cur.fetchone()
if r:
    cur.execute("DELETE FROM sessions WHERE member_id=%s", [r[0]])
    cur.execute("DELETE FROM board_members WHERE member_id=%s", [r[0]])
    cur.execute("DELETE FROM members WHERE id=%s", [r[0]])
    print(f"  Supprime doublon mogoro@gmail.com (#{r[0]})")

# Picard: garder francois-xavier.picard@reseau.sncf.fr (id 28), supprimer fx.picard@affi.fr
cur.execute("SELECT id FROM members WHERE email='fx.picard@affi.fr'")
r = cur.fetchone()
if r:
    cur.execute("DELETE FROM sessions WHERE member_id=%s", [r[0]])
    cur.execute("DELETE FROM board_members WHERE member_id=%s", [r[0]])
    cur.execute("DELETE FROM members WHERE id=%s", [r[0]])
    print(f"  Supprime doublon fx.picard@affi.fr (#{r[0]})")

conn.commit()

# Verification
cur.execute("SELECT COUNT(*) FROM members WHERE status='active'")
print(f"\nMembres actifs: {cur.fetchone()[0]}")
cur.execute("SELECT COUNT(*) FROM members WHERE consent_annuaire=TRUE AND status='active'")
print(f"Visibles annuaire: {cur.fetchone()[0]}")

conn.close()
print("Done")
