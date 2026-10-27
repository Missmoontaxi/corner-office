// A tiny Upstash Redis client over its REST API, so live runs need no extra package. Every call has a short
// timeout, and any error throws. Callers treat a throw as "no live run": Redis trouble never opens the door.
export async function redis<T = unknown>(command: (string | number)[]): Promise<T> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Upstash is not configured");
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(2500),
    cache: "no-store",
  });
  const json = (await res.json()) as { result?: T; error?: string };
  if (!res.ok || json.error) throw new Error(`Upstash: ${json.error ?? res.status}`);
  return json.result as T;
}
