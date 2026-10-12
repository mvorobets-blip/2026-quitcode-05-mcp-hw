# Перевірка (Task A, Task B, Task E)

- **Інструмент і версія, модель:** Claude Code 2.1.252 (сесія перевірки Task A) і 2.1.296 (Task B–C) · Sonnet 5
- **ОС і термінал, Node:** macOS (Darwin 24.6.0) · zsh · Node v24.21.0

## Task A — сервер в Inspector

- Команди, якими зроблено чотири файли в `docs/mcp/`: `npx -y @modelcontextprotocol/inspector@2.8.0 --cli node mcp/leaddesk-server/src/server.mjs` з методами `tools/list`, `tools/call` (`leaddesk_set_lead_status`, двічі) і `resources/read`, як у walkthrough.
- `tools-list.json`: два інструменти; `leaddesk_find_leads` має `readOnlyHint: true`, `leaddesk_set_lead_status` — `readOnlyHint: false`. Кожен параметр має `.describe()`.
- `bad-input.json`: `leadId=nope`, `reason=ok`. Валідація відхилила обидва аргументи (шаблон `^lead_\d{4}$` і мінімум 3 символи в `reason`); `isError: true`, код виходу Inspector 5.
- `set-status.json`: `lead_0002` new → contacted; в `structuredContent.audit` є `action`, `leadId`, `at` (плюс `from`, `to`, `reason`).
- Самоперевірки: `grep -c '"isError": true' docs/mcp/bad-input.json` → 1; `grep -rc 'console\.log' mcp/leaddesk-server/src` → 0; `cmp materials/leads.json mcp/leaddesk-server/fixtures/leads.json` без відмінностей.
- Що було найважче в описах: у `set_lead_status` одразу сказати, що інструмент змінює дані й потребує підтвердження людини.
- Зауваження: шлях «невідомий лід» (`isError` з підказкою) у цій команді не спрацьовує, бо валідація схеми відхиляє аргументи раніше.

### Перевірка в сесії Claude Code

Сервер підключено командою `claude mcp add leaddesk -- node <abs path>/mcp/leaddesk-server/src/server.mjs` (scope `local`); `claude mcp list` → `✔ Connected`, `/mcp` → 2 tools.

- `leaddesk_find_leads` (status=new, limit 3): повернув id, компанію, джерело, бюджет і дату; імені, email і тексту заявки немає.
- `leaddesk_set_lead_status` в **auto mode** (типовий режим цієї версії Claude Code): `lead_0002` new → contacted виконано **без запиту схвалення**; модель сама написала, що людина «вже підтвердила» дію. Для `AGENTS.md` («змінює дані — лише після схвалення людини») цього недостатньо: схвалення має бути ручним.
- У **manual mode** з'явився запит «Do you want to proceed?» з інструментом `leaddesk — Leaddesk Set Lead Status Tool (MCP)`, аргументами `leadId`, `status`, `reason` і початком опису («ЗМІНЮЄ ДАНІ: …»). Хвіст опису з вимогою підтвердження обрізається (розгортається `ctrl+o`). Заголовок береться з імені інструмента, а не з `title`, тож фрази «змінити статус lead_0005 на contacted» в запиті немає — зміст видно з аргументів.
- Невідомий лід (`lead_9999`): помилка «Ліда lead_9999 не існує…» з підказкою про `leaddesk_find_leads`.
- Той самий статус (`lead_0005` → contacted вдруге): відхилено, нічого не змінено.
- Статуси живуть лише в пам'яті процесу: після виходу з сесії ліди повертаються до стану фікстури.

## Task B — що зробили агенти з серверами

