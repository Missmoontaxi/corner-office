// Tells the desk whether this browser is Paula's, and how much live spending is left today. Read only.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { status } from "@/lib/live/ledger";
import { OWNER_COOKIE, cookieIsOwner } from "@/lib/live/owner";

export const dynamic = "force-dynamic";

export async function GET() {
  const owner = cookieIsOwner((await cookies()).get(OWNER_COOKIE)?.value);
  if (!owner) return NextResponse.json({ owner: false }, { headers: { "Cache-Control": "no-store" } });
  try {
    const s = await status();
    return NextResponse.json({ owner: true, ...s }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ owner: true, unavailable: true }, { headers: { "Cache-Control": "no-store" } });
  }
}
