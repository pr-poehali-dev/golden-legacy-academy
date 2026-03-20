
CREATE TABLE IF NOT EXISTS t_p86624112_golden_legacy_academ.users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(100) DEFAULT 'Ученик',
    level INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p86624112_golden_legacy_academ.sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_p86624112_golden_legacy_academ.users(id),
    token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 days'
);

CREATE TABLE IF NOT EXISTS t_p86624112_golden_legacy_academ.user_progress (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_p86624112_golden_legacy_academ.users(id),
    ground_id INTEGER NOT NULL,
    current_module INTEGER DEFAULT 1,
    total_modules INTEGER NOT NULL,
    percent INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'active',
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    UNIQUE(user_id, ground_id)
);

CREATE TABLE IF NOT EXISTS t_p86624112_golden_legacy_academ.certificates (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_p86624112_golden_legacy_academ.users(id),
    ground_id INTEGER NOT NULL,
    ground_title VARCHAR(255) NOT NULL,
    issued_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, ground_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON t_p86624112_golden_legacy_academ.sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON t_p86624112_golden_legacy_academ.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON t_p86624112_golden_legacy_academ.user_progress(user_id);
