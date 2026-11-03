// Run it live. Paula's owner cookie or a personal link. POST only, so no page load or link preview can start a
// run. The owner's worst case is reserved against her daily cap, and a link's against its own envelope, the
// monthly visitor cap, a per-minute limit and a velocity trigger. The kill switch is checked in the same step.
// Any refusal or failure answers with a reason and the desk keeps the recorded brief. Nothing ever errors out.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { runGuardedBrief } from "@/lib/engine/brief";
import { attackerAbsent, numbersGrounded, underWordLimit } from "@/lib/engine/checks";
import { RunFailed } from "@/lib/engine/run";
import { loadShowDay } from "@/lib/engine/sources/seed";
import { reserve, settle } from "@/lib/live/ledger";
import { LINK_COOKIE, reserveLink, settleLink, verifyToken } from "@/lib/live/links";
import { OWNER_COOKIE, cookieIsOwner } from "@/lib/live/owner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST() {
  const jar = await cookies();
  const owner = cookieIsOwner(jar.get(OWNER_COOKIE)?.value);
  const linkId = owner ? null : verifyToken(jar.get(LINK_COOKIE)?.value);
  if (!owner && !linkId) return json({ status: "not_allowed" }, 403);

  const r = owner ? await reserve() : await reserveLink(linkId!);
  if (!r.ok) return json({ status: r.reason });
  const done = (cost: number) => ("id" in r ? settleLink(r, cost) : settle(r, cost));

  const day = loadShowDay();
  try {
    // Balanced mode routes the live brief to Sonnet first, which answers in about ten seconds.
    const run = await runGuardedBrief(day, { task: "desk.brief.live", mode: "balanced", client: "web", runKind: "live", owner });
    await done(run.receipt.costMicroUsd);
    const checks = { numbers: numbersGrounded(run.output, day), words: underWordLimit(run.output, 250), attack: attackerAbsent(run.output, day) };
    return json({ status: "ok", brief: run.output, receipt: run.receipt, checks });
  } catch (e) {
    await done(e instanceof RunFailed ? e.receipt.costMicroUsd : r.reserved);
    return json({ status: "failed" });
  }
}
