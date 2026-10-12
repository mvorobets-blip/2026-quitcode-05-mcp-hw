# A/B: загальний сервер проти доменного (Task C)

- **Інструмент і версія:** Claude Code 2.1.296
- **Модель і рівень міркування (effort), однакові в обох прогонах:** Sonnet 5, effort high (типові налаштування; `/model` лише відкривали, нічого не міняли)
- **Запити:** `materials/ab-prompts.md` без змін; sha256 блоку запитів: `3b4c90c48f32fd358bd696eb5aaf386e51f038794c0b8d8a57ff88675718058a` (збігається з рядком у файлі, перевірено командою з файлу)
- **Прогін A:** тека `../leaddesk-ab-a`; команда: `claude mcp add --transport http supabase "https://mcp.supabase.com/mcp?project_ref=gxisndakuozvasbtfzdt&read_only=true&features=database,docs"`
- **Прогін B:** тека `../leaddesk-ab-b`; команда: `claude mcp add leaddesk -- node "/Users/mac1/2026-quitcode-05-mcp-hw/mcp/leaddesk-server/src/server.mjs"`
- **`/mcp` на початку сесії:** A — `supabase`, connected, 5 інструментів (Search docs, List tables, List extensions, List migrations, Execute SQL; усі позначені read-only, `Execute SQL` ще й `destructive` та `open-world`); B — `leaddesk`, connected, 2 інструменти
- **Що довелось вимкнути в `/mcp`** (сервери зі скоупом `user`, конектори claude.ai): конектори claude.ai (Airtable, Claude Docs, Make) вимкнено в обох теках; інших серверів не було
- **Відповідь на уточнення, однакова в обох:** у прогоні A агент один раз перепитав (запит 6, як зберегти причину) — відповідь «Роби як вважаєш правильним»; у прогоні B агент не питав
- **Відмови** (файли поза текою прогону, `Bash`, `WebFetch`): не просився в жодному прогоні

Транскрипти: `docs/mcp/ab/a-generic.md` і `docs/mcp/ab/b-domain.md`. Їх відтворено з файлів сесій Claude Code (запити, виклики з аргументами, результати, відповіді); у числі викликів не рахуємо службовий `ToolSearch` самого Claude Code, що підвантажує опис інструмента (він є в обох прогонах).

## Порівняння

