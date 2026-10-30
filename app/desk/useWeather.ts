// Live Flatiron weather for the monitor and the brief, fetched once per page load and shared. Until it arrives,
// or if it never does, the seed's weather line shows instead.
import { useEffect, useState } from "react";
import type { Weather } from "@/lib/desk/shared";

let pending: Promise<Weather | null> | null = null;
const fetchWeather = () =>
  (pending ??= fetch("/api/weather")
    .then((r) => (r.ok ? r.json() : { weather: null }))
    .then((b: { weather: Weather | null }) => b.weather)
    .catch(() => null));

export function useWeather(fallback: Weather | null): Weather | null {
  const [live, setLive] = useState<Weather | null>(null);
  useEffect(() => {
    let on = true;
    fetchWeather().then((w) => on && setLive(w));
    return () => {
      on = false;
    };
  }, []);
  return live ?? fallback;
}
