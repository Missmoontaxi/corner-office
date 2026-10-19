# Spike: pinned models, structured output and p95 through the gateway

*Wed 10/14. Part of the day-one gateway spike. Feeds ADR 0002 and the caps in `routing.yaml`.*

Run with `ai` 7.0.122, `@ai-sdk/gateway` 4.0.100 and `zod` 4.6.5 (each at least 14 days old), Node 22, on the `corner-office-dev` key. Scripts lived in a scratch folder outside the repo.

## 1. Contract check, one real call per gateway slug

| Model | Gateway slug | Result | Routed to |
|---|---|---|---|
| claude-haiku-5-5 | `anthropic/claude-haiku-5.5` | OK | anthropic |
| claude-sonnet-5-5 | `anthropic/claude-sonnet-5.5` | OK | anthropic |
| claude-opus-5-5 | `anthropic/claude-opus-5.5` | OK | anthropic |
| gpt-6-luna | `openai/gpt-6-luna` | OK | openai |
| gpt-6.1-sol | `openai/gpt-6.1-sol` | OK | openai |

- Every dot-form slug in the plan is correct, and the gateway's listed prices match the roster table.
- `openai/omni-moderation-latest` is **not** on the gateway. The November moderation alias has to be direct-only, with its own capped key.
- **Direct driver, Fri 10/16.** `pnpm check:direct` runs in the manual `direct-models` workflow with the CI eval keys ([run 38941312781](https://github.com/Missmoontaxi/corner-office/actions/runs/38941312781)). All three Claude models answered at their direct IDs (`claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5`), and structured output went out as Claude's native `output_config`, so the direct path uses native structured outputs as the plan wants. `ANTHROPIC_EVAL_KEY` is 106 characters with no whitespace and no repeat, so the feared double paste did not happen. **OpenAI added Sat 10/17** ([run 39049481260](https://github.com/Missmoontaxi/corner-office/actions/runs/39049481260)). `gpt-6-luna` and `gpt-6.1-sol` answered at their direct IDs, and structured output went out as OpenAI's strict JSON schema (the Responses API `text` format). `OPENAI_EVAL_KEY` is 167 characters, a service-account key in `corner-office-ci` under the $10 hard limit, expiring in 90 days. All five pinned models now pass on both drivers.

## 2. Effort and structured output through AI SDK 7

- AI SDK 7 has a provider-neutral `reasoning` option (`none`, `minimal`, `low`, `medium`, `high`, `xhigh`). The gateway receives it as-is and translates it per provider. It reaches the models. Opus 5.5 at medium and Sol at medium both reported reasoning tokens on a planning prompt.
- `Output.object({ schema })` sends the gateway a JSON schema as `responseFormat`, with `additionalProperties: false`. All five models returned schema-valid objects.
- **Open question.** Whether the gateway turns that into Claude's native `output_config.format` or a forced tool is not visible from our side. Validity was 100 percent either way, so this matters only for cost and latency, and it is worth one question to Vercel.
- **Forced `tool_choice` did not error** on Haiku, Sonnet or Opus 5.5, with reasoning at the planned effort or `none`. The plan's warning (a 400 error, medium confidence) did not reproduce through the gateway. The gateway may quietly adjust thinking when a tool is forced, so we still prefer `Output.object` over forced tools for BriefV1.
- Sonnet 5.5 at `high` produced zero reasoning tokens on an easy prompt. Thinking is adaptive, so effort is a ceiling, not a guarantee of spend.

## 3. p95 tokens and timing

**Method.** Ten streamed calls per row, five at a time, with `Output.object` and the planned effort. Input was the CareBird show day from the seed (calendar, decisions, inbox and tasks), with newsletters left out because the guard is not built yet. The prompt and schema were measurement stand-ins, not the product's brief prompt or BriefV1. With ten calls, p95 is the slowest or longest call. The first event is the first stream part of any kind from the model, including reasoning. Total spend was $1.36.

| Task | Model, effort | Input tokens | p95 output (thinking) | p95 first event | p95 total | Cost per call |
|---|---|---|---|---|---|---|
| desk.brief.precompute | Sonnet 5.5, medium | 7,626 | 1,430 (0) | 2.7s | 14.9s | $0.028 |
| desk.brief.precompute | Sol 6.1, medium | 5,158 | 1,234 (369) | 1.8s | 37.0s | $0.014 |
| desk.brief.live | Haiku 5.5, low | 7,626 | 2,254 (895) | 4.3s | 15.2s | $0.002 |
| desk.brief.live | Luna 6, low | 5,158 | 1,160 (328) | 0.8s | 11.0s | $0.001 |
| desk.brief.live | Sonnet 5.5, low | 7,626 | 1,462 (0) | 1.8s | 13.9s | $0.028 |
| desk.brief.live | Sol 6.1, low | 5,158 | 957 (147) | 3.0s | 28.4s | $0.011 |
| desk.brief.live | Opus 5.5, low | 7,626 | 1,248 (0) | 5.1s | 18.7s | $0.053 |
| guard.screen | Haiku 5.5, low | 1,248 | 207 (0) | 1.9s | 2.9s | $0.0002 |
| guard.screen | Luna 6, low | 686 | 382 (311) | 1.2s | 4.2s | $0.0002 |

No call errored and none stopped on max tokens.

### What it means

- **Caps can come down, except one.** At p95 times 1.5, brief precompute needs about 2,200 (planned 6,000) and brief live about 3,400 (planned 4,000, set by Haiku). **guard.screen needs about 600, above the planned 400**, because Luna spends most of its screen output thinking. At 400 the Luna fallback would hit the cap and count as a failed attempt.
- **Haiku thinks the most at low effort.** Haiku produced 895 thinking tokens on a live brief, while Sonnet and Opus at low produced none. Effort does not mean the same thing across models.
- **Timeouts sit on their floors.** The slowest p95 first event was Opus at 5.1s, so `first_event_ms` stays at the 8,000 floor. For `total_ms`, every Claude row stays at the 30,000 floor. Sol needs 33,400 live and 42,000 precompute, under the 55,000 ceiling. Sol is slow in total time, so it is a fine fallback but a poor primary for a visitor waiting on a live run.
- **Claude counts about 48 percent more input tokens than OpenAI for the same text** (7,626 against 5,158). Cost estimates and the 20,000 input cap should be measured in Claude tokens, the larger count.
- **Live brief cost per run** ranges from $0.001 (Luna) to $0.053 (Opus). Sonnet, the Balanced default, is about $0.028, inside the plan's estimates.

### Caveats

Ten calls per row is small, and the real brief prompt and BriefV1 will differ. Re-measure once both exist, and again after week one of real traffic as the plan already says.

### Numbers for `routing.yaml` (approved by Paula Sun 10/18, in routing.yaml version 2026-10-18.1)

| Setting | Planned | Measured proposal |
|---|---|---|
| desk.brief.precompute max_output | 6000 | 2200 |
| desk.brief.live max_output | 4000 | 3400 |
| guard.screen max_output | 400 | 600 |
| first_event_ms | p95 + 2000, floor 8000 | 8000 (floor) |
| total_ms | p95 + 5000, floor 30000 | 30000 for Claude, 42000 when Sol is the model |
