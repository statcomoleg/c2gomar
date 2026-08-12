-- onboarding_messages: серия сообщений для новых пользователей
-- media_type: null | 'photo' | 'video_note'
-- media_file_id: Telegram file_id после загрузки админом (кружок/фото)
create table onboarding_messages (
  id serial primary key,
  step_order integer not null unique,
  text text not null,
  delay_seconds integer not null default 0,
  media_type text check (media_type is null or media_type in ('photo', 'video_note')),
  media_file_id text,
  button_text text,
  button_url text,
  created_at timestamptz not null default now()
);

alter table onboarding_messages enable row level security;
