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
