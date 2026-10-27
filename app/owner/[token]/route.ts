// Paula's owner link. A correct token sets the owner cookie and lands on the desk. Anything else lands on the
// desk too, with no cookie and no hint that the path means anything.
import { NextResponse } from "next/server";
import { OWNER_COOKIE, cookieValue, tokenIsOwner } from "@/lib/live/owner";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cache-Control", "no-store");
  const value = cookieValue();
  if (value && tokenIsOwner(token)) {
    res.cookies.set(OWNER_COOKIE, value, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  }
  return res;
}
