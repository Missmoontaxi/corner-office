# 0001. Stack and the 14-day pin rule

*Status: proposed · Date: 2026-10-12 · Decider: Paula McMahon*

## Context

Corner Office has to stay stable through the Sat 10/24 demo and the Fri 10/30 public link. Brand-new releases are where surprise breakage lives.

## Decision

- Next.js and React with TypeScript strict, Tailwind 4.3, pnpm, Node 22 LTS (`.nvmrc`).
- Every dependency and GitHub Action is pinned to an exact version or commit SHA. Nothing newer than 14 days at pin time.
- At pin time on 2026-10-12 that means Next.js 16.3.6. The plan named 16.3.8, which was published inside the 14-day window, so the rule wins.

## Consequences

Upgrades are deliberate pull requests, never drift. The latest 16.4.x patch is considered after 10/24.
