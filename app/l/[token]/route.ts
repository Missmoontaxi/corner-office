// A personal link. A token with the right tag sets the link cookie, which lasts as long as the link, and lands
// on the desk. Anything else lands on the desk too, with no cookie and no hint. Opening a link touches no Redis
// and logs nothing, so the run log never shows link opens.
import { NextResponse } from "next/server";
import { budgets, LINK_COOKIE, verifyToken } from "@/lib/live/links";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Cache-Control", "no-store");
  if (verifyToken(token)) {
    res.cookies.set(LINK_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * budgets().links.days });
  }
  return res;
}
