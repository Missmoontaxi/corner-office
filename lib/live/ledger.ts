// The live-run ledger: a kill switch and a hard daily spending cap, both in Redis. Before a live run the worst
// case is reserved atomically; after it, the reservation is settled to the real cost. If the switch is on, the
// cap would be passed, or Redis fails, there is no live run and the desk keeps showing the recorded one.
import { redis } from "./redis";

const KILL_KEY = "live:kill";
// Daily cap in USD, set with LIVE_DAILY_CAP_USD. Paula owns the number; $1.00 until she sets one.
export const dailyCapMicroUsd = () => Math.round(Number(process.env.LIVE_DAILY_CAP_USD ?? "1") * 1e6);
// The most one live brief can cost: 3,400 output tokens and about 10,000 input tokens on the priciest mid model.
export const RESERVE_MICRO_USD = 60_000;

const dayKey = () => `live:spend:${new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })}`;

// Atomic check-and-reserve. Returns the new day total, -1 when the cap would be passed, -2 when the switch is on.
const RESERVE = `
if redis.call("GET", KEYS[2]) == "on" then return -2 end
local spent = tonumber(redis.call("GET", KEYS[1]) or "0")
if spent + tonumber(ARGV[1]) > tonumber(ARGV[2]) then return -1 end
local total = redis.call("INCRBY", KEYS[1], ARGV[1])
redis.call("EXPIRE", KEYS[1], 259200)
return total`;

export type Reservation = { ok: true; key: string; reserved: number } | { ok: false; reason: "paused" | "capped" | "unavailable" };

export async function reserve(microUsd = RESERVE_MICRO_USD): Promise<Reservation> {
  if (process.env.KILL_SWITCH === "on") return { ok: false, reason: "paused" };
  const key = dayKey();
  try {
    const r = await redis<number>(["EVAL", RESERVE, 2, key, KILL_KEY, microUsd, dailyCapMicroUsd()]);
    if (r === -2) return { ok: false, reason: "paused" };
    if (r === -1) return { ok: false, reason: "capped" };
    return { ok: true, key, reserved: microUsd };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

// Moves the day's total from the reservation to the real cost. A failed run settles to whatever it spent.
export async function settle(r: Extract<Reservation, { ok: true }>, actualMicroUsd: number) {
  try {
    await redis(["INCRBY", r.key, Math.round(actualMicroUsd) - r.reserved]);
  } catch {
    // The reservation stays counted, which errs toward spending less.
  }
}

export async function status() {
  const [spent, kill] = await Promise.all([redis<string | null>(["GET", dayKey()]), redis<string | null>(["GET", KILL_KEY])]);
  return { paused: kill === "on" || process.env.KILL_SWITCH === "on", spentMicroUsd: Number(spent ?? 0), capMicroUsd: dailyCapMicroUsd() };
}

export async function setKill(on: boolean) {
  await redis(on ? ["SET", KILL_KEY, "on"] : ["DEL", KILL_KEY]);
}
