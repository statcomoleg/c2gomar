
-- ========== 0001_users.sql ==========
-- users: РІСЃРµ, РєС‚Рѕ С…РѕС‚СЊ СЂР°Р· РЅР°РїРёСЃР°Р» Р±РѕС‚Сѓ /start
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


-- ========== 0002_admins.sql ==========
-- admins: telegram id Р°РґРјРёРЅРѕРІ
create table admins (
  id bigint primary key,
  added_at timestamptz not null default now()
);

alter table admins enable row level security;


-- ========== 0003_tasks.sql ==========
-- tasks: РџР”Р— Рё Р”Р—
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


-- ========== 0004_submissions.sql ==========
-- submissions: РѕС‚С‡С‘С‚С‹ РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№ РїРѕ Р·Р°РґР°РЅРёСЏРј
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


-- ========== 0005_points_ledger.sql ==========
-- points_ledger: Р¶СѓСЂРЅР°Р» РЅР°С‡РёСЃР»РµРЅРёР№
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


-- ========== 0006_onboarding_messages.sql ==========
-- onboarding_messages: СЃРµСЂРёСЏ СЃРѕРѕР±С‰РµРЅРёР№ РґР»СЏ РЅРѕРІС‹С… РїРѕР»СЊР·РѕРІР°С‚РµР»РµР№
-- media_type: null | 'photo' | 'video_note'
-- media_file_id: Telegram file_id РїРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё Р°РґРјРёРЅРѕРј (РєСЂСѓР¶РѕРє/С„РѕС‚Рѕ)
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


-- ========== 0007_app_settings.sql ==========
-- app_settings: singleton СЃ РЅР°СЃС‚СЂРѕР№РєР°РјРё РјР°СЂР°С„РѕРЅР°
create table app_settings (
  id boolean primary key default true check (id),
  marathon_start_at timestamptz not null,
  channel_id bigint not null,
  discussion_group_id bigint not null,
  channel_invite_link text
);

alter table app_settings enable row level security;


-- ========== 0008_indexes_and_rls.sql ==========
-- РРЅРґРµРєСЃС‹ РїРѕРґ СЂРµР°Р»СЊРЅС‹Рµ РїР°С‚С‚РµСЂРЅС‹ Р·Р°РїСЂРѕСЃРѕРІ
create index users_ranking_idx on users (total_points desc, last_points_at asc nulls last);
create index tasks_discussion_message_id_idx on tasks (discussion_message_id)
  where discussion_message_id is not null;
create index tasks_type_label_idx on tasks (type, label);
create index submissions_status_idx on submissions (status) where status = 'pending';
create index points_ledger_user_created_idx on points_ledger (user_id, created_at desc);


-- ========== 0009_seed.sql ==========
-- РЎРР”: РїР»РµР№СЃС…РѕР»РґРµСЂС‹. РџРµСЂРµРґ РїСЂРѕРґРѕРј Р·Р°РјРµРЅРёС‚Рµ channel_id / discussion_group_id
-- РЅР° СЂРµР°Р»СЊРЅС‹Рµ С‡РёСЃР»РѕРІС‹Рµ id (РѕС‚СЂРёС†Р°С‚РµР»СЊРЅС‹Рµ) РїРѕСЃР»Рµ РґРѕР±Р°РІР»РµРЅРёСЏ Р±РѕС‚Р° Р°РґРјРёРЅРѕРј.
-- Invite-СЃСЃС‹Р»РєРё СѓР¶Рµ РёР·РІРµСЃС‚РЅС‹; С‡РёСЃР»РѕРІС‹Рµ id СѓР·РЅР°СЋС‚СЃСЏ С‡РµСЂРµР· @userinfobot РёР»Рё /debug_chat_id.

