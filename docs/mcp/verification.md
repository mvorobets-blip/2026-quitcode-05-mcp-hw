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
