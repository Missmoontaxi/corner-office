// Tells the desk who this browser is. Paula's phone gets today's live spending. A personal link gets its first
// name, live runs left and expiry, never dollars. Everyone else gets nothing. Read only.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { status } from "@/lib/live/ledger";
import { getLink, isOpen, LINK_COOKIE, runsLeft, verifyToken } from "@/lib/live/links";
import { OWNER_COOKIE, cookieIsOwner } from "@/lib/live/owner";

export const dynamic = "force-dynamic";

const json = (body: unknown) => NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const jar = await cookies();
  if (cookieIsOwner(jar.get(OWNER_COOKIE)?.value)) {
    try {
      return json({ owner: true, ...(await status()) });
    } catch {
      return json({ owner: true, unavailable: true });
    }
  }
  const id = verifyToken(jar.get(LINK_COOKIE)?.value);
  if (!id) return json({ owner: false });
  try {
    const l = await getLink(id);
    if (!l) return json({ owner: false });
    const paused = (await status()).paused;
    return json({ owner: false, link: { name: l.name, runsLeft: runsLeft(l), expires: l.expires, open: isOpen(l), view: l.view }, paused });
  } catch {
    return json({ owner: false, link: { unavailable: true } });
  }
}
