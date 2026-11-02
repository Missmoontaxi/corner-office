import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadRubric } from "../../evals/lib";
import { BriefV1 } from "./contracts";
import { promoteGate } from "./promote";
import { Snapshot } from "./snapshot";
import { loadShowDay } from "./sources/seed";

const recorded = JSON.parse(fs.readFileSync(path.join(process.cwd(), "recordings", "brief-show-day.json"), "utf8"));
const brief = BriefV1.parse(recorded.brief);
const day = loadShowDay();
const pass = async () => ({ passed: true, reason: "ok", judge: "test-judge" });
const okAsk = { key: 1, checks: { numbers: { passed: true, detail: "" } } };

describe("promote gate", () => {
  it("grades every must-pass rubric row plus the word limit", async () => {
    const g = await promoteGate({ brief, model: "m", day, asks: [okAsk], judgeWith: pass });
    const mustPass = loadRubric().filter((c) => c.must_pass).map((c) => c.id);
    expect(g.results.map((r) => r.id)).toEqual([...mustPass, "words", "ask 1"]);
    expect(g.passed).toBe(true);
  });

  it("holds the run when a judge fails or cannot answer", async () => {
    expect((await promoteGate({ brief, model: "m", day, asks: [], judgeWith: async () => ({ passed: false, reason: "no", judge: "j" }) })).passed).toBe(false);
    expect((await promoteGate({ brief, model: "m", day, asks: [], judgeWith: async () => { throw new Error("timeout"); } })).passed).toBe(false);
  });

  it("holds the run when the attacker address is in the brief", async () => {
    const leaked = { ...brief, headline: { ...brief.headline, action: `Reply to ${day.planted!.attacker_address}` } };
    const g = await promoteGate({ brief: leaked, model: "m", day, asks: [], judgeWith: pass });
    expect(g.passed).toBe(false);
  });

  it("holds the run when a prompt-key answer fails a code check", async () => {
    const g = await promoteGate({ brief, model: "m", day, asks: [{ key: 2, checks: { numbers: { passed: false, detail: "Not in the material, 99" } } }], judgeWith: pass });
    expect(g.passed).toBe(false);
  });

  it("publishes when a prompt-key answer only runs a few words long", async () => {
    const g = await promoteGate({ brief, model: "m", day, asks: [{ key: 1, checks: { words: { passed: false, detail: "124 words, limit 120" } } }], judgeWith: pass });
    expect(g.passed).toBe(true);
  });

  it("never lets a failed gate into a snapshot", () => {
    const base = { kind: "snapshot", version: 1, runAt: recorded.recordedAt, brief: { brief, receipt: recorded.receipt, checks: recorded.checks }, asks: [] };
    expect(Snapshot.safeParse({ ...base, gate: { passed: true, results: [] } }).success).toBe(true);
    expect(Snapshot.safeParse({ ...base, gate: { passed: false, results: [] } }).success).toBe(false);
  });
});
