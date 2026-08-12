# CLAUDE.md — Telegram-бот марафона «Контент-завод»

## Что это за проект
Telegram-бот для администрирования онлайн-марафона: онбординг участников, приём заявок в закрытый
канал, приём и модерация отчётов о выполнении заданий (через комментарии под постами), система
баллов и рейтинга, рассылки. Полная бизнес-логика — в `TECH_SPEC.md`, идея и допущения — в
`PROJECT_IDEA.md`. Эти два файла — источник истины, при любом сомнении сверяться с ними, а не
додумывать самостоятельно.

## Стек
- TypeScript, Node.js 20+
- grammY (+ `@grammyjs/conversations`, `@grammyjs/runner`) — фреймворк бота, long polling
- Supabase (Postgres) через `@supabase/supabase-js`, service-role ключ
- zod — валидация ввода в диалогах
- date-fns — работа с датами (TZ=Europe/Moscow)
- Хостинг: Node-процесс (Railway/Render), без вебхуков

## Структура репозитория
```
/CLAUDE.md
/PROJECT_IDEA.md
/TECH_SPEC.md
/SPEC_TEMPLATE.md
/package.json
/tsconfig.json
/.env.example
/src/
  index.ts                 -- точка входа, инициализация бота
  bot/
    middleware/             -- isAdmin, error handling
    handlers/
      user/                 -- /start, "Мои задания", "Рейтинг"
      admin/                 -- /admin, "Начислить", "Добавить задание", "Рассылка"
      joinRequest.ts         -- chat_join_request
      discussionComment.ts   -- обработка комментариев в discussion group
    conversations/           -- многошаговые диалоги (award, addTask, broadcast)
    keyboards/               -- фабрики inline/reply-клавиатур
    texts/                   -- все текстовые шаблоны сообщений (единое место)
  db/
    client.ts                -- supabase client
    repositories/             -- users, tasks, submissions, pointsLedger, settings
  services/
    onboarding.ts
    ranking.ts
    broadcast.ts
    taskMatching.ts           -- сопоставление comment -> task через discussion_message_id
  types/
/supabase/
  migrations/                 -- SQL из TECH_SPEC.md раздел 2, по одной таблице на файл
.claude/
  agents/  -- роли сабагентов
  rules/   -- контекстные правила (авто-подключаются по glob)
  skills/  -- повторяемые процедуры
```

## Принцип: специфичность прежде кода
Не начинать писать код фичи, пока она не описана в `TECH_SPEC.md` разделом 4/5. Если что-то в
задаче не покрыто спекой — это баг спеки, дополнить `TECH_SPEC.md`, а не придумывать поведение
в коде молча.

## Правила моделей
- Все сабагенты (`.claude/agents/*.md`) — Opus, кроме `qa-reviewer` — Sonnet (ревью дешевле кода).
- `qa-reviewer` только читает и тестирует: инструменты `[Read, Bash, Glob, Grep]`, никогда не
  редактирует код напрямую — только пишет отчёт с найденными проблемами.

## Workflow сборки
1. `database-architect` создаёт все миграции из `TECH_SPEC.md` раздела 2 → `supabase/migrations/`.
2. `backend-engineer` реализует core бота и все handlers (разделы 4–5 TECH_SPEC.md).
3. `bot-ux-developer` пишет/причёсывает все тексты и клавиатуры (единое место — `src/bot/texts/`).
4. `qa-reviewer` прогоняет чек-лист (см. `.claude/agents/qa-reviewer.md`), пишет отчёт
   `QA_REPORT.md` в корне, не трогая код.
5. Замечания из `QA_REPORT.md` устраняет `backend-engineer`/`bot-ux-developer` точечно.
Работа над шагами 1–3 может идти параллельно (не блокируют друг друга: миграции независимы от
текстов, backend может писать заглушки текстов и заменить их позже реальными из `texts/`).

## Обязательные проверки перед тем как считать фичу готовой
- Все SQL из TECH_SPEC.md раздела 2 применены как отдельные миграции с понятными именами файлов
  (`0001_users.sql`, `0002_admins.sql`, ...).
- Секреты только в `.env` (никогда не хардкодить токен/ключи в коде), `.env` в `.gitignore`.
- Каждый admin-only handler защищён middleware проверки `admins` таблицы.
- Все тексты сообщений участнику — из `src/bot/texts/`, ни одной inline-строки в handlers.
- Нет TODO/заглушек — если поведение не описано в TECH_SPEC.md, сначала дополнить спеку.

## Игнорирование устаревших API
Context7 MCP (если подключён) — свериться с актуальной документацией grammY и
`@supabase-js` перед использованием менее очевидных методов (conversations plugin API меняется
между версиями).

## Готовность к автономной сборке
Ожидание полной автономии: агент не должен останавливаться для уточнений — все решения уже приняты
в `PROJECT_IDEA.md` разделе 9 и `TECH_SPEC.md`. Единственное легитимное исключение — секреты
(`BOT_TOKEN`, `SUPABASE_*`), которые пользователь вводит сам в `.env` после сборки кода.
