// The daily precompute, run by Vercel Cron. This is the one GET route that calls models, the documented
// exception in the threat model. It checks CRON_SECRET in constant time and fails closed without it, respects
// the kill switch, and takes a once-a-day Redis lock, so a replayed call cannot spend twice. If Redis is down it
// does not run. A run that fails the promote gate is never published; the previous snapshot stays up and Paula
// gets a GitHub issue.
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { precompute } from "@/lib/engine/precompute";
import { RunFailed } from "@/lib/engine/run";
import { publishSnapshot } from "@/lib/engine/snapshot";
import { status } from "@/lib/live/ledger";
import { redis } from "@/lib/live/redis";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const json = (body: unknown, code = 200) => NextResponse.json(body, { status: code, headers: { "Cache-Control": "no-store" } });

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || !header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Opens an issue on the repo, which emails Paula. Without ALERT_GITHUB_TOKEN it only logs.
async function alert(title: string, body: string) {
  console.error(`[precompute] ${title}\n${body}`);
  const token = process.env.ALERT_GITHUB_TOKEN;
  if (!token) return;
  try {
    await fetch("https://api.github.com/repos/Missmoontaxi/corner-office/issues", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json" },
      body: JSON.stringify({ title, body, labels: ["precompute"] }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // The log line above still records it.
  }
}

export async function GET(req: Request) {
  if (!authorized(req.headers.get("authorization"))) return json({ status: "unauthorized" }, 401);

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  try {
    if ((await status()).paused) return json({ status: "paused" });
    // 23 hours, so tomorrow's run is free to start a little early.
    const got = await redis<string | null>(["SET", `cron:precompute:${today}`, new Date().toISOString(), "NX", "EX", 82800]);
    if (got !== "OK") return json({ status: "already_ran", day: today });
  } catch {
    return json({ status: "redis_unavailable" }, 503);
  }

  try {
    const r = await precompute();
    const summary = { model: r.model, costUsd: r.costMicroUsd / 1e6, gate: r.gate.results.map((g) => `${g.id} ${g.passed ? "pass" : "FAIL"}`) };
    if (!r.snapshot) {
      const failed = r.gate.results.filter((g) => !g.passed);
      await alert(`Precompute held back on ${today}`, `The promote gate failed, so yesterday's brief stays up.\n\n${failed.map((g) => `- **${g.id}** ${g.detail}`).join("\n")}`);
      return json({ status: "held", ...summary });
    }
    const url = await publishSnapshot(r.snapshot);
    console.log(`[precompute] published ${url}`, JSON.stringify(summary));
    return json({ status: "published", ...summary });
  } catch (e) {
    const detail = e instanceof RunFailed ? e.message : e instanceof Error ? e.message : String(e);
    await alert(`Precompute failed on ${today}`, `The run did not finish, so yesterday's brief stays up.\n\n${detail}`);
    return json({ status: "failed" }, 500);
  }
}
