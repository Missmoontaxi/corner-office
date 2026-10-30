// Types and pure helpers the desk's client components share with the server data loader. No Node APIs here.

// Paula's credit, shown in italics after the honesty line on every view.
export const BUILT_BY = "Built by PM";
export type Check = { passed: boolean; detail: string };
export type Scorecard = {
  runAt: string;
  cases: number;
  judgesCalibrated: boolean;
  models: { model: string; graded: number; criteria: { id: string; label: string; mustPass: boolean; checkedBy: string; passed: number }[] }[];
};
export type Provider = { id: string; name: string; type: string; scope: string; verified_on: string; notes?: string };
export type Call = { id: string; task: string; provider: string; when: string; channel: string; outcome: string; next: string; turns: { speaker: string; text: string }[] };

// "verified N days ago" from the show day, where dates are written as D-12.
export function daysAgo(d: string) {
  const m = d.match(/^D-(\d+)$/);
  return m ? Number(m[1]) : d === "D0" ? 0 : null;
}


// Show-day dates in plain words. "D0 09:00" reads "today at 09:00", "D+3" reads "in 3 days".
export function plainDay(text: string) {
  return text
    .replace(/\bD0\s+(\d{1,2}:\d{2})/g, "today at $1")
    .replace(/\bD0\b/g, "today")
    .replace(/\bD-1\b/g, "yesterday")
    .replace(/\bD-(\d+)\b/g, "$1 days ago")
    .replace(/\bD\+1\b/g, "tomorrow")
    .replace(/\bD\+(\d+)\b/g, "in $1 days");
}

// The seed's weather line, such as "High 58 Low 42 Sunny", as numbers and a sky with its emoji.
export type Weather = { high: number | null; low: number | null; sky: string; emoji: string };
const SKY: [RegExp, string][] = [
  [/thunder|storm/i, "\u26c8\ufe0f"],
  [/snow/i, "\u2744\ufe0f"],
  [/rain|shower|drizzle/i, "\ud83c\udf27\ufe0f"],
  [/partly|mostly sunny|some sun/i, "\u26c5"],
  [/cloud|overcast|gray|grey/i, "\u2601\ufe0f"],
  [/fog|mist/i, "\ud83c\udf2b\ufe0f"],
  [/sun|clear|bright/i, "\u2600\ufe0f"],
];
export function parseWeather(text?: string | null): Weather | null {
  if (!text) return null;
  const high = text.match(/high\D*(-?\d+)/i)?.[1];
  const low = text.match(/low\D*(-?\d+)/i)?.[1];
  const sky = text.replace(/high\D*-?\d+|low\D*-?\d+/gi, "").replace(/[,.]/g, " ").trim();
  return { high: high ? Number(high) : null, low: low ? Number(low) : null, sky, emoji: SKY.find(([r]) => r.test(sky))?.[1] ?? "" };
}

// Today's live forecast for the Flatiron office, from Open-Meteo's daily high, low and WMO weather code.
// Anything missing or malformed reads as null, and the desk keeps the seed's line.
const WMO: [number, string][] = [
  [0, "Clear"],
  [2, "Partly cloudy"],
  [3, "Cloudy"],
  [48, "Fog"],
  [57, "Drizzle"],
  [67, "Rain"],
  [77, "Snow"],
  [82, "Rain showers"],
  [86, "Snow showers"],
  [99, "Thunderstorms"],
];
export function wmoSky(code: number): string {
  return WMO.find(([max]) => code <= max)?.[1] ?? "";
}
export function parseOpenMeteo(body: unknown): Weather | null {
  const d = (body as { daily?: { temperature_2m_max?: unknown[]; temperature_2m_min?: unknown[]; weather_code?: unknown[] } })?.daily;
  const [high, low, code] = [d?.temperature_2m_max?.[0], d?.temperature_2m_min?.[0], d?.weather_code?.[0]];
  if (typeof high !== "number" || typeof low !== "number" || typeof code !== "number") return null;
  const sky = wmoSky(code);
  return { high: Math.round(high), low: Math.round(low), sky, emoji: SKY.find(([r]) => r.test(sky))?.[1] ?? "" };
}

// The coffee cup's comparison (Paula's wording, Thu 10/22). The price is BLS series APU0000717311, 100% ground
// roast coffee per pound, U.S. city average, refreshed by hand when BLS publishes a new month. The per-cup cost
// uses the Specialty Coffee Association's ratio of 55 grams per liter: 453.6 g brews 8.25 L, about 34.9 cups of
// 8 ounces (0.2366 L).
export const COFFEE = { pricePerPound: 9.332, month: "Sept 2026", cupsPerPound: 453.6 / 55 / 0.2366 };

