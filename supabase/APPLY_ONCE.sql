-- Запуск ОДИН раз в Supabase → SQL Editor → New query → Run
-- Файл сгенерирован из supabase/migrations 0001–0010

-- ========== 0001_users.sql ==========
create table if not exists users (
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

-- ========== 0002_admins.sql ==========
create table if not exists admins (
  id bigint primary key,
  added_at timestamptz not null default now()
);
alter table admins enable row level security;

-- ========== 0003_tasks.sql ==========
create table if not exists tasks (
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
create unique index if not exists tasks_channel_message_id_idx on tasks(channel_message_id);
alter table tasks enable row level security;

-- ========== 0004_submissions.sql ==========
create table if not exists submissions (
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
create index if not exists submissions_task_user_idx on submissions(task_id, user_id);
alter table submissions enable row level security;

-- ========== 0005_points_ledger.sql ==========
create table if not exists points_ledger (
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

-- ========== 0006_onboarding_messages.sql ==========
create table if not exists onboarding_messages (
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

-- ========== 0007_app_settings.sql ==========
create table if not exists app_settings (
  id boolean primary key default true check (id),
  marathon_start_at timestamptz not null,
  channel_id bigint not null,
  discussion_group_id bigint not null,
  channel_invite_link text
);
alter table app_settings enable row level security;

-- ========== 0008_indexes_and_rls.sql ==========
create index if not exists users_ranking_idx on users (total_points desc, last_points_at asc nulls last);
create index if not exists tasks_discussion_message_id_idx on tasks (discussion_message_id)
  where discussion_message_id is not null;
create index if not exists tasks_type_label_idx on tasks (type, label);
create index if not exists submissions_status_idx on submissions (status) where status = 'pending';
create index if not exists points_ledger_user_created_idx on points_ledger (user_id, created_at desc);

-- ========== 0009_seed.sql ==========
insert into app_settings (id, marathon_start_at, channel_id, discussion_group_id, channel_invite_link)
values (
  true,
  '2026-08-17 12:00:00+03',
  -1004293703880,
  -1004302931100,
  'https://t.me/+4zgobAW0C-wzYjYy'
)
on conflict (id) do update set
  marathon_start_at = excluded.marathon_start_at,
  channel_id = excluded.channel_id,
  discussion_group_id = excluded.discussion_group_id,
  channel_invite_link = excluded.channel_invite_link;

insert into admins (id) values (5025829216) on conflict (id) do nothing;

insert into onboarding_messages (step_order, text, delay_seconds, media_type, media_file_id, button_text, button_url)
values
(
  1,
  E'Привет! 👋\n\nМеня зовут Олег Статком. Я сооснователь <a href="https://content2go.app/refH4kGr6DM">платформы</a> для создания контент-заводов <a href="https://content2go.app/refH4kGr6DM">Content2Go</a>.\n\nВас пригласил сюда тот, кто считает, что вам тут нужно быть — по одной из двух причин:\n\n<b>1.</b> Вы хотите научиться запускать контент-заводы и продавать эту услугу клиентам за 10–70 тысяч рублей в месяц каждому.\n\nТогда я расскажу, почему услуги креатора ИИ контент-заводов становятся одними из самых востребованных на рынке, за что клиенты платят нашим креаторам и как войти в эту профессию без вложений.\n\n<b>2.</b> Вы эксперт, предприниматель или специалист и хотите привлекать клиентов на автомате, используя возможности контент-завода без технических навыков.\n\nТогда я покажу, как запустить свой первый контент-завод за 15 минут на одном из 100+ форматов и получить охваты, трафик и клиентов.\n\nВсё это — на бесплатном практикуме <b>17 августа</b>.\n\nЗакрытый канал: https://t.me/+4zgobAW0C-wzYjYy',
  0, null, null, null, null
),
(
  2,
  E'Контент-завод — это система, которая сама анализирует нишу и тренды, пишет сценарии, снимает ИИ-видео и выкладывает в соцсети. ⚙️\n\nТо, что раньше креаторы делали руками в нейросетях, сейчас можно полностью делегировать:\n\n• найти тренды и идеи, которые вирусятся в вашей нише\n• создать сценарий, который зацепит зрителя\n• подготовить картинки, превратить их в видео, озвучить\n• сделать монтаж и выложить\n\nОдна ветка контент-завода на <a href="https://content2go.app/refH4kGr6DM">платформе</a> может давать до 1000 уникальных роликов в месяц: ИИ-аватары, креативные ролики, ИИ-мультики, UGC-обзоры и не только.\n\nНа <a href="https://content2go.app/refH4kGr6DM">платформе</a> уже 100+ форматов под разные ниши. Выбираете нужный, как в каталоге маркетплейса, вбиваете нишу, настраиваете детали — и через 15 минут всё готово к работе.',
  30, null, null, null, null
),
(
  3,
  E'Есть ли у вас планы на <b>17 августа</b>? 📅\n\nМы стартуем бесплатный практикум «Креатор контент-заводов». Это закрытый канал с инструкциями и уроками — за это время вы:\n\n<b>1.</b> Научитесь на <a href="https://content2go.app/refH4kGr6DM">платформе</a> собирать контент-заводы в любой нише без навыков\n<b>2.</b> Поймёте, как зарабатывать на контент-заводах — в своих проектах или внедряя другим под заказ\n<b>3.</b> Сделаете первые шаги, чтобы заработать на этом\n\nПосле практикума не будет продажи курсов. Тем, кто ответственно выполнит задания, откроется доступ в закрытое коммьюнити креаторов <a href="https://content2go.app/refH4kGr6DM">платформы</a> — с наработками, клиентами и опытом. Плюс несколько подарков, чтобы пройти практикум было приятнее.\n\nПрисоединяйтесь: https://t.me/+4zgobAW0C-wzYjYy',
  180, null, null, 'Присоединиться к практикуму', 'https://t.me/+4zgobAW0C-wzYjYy'
),
(
  4,
  E'Заберу буквально минуту — сэкономлю вам вечность. 🙂\n\nЗаходите на <a href="https://content2go.app/refH4kGr6DM">платформу</a> в кабинет, выбираете формат под нишу, настраиваете ветку и запускаете: видео, посты и статьи генерятся сами.\n\nКлиенты платят креаторам несколько тысяч за одно такое видео, а на <a href="https://content2go.app/refH4kGr6DM">платформе</a> оно делается автоматически и стоит около 160 ₽.\n\nЖду вас на практикуме <b>17 августа</b>.',
  300, 'video_note', null, 'Присоединиться к практикуму', 'https://t.me/+4zgobAW0C-wzYjYy'
),
(
  5,
  E'Не вижу вас среди участников… 👀\n\nПрактикум стартует <b>17 августа</b> — не созвоны и не вебинар, а текстовые и видео-инструкции, которые можно смотреть в удобное время.\n\nЗа дни практикума вы научитесь создавать контент-заводы и поймёте, кто готов платить за это сотни тысяч рублей и как таких клиентов найти.\n\nЗакрытый канал: https://t.me/+4zgobAW0C-wzYjYy',
  180, null, null, 'Присоединиться к практикуму', 'https://t.me/+4zgobAW0C-wzYjYy'
)
on conflict (step_order) do nothing;

-- ========== 0010_ranking_rpc.sql ==========
create or replace function get_user_rank(p_user_id bigint)
returns table(rank bigint, total_points integer)
language sql
stable
as $$
  with ranked as (
    select
      id,
      users.total_points,
      row_number() over (
        order by users.total_points desc, users.last_points_at asc nulls last
      ) as rank
    from users
  )
  select ranked.rank, ranked.total_points
  from ranked
  where id = p_user_id;
$$;
