# Перевірка (Task A)

- **Інструмент і версія, модель:** Claude Code · Claude Sonnet 5.5
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
