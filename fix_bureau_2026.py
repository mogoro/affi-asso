import os
import psycopg2, hashlib

DB_URL = os.environ.get('DATABASE_URL', '')
def hash_pw(pw):
    return hashlib.sha256(f"affi2026:{pw}".encode()).hexdigest()

conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Picard -> President
cur.execute("UPDATE members SET job_title='President' WHERE email='francois-xavier.picard@reseau.sncf.fr'")
cur.execute("UPDATE board_members SET role='President' WHERE member_id=(SELECT id FROM members WHERE email='francois-xavier.picard@reseau.sncf.fr')")

# Antoni -> Vice-President
cur.execute("UPDATE members SET job_title='Vice-President' WHERE email='marc.antoni@affi.fr'")
cur.execute("UPDATE board_members SET role='Vice-President' WHERE member_id=(SELECT id FROM members WHERE email='marc.antoni@affi.fr')")

# Mogoro -> Secretaire general
cur.execute("UPDATE members SET job_title='Secretaire general' WHERE email='jj.mogoro@gmail.com'")
cur.execute("UPDATE board_members SET role='Secretaire general' WHERE member_id=(SELECT id FROM members WHERE email='jj.mogoro@gmail.com')")

# Mingasson -> Secretaire general adjoint
cur.execute("UPDATE members SET job_title='Secretaire general adjoint' WHERE email='philippe.mingasson@affi.fr'")
cur.execute("UPDATE board_members SET role='Secretaire general adjoint' WHERE member_id=(SELECT id FROM members WHERE email='philippe.mingasson@affi.fr')")

# Mangone -> Responsable Partenaires
cur.execute("UPDATE members SET job_title='Responsable Partenaires' WHERE email='claude.mangone@reseau.sncf.fr'")
cur.execute("UPDATE board_members SET role='Responsable Partenaires' WHERE member_id=(SELECT id FROM members WHERE email='claude.mangone@reseau.sncf.fr')")

# Creer Gauchery et Harzallah
for acct in [
    {"email": "antoine.gauchery@affi.fr", "first_name": "Antoine", "last_name": "Gauchery"},
    {"email": "malek.harzallah@affi.fr", "first_name": "Malek", "last_name": "Harzallah"},
]:
    cur.execute("SELECT id FROM members WHERE email = %s", [acct["email"]])
    if not cur.fetchone():
        pw = hash_pw("affi2026")
        cur.execute("""INSERT INTO members (email, password_hash, first_name, last_name, company,
            job_title, sector, region, is_board, role, status, membership_type,
            consent_annuaire, consent_newsletter, consent_date)
            VALUES (%s,%s,%s,%s,'AFFI','Membre du Bureau','Ingenierie & Conseil','Ile-de-France',
            TRUE,'member','active','standard',TRUE,TRUE,NOW())""",
            [acct["email"], pw, acct["first_name"], acct["last_name"]])
        cur.execute("SELECT id FROM members WHERE email=%s", [acct["email"]])
        mid = cur.fetchone()[0]
        cur.execute("INSERT INTO board_members (member_id, role, title, is_active) VALUES (%s,'Membre du Bureau','Membre du Bureau',TRUE)", [mid])
        print(f"  NEW {acct['email']}")

conn.commit()

# Verification
cur.execute("""SELECT m.first_name, m.last_name, m.job_title, b.role
    FROM members m JOIN board_members b ON m.id = b.member_id
    WHERE b.is_active=TRUE ORDER BY b.sort_order, m.last_name""")
for r in cur.fetchall():
    print(f"  {r[0]} {r[1]} — {r[3]} (fiche: {r[2]})")

conn.close()
print("Done")
