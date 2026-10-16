# Spike: Blob snapshot writes, the snapshot cache tag and revalidation

*Fri 10/16. Part of the day-one spike. Feeds ADR 0002.*

## Setup

- Paula created a **public** Blob store, `corner-office-snapshots`, in Washington, D.C. (iad1), connected to the corner-office project in all three environments, with a read-write token. Public fits the plan, because the snapshot serves public reads and the wall art from 11/13 loads straight into browsers. Writes still need a credential.
- `@vercel/blob` 2.8.0, Next 16.3.6.
- A temporary route (`app/api/spike/snapshot/route.ts`, commit `1f6c083`) tested the pattern in production, then was removed. Its write path required a SHA-256 of the store token in a header, and it answered 404 without one.

## Results

**1. Keyless writes work.** A `put` with only a Vercel OIDC token and the store ID, and no read-write token, succeeded. Production functions get an OIDC token automatically, so `BLOB_READ_WRITE_TOKEN` can be removed once the app writes through OIDC. Until then it is listed in the secrets table.

**2. Never overwrite a fixed path.** Blob serves files with `Cache-Control: public, max-age=2592000` (30 days) through its CDN. After deleting a file and writing new content at the same path, the public URL kept returning the old content from cache (`x-vercel-cache: HIT`). Setting `cacheControlMaxAge: 60` did not help, because the cached copy still carried the old 30-day header. Every snapshot must be written to a new path (`addRandomSuffix: true`) and treated as immutable.

**3. Tag revalidation works on Vercel.** The read used `unstable_cache` with the tag `snapshot`, listing the newest file under the prefix and fetching it. The write used `revalidateTag("snapshot", { expire: 0 })`.

| Step | What happened |
|---|---|
| Two reads, empty store | Both served from one cached result |
| Write v1, then read | The very next read returned v1 |
| Write v2, then read | The very next read returned v2 |
| Five reads over 15 seconds | All served from one cached result again |

After each write, there was one extra recompute within about a second, and then reads settled back on the cache.

## Pattern for the build

1. The writer `put`s `snapshots/snapshot.json` with a random suffix, so the content is immutable and CDN caching is safe.
2. The writer calls `revalidateTag("snapshot", { expire: 0 })`. In Next 16 the second argument is required.
3. Readers resolve the newest snapshot inside a function cached under the `snapshot` tag, so `list` and the fetch run once per write, not once per visitor.
4. A cleanup job deletes old snapshot files, keeping the last few for rollback.

## Rule for this store

The store is public. Nothing private ever goes in it. That means no traces with real data, no keys, and nothing from Paula's private planning. Anything private gets its own private store.

## Cleanup

Both spike files were deleted, and the store is empty.
