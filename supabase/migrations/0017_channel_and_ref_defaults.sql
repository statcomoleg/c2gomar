-- Обновляем канал на @content2go и invite link
UPDATE app_settings
SET
  channel_id         = -1003877739897,
  channel_invite_link = 'https://t.me/content2go'
WHERE id = true;

-- Добавляем дефолтную реф-ссылку в настройки
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS default_ref_url TEXT NOT NULL DEFAULT 'https://content2go.app/refH4kGr6DM';

UPDATE app_settings
SET default_ref_url = 'https://content2go.app/refH4kGr6DM'
WHERE id = true;

-- Заменяем хардкод Content2Go URL в текстах онбординга на плейсхолдер {{REF_URL}}
UPDATE onboarding_messages
SET
  text       = REPLACE(text,       'https://content2go.app/refH4kGr6DM', '{{REF_URL}}'),
  button_url = REPLACE(button_url, 'https://content2go.app/refH4kGr6DM', '{{REF_URL}}')
WHERE text       LIKE '%content2go.app/refH4kGr6DM%'
   OR button_url LIKE '%content2go.app/refH4kGr6DM%';
