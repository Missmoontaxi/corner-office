# Security

## Secrets table

Every credential this project uses is listed here. If it is not in this table, it should not exist.

| Secret | Lives in | Scope | Cap | Rotation |
|---|---|---|---|---|
| AI Gateway (production) | None. Vercel OIDC | Corner Office project | $45 monthly project budget, $45 prepaid, auto top-up off | Not applicable |
| `AI_GATEWAY_API_KEY` (dev) | Paula's `.env.local` only | Local development | $10 key budget | Expires every 30 days |
| `ANTHROPIC_EVAL_KEY` | GitHub Actions secret | `ci-evals` workspace in the Moontaxi Lab Console org | $15 monthly workspace limit | 90 days |
| `OPENAI_EVAL_KEY` | GitHub Actions secret | OpenAI CI project | $10 hard limit | 90 days |
| `SPIKE_GATEWAY_KEY` (`spike-1-dollar`) | Paula's `.env.local` only | Spike tests | $1 key budget, already spent | Delete after the spike |
| Anthropic BYOK key (`vercel-byok`) | Vercel team AI Gateway BYOK settings | `gateway` workspace in the Moontaxi Lab Console org | $60 monthly workspace limit ($1 during the spike) | 90 days, revocable from the Console |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel environment variables | One Redis database | $20 monthly budget cap (Upstash's minimum) | 90 days |

No standing text-model key lives in the app. The Anthropic BYOK key is the one capped, listed exception. It lives in Vercel's gateway settings, never in the app, and the app still reaches the gateway through OIDC (spike notes in `docs/spikes/2026-10-14-byok.md`).

## Guards from the first commit

- A gitleaks pre-commit hook blocks staged secrets locally.
- A gitleaks CI job scans the full history on every push and pull request.
- GitHub Actions are pinned to commit SHAs.
- Every response carries `noindex` until the public launch.

## Reporting

Email hello@paulamcmahon.com.
