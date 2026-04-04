#!/usr/bin/env python3
"""Migration AFFI 2026 v3 — Creation comptes bureau complet + mise a jour organigramme."""
import psycopg2
import hashlib
import os

DB_URL = os.getenv('DATABASE_URL',
os.environ.get('DATABASE_URL', ''))

def hash_pw(pw):
    salt = "affi2026"
    return hashlib.sha256(f"{salt}:{pw}".encode()).hexdigest()

# Tous les membres du bureau avec leurs roles exacts
BUREAU_MEMBERS = [
    {
        "email": "marc.antoni@affi.fr",
        "first_name": "Marc",
        "last_name": "Antoni",
        "job_title": "President",
        "company": "AFFI",
        "sector": "Ingenierie & Conseil",
        "specialty": "Infrastructure / Voie",
        "region": "Ile-de-France",
        "is_admin": True,
        "is_board": True,
        "is_mentor": True,
        "role": "admin",
        "board_role": "President",
    },
    {
        "email": "yves.ramette@affi.fr",
        "first_name": "Yves",
        "last_name": "Ramette",
        "job_title": "Vice-President",
        "company": "AFFI",
        "sector": "Ingenierie & Conseil",
        "specialty": "Exploitation",
        "region": "Ile-de-France",
        "is_admin": True,
        "is_board": True,
        "is_mentor": True,
        "role": "admin",
        "board_role": "Vice-President",
    },
    {
        "email": "igor.bilimoff@ffrif.fr",
        "first_name": "Igor",
        "last_name": "Bilimoff",
        "job_title": "Vice-President, Delegue general FIF",
        "company": "FIF (Federation des Industries Ferroviaires)",
        "sector": "Ingenierie & Conseil",
        "specialty": "Infrastructure / Voie",
        "region": "Ile-de-France",
        "is_admin": True,
        "is_board": True,
        "is_mentor": False,
        "role": "admin",
        "board_role": "Vice-President, Delegue general FIF",
    },
    # Picard deja cree — on le met a jour
    {
        "email": "francois-xavier.picard@reseau.sncf.fr",
        "first_name": "Francois-Xavier",
        "last_name": "Picard",
        "job_title": "Vice-President",
        "company": "SNCF RESEAU / DIRECTION GENERALE OPI",
        "sector": "Ingenierie & Conseil",
        "specialty": "Exploitation",
        "region": "Ile-de-France",
        "is_admin": True,
        "is_board": True,
        "is_mentor": True,
        "role": "admin",
        "board_role": "Vice-President",
    },
    {
        "email": "philippe.mingasson@affi.fr",
        "first_name": "Philippe",
        "last_name": "Mingasson",
        "job_title": "Secretaire general",
        "company": "AFFI",
        "sector": "Ingenierie & Conseil",
        "specialty": "Exploitation",
        "region": "Ile-de-France",
        "is_admin": True,
        "is_board": True,
        "is_mentor": True,
        "role": "admin",
        "board_role": "Secretaire general",
    },
    {
        "email": "jean-pierre.riff@affi.fr",
        "first_name": "Jean-Pierre",
        "last_name": "Riff",
        "job_title": "Secretaire general adjoint",
        "company": "AFFI",
        "sector": "Ingenierie & Conseil",
        "specialty": "Signalisation / ERTMS",
        "region": "Ile-de-France",
        "is_admin": False,
        "is_board": True,
        "is_mentor": True,
        "role": "member",
        "board_role": "Secretaire general adjoint",
    },
    {
        "email": "christophe.vandenbrouck@affi.fr",
        "first_name": "Christophe",
        "last_name": "Vandenbrouck",
        "job_title": "Tresorier",
        "company": "AFFI",
        "sector": "Ingenierie & Conseil",
        "specialty": "Infrastructure / Voie",
        "region": "Ile-de-France",
        "is_admin": False,
        "is_board": True,
        "is_mentor": False,
        "role": "member",
        "board_role": "Tresorier",
    },
    {
        "email": "rosalie.loubinoux@affi.fr",
        "first_name": "Rosalie",
        "last_name": "Loubinoux",
        "job_title": "Tresorier adjoint",
        "company": "AFFI",
        "sector": "Ingenierie & Conseil",
        "specialty": "Exploitation",
        "region": "Ile-de-France",
        "is_admin": False,
        "is_board": True,
        "is_mentor": False,
        "role": "member",
        "board_role": "Tresorier adjoint",
    },
    {
        "email": "vivien.stamm-douvier@affi.fr",
        "first_name": "Vivien",
        "last_name": "Stamm-Douvier",
        "job_title": "Responsable Concours Etudiant et Rendez-vous de l'AFFI",
        "company": "AFFI",
        "sector": "Recherche & Formation",
        "specialty": "Exploitation",
        "region": "Ile-de-France",
        "is_admin": False,
        "is_board": True,
        "is_mentor": True,
        "role": "member",
        "board_role": "Responsable Concours Etudiant et RDV AFFI",
    },
    # Mogoro deja cree — on met a jour le role board
    {
        "email": "jj.mogoro@gmail.com",
        "first_name": "Jean-Jacques",
        "last_name": "Mogoro",
        "job_title": "Relations avec les partenaires",
        "company": "AFFI",
        "sector": "Ingenierie & Conseil",
        "specialty": "Infrastructure / Voie",
        "region": "Ile-de-France",
        "is_admin": True,
        "is_board": True,
        "is_mentor": True,
        "role": "admin",
        "board_role": "Relations partenaires",
    },
    {
        "email": "patrick.laval@affi.fr",
        "first_name": "Patrick",
        "last_name": "Laval",
        "job_title": "Responsable Communication",
        "company": "AFFI",
        "sector": "Ingenierie & Conseil",
        "specialty": "Exploitation",
        "region": "Ile-de-France",
        "is_admin": False,
        "is_board": True,
        "is_mentor": False,
        "role": "member",
        "board_role": "Responsable Communication",
    },
    {
        "email": "kevin.benoit@affi.fr",
        "first_name": "Kevin",
        "last_name": "Benoit",
        "job_title": "Communication sur les reseaux sociaux",
        "company": "AFFI",
        "sector": "Numerique & IA",
        "specialty": "Telecoms",
        "region": "Ile-de-France",
        "is_admin": False,
        "is_board": True,
        "is_mentor": False,
        "role": "member",
        "board_role": "Communication reseaux sociaux",
    },
    {
        "email": "mikael.beck@affi.fr",
        "first_name": "Mikael",
        "last_name": "Beck",
        "job_title": "Gestion du site Internet",
        "company": "AFFI",
        "sector": "Numerique & IA",
        "specialty": "Telecoms",
        "region": "Ile-de-France",
        "is_admin": True,
        "is_board": True,
        "is_mentor": False,
        "role": "admin",
        "board_role": "Gestion site Internet",
    },
    # Mangone deja cree — on met a jour
    {
        "email": "claude.mangone@reseau.sncf.fr",
        "first_name": "Claude",
        "last_name": "Mangone",
        "job_title": "Ingenieur",
        "company": "SNCF RESEAU / DIRECTIONS TECH ET INDUS NAT / DG IGM-DTII",
        "sector": "Infrastructure",
        "specialty": "Infrastructure / Voie",
        "region": "Ile-de-France",
        "is_admin": False,
        "is_board": True,
        "is_mentor": False,
        "role": "member",
        "board_role": "Membre du Bureau",
    },
]

