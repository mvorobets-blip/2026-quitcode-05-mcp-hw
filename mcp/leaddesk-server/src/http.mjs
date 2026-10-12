// LeadDesk MCP server over HTTP, same factory as the stdio server (server.mjs).
//
//   node src/http.mjs            listens on http://127.0.0.1:3333/mcp
//
// The Host and Origin guards are called here, in the request handler. Passing them as an option
// to toNodeHandler is silently ignored and the server would answer 200 to a forged Host.
// Listens on 127.0.0.1 only. Logs go to stderr and carry no lead data.
import { createServer } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler, localhostHostValidation, localhostOriginValidation } from "@modelcontextprotocol/node";
import { factory } from "./server.mjs";

const PORT = Number(process.env.LEADDESK_HTTP_PORT ?? 3333);

const mcp = toNodeHandler(createMcpHandler(factory));
const checkHost = localhostHostValidation();
const checkOrigin = localhostOriginValidation();

createServer(async (req, res) => {
  if (!checkHost(req, res)) return; // the guard has already answered 403
  if (!checkOrigin(req, res)) return;
  await mcp(req, res);
}).listen(PORT, "127.0.0.1", () => {
  console.error(`leaddesk MCP over HTTP: http://127.0.0.1:${PORT}/mcp`);
});
