-- Таблица документов/медиафайлов (загружаемых администратором для площадок)
CREATE TABLE IF NOT EXISTS t_p86624112_golden_legacy_academ.documents (
    id SERIAL PRIMARY KEY,
    ground_id INTEGER NOT NULL DEFAULT 0,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    file_key VARCHAR(500) NOT NULL,
    file_url TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL DEFAULT 'document',
    file_size INTEGER DEFAULT 0,
    uploaded_by INTEGER NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    required_level INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица задач/заданий по площадкам (для автопрогрессии)
CREATE TABLE IF NOT EXISTS t_p86624112_golden_legacy_academ.ground_tasks (
    id SERIAL PRIMARY KEY,
    ground_id INTEGER NOT NULL,
    module_num INTEGER NOT NULL DEFAULT 1,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    task_type VARCHAR(50) DEFAULT 'read',
    content TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица выполненных заданий пользователями
CREATE TABLE IF NOT EXISTS t_p86624112_golden_legacy_academ.user_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    ground_id INTEGER NOT NULL,
    completed_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, task_id)
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_documents_ground ON t_p86624112_golden_legacy_academ.documents(ground_id);
CREATE INDEX IF NOT EXISTS idx_ground_tasks_ground ON t_p86624112_golden_legacy_academ.ground_tasks(ground_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_user ON t_p86624112_golden_legacy_academ.user_tasks(user_id);