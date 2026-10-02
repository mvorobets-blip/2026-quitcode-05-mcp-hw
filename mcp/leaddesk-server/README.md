# LeadDesk MCP server

Stdio-сервер із двома бізнес-дієсловами замість `execute_sql` на всю базу.

| Що | Назва | Примітка |
|---|---|---|
| Інструмент | `leaddesk_find_leads` | лише читає; без імені, email і тексту заявки |
| Інструмент | `leaddesk_set_lead_status` | змінює статус у пам'яті процесу й пише запис в аудит; потрібне підтвердження людини |
| Ресурс | `leaddesk://reference/statuses` | `text/markdown`, п'ять статусів |

Працює офлайн на фікстурі `fixtures/leads.json` (копія `materials/leads.json`, файл не перезаписується).
Шлях можна змінити: `LEADDESK_FIXTURE=/шлях/leads.json`.

## Запуск

```bash
cd mcp/leaddesk-server && npm install
node src/server.mjs        # чекає на JSON-RPC у stdin
```

## Перевірка в Inspector (з кореня репозиторію)

```bash
npx -y @modelcontextprotocol/inspector@2.8.0 --cli node mcp/leaddesk-server/src/server.mjs --method tools/list
npx -y @modelcontextprotocol/inspector@2.8.0 --cli node mcp/leaddesk-server/src/server.mjs \
  --method tools/call --tool-name leaddesk_set_lead_status \
  --tool-arg leadId=lead_0002 --tool-arg status=contacted --tool-arg "reason=перевірка в Inspector"
npx -y @modelcontextprotocol/inspector@2.8.0 --cli node mcp/leaddesk-server/src/server.mjs \
  --method resources/read --uri leaddesk://reference/statuses
```

Результати збережено в `docs/mcp/`.

## Підключення до Claude Code

```bash
claude mcp add leaddesk -- node "$(pwd)/mcp/leaddesk-server/src/server.mjs"
```

Не пишіть у stdout (`console.log`): це канал протоколу.
