import psycopg2
DB_URL = 'postgresql://neondb_owner:npg_jBZhGekb5l3t@ep-holy-grass-anqa8ub6-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require'
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# Corrections d'emails
UPDATES = [
    # Mogoro: jj.mogoro@gmail.com -> mogoro@gmail.com
    ("jj.mogoro@gmail.com", "mogoro@gmail.com"),
    # Mingasson: philippe.mingasson@affi.fr -> phi.mingasson@gmail.com
    ("philippe.mingasson@affi.fr", "phi.mingasson@gmail.com"),
    # Vandenbrouck: christophe.vandenbrouck@affi.fr -> christophe.vandenbrouck@reseau.sncf.fr
    ("christophe.vandenbrouck@affi.fr", "christophe.vandenbrouck@reseau.sncf.fr"),
    # Gauchery: antoine.gauchery@affi.fr -> antoine.gauchery@ratp.fr
    ("antoine.gauchery@affi.fr", "antoine.gauchery@ratp.fr"),
    # Laval: patrick.laval@affi.fr -> patricklaval@yahoo.fr
    ("patrick.laval@affi.fr", "patricklaval@yahoo.fr"),
    # Stamm-Douvier: vivien.stamm-douvier@affi.fr -> vivien.stamm-douvier@helloparis-services.com
    ("vivien.stamm-douvier@affi.fr", "vivien.stamm-douvier@helloparis-services.com"),
    # Antoni: marc.antoni@affi.fr -> marc.pierre.antoni@gmail.com
    ("marc.antoni@affi.fr", "marc.pierre.antoni@gmail.com"),
    # Riff: jean-pierre.riff@affi.fr -> jean-pierre.riff@wanadoo.fr
    ("jean-pierre.riff@affi.fr", "jean-pierre.riff@wanadoo.fr"),
    # Benoit: kevin.benoit@affi.fr -> kevin.benoit@atif.fr
    ("kevin.benoit@affi.fr", "kevin.benoit@atif.fr"),
    # Harzallah: malek.harzallah@affi.fr -> malek.harzallah@ratp.fr
    ("malek.harzallah@affi.fr", "malek.harzallah@ratp.fr"),
    # Rosalie Loubinoux: on garde rosalie.loubinoux@affi.fr (pas dans la liste)
    # Picard: deja bon (francois-xavier.picard@reseau.sncf.fr)
    # Mangone: deja bon (claude.mangone@reseau.sncf.fr)
    # Beck: on garde mikael.beck@affi.fr (pas dans la liste)
    # Bilimoff: on garde igor.bilimoff@ffrif.fr (pas dans la liste)
]

for old, new in UPDATES:
    cur.execute("SELECT id FROM members WHERE email=%s", [old])
    r = cur.fetchone()
    if r:
        # Verifier que le nouvel email n'existe pas deja
        cur.execute("SELECT id FROM members WHERE email=%s", [new])
        dup = cur.fetchone()
        if dup:
            print(f"  SKIP {old} -> {new} (email deja utilise par #{dup[0]})")
        else:
            cur.execute("UPDATE members SET email=%s WHERE email=%s", [new, old])
            print(f"  OK   {old} -> {new}")
    else:
        print(f"  MISS {old} (non trouve)")

conn.commit()

# Verification finale
print("\nComptes bureau:")
cur.execute("""SELECT m.email, m.first_name, m.last_name, m.is_admin, b.role
    FROM members m JOIN board_members b ON m.id = b.member_id
    WHERE b.is_active=TRUE ORDER BY b.sort_order, m.last_name""")
for r in cur.fetchall():
    admin = " [ADMIN]" if r[3] else ""
    print(f"  {r[1]:18} {r[2]:18} {r[0]:45} {r[4]}{admin}")

conn.close()
print("\nDone")
