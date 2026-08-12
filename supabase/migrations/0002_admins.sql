-- admins: telegram id админов
create table admins (
  id bigint primary key,
  added_at timestamptz not null default now()
);

alter table admins enable row level security;
