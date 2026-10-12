-- Закриваємо доступ до public.leads для публічних ролей Supabase.
-- Без RLS будь-хто з публічним (anon) ключем міг би читати й змінювати всі рядки.
alter table public.leads enable row level security;

-- Політик не створюємо: anon і authenticated не бачать і не змінюють нічого.
-- Явно знімаємо й табличні права, щоб захист не тримався лише на RLS.
revoke all on public.leads from anon, authenticated;

-- Агент через MCP ходить під роллю postgres (власник таблиці): RLS її не обмежує,
-- тому читання й запис через execute_sql працюють як і раніше.
