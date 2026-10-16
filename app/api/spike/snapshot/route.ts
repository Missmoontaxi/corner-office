// Temporary spike route. Tests the snapshot pattern on Vercel: immutable Blob files, a read cached
// under the "snapshot" tag, and revalidateTag after a write. Removed once the spike notes are written.
import { createHash } from "node:crypto";
import { list, put } from "@vercel/blob";
import { revalidateTag, unstable_cache } from "next/cache";

export const dynamic = "force-dynamic";

const PREFIX = "spike/snapshots/";

const readLatest = unstable_cache(
  async () => {
    const { blobs } = await list({ prefix: PREFIX });
    const latest = blobs.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))[0];
    const data = latest ? await (await fetch(latest.url)).json() : null;
    return { data, file: latest?.pathname ?? null, cachedAt: new Date().toISOString() };
  },
  ["spike-snapshot"],
  { tags: ["snapshot"] },
);

export async function GET() {
  return Response.json({ ...(await readLatest()), servedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}

// Only a caller who holds the store's token can write: the header is its SHA-256.
export async function POST(request: Request) {
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? "";
  const expected = createHash("sha256").update(token).digest("hex");
  if (!token || request.headers.get("x-spike-key") !== expected) return new Response("Not found", { status: 404 });
  const { v } = (await request.json()) as { v: number };
  const blob = await put(`${PREFIX}snapshot.json`, JSON.stringify({ v, writtenAt: new Date().toISOString() }), {
    access: "public",
    addRandomSuffix: true,
    contentType: "application/json",
  });
  revalidateTag("snapshot", { expire: 0 });
  return Response.json({ wrote: blob.pathname });
}
