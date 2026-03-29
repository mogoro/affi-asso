#!/usr/bin/env python3
"""Seed v2: enriched schema + demo data."""
import psycopg2

conn = psycopg2.connect('postgresql://neondb_owner:npg_jBZhGekb5l3t@ep-holy-grass-anqa8ub6-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require')
conn.autocommit = True
cur = conn.cursor()

# === EXTENDED PROFILE COLUMNS ===
for col in [
    "skills TEXT[] DEFAULT '{}'",
    "certifications TEXT[] DEFAULT '{}'",
    "badges TEXT[] DEFAULT '{}'",
    "experience_years INT",
    "education TEXT",
    "availability VARCHAR(30) DEFAULT 'employe'",
    "is_freelance BOOLEAN DEFAULT FALSE",
    "daily_rate NUMERIC(8,2)",
    "location VARCHAR(100)",
    "website_url TEXT",
]:
    cur.execute(f"ALTER TABLE members ADD COLUMN IF NOT EXISTS {col}")

# === NEW TABLES ===
cur.execute("""CREATE TABLE IF NOT EXISTS member_projects (
    id SERIAL PRIMARY KEY,
    member_id INT REFERENCES members(id) ON DELETE CASCADE,
    title VARCHAR(300) NOT NULL,
    description TEXT,
    role VARCHAR(200),
    company VARCHAR(200),
    year INT,
    tags TEXT[] DEFAULT '{}',
    url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
)""")

cur.execute("""CREATE TABLE IF NOT EXISTS endorsements (
    id SERIAL PRIMARY KEY,
    from_member_id INT REFERENCES members(id) ON DELETE CASCADE,
    to_member_id INT REFERENCES members(id) ON DELETE CASCADE,
    skill VARCHAR(100) NOT NULL,
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(from_member_id, to_member_id, skill)
)""")

cur.execute("""CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    from_member_id INT REFERENCES members(id) ON DELETE CASCADE,
    to_member_id INT REFERENCES members(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
)""")
cur.execute("CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_member_id, is_read, created_at DESC)")

cur.execute("""CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    company VARCHAR(200) NOT NULL,
    location VARCHAR(200),
    contract_type VARCHAR(50),
    salary_range VARCHAR(100),
    description TEXT,
    requirements TEXT,
    sector VARCHAR(100),
    contact_email VARCHAR(255),
    contact_name VARCHAR(200),
    is_freelance BOOLEAN DEFAULT FALSE,
    posted_by INT REFERENCES members(id),
    is_active BOOLEAN DEFAULT TRUE,
    expires_at DATE,
    created_at TIMESTAMP DEFAULT NOW()
)""")

cur.execute("""CREATE TABLE IF NOT EXISTS job_applications (
    id SERIAL PRIMARY KEY,
    job_id INT REFERENCES jobs(id) ON DELETE CASCADE,
    member_id INT REFERENCES members(id) ON DELETE CASCADE,
    cover_letter TEXT,
    status VARCHAR(30) DEFAULT 'submitted',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(job_id, member_id)
)""")

cur.execute("""CREATE TABLE IF NOT EXISTS feed_posts (
    id SERIAL PRIMARY KEY,
    author_id INT REFERENCES members(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    post_type VARCHAR(30) DEFAULT 'text',
    link_url TEXT,
    link_title TEXT,
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
)""")

cur.execute("""CREATE TABLE IF NOT EXISTS feed_comments (
    id SERIAL PRIMARY KEY,
    post_id INT REFERENCES feed_posts(id) ON DELETE CASCADE,
    author_id INT REFERENCES members(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
)""")

cur.execute("""CREATE TABLE IF NOT EXISTS feed_likes (
    id SERIAL PRIMARY KEY,
    post_id INT REFERENCES feed_posts(id) ON DELETE CASCADE,
    member_id INT REFERENCES members(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, member_id)
)""")

cur.execute("""CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    member_id INT REFERENCES members(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(300),
    content TEXT,
    link VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
)""")
cur.execute("CREATE INDEX IF NOT EXISTS idx_notif_member ON notifications(member_id, is_read, created_at DESC)")

print("Tables created")

