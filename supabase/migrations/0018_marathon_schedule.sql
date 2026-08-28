-- Шаблоны сообщений марафонной рассылки
CREATE TABLE IF NOT EXISTS marathon_messages (
  id            SERIAL      PRIMARY KEY,
  step_order    INTEGER     NOT NULL,
  text          TEXT        NOT NULL DEFAULT '',
  media_type    TEXT,                             -- 'video_note' | 'photo' | null
  media_file_id TEXT,                             -- file_id Telegram или null
  button_text   TEXT,
  button_url    TEXT,
  -- Привязка таймера к join или marathon_start
  offset_base   TEXT        NOT NULL DEFAULT 'join',   -- 'join' | 'marathon_start'
  offset_seconds BIGINT     NOT NULL DEFAULT 0,        -- секунды от базовой точки
  -- Условия отправки (null = без условий)
  min_points    INTEGER,
  max_points    INTEGER,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_offset_base CHECK (offset_base IN ('join', 'marathon_start'))
);

-- Очередь отправки: одна запись на (пользователь × шаблон)
CREATE TABLE IF NOT EXISTS user_marathon_queue (
  id           SERIAL      PRIMARY KEY,
  user_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id   INTEGER     NOT NULL REFERENCES marathon_messages(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at      TIMESTAMPTZ,
  UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_umq_pending
  ON user_marathon_queue (scheduled_at)
  WHERE sent_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_umq_user ON user_marathon_queue (user_id);