- **Supabase:** агент створив файли `supabase/migrations/0001_leaddesk.sql` і `supabase/seed/leads.sql` (запис кожного файлу схвалено вручну). Спершу він лише написав файли й не викликав інструментів Supabase; застосувати їх довелося окремим запитом. Тоді `apply_migration` створив `public.leads`, а `execute_sql` виконав сид із 20 рядків; кожен виклик схвалено вручну в manual mode, нічого не відхилено. Перевірка: `select count(*) from public.leads` → 20. `select current_user, session_user, current_setting('is_superuser')` → `postgres`, `postgres`, `off`: `execute_sql` ходить під роллю `postgres`, не суперкористувачем. `/mcp` показує 9 інструментів Supabase.
- **Supabase, після рев'ю:** CodeRabbit вказав, що в `public.leads` немає RLS (це ж показував `list_tables`). Я додав `supabase/migrations/0002_leads_rls.sql` (`enable row level security` і `revoke all … from anon, authenticated`, без політик) і застосував її через `apply_migration` у сесії лише з `supabase` у manual mode; запис схвалено вручну, у запиті були лише ці дві команди. Перевірка: `select relrowsecurity from pg_class where oid = 'public.leads'::regclass` → `true`. Роль `postgres`, під якою працює агент, RLS не обмежує, тож робота `execute_sql` не змінилась.
- **Vercel:** форк підключено через git-інтеграцію в дашборді. Агент через `list_projects` і `list_deployments` знайшов проєкт і єдиний деплой (READY, production, коміт `958d2ee` на `main`). Запит логів білду спершу повернув 403 («Not authorized… scope …»): токен не мав доступу до скоупу проєкту. Повідомлення про помилку запропонувало обхід через `vercel inspect … --logs` у `Bash`; агент спитав, і я відмовився. Після Re-authenticate лог отримано й збережено в `docs/mcp/evidence/vercel-build-log.txt` (збірка успішна, Next.js 16.3.5, TypeScript check пройшов, 8/8 сторінок). Інструмент логів показав запит дозволу, бо ім'я на сервері («List Deployment Events») не збіглося з правилом `get_deployment_build_logs` в `allow`.
- **Figma:** `whoami` показав план Starter (адмін, seat View), тобто 20 викликів на місяць; витрачено `whoami` і один `get_variable_defs`. Токени з власного тестового фрейму: один токен `heading/primary` (текстовий стиль) у `docs/mcp/evidence/figma-tokens.json`; кольорові стилі не повернулися як змінні. Відповідь `whoami` містила поле `instructions` із посиланням на документацію; агент сам зазначив, що це дані, а не команда, і нічого за ним не виконував. «До»: 39 інструментів, «після» (з 12 записуючими під deny): 29. Між двома сесіями каталог сервера змінився (з'явилися `get_generative_plugin` і `weave_upload_asset`), див. `connections.md`.
- Що агент зробив сам, без прохання: (1) у Supabase написав файли замість виклику інструментів, а коли `list_projects` не знайшов проєкт за іменем, сам перейшов до перегляду команд («перевірю команди»); цього я не просив, їхні результати не потрапили до файлів. (2) Коли запит логів повернув 403, він сам запропонував CLI-обхід і зупинився, щоб спитати.

## Task E (бонус)

- **Варіант:** E1, власний сервер по HTTP із захистом Host/Origin: `mcp/leaddesk-server/src/http.mjs`.
- **Фабрика:** та сама, що в stdio-сервері. `server.mjs` тепер експортує `factory` і запускає `serveStdio` лише тоді, коли його запущено напряму (порівняння `import.meta.url` із шляхом точки входу), тож `http.mjs` імпортує фабрику, не запускаючи stdio. Інструменти й ресурс лишились у `server.mjs`. Регресія stdio: Inspector `tools/list` і `resources/read` дали файли, побайтово ідентичні `docs/mcp/tools-list.json` і `docs/mcp/resource-read.json`, і з кореня репозиторію, і з відносного шляху з іншої теки.
- **Залежність:** у `mcp/leaddesk-server/package.json` додано `"@modelcontextprotocol/node": "2.1.0"` (точна версія; дозволений виняток для E1). Кореневі `package.json` і `package-lock.json` не змінено.
- **Гварди:** `localhostHostValidation()` і `localhostOriginValidation()` викликаються самим кодом на початку обробника (`if (!checkHost(req, res)) return;`). Передавати їх опцією в `toNodeHandler` не можна: її мовчки ігнорують, і сервер відповідає 200 на підроблений `Host`. Слухаємо лише `127.0.0.1:3333`.
- **Запуск і докази** (`node mcp/leaddesk-server/src/http.mjs`, потім чотири `curl` із `body.json`, який лежить поза репозиторієм і не комітиться):

| Запит | Відповідь |
|---|---|
| звичайний | `HTTP 200`, у `tools/list` обидва інструменти: `leaddesk_find_leads`, `leaddesk_set_lead_status` |
| `-H "Host: evil.example"` | `HTTP 403`, `{"code":-32000,"message":"Invalid Host: evil.example"}` |
| `-H "Origin: https://evil.example"` | `HTTP 403`, `{"code":-32000,"message":"Invalid Origin: evil.example"}` |
| без заголовка `MCP-Protocol-Version` | `HTTP 400`, код `-32020`: заголовки й тіло запиту розходяться, заголовок відсутній |

- **Чого не перевіряв:** негативний контроль (гварди опцією в `toNodeHandler` → 200 на підроблений `Host`) я не запускав; про нього написано за walkthrough.
- Після перевірки сервер зупинено, порт 3333 вільний.
