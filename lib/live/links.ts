// Personal links. Each link is an id plus an HMAC tag of that id, so a forged or mistyped link is turned away
// without a Redis call. A valid link resolves to its record in Redis, which holds a pre-allocated budget envelope.
// Before a live run the worst case is reserved against the envelope, the monthly visitor cap, a per-minute limit
// and a velocity trigger, all in one atomic step. Any refusal or Redis error means the recorded brief, never a run.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import { redis } from "./redis";

export const LINK_COOKIE = "co_link";
const KILL_KEY = "live:kill";

const Budgets = z.object({
  visitor_monthly_cap: z.number(),
  envelopes: z.object({ standard: z.number(), vip: z.number() }),
  links: z.object({ days: z.number(), per_minute: z.number() }),
  run_worst_case: z.number(),
  velocity: z.object({ usd: z.number(), minutes: z.number(), pause_minutes: z.number() }),
});
let cached: z.infer<typeof Budgets> | null = null;
export function budgets() {
  cached ??= Budgets.parse(YAML.parse(fs.readFileSync(path.join(process.cwd(), "lib", "engine", "policy", "budgets.yaml"), "utf8")));
  return cached;
}
const micro = (usd: number) => Math.round(usd * 1e6);
export const runWorstCaseMicro = () => micro(budgets().run_worst_case);

export type Tier = "standard" | "vip";
export type Lens = "founder" | "enterprise";
export type LinkRecord = {
  id: string;
  name: string;
  label: string;
  tier: Tier;
  lens: Lens;
  view: "city" | "country";
  envelope: number; // micro-USD
  spent: number; // micro-USD, reservations included
  runs: number;
  created: number; // epoch ms
  expires: number; // epoch ms
  revoked: boolean;
};

// ---- Tokens, no Redis

export function linkSecret() {
  const s = process.env.LINK_SECRET;
  return s && s.length >= 32 ? s : null;
}

const tag = (secret: string, id: string) => createHmac("sha256", secret).update(`corner-office link v1:${id}`).digest("base64url").slice(0, 22);

export function makeToken(id: string, secret = linkSecret()) {
  if (!secret) throw new Error("LINK_SECRET is not set");
  return `${id}.${tag(secret, id)}`;
}

// The link id when the token's tag is right, otherwise null.
export function verifyToken(token: string | undefined, secret = linkSecret()): string | null {
  if (!secret || !token) return null;
  const m = /^([A-Za-z0-9_-]{10})\.([A-Za-z0-9_-]{22})$/.exec(token);
  if (!m) return null;
  const want = Buffer.from(tag(secret, m[1]!));
  const got = Buffer.from(m[2]!);
  return want.length === got.length && timingSafeEqual(want, got) ? m[1]! : null;
}

export const newId = () => randomBytes(8).toString("base64url").slice(0, 10);

// ---- Records

const key = (id: string) => `link:${id}`;
const INDEX = "links";
const monthKey = (now = new Date()) => `live:visitor:${now.toLocaleDateString("en-CA", { timeZone: "America/New_York" }).slice(0, 7)}`;

function parse(id: string, h: Record<string, string>): LinkRecord | null {
  if (!h.name) return null;
  return {
    id,
    name: h.name,
    label: h.label ?? "",
    tier: h.tier === "vip" ? "vip" : "standard",
    lens: h.lens === "enterprise" ? "enterprise" : "founder",
    view: h.view === "city" ? "city" : "country",
    envelope: Number(h.envelope),
    spent: Number(h.spent ?? 0),
    runs: Number(h.runs ?? 0),
    created: Number(h.created),
    expires: Number(h.expires),
    revoked: h.revoked === "1",
  };
}

const toHash = (flat: string[] | null) => {
  const h: Record<string, string> = {};
  for (let i = 0; flat && i < flat.length; i += 2) h[flat[i]!] = flat[i + 1]!;
  return h;
};

export async function getLink(id: string) {
  return parse(id, toHash(await redis<string[] | null>(["HGETALL", key(id)])));
}

export async function listLinks() {
  const ids = (await redis<string[]>(["SMEMBERS", INDEX])) ?? [];
  const all = await Promise.all(ids.map(getLink));
  return all.filter((l): l is LinkRecord => !!l).sort((a, b) => a.created - b.created);
}

export const isOpen = (l: LinkRecord, now = Date.now()) => !l.revoked && l.expires > now;
export const runsLeft = (l: LinkRecord, now = Date.now()) =>
  isOpen(l, now) ? Math.max(0, Math.floor((l.envelope - l.spent) / runWorstCaseMicro())) : 0;

// How much of the monthly visitor cap is still free to allocate: the cap, less this month's booked spend, less
// every open envelope's unspent balance. Expired and revoked links release what they did not spend.
export async function mintRoom(now = Date.now()) {
  const [links, month] = await Promise.all([listLinks(), redis<string | null>(["GET", monthKey(new Date(now))])]);
  const unspent = links.filter((l) => isOpen(l, now)).reduce((a, l) => a + Math.max(0, l.envelope - l.spent), 0);
  return micro(budgets().visitor_monthly_cap) - Number(month ?? 0) - unspent;
}

