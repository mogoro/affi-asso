#!/usr/bin/env python3
"""Migration AFFI 2026 v2 — RGPD, roles, logs, consentements + creation 3 comptes."""
import psycopg2
import hashlib
import os

DB_URL = os.getenv('DATABASE_URL',
os.environ.get('DATABASE_URL', ''))

def hash_pw(pw):
    salt = "affi2026"
    return hashlib.sha256(f"{salt}:{pw}".encode()).hexdigest()

MIGRATIONS = [
    # Nouveaux champs members
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS region VARCHAR(100);",
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member';",
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS consent_annuaire BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS consent_newsletter BOOLEAN DEFAULT FALSE;",
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS consent_date TIMESTAMP;",
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;",

    # Table logs
    """CREATE TABLE IF NOT EXISTS logs (
        id              SERIAL PRIMARY KEY,
        action          VARCHAR(50) NOT NULL,
        user_id         INT REFERENCES members(id) ON DELETE SET NULL,
        target_id       INT,
        target_type     VARCHAR(50),
        details         TEXT,
        ip_address      VARCHAR(45),
        created_at      TIMESTAMP DEFAULT NOW()
    );""",

    # Table consentements
    """CREATE TABLE IF NOT EXISTS consentements (
        id              SERIAL PRIMARY KEY,
        member_id       INT REFERENCES members(id) ON DELETE CASCADE,
        consent_type    VARCHAR(50) NOT NULL,
        granted         BOOLEAN DEFAULT FALSE,
        consent_date    TIMESTAMP DEFAULT NOW(),
        version_cgu     VARCHAR(20) DEFAULT '1.0'
    );""",

    # Index
    "CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(user_id);",
    "CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(created_at DESC);",
    "CREATE INDEX IF NOT EXISTS idx_consentements_member ON consentements(member_id);",
    "CREATE INDEX IF NOT EXISTS idx_members_region ON members(region);",
    "CREATE INDEX IF NOT EXISTS idx_members_consent ON members(consent_annuaire);",
]

ACCOUNTS = [
    {
        "email": "jj.mogoro@gmail.com",
        "password": "affi2026",
        "first_name": "Jean-Jacques",
        "last_name": "Mogoro",
        "company": "AFFI",
        "job_title": "Secretaire General",
        "sector": "Ingenierie & Conseil",
        "specialty": "Infrastructure / Voie",
        "region": "Ile-de-France",
        "is_admin": True,
        "is_board": True,
        "is_mentor": True,
        "role": "admin",
        "consent_annuaire": True,
        "consent_newsletter": True,
    },
    {
        "email": "claude.mangone@reseau.sncf.fr",
        "password": "affi2026",
        "first_name": "Claude",
        "last_name": "Mangone",
        "company": "SNCF RESEAU / DIRECTIONS TECH ET INDUS NAT / DG IGM-DTII",
        "job_title": "Ingenieur",
        "sector": "Infrastructure",
        "specialty": "Infrastructure / Voie",
        "region": "Ile-de-France",
        "is_admin": False,
        "is_board": True,
        "is_mentor": False,
        "role": "member",
        "consent_annuaire": True,
        "consent_newsletter": True,
    },
    {
        "email": "francois-xavier.picard@reseau.sncf.fr",
        "password": "affi2026",
        "first_name": "Francois-Xavier",
        "last_name": "Picard",
        "company": "SNCF RESEAU / DIRECTION GENERALE OPI / SIEGE DIR GEN OPI",
        "job_title": "President AFFI",
        "sector": "Ingenierie & Conseil",
        "specialty": "Exploitation",
        "region": "Ile-de-France",
        "is_admin": True,
        "is_board": True,
        "is_mentor": True,
        "role": "admin",
        "consent_annuaire": True,
        "consent_newsletter": True,
    },
]

def run():
    print("Connexion a Neon PostgreSQL...")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # Run migrations
    for i, sql in enumerate(MIGRATIONS, 1):
        label = sql.strip().split('\n')[0][:80]
        print(f"  [{i}/{len(MIGRATIONS)}] {label}")
        try:
            cur.execute(sql)
            conn.commit()
            print(f"           OK")
        except Exception as e:
            conn.rollback()
            print(f"           ERREUR: {e}")

    # Create accounts
    print("\nCreation des comptes...")
    for acct in ACCOUNTS:
        cur.execute("SELECT id FROM members WHERE email = %s", [acct["email"]])
        existing = cur.fetchone()
        if existing:
            print(f"  {acct['email']} — existe deja (id={existing[0]}), mise a jour...")
            cur.execute("""UPDATE members SET first_name=%s, last_name=%s, company=%s, job_title=%s,
                sector=%s, specialty=%s, region=%s, is_admin=%s, is_board=%s, is_mentor=%s,
                role=%s, consent_annuaire=%s, consent_newsletter=%s, consent_date=NOW(),
                status='active'
                WHERE email=%s""",
                [acct["first_name"], acct["last_name"], acct["company"], acct["job_title"],
                 acct["sector"], acct["specialty"], acct["region"], acct["is_admin"],
                 acct["is_board"], acct["is_mentor"], acct["role"],
                 acct["consent_annuaire"], acct["consent_newsletter"], acct["email"]])
        else:
            pw_hash = hash_pw(acct["password"])
            cur.execute("""INSERT INTO members (email, password_hash, first_name, last_name, company,
                job_title, sector, specialty, region, is_admin, is_board, is_mentor, role,
                consent_annuaire, consent_newsletter, consent_date, status, membership_type)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW(),'active','standard')""",
                [acct["email"], pw_hash, acct["first_name"], acct["last_name"], acct["company"],
                 acct["job_title"], acct["sector"], acct["specialty"], acct["region"],
                 acct["is_admin"], acct["is_board"], acct["is_mentor"], acct["role"],
                 acct["consent_annuaire"], acct["consent_newsletter"]])
            print(f"  {acct['email']} — cree (pwd: {acct['password']})")
        conn.commit()

    # Verification
    print("\nVerification...")
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='members' AND column_name IN ('region','role','consent_annuaire','consent_newsletter','archived_at') ORDER BY column_name")
    cols = [r[0] for r in cur.fetchall()]
    print(f"  Colonnes members: {cols}")

    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('logs','consentements') ORDER BY tablename")
    tables = [r[0] for r in cur.fetchall()]
    print(f"  Nouvelles tables: {tables}")

    cur.execute("SELECT id, email, first_name, last_name, is_admin, role FROM members WHERE email IN (%s,%s,%s)",
                [a["email"] for a in ACCOUNTS])
    accounts = cur.fetchall()
    print(f"  Comptes: {len(accounts)} trouves")
    for a in accounts:
        print(f"    #{a[0]} {a[2]} {a[3]} ({a[1]}) admin={a[4]} role={a[5]}")

    cur.close()
    conn.close()
    print("\nMigration v2 terminee avec succes !")

if __name__ == '__main__':
    run()