insert into app_settings (id, marathon_start_at, channel_id, discussion_group_id, channel_invite_link)
values (
  true,
  '2026-08-17 12:00:00+03',
  -1004293703880,  -- РєР°РЅР°Р» В«РљСЂРµР°С‚РѕСЂ РєРѕРЅС‚РµРЅС‚-Р·Р°РІРѕРґРѕРІВ» (РїСЂРѕРІРµСЂРµРЅРѕ getChat)
  -1004302931100,  -- С‡Р°С‚ РѕР±СЃСѓР¶РґРµРЅРёР№ РїСЂР°РєС‚РёРєСѓРјР° (РїСЂРѕРІРµСЂРµРЅРѕ getChat)
  'https://t.me/+4zgobAW0C-wzYjYy'
)
on conflict (id) do nothing;

-- РђРґРјРёРЅ РёР· РўР— / РѕС‚РІРµС‚РѕРІ Р·Р°РєР°Р·С‡РёРєР°
insert into admins (id) values (5025829216) on conflict (id) do nothing;

-- РћРЅР±РѕСЂРґРёРЅРі-СЃРµСЂРёСЏ (HTML). РљСЂСѓР¶РѕРє (С€Р°Рі 4): media_file_id Р·Р°РїРѕР»РЅСЏРµС‚СЃСЏ Р°РґРјРёРЅРѕРј С‡РµСЂРµР· /save_circle
insert into onboarding_messages (step_order, text, delay_seconds, media_type, media_file_id, button_text, button_url)
values
(
  1,
  E'РџСЂРёРІРµС‚! рџ‘‹\n\nРњРµРЅСЏ Р·РѕРІСѓС‚ РћР»РµРі РЎС‚Р°С‚РєРѕРј. РЇ СЃРѕРѕСЃРЅРѕРІР°С‚РµР»СЊ <a href="https://content2go.app/refH4kGr6DM">РїР»Р°С‚С„РѕСЂРјС‹</a> РґР»СЏ СЃРѕР·РґР°РЅРёСЏ РєРѕРЅС‚РµРЅС‚-Р·Р°РІРѕРґРѕРІ <a href="https://content2go.app/refH4kGr6DM">Content2Go</a>.\n\nР’Р°СЃ РїСЂРёРіР»Р°СЃРёР» СЃСЋРґР° С‚РѕС‚, РєС‚Рѕ СЃС‡РёС‚Р°РµС‚, С‡С‚Рѕ РІР°Рј С‚СѓС‚ РЅСѓР¶РЅРѕ Р±С‹С‚СЊ вЂ” РїРѕ РѕРґРЅРѕР№ РёР· РґРІСѓС… РїСЂРёС‡РёРЅ:\n\n<b>1.</b> Р’С‹ С…РѕС‚РёС‚Рµ РЅР°СѓС‡РёС‚СЊСЃСЏ Р·Р°РїСѓСЃРєР°С‚СЊ РєРѕРЅС‚РµРЅС‚-Р·Р°РІРѕРґС‹ Рё РїСЂРѕРґР°РІР°С‚СЊ СЌС‚Сѓ СѓСЃР»СѓРіСѓ РєР»РёРµРЅС‚Р°Рј Р·Р° 10вЂ“70 С‚С‹СЃСЏС‡ СЂСѓР±Р»РµР№ РІ РјРµСЃСЏС† РєР°Р¶РґРѕРјСѓ.\n\nРўРѕРіРґР° СЏ СЂР°СЃСЃРєР°Р¶Сѓ, РїРѕС‡РµРјСѓ СѓСЃР»СѓРіРё РєСЂРµР°С‚РѕСЂР° РР РєРѕРЅС‚РµРЅС‚-Р·Р°РІРѕРґРѕРІ СЃС‚Р°РЅРѕРІСЏС‚СЃСЏ РѕРґРЅРёРјРё РёР· СЃР°РјС‹С… РІРѕСЃС‚СЂРµР±РѕРІР°РЅРЅС‹С… РЅР° СЂС‹РЅРєРµ, Р·Р° С‡С‚Рѕ РєР»РёРµРЅС‚С‹ РїР»Р°С‚СЏС‚ РЅР°С€РёРј РєСЂРµР°С‚РѕСЂР°Рј Рё РєР°Рє РІРѕР№С‚Рё РІ СЌС‚Сѓ РїСЂРѕС„РµСЃСЃРёСЋ Р±РµР· РІР»РѕР¶РµРЅРёР№.\n\n<b>2.</b> Р’С‹ СЌРєСЃРїРµСЂС‚, РїСЂРµРґРїСЂРёРЅРёРјР°С‚РµР»СЊ РёР»Рё СЃРїРµС†РёР°Р»РёСЃС‚ Рё С…РѕС‚РёС‚Рµ РїСЂРёРІР»РµРєР°С‚СЊ РєР»РёРµРЅС‚РѕРІ РЅР° Р°РІС‚РѕРјР°С‚Рµ, РёСЃРїРѕР»СЊР·СѓСЏ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё РєРѕРЅС‚РµРЅС‚-Р·Р°РІРѕРґР° Р±РµР· С‚РµС…РЅРёС‡РµСЃРєРёС… РЅР°РІС‹РєРѕРІ.\n\nРўРѕРіРґР° СЏ РїРѕРєР°Р¶Сѓ, РєР°Рє Р·Р°РїСѓСЃС‚РёС‚СЊ СЃРІРѕР№ РїРµСЂРІС‹Р№ РєРѕРЅС‚РµРЅС‚-Р·Р°РІРѕРґ Р·Р° 15 РјРёРЅСѓС‚ РЅР° РѕРґРЅРѕРј РёР· 100+ С„РѕСЂРјР°С‚РѕРІ Рё РїРѕР»СѓС‡РёС‚СЊ РѕС…РІР°С‚С‹, С‚СЂР°С„РёРє Рё РєР»РёРµРЅС‚РѕРІ.\n\nР’СЃС‘ СЌС‚Рѕ вЂ” РЅР° Р±РµСЃРїР»Р°С‚РЅРѕРј РїСЂР°РєС‚РёРєСѓРјРµ <b>17 Р°РІРіСѓСЃС‚Р°</b>.\n\nР—Р°РєСЂС‹С‚С‹Р№ РєР°РЅР°Р»: https://t.me/+4zgobAW0C-wzYjYy',
  0,
  null,
  null,
  null,
  null
),
(
  2,
  E'РљРѕРЅС‚РµРЅС‚-Р·Р°РІРѕРґ вЂ” СЌС‚Рѕ СЃРёСЃС‚РµРјР°, РєРѕС‚РѕСЂР°СЏ СЃР°РјР° Р°РЅР°Р»РёР·РёСЂСѓРµС‚ РЅРёС€Сѓ Рё С‚СЂРµРЅРґС‹, РїРёС€РµС‚ СЃС†РµРЅР°СЂРёРё, СЃРЅРёРјР°РµС‚ РР-РІРёРґРµРѕ Рё РІС‹РєР»Р°РґС‹РІР°РµС‚ РІ СЃРѕС†СЃРµС‚Рё. вљ™пёЏ\n\nРўРѕ, С‡С‚Рѕ СЂР°РЅСЊС€Рµ РєСЂРµР°С‚РѕСЂС‹ РґРµР»Р°Р»Рё СЂСѓРєР°РјРё РІ РЅРµР№СЂРѕСЃРµС‚СЏС…, СЃРµР№С‡Р°СЃ РјРѕР¶РЅРѕ РїРѕР»РЅРѕСЃС‚СЊСЋ РґРµР»РµРіРёСЂРѕРІР°С‚СЊ:\n\nвЂў РЅР°Р№С‚Рё С‚СЂРµРЅРґС‹ Рё РёРґРµРё, РєРѕС‚РѕСЂС‹Рµ РІРёСЂСѓСЃСЏС‚СЃСЏ РІ РІР°С€РµР№ РЅРёС€Рµ\nвЂў СЃРѕР·РґР°С‚СЊ СЃС†РµРЅР°СЂРёР№, РєРѕС‚РѕСЂС‹Р№ Р·Р°С†РµРїРёС‚ Р·СЂРёС‚РµР»СЏ\nвЂў РїРѕРґРіРѕС‚РѕРІРёС‚СЊ РєР°СЂС‚РёРЅРєРё, РїСЂРµРІСЂР°С‚РёС‚СЊ РёС… РІ РІРёРґРµРѕ, РѕР·РІСѓС‡РёС‚СЊ\nвЂў СЃРґРµР»Р°С‚СЊ РјРѕРЅС‚Р°Р¶ Рё РІС‹Р»РѕР¶РёС‚СЊ\n\nРћРґРЅР° РІРµС‚РєР° РєРѕРЅС‚РµРЅС‚-Р·Р°РІРѕРґР° РЅР° <a href="https://content2go.app/refH4kGr6DM">РїР»Р°С‚С„РѕСЂРјРµ</a> РјРѕР¶РµС‚ РґР°РІР°С‚СЊ РґРѕ 1000 СѓРЅРёРєР°Р»СЊРЅС‹С… СЂРѕР»РёРєРѕРІ РІ РјРµСЃСЏС†: РР-Р°РІР°С‚Р°СЂС‹, РєСЂРµР°С‚РёРІРЅС‹Рµ СЂРѕР»РёРєРё, РР-РјСѓР»СЊС‚РёРєРё, UGC-РѕР±Р·РѕСЂС‹ Рё РЅРµ С‚РѕР»СЊРєРѕ.\n\nРќР° <a href="https://content2go.app/refH4kGr6DM">РїР»Р°С‚С„РѕСЂРјРµ</a> СѓР¶Рµ 100+ С„РѕСЂРјР°С‚РѕРІ РїРѕРґ СЂР°Р·РЅС‹Рµ РЅРёС€Рё. Р’С‹Р±РёСЂР°РµС‚Рµ РЅСѓР¶РЅС‹Р№, РєР°Рє РІ РєР°С‚Р°Р»РѕРіРµ РјР°СЂРєРµС‚РїР»РµР№СЃР°, РІР±РёРІР°РµС‚Рµ РЅРёС€Сѓ, РЅР°СЃС‚СЂР°РёРІР°РµС‚Рµ РґРµС‚Р°Р»Рё вЂ” Рё С‡РµСЂРµР· 15 РјРёРЅСѓС‚ РІСЃС‘ РіРѕС‚РѕРІРѕ Рє СЂР°Р±РѕС‚Рµ.',
  30,
  null,
  null,
  null,
  null
),
(
  3,
  E'Р•СЃС‚СЊ Р»Рё Сѓ РІР°СЃ РїР»Р°РЅС‹ РЅР° <b>17 Р°РІРіСѓСЃС‚Р°</b>? рџ“…\n\nРњС‹ СЃС‚Р°СЂС‚СѓРµРј Р±РµСЃРїР»Р°С‚РЅС‹Р№ РїСЂР°РєС‚РёРєСѓРј В«РљСЂРµР°С‚РѕСЂ РєРѕРЅС‚РµРЅС‚-Р·Р°РІРѕРґРѕРІВ». Р­С‚Рѕ Р·Р°РєСЂС‹С‚С‹Р№ РєР°РЅР°Р» СЃ РёРЅСЃС‚СЂСѓРєС†РёСЏРјРё Рё СѓСЂРѕРєР°РјРё вЂ” Р·Р° СЌС‚Рѕ РІСЂРµРјСЏ РІС‹:\n\n<b>1.</b> РќР°СѓС‡РёС‚РµСЃСЊ РЅР° <a href="https://content2go.app/refH4kGr6DM">РїР»Р°С‚С„РѕСЂРјРµ</a> СЃРѕР±РёСЂР°С‚СЊ РєРѕРЅС‚РµРЅС‚-Р·Р°РІРѕРґС‹ РІ Р»СЋР±РѕР№ РЅРёС€Рµ Р±РµР· РЅР°РІС‹РєРѕРІ\n<b>2.</b> РџРѕР№РјС‘С‚Рµ, РєР°Рє Р·Р°СЂР°Р±Р°С‚С‹РІР°С‚СЊ РЅР° РєРѕРЅС‚РµРЅС‚-Р·Р°РІРѕРґР°С… вЂ” РІ СЃРІРѕРёС… РїСЂРѕРµРєС‚Р°С… РёР»Рё РІРЅРµРґСЂСЏСЏ РґСЂСѓРіРёРј РїРѕРґ Р·Р°РєР°Р·\n<b>3.</b> РЎРґРµР»Р°РµС‚Рµ РїРµСЂРІС‹Рµ С€Р°РіРё, С‡С‚РѕР±С‹ Р·Р°СЂР°Р±РѕС‚Р°С‚СЊ РЅР° СЌС‚РѕРј\n\nРџРѕСЃР»Рµ РїСЂР°РєС‚РёРєСѓРјР° РЅРµ Р±СѓРґРµС‚ РїСЂРѕРґР°Р¶Рё РєСѓСЂСЃРѕРІ. РўРµРј, РєС‚Рѕ РѕС‚РІРµС‚СЃС‚РІРµРЅРЅРѕ РІС‹РїРѕР»РЅРёС‚ Р·Р°РґР°РЅРёСЏ, РѕС‚РєСЂРѕРµС‚СЃСЏ РґРѕСЃС‚СѓРї РІ Р·Р°РєСЂС‹С‚РѕРµ РєРѕРјРјСЊСЋРЅРёС‚Рё РєСЂРµР°С‚РѕСЂРѕРІ <a href="https://content2go.app/refH4kGr6DM">РїР»Р°С‚С„РѕСЂРјС‹</a> вЂ” СЃ РЅР°СЂР°Р±РѕС‚РєР°РјРё, РєР»РёРµРЅС‚Р°РјРё Рё РѕРїС‹С‚РѕРј. РџР»СЋСЃ РЅРµСЃРєРѕР»СЊРєРѕ РїРѕРґР°СЂРєРѕРІ, С‡С‚РѕР±С‹ РїСЂРѕР№С‚Рё РїСЂР°РєС‚РёРєСѓРј Р±С‹Р»Рѕ РїСЂРёСЏС‚РЅРµРµ.\n\nРџСЂРёСЃРѕРµРґРёРЅСЏР№С‚РµСЃСЊ: https://t.me/+4zgobAW0C-wzYjYy',
  180,
  null,
  null,
  'РџСЂРёСЃРѕРµРґРёРЅРёС‚СЊСЃСЏ Рє РїСЂР°РєС‚РёРєСѓРјСѓ',
  'https://t.me/+4zgobAW0C-wzYjYy'
),
(
  4,
  E'Р—Р°Р±РµСЂСѓ Р±СѓРєРІР°Р»СЊРЅРѕ РјРёРЅСѓС‚Сѓ вЂ” СЃСЌРєРѕРЅРѕРјР»СЋ РІР°Рј РІРµС‡РЅРѕСЃС‚СЊ. рџ™‚\n\nР—Р°С…РѕРґРёС‚Рµ РЅР° <a href="https://content2go.app/refH4kGr6DM">РїР»Р°С‚С„РѕСЂРјСѓ</a> РІ РєР°Р±РёРЅРµС‚, РІС‹Р±РёСЂР°РµС‚Рµ С„РѕСЂРјР°С‚ РїРѕРґ РЅРёС€Сѓ, РЅР°СЃС‚СЂР°РёРІР°РµС‚Рµ РІРµС‚РєСѓ Рё Р·Р°РїСѓСЃРєР°РµС‚Рµ: РІРёРґРµРѕ, РїРѕСЃС‚С‹ Рё СЃС‚Р°С‚СЊРё РіРµРЅРµСЂСЏС‚СЃСЏ СЃР°РјРё.\n\nРљР»РёРµРЅС‚С‹ РїР»Р°С‚СЏС‚ РєСЂРµР°С‚РѕСЂР°Рј РЅРµСЃРєРѕР»СЊРєРѕ С‚С‹СЃСЏС‡ Р·Р° РѕРґРЅРѕ С‚Р°РєРѕРµ РІРёРґРµРѕ, Р° РЅР° <a href="https://content2go.app/refH4kGr6DM">РїР»Р°С‚С„РѕСЂРјРµ</a> РѕРЅРѕ РґРµР»Р°РµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё Рё СЃС‚РѕРёС‚ РѕРєРѕР»Рѕ 160 в‚Ѕ.\n\nР–РґСѓ РІР°СЃ РЅР° РїСЂР°РєС‚РёРєСѓРјРµ <b>17 Р°РІРіСѓСЃС‚Р°</b>.',
  300,
  'video_note',
  null, -- Р·Р°РїРѕР»РЅРёС‚СЊ С‡РµСЂРµР· /save_circle (РїРµСЂРµСЃР»Р°С‚СЊ РєСЂСѓР¶РѕРє Р±РѕС‚Сѓ)
  'РџСЂРёСЃРѕРµРґРёРЅРёС‚СЊСЃСЏ Рє РїСЂР°РєС‚РёРєСѓРјСѓ',
  'https://t.me/+4zgobAW0C-wzYjYy'
),
(
  5,
  E'РќРµ РІРёР¶Сѓ РІР°СЃ СЃСЂРµРґРё СѓС‡Р°СЃС‚РЅРёРєРѕРІвЂ¦ рџ‘Ђ\n\nРџСЂР°РєС‚РёРєСѓРј СЃС‚Р°СЂС‚СѓРµС‚ <b>17 Р°РІРіСѓСЃС‚Р°</b> вЂ” РЅРµ СЃРѕР·РІРѕРЅС‹ Рё РЅРµ РІРµР±РёРЅР°СЂ, Р° С‚РµРєСЃС‚РѕРІС‹Рµ Рё РІРёРґРµРѕ-РёРЅСЃС‚СЂСѓРєС†РёРё, РєРѕС‚РѕСЂС‹Рµ РјРѕР¶РЅРѕ СЃРјРѕС‚СЂРµС‚СЊ РІ СѓРґРѕР±РЅРѕРµ РІСЂРµРјСЏ.\n\nР—Р° РґРЅРё РїСЂР°РєС‚РёРєСѓРјР° РІС‹ РЅР°СѓС‡РёС‚РµСЃСЊ СЃРѕР·РґР°РІР°С‚СЊ РєРѕРЅС‚РµРЅС‚-Р·Р°РІРѕРґС‹ Рё РїРѕР№РјС‘С‚Рµ, РєС‚Рѕ РіРѕС‚РѕРІ РїР»Р°С‚РёС‚СЊ Р·Р° СЌС‚Рѕ СЃРѕС‚РЅРё С‚С‹СЃСЏС‡ СЂСѓР±Р»РµР№ Рё РєР°Рє С‚Р°РєРёС… РєР»РёРµРЅС‚РѕРІ РЅР°Р№С‚Рё.\n\nР—Р°РєСЂС‹С‚С‹Р№ РєР°РЅР°Р»: https://t.me/+4zgobAW0C-wzYjYy',
  180,
  null,
  null,
  'РџСЂРёСЃРѕРµРґРёРЅРёС‚СЊСЃСЏ Рє РїСЂР°РєС‚РёРєСѓРјСѓ',
  'https://t.me/+4zgobAW0C-wzYjYy'
)
on conflict (step_order) do nothing;


-- ========== 0010_ranking_rpc.sql ==========
-- RPC РґР»СЏ СЂРµР№С‚РёРЅРіР° СѓС‡Р°СЃС‚РЅРёРєР° (С‚Р°Р№-Р±СЂРµР№Рє: СЂР°РЅСЊС€Рµ РґРѕСЃС‚РёРі СЃСѓРјРјС‹ вЂ” РІС‹С€Рµ)
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

