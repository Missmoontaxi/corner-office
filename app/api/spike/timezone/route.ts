// Temporary spike route. Echoes only Vercel's x-vercel-ip-timezone header so its presence and format
// can be checked on Pro. Removed once the spike notes are written.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const tz = request.headers.get("x-vercel-ip-timezone");
  let validIana = false;
  if (tz) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      validIana = true;
    } catch {}
  }
  return Response.json({ present: tz !== null, value: tz, validIana }, { headers: { "Cache-Control": "no-store" } });
}
