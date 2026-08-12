-- app_settings: singleton с настройками марафона
create table app_settings (
  id boolean primary key default true check (id),
  marathon_start_at timestamptz not null,
  channel_id bigint not null,
  discussion_group_id bigint not null,
  channel_invite_link text
);

alter table app_settings enable row level security;
