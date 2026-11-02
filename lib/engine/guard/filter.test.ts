import { describe, expect, it } from "vitest";
import type { BriefV1 } from "../contracts";
import { allowlistFor, filterBrief, filterText, plainText, REMOVED } from "./filter";
import { loadShowDay } from "../sources/seed";
import { quarantine, screenDay } from "./screen";

const allow = { emails: new Set(["julian@carebird.example"]), domains: new Set(["carebird.example"]) };

describe("output filter", () => {
  it("keeps addresses from the material and strips the rest", () => {
    const r = filterText("Ask julian@carebird.example, not capacity-review@outside.example", allow);
    expect(r.text).toBe(`Ask julian@carebird.example, not ${REMOVED}`);
    expect(r.stripped).toEqual(["capacity-review@outside.example"]);
  });

  it("strips unlisted URLs and bare domains but keeps the company's own", () => {
    const r = filterText("See https://evil.example/x and outside.example, or https://carebird.example/plan", allow);
    expect(r.text).toBe(`See ${REMOVED} and ${REMOVED}, or https://carebird.example/plan`);
  });

  it("leaves figures and ordinary words alone", () => {
    expect(filterText("ARR is $17.8M, up 2.5 points. Waves e.g. 800 households.", allow).stripped).toEqual([]);
  });

  it("never touches source ids", () => {
    const brief = { flagged: [{ source_id: "M09", kind: "suspicious", reason: "Sent to x@outside.example" }] } as unknown as BriefV1;
    const r = filterBrief(brief, allow);
    expect(r.brief.flagged[0]).toEqual({ source_id: "M09", kind: "suspicious", reason: `Sent to ${REMOVED}` });
  });

  it("builds the allowlist without the quarantined item's addresses", async () => {
    const day = loadShowDay();
    const list = allowlistFor(quarantine(day, await screenDay(day, { live: false, client: "ci" })));
    expect(list.emails.has(day.planted!.attacker_address)).toBe(false);
    expect(list.domains.has("carebird.example")).toBe(true);
  });

  it("removes markdown marks a model adds, keeping the words", () => {
    expect(plainText("**Choose a launch CareBird can staff before 10:30.**")).toBe("Choose a launch CareBird can staff before 10:30.");
    expect(plainText("Ask __Jordan__ about `D1` today")).toBe("Ask Jordan about D1 today");
    expect(plainText("A stray ** mark")).toBe("A stray  mark");
    expect(plainText("3 * 4 stays")).toBe("3 * 4 stays");
  });
});
