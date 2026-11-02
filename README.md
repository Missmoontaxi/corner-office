# Corner Office

Sit in a CEO's chair. Open the morning brief. Flip any card to see its receipt with which model ran and why, what it cost, how it scored against a human-written rubric, and which guardrails fired.

Corner Office is a working demo of an AI chief of staff for a fictional company, built by **Paula McMahon** with Claude Code as pair programmer.

**Status:** private build. First public link planned for Fri 10/30 at `lab.moontaxilab.com`.

## Run it locally

```bash
nvm use
corepack enable
pnpm install
pnpm dev
```

## Docs

- [SECURITY.md](SECURITY.md) covers the secrets table and guards.
- [docs/adr](docs/adr) holds the architecture decision records.
