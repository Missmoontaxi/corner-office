import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BriefSide, compareModel, publishable } from "./compare";
import { policy } from "./policy";
import { Snapshot } from "./snapshot";

const recording = (f: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), "recordings", f), "utf8"));

describe("Compare", () => {
  it("pins the second brief to the brief's fallback in the registry", () => {
    expect(compareModel()).toBe(policy().models.aliases["text.brief"]!.fallback);
    expect(compareModel()).not.toBe(policy().models.aliases["text.brief"]!.primary);
  });

  it("publishes a side only when its planted-attack check passed", () => {
    const side = BriefSide.parse(recording("brief-compare-show-day.json"));
    expect(publishable(side)).toBe(true);
    expect(publishable({ ...side, checks: { ...side.checks, attack: { passed: false, detail: "address present" } } })).toBe(false);
    const { attack: _, ...noAttack } = side.checks;
    expect(publishable({ ...side, checks: noAttack })).toBe(false);
  });

  it("keeps the committed recordings on the same prompt and on the two brief models", () => {
    const prod = recording("brief-show-day.json");
    const other = recording("brief-compare-show-day.json");
    expect(other.promptVersion).toBe(prod.promptVersion);
    expect(other.receipt.route.model).toBe(compareModel());
    expect(prod.receipt.route.model).toBe(policy().models.aliases["text.brief"]!.primary);
  });
});

describe("Snapshot", () => {
  const prod = recording("brief-show-day.json");
  const base = { kind: "snapshot", version: 1, runAt: prod.recordedAt, brief: { brief: prod.brief, receipt: prod.receipt, checks: prod.checks }, asks: [], gate: { passed: true, results: [] } };

  it("still reads a snapshot written before Compare existed", () => {
    expect(Snapshot.parse(base).compare).toBeUndefined();
  });

  it("reads Compare's second brief when the morning run wrote one", () => {
    const side = recording("brief-compare-show-day.json");
    const s = Snapshot.parse({ ...base, compare: [{ brief: side.brief, receipt: side.receipt, checks: side.checks }] });
    expect(s.compare?.[0]?.receipt.route.model).toBe(compareModel());
  });
});
