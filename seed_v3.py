#!/usr/bin/env python3
"""Seed v3: courses, member locations for map."""
import psycopg2

conn = psycopg2.connect('postgresql://neondb_owner:npg_jBZhGekb5l3t@ep-holy-grass-anqa8ub6-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require')
conn.autocommit = True
cur = conn.cursor()

# Add geo columns to members
for col in [
    "latitude DOUBLE PRECISION",
    "longitude DOUBLE PRECISION",
]:
    cur.execute(f"ALTER TABLE members ADD COLUMN IF NOT EXISTS {col}")

# Create courses table
cur.execute("""CREATE TABLE IF NOT EXISTS courses (
    id SERIAL PRIMARY KEY,
    title VARCHAR(300) NOT NULL,
    slug VARCHAR(300),
    description TEXT,
    instructor VARCHAR(200),
    instructor_bio TEXT,
    duration VARCHAR(50),
    level VARCHAR(30),
    category VARCHAR(100),
    objectives TEXT,
    prerequisites TEXT,
    max_participants INT,
    price NUMERIC(8,2) DEFAULT 0,
    is_online BOOLEAN DEFAULT FALSE,
    location VARCHAR(200),
    next_date TIMESTAMP,
    image_url TEXT,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
)""")

cur.execute("""CREATE TABLE IF NOT EXISTS course_registrations (
    id SERIAL PRIMARY KEY,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    member_id INT REFERENCES members(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'registered',
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(course_id, member_id)
)""")

# Update member locations (lat/lng for map)
locations = {
    'mogoro@gmail.com': (48.8566, 2.3522, 'Paris'),
    'admin@ingenieur-ferroviaire.net': (48.8942, 2.2879, 'Levallois-Perret'),
    'marie.dupont@sncf.fr': (48.8736, 2.2811, 'La Defense'),
    'pierre.martin@alstom.com': (48.9121, 2.3324, 'Saint-Ouen'),
    'sophie.bernard@ratp.fr': (48.8496, 2.4741, 'Fontenay-sous-Bois'),
    'luc.petit@thalesgroup.com': (48.7833, 2.1897, 'Velizy'),
    'anne.moreau@systra.com': (48.8704, 2.3151, 'Paris 8e'),
    'marc.leroy@egis.fr': (45.7640, 4.8357, 'Lyon'),
    'claire.simon@keolis.com': (50.6292, 3.0573, 'Lille'),
    'thomas.garcia@sncf.fr': (48.8396, 2.3190, 'Paris 14e'),
    'julie.roux@bombardier.com': (48.5932, 7.7481, 'Strasbourg'),
    'paul.fournier@hitachirail.com': (43.2965, 5.3698, 'Marseille'),
}
for email, (lat, lng, loc) in locations.items():
    cur.execute("UPDATE members SET latitude=%s, longitude=%s, location=%s WHERE email=%s",
        (lat, lng, loc, email))

# Seed courses
courses = [
    ("Introduction a la signalisation ferroviaire",
     "Comprendre les fondamentaux des systemes de signalisation ferroviaire : principes, normes, technologies.",
     "Jean-Pierre Laurent", "Expert signalisation, 25 ans chez Thales",
     "2 jours", "Debutant", "Signalisation",
     "Comprendre les principes de base de la signalisation\nConnaitre les differents systemes (BAL, BAPR, TVM)\nApprehender le cadre normatif europeen",
     "Aucun prerequis technique", 20, 450, False, "Paris", "2026-05-15 09:00:00"),

    ("ERTMS/ETCS : Architecture et deploiement",
     "Formation approfondie sur le systeme europeen de signalisation ERTMS, niveaux 1, 2 et 3.",
     "Luc Petit", "Expert ERTMS chez Thales, membre AFFI",
     "3 jours", "Avance", "Signalisation",
     "Maitriser l architecture ETCS niveaux 1, 2, 3\nComprendre le RBC et les interfaces\nAnalyser les retours d experience europeens",
     "Connaissances en signalisation ferroviaire", 15, 1200, False, "Saint-Denis", "2026-06-10 09:00:00"),

    ("Maintenance predictive par IA",
     "Application de l intelligence artificielle et du machine learning a la maintenance du materiel roulant.",
     "Claire Simon", "Data Scientist chez Keolis, specialiste IA ferroviaire",
     "2 jours", "Intermediaire", "Numerique & IA",
     "Comprendre les algorithmes de maintenance predictive\nMettre en oeuvre des modeles ML sur des donnees ferroviaires\nEvaluer le ROI d un projet de maintenance predictive",
     "Bases en Python et statistiques", 25, 800, True, "En ligne", "2026-05-20 09:00:00"),

    ("Normes ferroviaires EN 50126/50128/50129",
     "Maitrise du cadre normatif CENELEC pour les systemes de signalisation et de securite ferroviaire.",
     "Anne Moreau", "Directrice Ingenierie chez Systra",
     "2 jours", "Intermediaire", "Ingenierie",
     "Comprendre les exigences de surete de fonctionnement\nAppliquer les niveaux de SIL\nMaitriser le cycle de vie selon EN 50126",
     "Experience en ingenierie ferroviaire", 20, 650, False, "Paris", "2026-07-01 09:00:00"),

    ("Gestion de projet ferroviaire",
     "Methodes et outils pour piloter des projets complexes dans le secteur ferroviaire.",
     "Jean-Jacques Mogoro", "President AFFI, 20 ans d experience en gestion de projet",
     "1 jour", "Tous niveaux", "Management",
     "Planifier et piloter un projet ferroviaire\nGerer les parties prenantes et les risques\nMaitriser les outils de reporting",
     "Aucun", 30, 350, False, "Paris", "2026-05-28 09:00:00"),

    ("Cybersecurite des systemes ferroviaires",
     "Enjeux et solutions de cybersecurite pour les systemes critiques du transport ferroviaire.",
     "Luc Petit", "Expert Cybersecurite et ERTMS",
     "1 jour", "Avance", "Numerique & IA",
     "Identifier les menaces cyber sur les systemes ferroviaires\nAppliquer les normes IEC 62443\nMettre en place une strategie de defense",
     "Connaissances en systemes ferroviaires", 20, 500, True, "En ligne", "2026-06-25 09:00:00"),
]
for title, desc, instructor, ibio, dur, level, cat, obj, prereq, maxp, price, online, loc, ndate in courses:
    cur.execute("""INSERT INTO courses (title, description, instructor, instructor_bio, duration, level,
        category, objectives, prerequisites, max_participants, price, is_online, location, next_date)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (title, desc, instructor, ibio, dur, level, cat, obj, prereq, maxp, price, online, loc, ndate))

for t in ['courses']:
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    print(f"  {t}: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM members WHERE latitude IS NOT NULL")
print(f"  Members with location: {cur.fetchone()[0]}")
conn.close()
print("Seed v3 OK")
