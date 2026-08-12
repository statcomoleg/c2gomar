-- users: все, кто хоть раз написал боту /start
create table users (
  id bigint primary key,
  username text,
  first_name text,
  joined_channel_at timestamptz,
  total_points integer not null default 0,
  last_points_at timestamptz,
  onboarding_step integer not null default 0,
  created_at timestamptz not null default now()
);

alter table users enable row level security;
