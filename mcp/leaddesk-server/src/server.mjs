// LeadDesk domain MCP server: two business verbs instead of raw SQL.
//
//   node src/server.mjs                           fixture from ../fixtures/leads.json
//   LEADDESK_FIXTURE=/path/leads.json node src/server.mjs
//
// stdout is the protocol channel: no console output on stdout. The fixture is read once,
// changes live in process memory only, and the file is never rewritten.
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";

const FIXTURE = process.env.LEADDESK_FIXTURE ?? fileURLToPath(new URL("../fixtures/leads.json", import.meta.url));

// Same vocabulary as LEAD_STATUSES in lib/types.ts.
const STATUSES = ["new", "contacted", "qualified", "won", "lost"];

const leads = JSON.parse(readFileSync(FIXTURE, "utf8"));
const audit = [];

// Only these fields leave the server: no name, email or message text.
const publicLead = (l) => ({
  id: l.id,
  company: l.company,
  status: l.status,
  source: l.source,
  budget: l.budget,
  createdAt: l.createdAt,
});

const fail = (text) => ({ isError: true, content: [{ type: "text", text }] });

const STATUS_REFERENCE = `# Статуси лідів LeadDesk

- \`new\` — заявка надійшла, з лідом ще ніхто не спілкувався.
- \`contacted\` — менеджер вийшов на зв'язок: був дзвінок чи лист і клієнт відповів.
- \`qualified\` — підтверджено бюджет, потребу й особу, що ухвалює рішення; можна готувати пропозицію.
- \`won\` — договір підписано або оплату отримано. Переводить у цей статус лише менеджер угоди.
- \`lost\` — клієнт відмовився або не відповідає після кількох спроб; причину запишіть у \`reason\`.
`;

const factory = () => {
  const server = new McpServer({ name: "leaddesk", version: "0.1.0" });

  server.registerTool(
    "leaddesk_find_leads",
    {
      title: "Знайти ліди",
      description:
        "Повертає ліди LeadDesk за статусом, найновіші першими. Для кожного ліда — id, компанія, статус, джерело, бюджет і дата створення; імені, email і тексту заявки немає. Тільки читає, нічого не змінює.",
      inputSchema: {
        status: z.enum([...STATUSES, "any"]).default("any").describe("Статус ліда: new, contacted, qualified, won, lost. any — без фільтра за статусом"),
        limit: z.number().int().min(1).max(50).default(10).describe("Скільки лідів повернути, від 1 до 50. За замовчуванням 10"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ status = "any", limit = 10 }) => {
      const found = leads
        .filter((l) => status === "any" || l.status === status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit)
        .map(publicLead);
      const lines = found.map((l) => `- ${l.id} · ${l.company} · ${l.status} · ${l.source} · ${l.budget ?? "—"}`);
      return {
        content: [{ type: "text", text: `Знайдено лідів: ${found.length}\n${lines.join("\n")}` }],
        structuredContent: { count: found.length, leads: found },
      };
    },
  );

  server.registerTool(
    "leaddesk_set_lead_status",
    {
      title: "Змінити статус ліда",
      description:
        "ЗМІНЮЄ ДАНІ: переводить лід в інший статус і пише запис в аудит. Перед викликом отримай підтвердження людини («змінити статус lead_0002 на contacted»). Застосовуй після дзвінка чи листа, коли статус ліда змінився. Статус — лише з переліку; невідомий лід або той самий статус дають помилку.",
      inputSchema: {
        leadId: z.string().regex(/^lead_\d{4}$/).describe("Ідентифікатор ліда у форматі lead_0001. Знайти його можна через leaddesk_find_leads"),
        status: z.enum(STATUSES).describe("Новий статус: new, contacted, qualified, won або lost"),
        reason: z.string().min(3).max(500).describe("Чому змінюємо статус, від 3 до 500 символів: що сталося на дзвінку чи в листуванні"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ leadId, status, reason }) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) return fail(`Ліда ${leadId} не існує. Знайди id через leaddesk_find_leads.`);
      if (lead.status === status) return fail(`Лід ${leadId} уже має статус ${status}. Нічого не змінено.`);
      const from = lead.status;
      lead.status = status;
      const entry = { action: "lead.status_changed", leadId, at: new Date().toISOString(), from, to: status, reason };
      audit.push(entry);
      return {
        content: [{ type: "text", text: `Лід ${leadId}: ${from} → ${status}. Запис в аудиті створено (${entry.at}).` }],
        structuredContent: { lead: publicLead(lead), audit: entry },
      };
    },
  );

  server.registerResource(
    "lead-statuses",
    "leaddesk://reference/statuses",
    { title: "Статуси лідів", description: "П'ять статусів ліда й що кожен означає для команди", mimeType: "text/markdown" },
    async (uri) => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: STATUS_REFERENCE }] }),
  );

  return server;
};

export { factory };

// stdio starts only when this file is the entry point; http.mjs imports the factory without it.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  await serveStdio(factory);
}