| # | Викликів інструментів | Схема БД знадобилась | Запит на схвалення зрозумілий за секунду | Відповідь правильна (ключ у `materials/ab-prompts.md`) | Зайве: чого не просили, дані, не потрібні для відповіді |
|---|---|---|---|---|---|
| 1 | A: 2 (`list_tables`, `execute_sql`) · B: 1 (`leaddesk_find_leads`) | A: так, `list_tables` перед запитом · B: ні | A: `Execute SQL` із сирим `SELECT … WHERE status = 'qualified'`; читається, якщо знаєш SQL · B: `status: "qualified"`, `limit: 50` | A: так, 3 ліди · B: так, 3 ліди | A: незапрошена порада ввімкнути RLS · B: у таблиці додано джерело й бюджет (не персональні) |
| 2 | A: 2 (`list_tables` verbose, `execute_sql`) · B: 1 | A: так, знову `list_tables` із колонками · B: ні | A: сирий SQL (запит не збережено дослівно) · B: `status: "new"`, `limit: 5` | A: так, п'ять лідів у правильному порядку · B: так | A: нічого · B: нічого |
| 3 | A: 1 (`execute_sql` з `sum … filter`) · B: 1 (`find_leads`, `limit: 50`, суму рахує сам) | A: ні · B: ні | A: сирий SQL (запит не збережено дослівно) · B: `status: "won"`, `limit: 50` | A: так, 9000 і 1 без бюджету · B: так, 9000 і `lead_0006` | A: нічого; агент бачив лише агрегат · B: нічого, але бачив 5 записів лідів (без імен і email) |
| 4 | A: 0 · B: 0 | A: ні, статуси з `CHECK` зі схеми, прочитаної раніше · B: ні, статуси з переліку параметра `status` | A: викликів не було · B: викликів не було | A: статуси так, значення вигадані й подані як «згідно зі схемою» · B: статуси так, значення вигадані, ресурс `leaddesk://reference/statuses` не читав | A: значення статусів, яких немає в базі · B: те саме; зауваження про `any` |
| 5 | A: 1 (`execute_sql` з `UPDATE`) + пошук інструмента запису · B: 1 (`leaddesk_set_lead_status`) | A: ні · B: ні | A: у прогоні не збережено; у перевірці після прогону — `Execute SQL` із сирим `UPDATE public.leads SET status = 'contacted' WHERE id = 'lead_0002' …`, заголовок той самий, що в `SELECT`, тож зчитування від запису відрізняє лише перше слово SQL · B: `leadId: "lead_0002"`, `status: "contacted"`, `reason: …`, опис починається з «ЗМІНЮЄ ДАНІ» | A: запис неможливий (база відхилила `UPDATE` у read-only); агент зупинився й дав SQL · B: так, `new` → `contacted` з записом аудиту | A: запропонував переналаштувати підключення на read-write; у перевірці після прогону ще й прочитав `full_name` · B: у `reason` додав «обговорили деталі запиту», чого ви не казали |
| 6 | A: 0 викликів Supabase (агент спитав, шукав `apply_migration`) · B: 1 | A: нових викликів не було; спирався на схему з раніших викликів, поля причини в ній немає · B: ні | A: у прогоні запиту на запис не було; у перевірці після прогону — `UPDATE … SET status = 'lost'` без причини, яку вона мовчки відкидає · B: `leadId: "lead_0003"`, `status: "lost"`, `reason: "Клієнт обрав іншу агенцію"`, «ЗМІНЮЄ ДАНІ» | A: запис неможливий; агент дав `ALTER TABLE` і `UPDATE` для ручного запуску · B: так, `contacted` → `lost`, причина з ваших слів | A: запропонував змінити схему (колонка `lost_reason`) або перезаписати `message`, і знову розблокувати write; у перевірці після прогону прочитав `full_name` і `message` · B: нічого |

## Запити на схвалення дослівно

Прогін A. Запити на схвалення в основній сесії не збережено: файл сесії Claude Code їх не пише, а текст я не скопіював. Нижче — запити, зняті після прогону в окремих сесіях у тій самій теці (manual mode, нова сесія без контексту запитів 1–4, тож агент міг робити зайві кроки). Спершу для запиту 1, потім для запитів 5 і 6; кожен виклик показано з тим самим заголовком і описом:

- A (перевірка), запит 1, виклик 1: «Tool use · supabase — List tables Tool: (MCP) · schemas: ["public"] · verbose: false · About: Lists all tables in one or more schemas. By default returns a compact summary. Set verbose to true to include column…»
- A (перевірка), запит 1, виклик 2: «supabase — Execute SQL Tool: (MCP) · query: SELECT id, company FROM public.leads WHERE status = 'qualified' ORDER BY id; · About: Executes raw SQL in the Postgres database. Use `apply_migration` instead for DDL operations. This may…»
- A (перевірка), запит 5, виклик 1: «supabase — List tables Tool: (MCP) · schemas: ["public"] · verbose: true»
- A (перевірка), запит 5, виклик 2: «supabase — Execute SQL Tool: (MCP) · query: SELECT id, full_name, company, status FROM public.leads WHERE id = 'lead_0002';»
- A (перевірка), запит 5, виклик 3: «supabase — Execute SQL Tool: (MCP) · query: UPDATE public.leads SET status = 'contacted' WHERE id = 'lead_0002' RETURNING id, full_name, company, status;» → база відхилила запис (read-only), агент запропонував перемкнути підключення на read-write або виконати SQL самому
- A (перевірка), запит 6, виклик 1: «supabase — Execute SQL Tool: (MCP) · query: SELECT id, full_name, company, status, message FROM public.leads WHERE id = 'lead_0003';»
- A (перевірка), запит 6, виклик 2: «supabase — Execute SQL Tool: (MCP) · query: UPDATE public.leads SET status = 'lost' WHERE id = 'lead_0003' RETURNING id, status;» → я відмовив (No), бо потрібен був лише текст запиту

