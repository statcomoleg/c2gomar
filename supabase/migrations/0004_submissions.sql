-- submissions: отчёты пользователей по заданиям
create table submissions (
  id serial primary key,
  task_id integer not null references tasks(id) on delete restrict,
  user_id bigint not null references users(id) on delete restrict,
  comment_message_id bigint not null,
  comment_text text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'superseded')),
  points_awarded integer,
  reviewed_by bigint references admins(id) on delete restrict,
  reviewed_at timestamptz,
  admin_feedback text,
  submitted_at timestamptz not null default now()
);

create index submissions_task_user_idx on submissions(task_id, user_id);

alter table submissions enable row level security;