DEFAULT_PASSWORD = "affi2026"

def run():
    print("Connexion a Neon PostgreSQL...")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    print(f"\nCreation/MAJ de {len(BUREAU_MEMBERS)} comptes bureau...")
    for acct in BUREAU_MEMBERS:
        cur.execute("SELECT id FROM members WHERE email = %s", [acct["email"]])
        existing = cur.fetchone()

        if existing:
            member_id = existing[0]
            print(f"  MAJ  {acct['email']} (#{member_id})...")
            cur.execute("""UPDATE members SET first_name=%s, last_name=%s, company=%s, job_title=%s,
                sector=%s, specialty=%s, region=%s, is_admin=%s, is_board=%s, is_mentor=%s,
                role=%s, consent_annuaire=TRUE, consent_newsletter=TRUE, consent_date=NOW(),
                status='active'
                WHERE id=%s""",
                [acct["first_name"], acct["last_name"], acct["company"], acct["job_title"],
                 acct["sector"], acct["specialty"], acct["region"], acct["is_admin"],
                 acct["is_board"], acct["is_mentor"], acct["role"], member_id])
        else:
            pw_hash = hash_pw(DEFAULT_PASSWORD)
            cur.execute("""INSERT INTO members (email, password_hash, first_name, last_name, company,
                job_title, sector, specialty, region, is_admin, is_board, is_mentor, role,
                consent_annuaire, consent_newsletter, consent_date, status, membership_type)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,TRUE,TRUE,NOW(),'active','standard')""",
                [acct["email"], pw_hash, acct["first_name"], acct["last_name"], acct["company"],
                 acct["job_title"], acct["sector"], acct["specialty"], acct["region"],
                 acct["is_admin"], acct["is_board"], acct["is_mentor"], acct["role"]])
            print(f"  NEW  {acct['email']} (pwd: {DEFAULT_PASSWORD})")

        conn.commit()

        # Update board_members table
        cur.execute("SELECT id FROM members WHERE email = %s", [acct["email"]])
        mid = cur.fetchone()[0]
        cur.execute("SELECT id FROM board_members WHERE member_id = %s", [mid])
        bm = cur.fetchone()
        if bm:
            cur.execute("UPDATE board_members SET role=%s, is_active=TRUE WHERE member_id=%s",
                        [acct["board_role"], mid])
        else:
            cur.execute("""INSERT INTO board_members (member_id, role, title, sort_order, is_active)
                VALUES (%s, %s, %s, %s, TRUE)""",
                [mid, acct["board_role"], acct["job_title"],
                 BUREAU_MEMBERS.index(acct)])
        conn.commit()

    # Verification
    print("\nVerification...")
    cur.execute("SELECT COUNT(*) FROM members WHERE is_board=TRUE AND status='active'")
    board_count = cur.fetchone()[0]
    print(f"  Membres du bureau actifs: {board_count}")

    cur.execute("SELECT COUNT(*) FROM members WHERE is_admin=TRUE AND status='active'")
    admin_count = cur.fetchone()[0]
    print(f"  Administrateurs actifs: {admin_count}")

    cur.execute("SELECT COUNT(*) FROM members WHERE consent_annuaire=TRUE AND status='active'")
    public_count = cur.fetchone()[0]
    print(f"  Profils publics (annuaire): {public_count}")

    cur.execute("""SELECT m.email, m.first_name, m.last_name, m.is_admin, b.role
        FROM members m JOIN board_members b ON m.id = b.member_id
        WHERE b.is_active=TRUE ORDER BY b.sort_order""")
    board = cur.fetchall()
    print(f"\n  Bureau ({len(board)} membres):")
    for b in board:
        admin = " [ADMIN]" if b[3] else ""
        print(f"    {b[1]} {b[2]} — {b[4]}{admin} ({b[0]})")

    cur.close()
    conn.close()
    print("\nMigration v3 terminee !")

if __name__ == '__main__':
    run()
