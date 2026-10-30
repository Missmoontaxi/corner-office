# 0002. Build the policy layer, buy the transport

*Status: proposed · Date: 2026-10-30 · Decider: Paula McMahon*

## Context

Every model call in Corner Office has to answer three questions before it runs. Which model, and why. How much can it spend. What does the visitor see if it fails. The receipts on the desk show those answers to visitors, so they have to come from code we can read and test, not from a vendor dashboard.

Separately, the calls have to reach Anthropic and OpenAI. That part is plumbing (auth, retries, provider failover, billing) and has nothing to do with what the demo is showing.

The day-one spike (Wed 10/14, `docs/spikes/`) tested the bought half before we leaned on it.

- **Pinned models and structured output work through Vercel AI Gateway** with AI SDK 7, for every slug in `models.yaml`, with p95 tokens and timing recorded for `routing.yaml`.
- **Key budgets stop a key, but softly.** A $1.00 key budget let spend reach about $1.60, because the gateway's count trails by about one request. Refusals are HTTP 402 and cost nothing.
- **The team's prepaid balance is a hard ceiling.** Vercel support confirmed in writing (Sat 10/17) that at $0 further requests get HTTP 402 and are never billed to the card on file.

## Decision

**Buy the transport.** All model calls go through Vercel AI Gateway (`@ai-sdk/gateway`), with OIDC in production and no stored key. Each call pins the vendor's own host (`order` and `only`), so Claude never runs on Bedrock or Vertex. `DRIVER=direct` calls Anthropic and OpenAI with their own keys as the outage exit, and a hand-run CI check (`direct-models`) proves that path works.

**Build the policy layer.** Three versioned YAML files in `lib/engine/policy/` decide everything the receipts explain, and every trace records their versions.

- `models.yaml`, the model registry, with pinned slugs, vendors and list prices.
- `routing.yaml`, which picks an alias, a fallback chain, effort, output caps and timeouts for each task, plus a plain-English reason (`lib/engine/router.ts`).
- `budgets.yaml`, the money rules. Each live run reserves its worst case in Redis before it starts and settles to the real token cost when it finishes (`lib/live/ledger.ts`). That covers the owner's daily cap, the kill switch and, from the personal links on, envelopes, a velocity trigger and a daily breaker.

The app's caps count spend from each response's own token usage and never wait for the gateway's count. Any failed run, a gateway 402 included, ends with the recorded brief. Telling a 402 apart as a budget stop that alerts Paula, never retried, is a follow-up.

## Alternatives considered

- **LiteLLM or Portkey as the policy layer.** Both offer routing, fallbacks and budgets. But the routing reasons, the per-run reservation and the receipt fields would then live in someone else's config format, and the demo's whole point is showing that logic. They would also add a service to run and secure.
- **OpenRouter or Cloudflare AI Gateway as the transport.** Both are workable. AI Gateway won because it sits in the same Vercel team, uses OIDC with no key to leak, and its zero-balance behavior is confirmed in writing.
- **Calling vendors directly with no gateway.** This is kept as the exit path, not the default, because it means storing two provider keys in production and building failover ourselves.

## Consequences

- Swapping a model or rerouting a task is a reviewed YAML change with a version bump, and the scorecard and receipts pick it up.
- Spend has three layers. The app's reservation is exact and comes first, the gateway's prepaid balance is the hard floor, and key budgets bound local development.
- We depend on Vercel for transport. If the gateway is down, `DRIVER=direct` is a one-variable switch.
- **What changes at 100x.** Move the ledger from one Redis key per day to per-envelope streams. Add a second transport behind the same driver interface. Consider LiteLLM or Portkey for transport only, while the policy files stay ours.
