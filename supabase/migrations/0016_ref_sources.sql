-- Источники трафика / реферальные ссылки
CREATE TABLE IF NOT EXISTS ref_sources (
  code        TEXT        PRIMARY KEY,          -- числовой или строковый код (start-параметр)
  label       TEXT        NOT NULL,             -- внутреннее название (видит только admin)
  target_url  TEXT        NOT NULL,             -- ссылка на Content2Go для этого источника
  clicks      INTEGER     NOT NULL DEFAULT 0,   -- кол-во /start с этим кодом
  joins       INTEGER     NOT NULL DEFAULT 0,   -- кол-во вступивших в канал
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Добавляем поля в users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ref_code         TEXT REFERENCES ref_sources(code) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marathon_starts_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_ref_code ON users(ref_code);
