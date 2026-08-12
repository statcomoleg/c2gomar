-- points_ledger: журнал начислений
create table points_ledger (
  id serial primary key,
  user_id bigint not null references users(id) on delete restrict,
  points integer not null,
  reason text not null,
  related_submission_id integer references submissions(id) on delete restrict,
  related_task_id integer references tasks(id) on delete restrict,
  admin_id bigint references admins(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table points_ledger enable row level security;
