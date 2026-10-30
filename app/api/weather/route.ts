// Today's weather at the CareBird office in Flatiron, for the monitor and the brief's date strip. Open-Meteo is
// free, needs no key and gets no visitor data. Vercel caches the answer for 30 minutes, so visitors never reach
// Open-Meteo themselves. A slow or failed fetch answers null and the desk keeps the seed's weather line.
import { NextResponse } from "next/server";
import { parseOpenMeteo } from "@/lib/desk/shared";

export const revalidate = 1800;

const FORECAST =
  "https://api.open-meteo.com/v1/forecast?latitude=40.7411&longitude=-73.9897" +
  "&daily=temperature_2m_max,temperature_2m_min,weather_code&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=1";

export async function GET() {
  let weather = null;
  try {
    const res = await fetch(FORECAST, { next: { revalidate }, signal: AbortSignal.timeout(3000) });
    if (res.ok) weather = parseOpenMeteo(await res.json());
  } catch {
    // Keep null. The desk falls back to the seed.
  }
  return NextResponse.json({ weather });
}
