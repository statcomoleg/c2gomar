-- Промо-коды: одно слово → начисление баллов
CREATE TABLE IF NOT EXISTS promo_codes (
  id          SERIAL PRIMARY KEY,
  code        TEXT    NOT NULL UNIQUE,
  points      INTEGER NOT NULL CHECK (points > 0),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  max_uses    INTEGER NOT NULL DEFAULT 0,   -- 0 = безлимит
  used_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Учёт кто какой промо-код использовал (каждый пользователь — один раз на код)
CREATE TABLE IF NOT EXISTS promo_code_uses (
  id        SERIAL PRIMARY KEY,
  code_id   INTEGER NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id   BIGINT  NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  used_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_code_uses_user ON promo_code_uses(user_id);
