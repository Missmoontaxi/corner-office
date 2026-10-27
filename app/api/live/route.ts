// Run it live. Owner only until personal links arrive. POST only, so no page load or link preview can start a
// run. The worst case is reserved against the daily cap first, and the kill switch is checked in the same step.
// Any refusal or failure answers with a reason and the desk keeps the recorded brief. Nothing ever errors out.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { runGuardedBrief } from "@/lib/engine/brief";
import { attackerAbsent, numbersGrounded, underWordLimit } from "@/lib/engine/checks";
import { RunFailed } from "@/lib/engine/run";
import { loadShowDay } from "@/lib/engine/sources/seed";
import { reserve, settle } from "@/lib/live/ledger";
import { OWNER_COOKIE, cookieIsOwner } from "@/lib/live/owner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST() {
  if (!cookieIsOwner((await cookies()).get(OWNER_COOKIE)?.value)) return json({ status: "not_owner" }, 403);
  const r = await reserve();
  if (!r.ok) return json({ status: r.reason });

  const day = loadShowDay();
  try {
    // Balanced mode routes the live brief to Sonnet first, which answers in about ten seconds.
    const run = await runGuardedBrief(day, { task: "desk.brief.live", mode: "balanced", client: "web", runKind: "live", owner: true });
    await settle(r, run.receipt.costMicroUsd);
    const checks = { numbers: numbersGrounded(run.output, day), words: underWordLimit(run.output, 250), attack: attackerAbsent(run.output, day) };
    return json({ status: "ok", brief: run.output, receipt: run.receipt, checks });
  } catch (e) {
    await settle(r, e instanceof RunFailed ? e.receipt.costMicroUsd : r.reserved);
    return json({ status: "failed" });
  }
}
