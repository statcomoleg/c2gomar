-- Расширяем онбординг: video/media_group, локальные пути, условие «не в канале»
alter table onboarding_messages
  drop constraint if exists onboarding_messages_media_type_check;

alter table onboarding_messages
  add constraint onboarding_messages_media_type_check
  check (
    media_type is null
    or media_type in ('photo', 'video', 'video_note', 'media_group')
  );

alter table onboarding_messages
  add column if not exists local_media_paths text;

alter table onboarding_messages
  add column if not exists only_if_not_joined boolean not null default false;

comment on column onboarding_messages.local_media_paths is
  'JSON-массив относительных путей к файлам, напр. ["assets/onboarding/msg1.png"]';
comment on column onboarding_messages.only_if_not_joined is
  'Если true — шаг не отправляется, если users.joined_channel_at уже заполнен';
