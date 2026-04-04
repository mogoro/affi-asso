import os
"""Migration: endorsements, polls, verified badges, event communication."""
import psycopg2
DB_URL = os.environ.get('DATABASE_URL', '')
conn = psycopg2.connect(DB_URL)
cur = conn.cursor()

# === ENDORSEMENTS ===
cur.execute("""CREATE TABLE IF NOT EXISTS endorsements (
    id SERIAL PRIMARY KEY,
    from_member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    to_member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    skill TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_member_id, to_member_id, skill)
)""")
print("  endorsements table OK")

# === POLLS / SONDAGES ===
cur.execute("""CREATE TABLE IF NOT EXISTS polls (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES members(id),
    is_active BOOLEAN DEFAULT TRUE,
    is_anonymous BOOLEAN DEFAULT FALSE,
    multiple_choice BOOLEAN DEFAULT FALSE,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
)""")
cur.execute("""CREATE TABLE IF NOT EXISTS poll_options (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0
)""")
cur.execute("""CREATE TABLE IF NOT EXISTS poll_votes (
    id SERIAL PRIMARY KEY,
    poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
    option_id INTEGER REFERENCES poll_options(id) ON DELETE CASCADE,
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(poll_id, option_id, member_id)
)""")
print("  polls tables OK")

# === VERIFIED BADGE ===
cur.execute("""DO $$ BEGIN
    ALTER TABLE members ADD COLUMN is_verified BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$""")
# Verify all bureau members
cur.execute("UPDATE members SET is_verified = TRUE WHERE is_board = TRUE")
print("  is_verified column OK, bureau members verified")

# === EVENT COMMUNICATION ===
cur.execute("""CREATE TABLE IF NOT EXISTS event_communications (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    sent_by INTEGER REFERENCES members(id),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    recipient_type TEXT DEFAULT 'registered'
)""")
# Emargement
cur.execute("""DO $$ BEGIN
    ALTER TABLE event_registrations ADD COLUMN attended BOOLEAN DEFAULT FALSE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$""")
cur.execute("""DO $$ BEGIN
    ALTER TABLE event_registrations ADD COLUMN attended_at TIMESTAMPTZ;
EXCEPTION WHEN duplicate_column THEN NULL; END $$""")
print("  event_communications + emargement OK")

conn.commit()
conn.close()
print("Migration done!")
