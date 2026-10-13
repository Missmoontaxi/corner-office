# Security

## Secrets table

Every credential this project uses is listed here. If it is not in this table, it should not exist.

| Secret | Lives in | Scope | Cap | Rotation |
|---|---|---|---|---|
| AI Gateway (production) | None. Vercel OIDC | Corner Office project | $45 monthly project budget, $45 prepaid, auto top-up off | Not applicable |
| `AI_GATEWAY_API_KEY` (dev) | Paula's `.env.local` only | Local development | $10 key budget | Expires every 30 days |
| `ANTHROPIC_EVAL_KEY` | GitHub Actions secret | `ci-evals` workspace in the Moontaxi Lab Console org | $15 monthly workspace limit | 90 days |
| `OPENAI_EVAL_KEY` | GitHub Actions secret | OpenAI CI project | $10 hard limit | 90 days |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel environment variables | One Redis database | $5 monthly budget cap | 90 days |

No standing text-model key lives in the app. A BYOK Anthropic key may join this table after the Tue 10/13 spike, as a capped, listed exception.

## Guards from the first commit

- A gitleaks pre-commit hook blocks staged secrets locally.
- A gitleaks CI job scans the full history on every push and pull request.
- GitHub Actions are pinned to commit SHAs.
- Every response carries `noindex` until the public launch.

## Reporting

Email hello@paulamcmahon.com.
