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

-- Index
CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_publications_date ON publications(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_date ON news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_subscriptions_member ON subscriptions(member_id);
CREATE INDEX IF NOT EXISTS idx_members_specialty ON members(specialty);
CREATE INDEX IF NOT EXISTS idx_quizz_scores_quizz ON quizz_scores(quizz_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_replays_category ON replays(category);
