---
name: db_rules
globs: ["supabase/migrations/**/*.sql"]
---

- RLS включён (`enable row level security`) на каждой новой таблице без исключений.
- Никаких `select *` в коде приложения, обращающемся к этим таблицам — только явные списки полей.
- Баллы (`points`, `total_points`) — только `integer`, никогда `float`/`numeric` с дробной частью.
- Все временные поля — `timestamptz`, никогда `timestamp without time zone`.
- Внешние ключи обязательны везде, где есть логическая связь (task_id, user_id, admin_id и т.д.).
- Изменение существующей применённой миграции запрещено — только новая миграция сверху (append-only).
- Имя файла миграции: `NNNN_short_description.sql`, номер строго по возрастанию без пропусков.
