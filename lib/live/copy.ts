// What a personal link holder reads in the live bar. Plain functions, so the wording is tested without a browser.

export const runs = (n: number) => `${n} live run${n === 1 ? "" : "s"} left`;

export const until = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" });

// The idle line for an open link. A pause is about the whole site and has no end date, so it never shares a
// sentence with the link's expiry.
export function linkLine(link: { name?: string; runsLeft?: number; expires?: number }, paused: boolean) {
  const end = until(link.expires ?? 0);
  return paused
    ? `Prepared for ${link.name}. Live runs are paused for now. This link works until ${end}.`
    : `Prepared for ${link.name}. ${runs(link.runsLeft ?? 0)}, until ${end}.`;
}
