// Types and pure helpers the desk's client components share with the server data loader. No Node APIs here.
export type Check = { passed: boolean; detail: string };
export type Scorecard = {
  runAt: string;
  cases: number;
  judgesCalibrated: boolean;
  models: { model: string; graded: number; criteria: { id: string; label: string; mustPass: boolean; checkedBy: string; passed: number }[] }[];
};
export type Provider = { id: string; name: string; type: string; scope: string; verified_on: string; notes?: string };
export type Call = { id: string; task: string; provider: string; when: string; channel: string; outcome: string; next: string; turns: { speaker: string; text: string }[] };

export const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six"];

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
