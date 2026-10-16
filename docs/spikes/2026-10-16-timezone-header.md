# Spike: the x-vercel-ip-timezone header on Pro

*Fri 10/16. Part of the day-one spike.*

## Question

Does Vercel send `x-vercel-ip-timezone` to our functions on the Pro plan, and in what format? The desk uses it to pick the visitor's morning, afternoon or evening lighting and greeting without asking for location.

## Method

A temporary route, `app/api/spike/timezone/route.ts`, deployed to production in commit `bfdd7b6`, returned only the header's value and whether `Intl.DateTimeFormat` accepts it as a time zone. It was removed in the next commit.

## Result

```json
{"present":true,"value":"America/New_York","validIana":true}
```

- **Present on Pro**, on a dynamic route, with `Cache-Control: no-store` and a cache MISS.
- **IANA format** (`Area/City`), which `Intl` accepts directly, so the desk needs no lookup table.

## Notes for the build

- Only read it in dynamic code, since a static or cached page would bake one visitor's zone in for everyone. For the static desk, the lighting can be chosen on the client from the browser's own `Intl.DateTimeFormat().resolvedOptions().timeZone`, with the header as the server-side fallback.
- Tested from one location only. Treat a missing or invalid value as "no zone" and fall back to the browser's zone, then to `America/New_York`, CareBird's home.
- The value is coarse location data. Use it only to choose lighting and greeting, never log it with a visitor's runs, and never show it back to them.
