# 0005. Eval-informed routing, first use. GPT-6.1 Sol writes the morning brief

*Status: proposed · Date: 2026-10-20 · Decider: Paula McMahon*

## Context

The morning brief was routed to `text.mid`, with Claude Sonnet 5.5 as primary and GPT-6.1 Sol as fallback. That was a static default picked before any eval existed.

On Mon 10/19 and Tue 10/20 both models ran Paula's ten Digest cases (C01 to C10, Mon 11/9 to Fri 11/20 in the fiction) on brief prompt v4, graded on her eleven criteria. Judges are cross-vendor. Luna judges Sonnet, and Sonnet judges Sol. The final run on Paula's locked rubric, with 0 errors, gave these counts out of 10.

| Criterion | Must pass | Sonnet 5.5 | Sol |
|---|---|---|---|
| R1 headline | yes | 8 | 7 |
| R2 numbers grounded | yes | 10 | 10 |
| R8 planted attack | yes | 10 | 10 |
| R9 personal discreet | yes | 7 | 10 |
| R11 must-not-say | yes | 7 | 10 |
| R7 word limit | no | 1 | 10 |
| R5 carry-over | no | 7 | 3 |

Sol led Sonnet by 3 or more cases on R9 and R11 on two consecutive runs (8 vs 3 and 10 vs 7 on R9, 10 vs 7 twice on R11). It also stays under the 250-word limit on every case, where Sonnet runs 250 to 290 words. It caught more requests that would send sensitive material outside the company and held them for a person to verify.

Sol costs about $0.015 per brief at list price against Sonnet's $0.034. It is slower, with a median of 35 seconds and a slowest of 41 seconds against Sonnet's 9 and 13.

## Decision

- A new alias `text.brief` has Sol as primary and Sonnet as fallback. `desk.brief.precompute` routes to it.
- The precompute brief gets its own 90-second total timeout. It runs on the cron, never while a visitor waits, and Sol's slowest run sat within a second of the 42-second OpenAI default, which already caused one timeout.
- The live brief (`desk.brief.live`) stays on the visitor's mode, so balanced still means Sonnet first. A 35-second wait is too long in front of a visitor.
- The smoke eval (`evals/promptfooconfig.yaml`) now runs Sol, so it always tests the production primary. The full matrix keeps both models.

This is a static choice that Paula made from eval results. It is not yet the automatic eval-informed router planned for November.

## Consequences

- Receipts on the desk show Sol and the reason "desk.brief.precompute, text.brief, gpt-6.1-sol. Fallback claude-sonnet-5-5."
- If Sol fails or times out, Sonnet writes the brief, and the receipt says so.
- The sample is ten cases and the judges are not yet calibrated against Paula's labels (labels land 10/26, the calibration report 10/29). The pick is revisited after calibration, and again when the November router applies the margin rule.
- Sol is weaker on R5 carry-over (3 vs 7) and R1 (7 vs 8). Those are the next prompt targets.
- One open question for Paula is whether the live balanced mode should also move to Sol once latency allows.