// The phrase that finishes "That's ...". Today's ratio of about 0.6 reads as Paula wrote it, "just over half".
export function coffeeComparison(costUsd: number): string {
  const r = costUsd / (COFFEE.pricePerPound / COFFEE.cupsPerPound);
  if (r < 0.25) return "less than a quarter of the cost of a cup of coffee";
  if (r < 0.45) return "less than half the cost of a cup of coffee";
  if (r < 0.55) return "about half the cost of a cup of coffee";
  if (r < 0.8) return "just over half the cost of a cup of coffee";
  if (r < 0.95) return "a little less than the cost of a cup of coffee";
  if (r < 1.15) return "about the cost of a cup of coffee";
  return `about the cost of ${(Math.round(r * 10) / 10).toString()} cups of coffee`;
}

// The deep-link names, such as ?open=calendar. Each is a prebuilt page under /office/<name>. The rewrite in
// next.config.ts lists the same names, and a test keeps the two in step.
export const DEEP_LINK_NAMES = ["brief", "ask", "calendar", "numbers", "engine", "coffee", "gm", "cheers"] as const;
export type DeepLink = (typeof DEEP_LINK_NAMES)[number];

// The brief writes calendar times on the 24-hour clock. On the desk they read as 9:00 AM and 3:30 PM.
export function twelveHour(text: string) {
  return text.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]\.?m)/gi, (_m, h: string, m: string) => {
    const n = Number(h);
    return `${n % 12 || 12}:${m} ${n < 12 ? "AM" : "PM"}`;
  });
}

// Display-only tidying of model text. A raw dollar figure such as "18000000 USD" reads as $18.0M.
export function dollars(text: string) {
  return text.replace(/\$?\b(\d{1,3}(?:,\d{3}){2,}|\d{7,})(?:\.\d+)?(?:\s*USD)?\b/g, (m, n: string) => {
    if (!/USD|\$/.test(m)) return m;
    const v = Number(n.replace(/,/g, ""));
    return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : m;
  });
}

// Receipts in plain words, for a reader who is not an engineer (a friend's note, Fri 10/30). The technical
// receipt still sits underneath, behind "For builders".
const MODEL_NAMES: Record<string, string> = {
  "gpt-6.1-sol": "GPT-6.1 Sol from OpenAI",
  "gpt-6-luna": "GPT-6 Luna from OpenAI",
  "claude-sonnet-5-5": "Claude Sonnet 5.5 from Anthropic",
  "claude-haiku-5-5": "Claude Haiku 5.5 from Anthropic",
  "claude-opus-5-5": "Claude Opus 5.5 from Anthropic",
};
export const modelName = (id: string) => MODEL_NAMES[id] ?? id;

// Why each kind of job goes to its model. text.brief is ADR 0005.
const WHY: Record<string, string> = {
  "text.brief": "Paula chose it for the morning brief after it scored best on her tests for keeping personal matters private and leaving out what should not be said.",
  "text.mid": "It is the everyday model for short, careful answers. Fast, and strong at following the house rules.",
};

export type PlainReceiptInput = {
  runKind: string;
  route: { alias: string; model: string; effort: string; attempts: { model: string; outcome: string }[] };
  costMicroUsd: number;
  latencyMs: { total: number };
  guardrails: { layer: string; action: string }[];
};

export function plainReceipt(r: PlainReceiptInput, what: string) {
  const when = r.runKind === "live" ? "just now, live" : "early this morning, so nobody had to wait";
  const used = `Corner Office wrote ${what} with ${modelName(r.route.model)}, at ${r.route.effort} effort, ${when}.`;
  const first = r.route.attempts[0];
  const fellBack = r.route.attempts.length > 1 && first ? ` The first choice, ${modelName(first.model)}, did not answer, so the backup took over.` : "";
  const why = (WHY[r.route.alias] ?? "It is the model Corner Office's routing rules assign to this job.") + fellBack;
  const seconds = Math.max(1, Math.round(r.latencyMs.total / 1000));
  const usd = r.costMicroUsd / 1e6;
  const cost = `It took ${seconds} second${seconds === 1 ? "" : "s"} and cost $${usd.toFixed(usd < 0.01 ? 4 : 3)}, ${coffeeComparison(usd)}.`;
  const caught = r.guardrails.filter((g) => g.layer === "screen" && g.action === "quarantined").length;
  const stripped = r.guardrails.filter((g) => g.action === "stripped").length;
  const safety = [
    caught ? `${caught === 1 ? "One email" : `${caught} emails`} tried to give the assistant orders. Corner Office set ${caught === 1 ? "it" : "them"} aside and never followed ${caught === 1 ? "it" : "them"}.` : "",
    stripped ? "An address that is not on the approved list was removed before anyone saw it." : "",
    "Nothing on this desk can send, forward or buy anything, so no email can make it act.",
  ].filter(Boolean);
  return { used, why, cost, safety };
}
