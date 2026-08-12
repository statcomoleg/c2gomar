-- Индексы под реальные паттерны запросов
create index users_ranking_idx on users (total_points desc, last_points_at asc nulls last);
create index tasks_discussion_message_id_idx on tasks (discussion_message_id)
  where discussion_message_id is not null;
create index tasks_type_label_idx on tasks (type, label);
create index submissions_status_idx on submissions (status) where status = 'pending';
create index points_ledger_user_created_idx on points_ledger (user_id, created_at desc);
