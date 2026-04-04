-- AFFI Association Management — Schema Neon PostgreSQL

-- Membres
CREATE TABLE IF NOT EXISTS members (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    phone           VARCHAR(20),
    company         VARCHAR(200),
    job_title       VARCHAR(200),
    sector          VARCHAR(100),
    bio             TEXT,
    photo_url       TEXT,
    membership_type VARCHAR(30) DEFAULT 'standard',
    status          VARCHAR(20) DEFAULT 'pending',
    joined_at       TIMESTAMP DEFAULT NOW(),
    expires_at      DATE,
    last_login      TIMESTAMP,
    is_admin        BOOLEAN DEFAULT FALSE,
    is_board        BOOLEAN DEFAULT FALSE,
    specialty       VARCHAR(100),
    is_mentor       BOOLEAN DEFAULT FALSE,
    region          VARCHAR(100),
    role            VARCHAR(20) DEFAULT 'member',
    consent_annuaire BOOLEAN DEFAULT FALSE,
    consent_newsletter BOOLEAN DEFAULT FALSE,
    consent_date    TIMESTAMP,
    archived_at     TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Quizz
CREATE TABLE IF NOT EXISTS quizz_scores (
    id              SERIAL PRIMARY KEY,
    member_id       INT REFERENCES members(id) ON DELETE CASCADE,
    quizz_id        VARCHAR(50) NOT NULL,
    score           INT NOT NULL,
    total           INT NOT NULL,
    played_at       TIMESTAMP DEFAULT NOW(),
    UNIQUE(member_id, quizz_id)
);

-- Replays / Mediatheque
CREATE TABLE IF NOT EXISTS replays (
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
);

-- Cotisations
CREATE TABLE IF NOT EXISTS subscriptions (
    id              SERIAL PRIMARY KEY,
    member_id       INT REFERENCES members(id) ON DELETE CASCADE,
    year            INT NOT NULL,
    amount          NUMERIC(8,2) NOT NULL,
    payment_method  VARCHAR(30),
    payment_ref     VARCHAR(100),
    status          VARCHAR(20) DEFAULT 'pending',
    paid_at         TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(member_id, year)
);

-- Evenements
CREATE TABLE IF NOT EXISTS events (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(300) NOT NULL,
    slug            VARCHAR(300) UNIQUE,
    description     TEXT,
    event_type      VARCHAR(50),
    location        VARCHAR(300),
    address         TEXT,
    start_date      TIMESTAMP NOT NULL,
    end_date        TIMESTAMP,
    max_attendees   INT,
    price           NUMERIC(8,2) DEFAULT 0,
    image_url       TEXT,
    is_members_only BOOLEAN DEFAULT FALSE,
    is_published    BOOLEAN DEFAULT TRUE,
    created_by      INT REFERENCES members(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Inscriptions evenements
CREATE TABLE IF NOT EXISTS event_registrations (
    id              SERIAL PRIMARY KEY,
    event_id        INT REFERENCES events(id) ON DELETE CASCADE,
    member_id       INT REFERENCES members(id) ON DELETE CASCADE,
    status          VARCHAR(20) DEFAULT 'registered',
    registered_at   TIMESTAMP DEFAULT NOW(),
    UNIQUE(event_id, member_id)
);

-- Publications / Articles
CREATE TABLE IF NOT EXISTS publications (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(300) NOT NULL,
    slug            VARCHAR(300) UNIQUE,
    content         TEXT,
    excerpt         TEXT,
    category        VARCHAR(50),
    image_url       TEXT,
    file_url        TEXT,
    is_members_only BOOLEAN DEFAULT FALSE,
    is_published    BOOLEAN DEFAULT TRUE,
    author_id       INT REFERENCES members(id),
    published_at    TIMESTAMP DEFAULT NOW(),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Actualites
CREATE TABLE IF NOT EXISTS news (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(300) NOT NULL,
    slug            VARCHAR(300) UNIQUE,
    content         TEXT,
    excerpt         TEXT,
    image_url       TEXT,
    is_pinned       BOOLEAN DEFAULT FALSE,
    is_published    BOOLEAN DEFAULT TRUE,
    author_id       INT REFERENCES members(id),
    published_at    TIMESTAMP DEFAULT NOW(),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Documents partages (espace membres)
CREATE TABLE IF NOT EXISTS documents (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(300) NOT NULL,
    description     TEXT,
    file_url        TEXT NOT NULL,
    file_type       VARCHAR(20),
    file_size       INT,
    category        VARCHAR(50),
    is_members_only BOOLEAN DEFAULT TRUE,
    uploaded_by     INT REFERENCES members(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Partenaires
CREATE TABLE IF NOT EXISTS partners (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    logo_url        TEXT,
    website_url     TEXT,
    description     TEXT,
    sort_order      INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Bureau / Conseil d'administration
CREATE TABLE IF NOT EXISTS board_members (
    id              SERIAL PRIMARY KEY,
    member_id       INT REFERENCES members(id),
    role            VARCHAR(100) NOT NULL,
    title           VARCHAR(200),
    sort_order      INT DEFAULT 0,
    is_active       BOOLEAN DEFAULT TRUE
);

-- Messages contact
CREATE TABLE IF NOT EXISTS contact_messages (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(200) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    subject         VARCHAR(300),
    message         TEXT NOT NULL,
    is_read         BOOLEAN DEFAULT FALSE,
    replied_at      TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Newsletter
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id              SERIAL PRIMARY KEY,
    email           VARCHAR(255) UNIQUE NOT NULL,
    first_name      VARCHAR(100),
    is_active       BOOLEAN DEFAULT TRUE,
    subscribed_at   TIMESTAMP DEFAULT NOW()
);

-- Sessions (auth simple)
CREATE TABLE IF NOT EXISTS sessions (
    id              SERIAL PRIMARY KEY,
    token           VARCHAR(255) UNIQUE NOT NULL,
    member_id       INT REFERENCES members(id) ON DELETE CASCADE,
    expires_at      TIMESTAMP NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Logs (journalisation RGPD)
CREATE TABLE IF NOT EXISTS logs (
    id              SERIAL PRIMARY KEY,
    action          VARCHAR(50) NOT NULL,
    user_id         INT REFERENCES members(id) ON DELETE SET NULL,
    target_id       INT,
    target_type     VARCHAR(50),
    details         TEXT,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Consentements RGPD
CREATE TABLE IF NOT EXISTS consentements (
    id              SERIAL PRIMARY KEY,
    member_id       INT REFERENCES members(id) ON DELETE CASCADE,
    consent_type    VARCHAR(50) NOT NULL,
    granted         BOOLEAN DEFAULT FALSE,
    consent_date    TIMESTAMP DEFAULT NOW(),
    version_cgu     VARCHAR(20) DEFAULT '1.0'
);

-- ============================================================
-- Tables additionnelles (social, courses, admin, annonces)
-- ============================================================

-- Annonces membres (admin.py, members.py)
CREATE TABLE IF NOT EXISTS member_announcements (
    id              SERIAL PRIMARY KEY,
    author_id       INT REFERENCES members(id) ON DELETE CASCADE,
    title           VARCHAR(300) NOT NULL,
    content         TEXT,
    category        VARCHAR(50) DEFAULT 'general',
    is_active       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Fil d'actualite — posts (social.py)
CREATE TABLE IF NOT EXISTS feed_posts (
    id              SERIAL PRIMARY KEY,
    author_id       INT REFERENCES members(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    post_type       VARCHAR(20) DEFAULT 'text',
    link_url        TEXT,
    link_title      VARCHAR(300),
    likes_count     INT DEFAULT 0,
    comments_count  INT DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Fil d'actualite — commentaires (social.py)
CREATE TABLE IF NOT EXISTS feed_comments (
    id              SERIAL PRIMARY KEY,
    post_id         INT REFERENCES feed_posts(id) ON DELETE CASCADE,
    author_id       INT REFERENCES members(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Fil d'actualite — likes (social.py)
CREATE TABLE IF NOT EXISTS feed_likes (
    id              SERIAL PRIMARY KEY,
    post_id         INT REFERENCES feed_posts(id) ON DELETE CASCADE,
    member_id       INT REFERENCES members(id) ON DELETE CASCADE,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(post_id, member_id)
);

-- Messagerie privee (social.py)
CREATE TABLE IF NOT EXISTS messages (
    id              SERIAL PRIMARY KEY,
    from_member_id  INT REFERENCES members(id) ON DELETE CASCADE,
    to_member_id    INT REFERENCES members(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Recommandations / endorsements (social.py)
CREATE TABLE IF NOT EXISTS endorsements (
    id              SERIAL PRIMARY KEY,
    from_member_id  INT REFERENCES members(id) ON DELETE CASCADE,
    to_member_id    INT REFERENCES members(id) ON DELETE CASCADE,
    skill           VARCHAR(100) NOT NULL,
    comment         TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(from_member_id, to_member_id, skill)
);

-- Offres d'emploi (social.py)
CREATE TABLE IF NOT EXISTS jobs (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(300) NOT NULL,
    company         VARCHAR(200),
    location        VARCHAR(300),
    contract_type   VARCHAR(50),
    salary_range    VARCHAR(100),
    description     TEXT,
    sector          VARCHAR(100),
    is_freelance    BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    posted_by       INT REFERENCES members(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Candidatures (social.py)
CREATE TABLE IF NOT EXISTS job_applications (
    id              SERIAL PRIMARY KEY,
    job_id          INT REFERENCES jobs(id) ON DELETE CASCADE,
    member_id       INT REFERENCES members(id) ON DELETE CASCADE,
    cover_letter    TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(job_id, member_id)
);

-- Projets membres (social.py)
CREATE TABLE IF NOT EXISTS member_projects (
    id              SERIAL PRIMARY KEY,
    member_id       INT REFERENCES members(id) ON DELETE CASCADE,
    title           VARCHAR(300),
    description     TEXT,
    role            VARCHAR(200),
    company         VARCHAR(200),
    year            INT,
    tags            TEXT[],
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Sondages (social.py)
CREATE TABLE IF NOT EXISTS polls (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(300) NOT NULL,
    description     TEXT,
    is_anonymous    BOOLEAN DEFAULT FALSE,
    multiple_choice BOOLEAN DEFAULT FALSE,
    is_active       BOOLEAN DEFAULT TRUE,
    ends_at         TIMESTAMP,
    created_by      INT REFERENCES members(id),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Options de sondage (social.py)
CREATE TABLE IF NOT EXISTS poll_options (
    id              SERIAL PRIMARY KEY,
    poll_id         INT REFERENCES polls(id) ON DELETE CASCADE,
    label           VARCHAR(300) NOT NULL,
    sort_order      INT DEFAULT 0
);

-- Votes de sondage (social.py)
CREATE TABLE IF NOT EXISTS poll_votes (
    id              SERIAL PRIMARY KEY,
    poll_id         INT REFERENCES polls(id) ON DELETE CASCADE,
    option_id       INT REFERENCES poll_options(id) ON DELETE CASCADE,
    member_id       INT REFERENCES members(id) ON DELETE CASCADE,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(poll_id, option_id, member_id)
);

-- Notifications (social.py)
CREATE TABLE IF NOT EXISTS notifications (
    id              SERIAL PRIMARY KEY,
    member_id       INT REFERENCES members(id) ON DELETE CASCADE,
    type            VARCHAR(50),
    title           VARCHAR(300),
    content         TEXT,
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Communications evenementielles (admin.py)
CREATE TABLE IF NOT EXISTS event_communications (
    id              SERIAL PRIMARY KEY,
    event_id        INT REFERENCES events(id) ON DELETE CASCADE,
    subject         VARCHAR(300),
    body            TEXT,
    sent_by         INT REFERENCES members(id),
    recipient_type  VARCHAR(20) DEFAULT 'registered',
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Formations (courses.py)
CREATE TABLE IF NOT EXISTS courses (
    id              SERIAL PRIMARY KEY,
    title           VARCHAR(300) NOT NULL,
    description     TEXT,
    category        VARCHAR(100),
    level           VARCHAR(50),
    duration        VARCHAR(50),
    price           NUMERIC(8,2) DEFAULT 0,
    instructor      VARCHAR(200),
    instructor_bio  TEXT,
    objectives      TEXT,
    location        VARCHAR(300),
    is_online       BOOLEAN DEFAULT FALSE,
    is_published    BOOLEAN DEFAULT TRUE,
    next_date       TIMESTAMP,
    max_attendees   INT,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- Index — tables originales
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_specialty ON members(specialty);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_publications_date ON publications(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_date ON news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_subscriptions_member ON subscriptions(member_id);
CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_date ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consentements_member ON consentements(member_id);
CREATE INDEX IF NOT EXISTS idx_quizz_scores_quizz ON quizz_scores(quizz_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_replays_category ON replays(category);

-- ============================================================
-- Index — nouvelles tables
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_member_announcements_author ON member_announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_member_announcements_active ON member_announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_feed_posts_author ON feed_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_date ON feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_comments_post ON feed_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_feed_likes_post ON feed_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_member_id, is_read);
CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_member_id);
CREATE INDEX IF NOT EXISTS idx_endorsements_to ON endorsements(to_member_id);
CREATE INDEX IF NOT EXISTS idx_jobs_active ON jobs(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_sector ON jobs(sector);
CREATE INDEX IF NOT EXISTS idx_job_applications_job ON job_applications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_member ON job_applications(member_id);
CREATE INDEX IF NOT EXISTS idx_member_projects_member ON member_projects(member_id);
CREATE INDEX IF NOT EXISTS idx_polls_active ON polls(is_active);
CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON poll_votes(poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_member ON poll_votes(member_id);
CREATE INDEX IF NOT EXISTS idx_notifications_member ON notifications(member_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_date ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_communications_event ON event_communications(event_id);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_courses_published ON courses(is_published, next_date);
CREATE INDEX IF NOT EXISTS idx_members_location ON members(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_members_freelance ON members(is_freelance);

-- ============================================================
-- ALTER TABLE — colonnes manquantes sur tables existantes
-- ============================================================

-- members : colonnes additionnelles (map.py, social.py, courses.py)
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_verified      BOOLEAN DEFAULT FALSE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS cv_text          TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS cv_updated_at    TIMESTAMP;
ALTER TABLE members ADD COLUMN IF NOT EXISTS linkedin_url     TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS latitude         DOUBLE PRECISION;
ALTER TABLE members ADD COLUMN IF NOT EXISTS longitude        DOUBLE PRECISION;
ALTER TABLE members ADD COLUMN IF NOT EXISTS badges           TEXT[];
ALTER TABLE members ADD COLUMN IF NOT EXISTS skills           TEXT[];
ALTER TABLE members ADD COLUMN IF NOT EXISTS certifications   TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS experience_years INT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS education        TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS location         VARCHAR(300);
ALTER TABLE members ADD COLUMN IF NOT EXISTS website_url      TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_freelance     BOOLEAN DEFAULT FALSE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS daily_rate       NUMERIC(8,2);
ALTER TABLE members ADD COLUMN IF NOT EXISTS availability     VARCHAR(50);

-- event_registrations : colonnes de presence (admin.py)
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS attended    BOOLEAN DEFAULT FALSE;
ALTER TABLE event_registrations ADD COLUMN IF NOT EXISTS attended_at TIMESTAMP;

-- ============================================================
-- PROTECTIONS BASE DE DONNEES
-- ============================================================

-- Protection: empecher la suppression accidentelle de membres actifs
CREATE OR REPLACE FUNCTION prevent_active_member_delete()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'active' AND OLD.is_admin = FALSE AND OLD.archived_at IS NULL THEN
        RAISE EXCEPTION 'Impossible de supprimer un membre actif. Archivez-le d''abord.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_active_member_delete ON members;
CREATE TRIGGER trg_prevent_active_member_delete
    BEFORE DELETE ON members
    FOR EACH ROW EXECUTE FUNCTION prevent_active_member_delete();

-- Protection: journalisation automatique des modifications sur members
CREATE OR REPLACE FUNCTION log_member_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        INSERT INTO logs (action, user_id, details, ip_address)
        VALUES ('status_change', NEW.id,
                'Status: ' || OLD.status || ' -> ' || NEW.status, 'system');
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.is_admin != NEW.is_admin THEN
        INSERT INTO logs (action, user_id, details, ip_address)
        VALUES ('admin_change', NEW.id,
                'is_admin: ' || OLD.is_admin || ' -> ' || NEW.is_admin, 'system');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_member_changes ON members;
CREATE TRIGGER trg_log_member_changes
    AFTER UPDATE ON members
    FOR EACH ROW EXECUTE FUNCTION log_member_changes();

-- Protection: nettoyage automatique des sessions expirees
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Protection: limite le nombre de sessions par membre (max 3)
CREATE OR REPLACE FUNCTION limit_sessions_per_member()
RETURNS TRIGGER AS $$
BEGIN
    DELETE FROM sessions
    WHERE member_id = NEW.member_id
      AND id NOT IN (
          SELECT id FROM sessions
          WHERE member_id = NEW.member_id
          ORDER BY created_at DESC LIMIT 3
      );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_limit_sessions ON sessions;
CREATE TRIGGER trg_limit_sessions
    AFTER INSERT ON sessions
    FOR EACH ROW EXECUTE FUNCTION limit_sessions_per_member();

-- Protection: empecher les injections via email (format basique)
ALTER TABLE members DROP CONSTRAINT IF EXISTS chk_email_format;
ALTER TABLE members ADD CONSTRAINT chk_email_format
    CHECK (email ~* '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');

-- Protection: mots de passe non vides
ALTER TABLE members DROP CONSTRAINT IF EXISTS chk_password_not_empty;
ALTER TABLE members ADD CONSTRAINT chk_password_not_empty
    CHECK (length(password_hash) >= 10);

-- Protection: limiter la taille des champs texte
ALTER TABLE contact_messages DROP CONSTRAINT IF EXISTS chk_message_length;
ALTER TABLE contact_messages ADD CONSTRAINT chk_message_length
    CHECK (length(message) <= 10000);

ALTER TABLE members DROP CONSTRAINT IF EXISTS chk_bio_length;
ALTER TABLE members ADD CONSTRAINT chk_bio_length
    CHECK (bio IS NULL OR length(bio) <= 5000);
