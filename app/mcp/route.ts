// Public MCP server. Spike version with one read-only tool; the desk tools join with the engine.
// Every tool is read-only over fictional data and declares readOnlyHint, so hosts can call it without a write warning.
import { createMcpHandler } from "mcp-handler";
import { z } from "zod";

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
  },
  { serverInfo: { name: "corner-office", version: "0.0.1" } },
);

export { handler as GET, handler as POST, handler as DELETE };
