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
