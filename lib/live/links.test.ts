import { describe, expect, it } from "vitest";
import { budgets, isOpen, makeToken, newId, runsLeft, verifyToken, type LinkRecord } from "./links";

const SECRET = "x".repeat(40);
const OTHER = "y".repeat(40);

describe("link tokens", () => {
  it("round-trips an id", () => {
    const id = newId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{10}$/);
    expect(verifyToken(makeToken(id, SECRET), SECRET)).toBe(id);
  });
  it("turns away a forged, altered or malformed token", () => {
    const id = newId();
    const t = makeToken(id, SECRET);
    expect(verifyToken(makeToken(id, OTHER), SECRET)).toBeNull();
    expect(verifyToken(`${newId()}.${t.split(".")[1]}`, SECRET)).toBeNull();
    expect(verifyToken(t.slice(0, -1), SECRET)).toBeNull();
    expect(verifyToken("", SECRET)).toBeNull();
    expect(verifyToken(undefined, SECRET)).toBeNull();
  });
  it("refuses everything without a secret", () => {
    expect(verifyToken(makeToken(newId(), SECRET), null)).toBeNull();
  });
});

describe("runs left", () => {
  const now = Date.parse("2026-11-06T15:00:00Z");
  const base: LinkRecord = { id: "a", name: "Sam", label: "", tier: "standard", lens: "founder", view: "country", envelope: 1_000_000, spent: 0, runs: 0, created: now, expires: now + 86_400_000, revoked: false };
  it("matches the plan's meter, 7 on $1 and 21 on $3", () => {
    expect(budgets().run_worst_case).toBe(0.14);
    expect(runsLeft(base, now)).toBe(7);
    expect(runsLeft({ ...base, tier: "vip", envelope: 3_000_000 }, now)).toBe(21);
    expect(runsLeft({ ...base, spent: 90_000, runs: 1 }, now)).toBe(6);
  });
  it("is zero when revoked or expired", () => {
    expect(runsLeft({ ...base, revoked: true }, now)).toBe(0);
    expect(isOpen({ ...base, expires: now }, now)).toBe(false);
  });
});
