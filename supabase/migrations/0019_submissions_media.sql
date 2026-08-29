ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS media_type    TEXT,   -- 'photo' | 'video' | 'document' | null
  ADD COLUMN IF NOT EXISTS media_file_id TEXT;   -- Telegram file_id наибольшего доступного разрешения
