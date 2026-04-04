"""Seed board_members with category and level for dynamic organigramme."""
import psycopg2, os

DB_URL = os.environ.get('DATABASE_URL', '')
if not DB_URL:
    print("ERREUR: DATABASE_URL requis.")
    print("Usage: DATABASE_URL='postgresql://...' python seed_organigramme.py")
    exit(1)

conn = psycopg2.connect(DB_URL, sslmode='require')
cur = conn.cursor()

# Add columns if missing
cur.execute("ALTER TABLE board_members ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'bureau'")
cur.execute("ALTER TABLE board_members ADD COLUMN IF NOT EXISTS level INT DEFAULT 2")
conn.commit()

# Clear existing board members
cur.execute("DELETE FROM board_members")

BOARD = [
    # (role, first_name_pattern, last_name_pattern, category, level, sort_order)
    ("President", "Francois%", "Picard", "bureau", 1, 1),
    ("Vice-President", "Marc", "Antoni", "bureau", 2, 1),
    ("Vice-President", "Yves", "Ramette", "bureau", 2, 2),
    ("Vice-President", "Igor", "Bilimoff", "bureau", 2, 3),
    ("Secretaire General", "Jean-Jacques", "Mogoro", "bureau", 2, 4),
    ("Secretaire General Adjoint", "Philippe", "Mingasson", "bureau", 2, 5),
    ("Secretaire General Adjoint", "Jean-Pierre", "Riff", "bureau", 2, 6),
    ("Tresorier", "Christophe", "Vandenbrouck", "bureau", 2, 7),
    ("Concours Etudiant & RDV AFFI", "Vivien", "Stamm%", "bureau-other", 3, 1),
    ("Responsable Partenaires", "Claude", "Mangone", "bureau-other", 3, 2),
    ("Responsable Communication", "Patrick", "Laval", "bureau-other", 3, 3),
    ("Communication reseaux sociaux", "Kevin", "Benoit", "bureau-other", 3, 4),
    ("Gestion site Internet", "Mikael", "Beck", "bureau-other", 3, 5),
    ("Membre du Bureau", "Antoine", "Gauchery", "bureau-other", 3, 6),
    ("Membre du Bureau", "Malek", "Harzallah", "bureau-other", 3, 7),
    ("President Honoraire", "Jean-Pierre", "Loubinoux", "administrateur", 4, 1),
    ("SAFERAIL", "Quentin", "Barbaud", "administrateur", 4, 2),
    ("Telecom-Paritech", "Gerard", "Cambillau", "administrateur", 4, 3),
    ("Administrateur", "Francois", "Lacote", "administrateur", 4, 4),
    ("Administrateur", "Jean-Louis", "Wagner", "administrateur", 4, 5),
    ("Certifer", "Nicolas", "Castres%", "administrateur", 4, 6),
    ("BEATT", "Jean-Damien", "Poncet", "administrateur", 4, 7),
    ("Alstom", "Pierre", "Fleury", "administrateur", 4, 8),
    ("SNCF", "Thomas", "Joindot", "administrateur", 4, 9),
    ("RATP", "Francois", "Mazza", "administrateur", 4, 10),
    ("Arcadis", "Dominique", "Seguier", "administrateur", 4, 11),
    ("Universite de l'Ingenierie", "Pierre", "Gibbe", "administrateur", 4, 12),
    ("Vossloh", "Julien", "Berthelot", "administrateur", 4, 13),
]

inserted = 0
for role, fn, ln, cat, level, order in BOARD:
    cur.execute("SELECT id FROM members WHERE first_name ILIKE %s AND last_name ILIKE %s LIMIT 1", [fn, ln])
    row = cur.fetchone()
    mid = row[0] if row else None
    cur.execute("INSERT INTO board_members (member_id, role, category, level, sort_order, is_active) VALUES (%s,%s,%s,%s,%s,TRUE)",
        [mid, role, cat, level, order])
    inserted += 1
    status = f"member_id={mid}" if mid else "NOT LINKED"
    print(f"  {role}: {fn} {ln} -> {status}")

conn.commit()
print(f"\nDone: {inserted} board members inserted.")

# Verification
cur.execute("""SELECT b.role, b.category, b.level, b.sort_order, m.first_name, m.last_name
    FROM board_members b LEFT JOIN members m ON b.member_id = m.id
    WHERE b.is_active = TRUE ORDER BY b.level, b.sort_order""")
print("\nVerification:")
for r in cur.fetchall():
    print(f"  L{r[2]} [{r[1]}] {r[0]}: {r[4] or '?'} {r[5] or '?'}")

conn.close()
