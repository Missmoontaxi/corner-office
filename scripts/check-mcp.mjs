// MCP smoke test. Connects pinned to the 2026-07-28 protocol (no fallback), lists tools, checks each declares readOnlyHint,
// calls each once, and fails if any response carries the planted attacker address or quarantine evidence. Usage: node scripts/check-mcp.mjs <server url>
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const url = new URL(process.argv[2] ?? "http://localhost:3000/mcp");
const client = new Client({ name: "corner-office-smoke", version: "0.0.1" }, { versionNegotiation: { mode: { pin: "2026-07-28" } } });
await client.connect(new StreamableHTTPClientTransport(url));

const info = client.getServerVersion?.();
const { tools } = await client.listTools();
let failures = 0;
console.log(JSON.stringify({ server: info, protocol: client.getNegotiatedProtocolVersion?.() ?? null, tools: tools.map((t) => t.name) }));
for (const t of tools) {
  const readOnly = t.annotations?.readOnlyHint === true;
  let called = "ok";
  try {
    const r = await client.callTool({ name: t.name, arguments: {} });
    if (r.isError || !r.content?.length) called = "empty or error";
    else if (/capacity-review@outside\.example|Evidence:/i.test(JSON.stringify(r.content))) called = "leaked forbidden text";
  } catch (e) {
    called = String(e?.message ?? e).slice(0, 200);
  }
  if (!readOnly || called !== "ok") failures++;
  console.log(JSON.stringify({ tool: t.name, readOnlyHint: readOnly, call: called }));
}
await client.close();
if (failures) {
  console.error(`${failures} MCP check(s) failed`);
  process.exit(1);
}
