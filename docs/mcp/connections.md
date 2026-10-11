# Підключення MCP-серверів LeadDesk (Task B)

- **Акаунти** (особисті чи одноразові, без клієнтських організацій і команд): Supabase — одноразовий проєкт `leaddesk-ws05` в особистій організації · Vercel — особистий акаунт (Hobby), форк підключено через git-інтеграцію в дашборді · Figma — особистий акаунт, план Starter, власний тестовий файл
- **Третій сервер:** Figma — чому саме він: не потребує запуску локального процесу й браузера, а для Task B потрібен лише невеликий результат (токени дизайну з одного фрейму). Урок про права теж показовий: звузити токен на сервері неможливо, лише deny на клієнті.
- **Vercel CLI на цій машині:** не встановлено (`command -v vercel` нічого не знайшов), тож `use_vercel_cli` не має чого запускати.

## Сервери

| Сервер | Який доступ | Навіщо нам | Що станеться при компрометації | Чим саме звужено |
|---|---|---|---|---|
| `supabase` | Один проєкт: читання й запис у базу через `execute_sql` і `apply_migration`, документація, URL і публічні ключі. `execute_sql` ходить під роллю `postgres` (не суперкористувач) | Міграція схеми й сид для Task C | Хто вкраде токен, зможе читати й змінювати дані та схему цього одноразового проєкту. Інших проєктів і організацій не побачить | `project_ref=…` прив'язує всі інструменти до одного проєкту; `features=database,development,docs` прибирає account-інструменти, `functions` і `branching`. `read_only` свідомо не ставили, бо потрібен `apply_migration`. В `allow` лише `search_docs`, `list_tables`, `list_migrations`; `execute_sql` і `apply_migration` схвалюються вручну |
| `vercel` | OAuth-токен усього користувача Vercel: проєкти, деплої, логи, покупки, токен не звужується | Лог білду для перевірки деплою | З токеном можна деплоїти, купувати плани й домени, роздавати посилання повз Deployment Protection, писати в toolbar-треди | В URL нічого звузити не можна. На клієнті deny на 11 інструментів, що змінюють стан (`buy_*`, `deploy_to_vercel`, `get_access_to_vercel_url`, `import-claude-design-from-url`, 4 toolbar). В `allow` лише читання деплоїв і логів. CLI не встановлено |
| `figma` | Один OAuth-скоуп `mcp:connect`: читання файлів акаунта, а також запис через деякі інструменти | Токени дизайну (змінні й стилі) з одного фрейму | Хто вкраде токен, зможе читати файли акаунта й створювати чи змінювати файли та ресурси, поки діє скоуп | Звузити на сервері нічим. На клієнті deny на 12 записуючих інструментів: чотири обов'язкові (`use_figma`, `create_new_file`, `upload_assets`, `generate_diagram`) плюс `add_code_connect_map`, `send_code_connect_mappings`, `create_/update_generative_plugin`, `create_/update_shader`, `generate_figma_design`, `generate_image`. В `allow` нічого: кожен виклик запитує дозвіл |

## Supabase: схема й сид

- Міграція `supabase/migrations/0001_leaddesk.sql` створює таблицю `public.leads` (`id`, `full_name`, `company`, `email`, `source`, `status` з `check` на п'ять статусів, `budget`, `message`, `created_at`)
- Сид `supabase/seed/leads.sql`: 20 рядків, `lead_0001`–`lead_0020`, ті самі, що в `materials/leads.json`
- Скільки інструментів Supabase видно в `/mcp` із вашим URL: 9
- Якими викликами створено схему й дані і що ви схвалювали вручну: агент створив файли міграції й сиду (запис файлів схвалено вручну), потім `apply_migration` застосував міграцію, а `execute_sql` виконав сид; кожен виклик схвалено вручну в manual mode. Перевірка: `select count(*) from public.leads` → 20; `select current_user, session_user, current_setting('is_superuser')` → `postgres`, `postgres`, `off`

## Сесії: що вмикаємо разом

У кожній сесії — щонайбільше один сервер із правом запису; браузерний сервер — ніколи разом із Supabase.

| Крок | Увімкнено в `/mcp` | Сервер із правом запису в цій сесії |
|---|---|---|
| Міграція й сид | `supabase` | `supabase` |
| Лог білду | `vercel` | —, записуючі інструменти під deny |
| Токени з Figma | `figma` | —, записуючі інструменти під deny |

## Vercel: що пішло не так

- Агент знайшов проєкт і деплой (`list_projects`, `list_deployments`), але запит логів білду повернув **403** «Not authorized… scope …»: токен не мав доступу до скоупу, якому належить проєкт.
- Повідомлення про помилку само запропонувало обхід через `vercel inspect … --logs` у `Bash`. Агент запитав дозвіл, ми відмовилися: CLI працює під окремим логіном повз правила `mcp__vercel__*`.
- Після повторної автентифікації (`/mcp` → Re-authenticate) лог отримано; збережено в `docs/mcp/evidence/vercel-build-log.txt`.
- Інструмент логів показав запит дозволу, хоча в `allow` є `get_deployment_build_logs`: ім'я на живому сервері інше (агент викликав «List Deployment Events»), тож правило не збіглося. Безпечний бік помилки: запит замість мовчазного дозволу.

## До і після звуження: третій сервер

- Як отримали перелік: нова сесія, у `/mcp` лише `figma`, запит «Перелічи всі інструменти сервера figma, які тобі зараз доступні. Нічого не викликай.»
- `docs/mcp/evidence/mcp-before.txt`: 39 інструментів
- `docs/mcp/evidence/mcp-after.txt`: 29 інструментів; зникли рівно 12 заборонених: `use_figma`, `create_new_file`, `upload_assets`, `generate_diagram`, `add_code_connect_map`, `send_code_connect_mappings`, `create_generative_plugin`, `update_generative_plugin`, `create_shader`, `update_shader`, `generate_figma_design`, `generate_image`
- **Дрейф каталогу:** у «після» з'явилися два інструменти, яких не було в «до»: `get_generative_plugin` і `weave_upload_asset`. Каталог сервера змінився між двома сесіями. `weave_upload_asset` схожий на запис (завантаження ресурсу), але не під deny, бо його не було в списку «до»; залишено як спостереження. Перелік інструментів — свідчення на момент сесії, а не гарантія.
- Результат `get_variable_defs` для одного фрейму: один токен `heading/primary` (текстовий стиль) у `docs/mcp/evidence/figma-tokens.json`. Кольорові стилі не повернулися як змінні.
- Квота: `whoami` показав план Starter (адмін, seat View), тобто 20 викликів на місяць; ми використали `whoami` і один `get_variable_defs`.