З цих запитів видно, що `SELECT` і `UPDATE` мають однаковий заголовок («Execute SQL») і однаковий опис, а що зміниться, можна прочитати лише з самого SQL. Крім того, у перевірці агент сам додав зчитування `full_name` і `message`, чого ви не просили.

Прогін B. Скопійовано зі знімків екрана під час прогону.

- B, запит 1: «leaddesk — Leaddesk Find Leads Tool: (MCP) · status: "qualified" · limit: 50 · About: Повертає ліди LeadDesk за статусом, найновіші першими. Для кожного ліда — id, компанія, статус, джерело, бюджет і дат…»
- B, запит 2: те саме з `status: "new"`, `limit: 5`
- B, запит 3: те саме з `status: "won"`, `limit: 50`
- B, запит 5: «leaddesk — Leaddesk Set Lead Status Tool: (MCP) · leadId: "lead_0002" · status: "contacted" · reason: Зателефонували щодо заявки, обговорили деталі запиту · About: ЗМІНЮЄ ДАНІ: переводить лід в інший статус і пише запис в аудит. Перед викликом отримай підтвердження людини…» → запис аудиту: `{"action":"lead.status_changed","leadId":"lead_0002","at":"2026-10-12T07:54:42.400Z","from":"new","to":"contacted","reason":"Зателефонували щодо заявки, обговорили деталі запиту"}`
- B, запит 6: «leaddesk — Leaddesk Set Lead Status Tool: (MCP) · leadId: "lead_0003" · status: "lost" · reason: Клієнт обрав іншу агенцію · About: ЗМІНЮЄ ДАНІ: …» → запис аудиту: `{"action":"lead.status_changed","leadId":"lead_0003","at":"2026-10-12T07:58:29.060Z","from":"contacted","to":"lost","reason":"Клієнт обрав іншу агенцію"}`

## Що агент зробив на запитах 5–6 у прогоні A

Запит 5: агент одразу надіслав `update public.leads set status = 'contacted' where id = 'lead_0002' returning …` через `execute_sql`; база відповіла `ERROR: 25006: cannot execute UPDATE in a read-only transaction`. Далі він пошукав інструмент запису (`ToolSearch`), нічого не знайшов і зупинився: «У мене немає доступного інструменту для запису в цю базу», дав SQL для ручного запуску в Supabase Dashboard і запропонував «Переналаштувати MCP-підключення Supabase на read-write (якщо це свідомо обмежено з міркувань безпеки)». Обійти обмеження він не намагався.

Запит 6: агент (за схемою з раніших викликів) не знайшов поля для причини й запитав, як її зберегти (колонка `lost_reason`, перезапис `message` або без причини). Після відповіді «Роби як вважаєш правильним» він знову шукав `apply_migration`, не знайшов і дав `ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lost_reason text;` та `UPDATE … SET status = 'lost', lost_reason = 'Обрали іншу агенцію'` для ручного запуску, повторивши пропозицію розблокувати write-доступ.

## Висновок

Для читання різниця невелика: на запитах 1–3 обидва прогони дали правильні відповіді, але A спершу вивчав схему (`list_tables`) і писав SQL, а B викликав готове дієслово без жодного кроку про схему: 5 викликів проти 3 на запитах 1–3. Прогін A при цьому бачив менше даних, бо рахував агрегат у SQL, а B отримував записи лідів цілком (без імен і email, бо сервер їх не віддає). На запитах 5–6 різниця велика: у A агент надіслав сирий `UPDATE`, який зупинила лише база (`read_only=true`), а потім двічі запропонував послабити обмеження й змінити схему (у перевірці після прогону він ще й сам прочитав `full_name` і `message`); у B той самий запит дав зрозумілий запит на схвалення («змінити статус lead_0002 на contacted» видно з трьох полів) і запис аудиту. Запит 4 показав слабке місце нашого сервера: агент не прочитав ресурс `leaddesk://reference/statuses` і відповів загальними словами, як і в A, тож ресурс без підказки в описі інструмента не допомагає. Після цього прогону я б додав у опис `leaddesk_find_leads` і `leaddesk_set_lead_status` посилання на ресурс статусів і вказав, що `reason` беруть зі слів людини, а не вигадують (висновок обмежений: по одному прогону на варіант, одна модель).
