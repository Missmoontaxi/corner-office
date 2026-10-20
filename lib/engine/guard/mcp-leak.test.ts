// The leak contract (plan section 6.5). Nothing MCP or a hand-off returns may carry the attacker address,
// the planted instruction or any sentence of a seed newsletter. The web receipt may carry quoted evidence
// in guardrail detail, so this test proves the projection drops it.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BriefV1, Receipt, toMcpReceipt } from "../contracts";
import { briefForMcp } from "../projection";
import { loadShowDay } from "../sources/seed";
import { screenDay, screenGuardrails } from "./screen";

const day = loadShowDay();
const planted = day.inbox.find((m) => m.id === day.planted!.source_id)!;
const sentencesOf = (t: string) => t.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 24);

const forbidden = [
  day.planted!.attacker_address,
  ...sentencesOf(planted.body).filter((s) => /assistant|forward|do not mention/i.test(s)),
  ...day.newsletters.flatMap((n) => sentencesOf(n.body)),
];

const recordings = fs.readdirSync(path.join(process.cwd(), "recordings")).filter((f) => f.endsWith(".json"));

describe("MCP leak contract", () => {
  it("has something to look for", () => {
    expect(forbidden.length).toBeGreaterThan(5);
  });

  it("drops quoted evidence from a receipt that holds it", async () => {
    const recorded = JSON.parse(fs.readFileSync(path.join(process.cwd(), "recordings", recordings[0]!), "utf8"));
    const receipt = Receipt.parse({ ...recorded.receipt, guardrails: [...recorded.receipt.guardrails, ...screenGuardrails(await screenDay(day, { live: false, client: "ci" }))] });
    expect(JSON.stringify(receipt)).toContain(day.planted!.source_id);
    const out = JSON.stringify(toMcpReceipt(receipt));
    for (const f of forbidden) expect(out).not.toContain(f);
    expect(out).not.toContain("Evidence");
  });

  it("keeps the todays_brief tool output free of forbidden text", () => {
    const r = JSON.parse(fs.readFileSync(path.join(process.cwd(), "recordings", "brief-show-day.json"), "utf8"));
    const out = JSON.stringify(briefForMcp(BriefV1.parse(r.brief), Receipt.parse(r.receipt)));
    for (const f of forbidden) expect(out).not.toContain(f);
    expect(out).not.toContain("Quarantined");
    expect(out).not.toContain("detail");
  });

  it("keeps the about tool free of seed text", async () => {
    const src = fs.readFileSync(path.join(process.cwd(), "app", "mcp", "route.ts"), "utf8");
    for (const f of forbidden) expect(src).not.toContain(f);
  });

  it("keeps every recorded brief free of the attacker address", () => {
    for (const f of recordings) {
      const r = JSON.parse(fs.readFileSync(path.join(process.cwd(), "recordings", f), "utf8"));
      expect(JSON.stringify(r.brief)).not.toContain(day.planted!.attacker_address);
    }
  });
});
