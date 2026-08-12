# Запуск бота марафона «Контент-завод»

## Что нужно заранее

1. Проект в [Supabase](https://supabase.com) (Postgres).
2. Бот от [@BotFather](https://t.me/BotFather) → `BOT_TOKEN`.
3. Закрытый канал + группа обсуждений (Discussion), бот — **админ** в обоих.
4. Ваш Telegram ID (уже в сиде: `5025829216`).

## 1. Зависимости

```bash
npm install
cp .env.example .env
```

Заполните `.env`:

```
BOT_TOKEN=...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...   # service_role, не anon
ADMIN_TELEGRAM_IDS=5025829216
TZ=Europe/Moscow
```

## 2. Миграции Supabase

В SQL Editor Supabase выполните файлы из `supabase/migrations/` **по порядку**  
`0001` → `0010` (или `supabase db push`, если настроен CLI).

Затем **обязательно** обновите плейсхолдеры:

```sql
update app_settings set
  channel_id = -100xxxxxxxxxx,          -- id канала (отрицательный)
  discussion_group_id = -100xxxxxxxxxx, -- id группы обсуждений
  marathon_start_at = '2026-08-17 12:00:00+03',
  channel_invite_link = 'https://t.me/+4zgobAW0C-wzYjYy'
where id = true;
```

### Как узнать channel_id / discussion_group_id

1. Добавьте бота админом в канал и в чат обсуждений.
2. Перешлите любое сообщение из канала/чата боту @userinfobot  
   **или** напишите боту `/debug_chat_id` из нужного чата (команда админа; в группе бот должен видеть сообщения).

Invite-ссылки:
- Канал: https://t.me/+4zgobAW0C-wzYjYy  
- Чат: https://t.me/+u503tNUQUCI2NDFi  

## 3. Видео-кружок в онбординге

Шаг 4 онбординга ждёт `media_file_id`:

1. `/admin` → **Онбординг** → «Сохранить кружок» (или `/save_circle`).
2. Отправьте боту video-кружок (запишите в Telegram и перешлите).
3. Бот сохранит `file_id` в БД — деплой не нужен.

Тексты и задержки шагов правятся там же: **Онбординг** → шаг → изменить текст/задержку.  
HTML: `<b>жирный</b>`, `<a href="https://...">ссылка</a>`.

## 4. Локальный запуск

```bash
npm run dev
```

Напишите боту `/start`. Админ: `/admin`.

## 5. Railway

Railway **не бесплатный навсегда**: trial ~$5, дальше Hobby ≈ **$5–10/мес**.  
Для ~1000 участников одного Node-процесса с long polling хватает (БД в Supabase, не на Railway).

1. Создайте проект на [railway.app](https://railway.app), подключите GitHub-репозиторий.
2. Variables = те же, что в `.env`.
3. Build: `npm run build`, Start: `npm start` (уже в `package.json` / Nixpacks).
4. Деплой перезапускает **только процесс бота**. Прогресс участников (`users`, `submissions`, `points_ledger`) живёт в Supabase и **не сбрасывается**.

Не храните прод-БД на эфемерном диске Railway. Миграции — только additive (без DROP прод-данных).

## 6. Чек-лист перед стартом марафона

- [ ] `channel_id` / `discussion_group_id` реальные  
- [ ] Бот админ канала + discussion group, заявки может approve  
- [ ] Кружок онбординга сохранён (`/save_circle`)  
- [ ] ПДЗ добавлены через «Добавить задание» + ссылка на пост  
- [ ] `/start` → цепочка → заявка в канал → авто-одобрение  
- [ ] Тестовый комментарий под постом → карточка админу  

## 7. Локальная админка (только ваш компьютер)

```bash
npm run admin
```

Откройте в браузере: **http://127.0.0.1:3737**

Пароль — из `.env` → `ADMIN_PANEL_PASSWORD` (сейчас `content2go-admin`).

Сервер слушает **только 127.0.0.1** — из интернета недоступен.  
Можно держать бота на Railway, а админку запускать у себя дома.

Разделы: обзор, проверка заданий, участники (±баллы), рейтинг, задания, рассылка, онбординг, журнал баллов, настройки.

---

## Команды админа в Telegram

| Действие | Как |
|---|---|
| Меню | `/admin` |
| Начислить / задание / рассылка / онбординг | кнопки меню |
| Сохранить кружок | `/save_circle` или кнопка в Онбординге |
| Узнать chat id | `/debug_chat_id` |
