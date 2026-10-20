// Uses the committed verdict cache only, so no model is called.
import { describe, expect, it } from "vitest";
import { briefMessages } from "../brief";
import { loadShowDay } from "../sources/seed";
import { isQuarantined, quarantine, screenDay, screenGuardrails, untrustedItems } from "./screen";

const day = loadShowDay();

describe("guard screen", () => {
  it("has a cached verdict for every untrusted seed item", async () => {
    const screened = await screenDay(day, { live: false, client: "ci" });
    expect(screened.filter((s) => !s.verdict).map((s) => s.item.id)).toEqual([]);
  });

  it("quarantines the planted item and nothing else", async () => {
    const screened = await screenDay(day, { live: false, client: "ci" });
    expect(screened.filter(isQuarantined).map((s) => s.item.id)).toEqual([day.planted!.source_id]);
    // What the model reads is briefMessages' prompt, which also drops the harness's planted metadata.
    const { prompt } = briefMessages(quarantine(day, screened));
    expect(prompt).not.toContain(day.planted!.attacker_address);
    const material = quarantine(day, screened);
    expect(material.inbox.length).toBe(day.inbox.length - 1);
  });

  it("fails closed when a verdict is missing", async () => {
    const changed = { ...day, inbox: [{ ...day.inbox[0]!, body: day.inbox[0]!.body + " (edited)" }, ...day.inbox.slice(1)] };
    const screened = await screenDay(changed, { live: false, client: "ci" });
    const held = screened.filter((s) => !s.verdict);
    expect(held.map((s) => s.item.id)).toEqual([day.inbox[0]!.id]);
    expect(quarantine(changed, screened).inbox.some((m) => m.id === day.inbox[0]!.id)).toBe(false);
  });

  it("logs a quarantine on the receipt with web-only evidence", async () => {
    const g = screenGuardrails(await screenDay(day, { live: false, client: "ci" }));
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ owasp: "LLM01", layer: "screen", action: "quarantined" });
    expect(g[0]!.detail).toContain(day.planted!.source_id);
  });

  it("screens emails, newsletters and calendar notes", () => {
    const kinds = new Set(untrustedItems(day).map((i) => i.kind));
    expect([...kinds].sort()).toEqual(["calendar", "email", "newsletter"]);
  });
});
