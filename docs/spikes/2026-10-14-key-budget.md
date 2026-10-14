# Spike: does a gateway key budget stop the key?

*Wed 10/14. Part of the day-one gateway spike. Feeds ADR 0002.*

## Question

The `spike-1-dollar` key has a $1.00 budget in AI Gateway. When the key's spend passes $1.00, are its requests stopped, and by how much does spend overshoot first?

## Method

One request at a time, never in parallel, to `anthropic/claude-opus-5.5-fast` through the OpenAI-compatible endpoint, each asking for a long answer with `max_tokens` 8000. At list price ($8 in, $40 out per million tokens) each call costs about $0.32. The script stopped after two rejections or $2.50 of estimated spend.

## Result

| Call | Status | Output tokens | Running estimate |
|---|---|---|---|
| 1 | 200 | 8000 | $0.32 |
| 2 | 200 | 8000 | $0.64 |
| 3 | 200 | 8000 | $0.96 |
| 4 | 200 | 8000 | $1.28 |
| 5 | 200 | 8000 | $1.60 |
| 6 | 402 | none | $1.60 |
| 7 | 402 | none | $1.60 |

The rejection is HTTP 402 with error type `quota_for_entity_exceeded` and the message "API key budget exceeded. Current spend $1.28, limit $1.00." It returns in about 0.1 seconds and costs nothing.

## What it means

- **Key budgets work.** Once the gateway counts the spend, every later request on the key is refused.
- **They are soft, and they lag.** Call 4 crossed the limit and completed, as Vercel's docs say. Call 5 also completed, even though the key was already over budget, because the gateway's spend count did not include call 4 yet when call 5 arrived. Call 6 still read $1.28, so the count trails by about one request. Final spend was about $1.60 on a $1.00 budget.
- **Overshoot is roughly the cost of one or two requests in flight**, and more with parallel requests. For the $10 dev key, with requests capped well under $0.50, that is a few dollars at most.
- **This says nothing about the production path.** Production calls the gateway through OIDC with no key, so key budgets never apply there. The team's zero-balance behavior is still open, and Paula is asking Vercel support in writing. Until Vercel answers, the app's own per-request and daily caps are the hard ceiling, and the $45 gateway balance is a soft backstop.

## Follow-ups

- The app's caps should count spend from the response's own token usage at the moment each request finishes, and never wait for the gateway's count.
- Treat a 402 with `quota_for_entity_exceeded` as a budget stop, not a retryable error.