export async function createLink(input: { name: string; label: string; tier: Tier; lens: Lens; view?: "city" | "country" }, now = Date.now()) {
  const b = budgets();
  const envelope = micro(b.envelopes[input.tier]);
  const room = await mintRoom(now);
  if (envelope > room) return { ok: false as const, room };
  const id = newId();
  const rec: LinkRecord = {
    id,
    name: input.name,
    label: input.label,
    tier: input.tier,
    lens: input.lens,
    view: input.view ?? (input.lens === "enterprise" ? "city" : "country"),
    envelope,
    spent: 0,
    runs: 0,
    created: now,
    expires: now + b.links.days * 86_400_000,
    revoked: false,
  };
  const fields = Object.entries({ ...rec, revoked: "0" }).flatMap(([k, v]) => (k === "id" ? [] : [k, String(v)]));
  await redis(["HSET", key(id), ...fields]);
  await redis(["SADD", INDEX, id]);
  return { ok: true as const, link: rec, token: makeToken(id), room: room - envelope };
}

export async function revokeLink(id: string) {
  if (!(await redis<number>(["EXISTS", key(id)]))) return false;
  await redis(["HSET", key(id), "revoked", "1"]);
  return true;
}

// ---- Live runs

// Returns the reservation, or a negative code. KEYS link, kill, per-minute counter, velocity bucket, velocity pause,
// month. ARGV reserve, now, monthly cap, velocity limit, velocity window seconds, pause seconds.
const RESERVE = `
if redis.call("GET", KEYS[2]) == "on" then return -2 end
if redis.call("EXISTS", KEYS[1]) == 0 then return -3 end
local l = redis.call("HMGET", KEYS[1], "revoked", "expires", "spent", "envelope")
if l[1] == "1" or tonumber(l[2]) <= tonumber(ARGV[2]) then return -4 end
if tonumber(l[3]) + tonumber(ARGV[1]) > tonumber(l[4]) then return -5 end
if tonumber(redis.call("GET", KEYS[3]) or "0") >= tonumber(ARGV[7]) then return -6 end
if redis.call("EXISTS", KEYS[5]) == 1 then return -7 end
if tonumber(redis.call("GET", KEYS[4]) or "0") + tonumber(ARGV[1]) > tonumber(ARGV[4]) then
  redis.call("SET", KEYS[5], "on", "EX", ARGV[6])
  return -7
end
if tonumber(redis.call("GET", KEYS[6]) or "0") + tonumber(ARGV[1]) > tonumber(ARGV[3]) then return -8 end
redis.call("HINCRBY", KEYS[1], "spent", ARGV[1])
redis.call("HINCRBY", KEYS[1], "runs", 1)
redis.call("INCR", KEYS[3])
redis.call("EXPIRE", KEYS[3], 60)
redis.call("INCRBY", KEYS[4], ARGV[1])
redis.call("EXPIRE", KEYS[4], ARGV[5])
redis.call("INCRBY", KEYS[6], ARGV[1])
redis.call("EXPIRE", KEYS[6], 3456000)
return 1`;

export type LinkRefusal = "paused" | "unknown" | "expired" | "spent" | "slow_down" | "busy" | "capped" | "unavailable";
export type LinkReservation = { ok: true; id: string; month: string; bucket: string; reserved: number } | { ok: false; reason: LinkRefusal };

const CODES: Record<number, LinkRefusal> = { [-2]: "paused", [-3]: "unknown", [-4]: "expired", [-5]: "spent", [-6]: "slow_down", [-7]: "busy", [-8]: "capped" };

export async function reserveLink(id: string, now = Date.now()): Promise<LinkReservation> {
  if (process.env.KILL_SWITCH === "on") return { ok: false, reason: "paused" };
  const b = budgets();
  const reserve = runWorstCaseMicro();
  const windowSec = b.velocity.minutes * 60;
  const bucket = `live:velocity:${Math.floor(now / 1000 / windowSec)}`;
  const month = monthKey(new Date(now));
  try {
    const r = await redis<number>([
      "EVAL", RESERVE, 6,
      key(id), KILL_KEY, `live:rate:${id}`, bucket, "live:velocity:pause", month,
      reserve, now, micro(b.visitor_monthly_cap), micro(b.velocity.usd), windowSec, b.velocity.pause_minutes * 60, b.links.per_minute,
    ]);
    if (r < 0) return { ok: false, reason: CODES[r] ?? "unavailable" };
    return { ok: true, id, month, bucket, reserved: reserve };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

// Moves the envelope and the month from the reservation to the real cost.
export async function settleLink(r: Extract<LinkReservation, { ok: true }>, actualMicroUsd: number) {
  const delta = Math.round(actualMicroUsd) - r.reserved;
  try {
    await Promise.all([redis(["HINCRBY", key(r.id), "spent", delta]), redis(["INCRBY", r.month, delta]), redis(["INCRBY", r.bucket, delta])]);
  } catch {
    // The reservation stays counted, which errs toward spending less.
  }
}
