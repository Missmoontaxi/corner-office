// The public snapshot: the morning's promoted brief and prompt-key answers, as one JSON file in the public Blob
// store. Every public read goes through readSnapshot, so a visitor never touches Redis or a model. Each write
// lands at a new path, since Blob's CDN keeps a fixed path for 30 days (spike, Fri 10/16), and then the
// "snapshot" tag is revalidated so pages pick up the new file. The store is public, so only what the desk
// already shows goes in it.
import { list, put } from "@vercel/blob";
import { revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import { AskV1, BriefV1, Receipt } from "./contracts";

const PREFIX = "snapshots/snapshot";
const Check = z.object({ passed: z.boolean(), detail: z.string() });

export const Snapshot = z.object({
  kind: z.literal("snapshot"),
  version: z.literal(1),
  runAt: z.string(),
  brief: z.object({ brief: BriefV1, receipt: Receipt, checks: z.record(z.string(), Check) }),
  asks: z.array(z.object({ key: z.number(), question: z.string(), answer: AskV1, checks: z.record(z.string(), Check), receipt: Receipt })),
  gate: z.object({ passed: z.literal(true), results: z.array(z.object({ id: z.string(), passed: z.boolean(), detail: z.string() })) }),
});
export type Snapshot = z.infer<typeof Snapshot>;

const configured = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

// Only a run that passed the promote gate reaches here, and the schema enforces that too.
export async function publishSnapshot(s: Snapshot) {
  const blob = await put(`${PREFIX}.json`, JSON.stringify(Snapshot.parse(s)), { access: "public", addRandomSuffix: true, contentType: "application/json" });
  revalidateTag("snapshot", { expire: 0 });
  return blob.url;
}

// The newest snapshot, resolved once per write rather than once per visitor. Its URL is unique, so the fetch
// can be cached for good.
const newest = unstable_cache(
  async () => {
    const { blobs } = await list({ prefix: PREFIX });
    const latest = blobs.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))[0];
    if (!latest) return null;
    const res = await fetch(latest.url, { next: { tags: ["snapshot"] } });
    return res.ok ? ((await res.json()) as unknown) : null;
  },
  ["snapshot"],
  { tags: ["snapshot"] },
);

// Null when Blob is not set up, unreachable or holds nothing valid. Callers then serve the committed recordings.
export async function readSnapshot(): Promise<Snapshot | null> {
  if (!configured()) return null;
  try {
    const parsed = Snapshot.safeParse(await newest());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
