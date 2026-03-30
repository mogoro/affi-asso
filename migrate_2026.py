#!/usr/bin/env python3
"""Migration AFFI 2026 — Ajout specialty, is_mentor, quizz_scores, replays."""
import psycopg2
import os

DB_URL = os.getenv('DATABASE_URL',
    'postgresql://neondb_owner:npg_jBZhGekb5l3t@ep-holy-grass-anqa8ub6-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require')

MIGRATIONS = [
    # 1. Ajouter specialty et is_mentor a members
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS specialty VARCHAR(100);",
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS is_mentor BOOLEAN DEFAULT FALSE;",

    # 2. Creer table quizz_scores
    """CREATE TABLE IF NOT EXISTS quizz_scores (
        id              SERIAL PRIMARY KEY,
        member_id       INT REFERENCES members(id) ON DELETE CASCADE,
        quizz_id        VARCHAR(50) NOT NULL,
        score           INT NOT NULL,
        total           INT NOT NULL,
        played_at       TIMESTAMP DEFAULT NOW(),
        UNIQUE(member_id, quizz_id)
    );""",

    # 3. Creer table replays
    """CREATE TABLE IF NOT EXISTS replays (
        id              SERIAL PRIMARY KEY,
        title           VARCHAR(300) NOT NULL,
        description     TEXT,
        video_url       TEXT NOT NULL,
        video_platform  VARCHAR(20) DEFAULT 'youtube',
        category        VARCHAR(50),
        speaker_name    VARCHAR(200),
        speaker_member_id INT REFERENCES members(id),
        thumbnail_url   TEXT,
        duration        VARCHAR(20),
        event_date      DATE,
        is_published    BOOLEAN DEFAULT TRUE,
        created_at      TIMESTAMP DEFAULT NOW()
    );""",

    # 4. Index
    "CREATE INDEX IF NOT EXISTS idx_members_specialty ON members(specialty);",
    "CREATE INDEX IF NOT EXISTS idx_quizz_scores_quizz ON quizz_scores(quizz_id, score DESC);",
    "CREATE INDEX IF NOT EXISTS idx_replays_category ON replays(category);",
]

def run():
    print("Connexion a Neon PostgreSQL...")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

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

    # Verification
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='members' AND column_name IN ('specialty','is_mentor') ORDER BY column_name")
    cols = [r[0] for r in cur.fetchall()]
    print(f"\nVerification members: colonnes trouvees = {cols}")

    cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('quizz_scores','replays') ORDER BY tablename")
    tables = [r[0] for r in cur.fetchall()]
    print(f"Nouvelles tables: {tables}")

    cur.close()
    conn.close()
    print("\nMigration terminee avec succes !")

if __name__ == '__main__':
    run()
