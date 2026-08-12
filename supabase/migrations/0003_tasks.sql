-- tasks: ПДЗ и ДЗ
create table tasks (
  id serial primary key,
  type text not null check (type in ('pre', 'main')),
  label text not null,
  description text not null,
  channel_post_link text not null,
  channel_message_id bigint not null,
  discussion_message_id bigint,
  is_active boolean not null default true,
  created_by bigint references admins(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index tasks_channel_message_id_idx on tasks(channel_message_id);

alter table tasks enable row level security;