# === SEED SKILLS ===
skills_map = {
    'mogoro@gmail.com': (['ERTMS','Signalisation','Gestion de projet','Management'], ['President AFFI'], 'Paris'),
    'marie.dupont@sncf.fr': (['ERTMS','ETCS','Signalisation','NF EN 50128'], [], 'Paris'),
    'pierre.martin@alstom.com': (['Materiel roulant','Conception mecanique','Certification'], [], 'Saint-Ouen'),
    'sophie.bernard@ratp.fr': (['Maintenance predictive','MRO','Gestion de flotte'], [], 'Paris'),
    'luc.petit@thalesgroup.com': (['ERTMS','ETCS L2','GSM-R','FRMCS','Cybersecurite'], ['Expert ERTMS'], 'Velizy'),
    'anne.moreau@systra.com': (['Ingenierie','AMO','Infrastructure','Direction de projet'], [], 'Paris'),
    'marc.leroy@egis.fr': (['Infrastructure','Voie ferree','Genie civil','BIM'], [], 'Lyon'),
    'claire.simon@keolis.com': (['IA','Data Science','Maintenance predictive','Python'], [], 'Lille'),
}
for email, (skills, badges, loc) in skills_map.items():
    cur.execute("UPDATE members SET skills=%s, badges=%s, location=%s WHERE email=%s", (skills, badges, loc, email))

# === SEED JOBS ===
cur.execute("DELETE FROM jobs")
jobs = [
    ('Ingenieur Signalisation ERTMS Senior', 'Alstom', 'Saint-Ouen (93)', 'CDI', '55-70k EUR',
     'Nous recherchons un ingenieur signalisation senior specialise ERTMS/ETCS pour rejoindre notre equipe.', 'Signalisation & ERTMS', False),
    ('Chef de Projet Infrastructure Ferroviaire', 'SNCF Reseau', 'La Defense', 'CDI', '60-80k EUR',
     'Pilotage de projets de modernisation d infrastructure ferroviaire en Ile-de-France.', 'Infrastructure', False),
    ('Consultant Signalisation - Mission 6 mois', 'Systra', 'Lyon', 'Freelance', '500-650 EUR/jour',
     'Mission expertise sur le deploiement ETCS niveau 2 sur la LGV Sud-Est.', 'Signalisation & ERTMS', True),
    ('Ingenieur Maintenance Materiel Roulant', 'RATP', 'Fontenay-sous-Bois', 'CDI', '45-55k EUR',
     'Optimisation des plans de maintenance du parc metro et RER.', 'Maintenance', False),
    ('Data Scientist Ferroviaire', 'Thales', 'Velizy', 'CDI', '50-65k EUR',
     'IA appliquee a la maintenance predictive des systemes de signalisation.', 'Numerique & IA', False),
]
for title, company, loc, ctype, salary, desc, sector, freelance in jobs:
    cur.execute("INSERT INTO jobs (title, company, location, contract_type, salary_range, description, sector, is_freelance) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
        (title, company, loc, ctype, salary, desc, sector, freelance))

# === SEED FEED ===
cur.execute("DELETE FROM feed_posts")
cur.execute("SELECT id FROM members WHERE email='mogoro@gmail.com'")
jj = cur.fetchone()[0]
cur.execute("SELECT id FROM members WHERE email='luc.petit@thalesgroup.com'")
luc = cur.fetchone()[0]
cur.execute("SELECT id FROM members WHERE email='marie.dupont@sncf.fr'")
marie = cur.fetchone()[0]

for author, content, ptype, url, lt in [
    (jj, "Excellente conference hier sur les domaines de pertinence du ferroviaire par Jacques Damas. Plus de 60 participants !", 'text', None, None),
    (luc, "Nouveau standard FRMCS : le successeur du GSM-R se precise. Quelles implications pour les operateurs ?", 'text', None, None),
    (marie, "SNCF Reseau lance un appel a projets pour la signalisation de nouvelle generation.", 'link', 'https://ted.europa.eu', 'Appel a projets signalisation'),
    (jj, "Rappel : inscriptions pour la 6eme edition du Rail Innovation Challenge ouvertes ! Avant le 30 mai.", 'text', None, None),
]:
    cur.execute("INSERT INTO feed_posts (author_id, content, post_type, link_url, link_title) VALUES (%s,%s,%s,%s,%s)",
        (author, content, ptype, url, lt))

# === SEED ENDORSEMENTS ===
cur.execute("INSERT INTO endorsements (from_member_id, to_member_id, skill, comment) VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING",
    (marie, luc, 'ERTMS', 'Luc est un expert reconnu en ERTMS.'))
cur.execute("INSERT INTO endorsements (from_member_id, to_member_id, skill, comment) VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING",
    (luc, marie, 'Signalisation', 'Marie maitrise parfaitement les systemes de signalisation.'))

for t in ['jobs','feed_posts','endorsements','notifications']:
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    print(f"  {t}: {cur.fetchone()[0]}")
conn.close()
print("Seed v2 OK")
