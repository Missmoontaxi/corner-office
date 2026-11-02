// Public MCP server. Read-only tools over fictional data. Tool output uses the MCP projection, never the web receipt.
// Every tool is read-only over fictional data and declares readOnlyHint, so hosts can call it without a write warning.
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import recorded from "@/recordings/brief-show-day.json";
import { BriefV1, Receipt } from "@/lib/engine/contracts";
import { briefForMcp } from "@/lib/engine/projection";
import { readSnapshot } from "@/lib/engine/snapshot";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "about_corner_office",
      {
        title: "About Corner Office",
        description: "Describes Corner Office, a working demo of an AI chief of staff for a fictional company.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async () => ({
        content: [
          {
            type: "text",
            text: "Corner Office is a working demo of an AI chief of staff for CareBird, a fictional care coordination company. Every person, company and email in it is made up. More tools arrive as the desk is built.",
          },
        ],
      }),
    );
    server.registerTool(
      "todays_brief",
      {
        title: "Today's brief",
        description: "Alex Ellery's morning brief for the show day at CareBird, a fictional company, with a receipt of which model wrote it, what it cost and which guardrails acted. Flagged items are counts only.",
        inputSchema: z.object({}),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async () => {
        // The morning's snapshot when there is one, the committed recording otherwise.
        const b = (await readSnapshot())?.brief ?? recorded;
        return { content: [{ type: "text", text: JSON.stringify(briefForMcp(BriefV1.parse(b.brief), Receipt.parse(b.receipt)), null, 1) }] };
      },
    );
  },
  { serverInfo: { name: "corner-office", version: "0.0.2" } },
);

export { handler as GET, handler as POST, handler as DELETE };
