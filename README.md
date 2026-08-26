# Hair Care Assistant — engineering foundation

Mobile assistant that understands the user's hair, builds a care routine and tells her **what to do today and why**.
Stack: **Expo SDK 57 / React Native 0.86 / TypeScript strict** + **Supabase** (Postgres + RLS, Edge Functions on Deno).

> Status: **SPEC-000 Engineering Foundation** — no product features exist yet. Product work starts only under approved SPECs (`docs/specs/`).

## Start here (humans and agents)
1. `CLAUDE.md` — operating rules for anyone (or any agent) changing this repo.
2. `docs/README.md` — index of product, architecture, security and decision documents.
3. `docs/architecture/DECISION-REGISTER.md` — what is decided, what needs a human, what is deferred.
4. `docs/specs/README.md` — spec-driven workflow, Definition of Ready/Done, SPEC index.

## Layout
```
apps/mobile         Expo app (presentation + infrastructure adapters)
packages/core       runtime-independent domain + application (@app/core) — no React/Expo/Supabase/Node APIs
supabase/           schema-as-code: config, migrations, local seeds, pgTAP security tests, Edge Functions
docs/               product · architecture · adr · specs · security · runbooks
scripts/            repo guardrail scripts (node pin, boundaries, docs links, deno import map)
tooling/            negative boundary fixtures
.claude/skills      agent workflows: /spec-create /spec-review /rls-review /migration-review /pre-commit-review
```

## Requirements
- **Node 22.23.x** (pinned in `.node-version`; `pnpm install` fails on other majors — see `DECISION-REGISTER` D-43).
  Without a version manager: `npx -y -p node@22.23.2 -- <command>`.
- **pnpm 10** via Corepack: `corepack enable` (version pinned in `package.json#packageManager`).
- Optional: Docker Desktop (Supabase local stack), Deno 2 (`npx -y -p deno@2 -- deno ...` also works).

## Commands
```
pnpm install                 # frozen lockfile in CI; dependency install scripts are blocked unless allow-listed
pnpm verify                  # check:node + format + lint + typecheck + dep-cruise + test + boundaries + docs-links
pnpm lint | typecheck | test # individually
pnpm check:boundaries        # proves the architectural rules reject 8 negative fixtures
pnpm --filter mobile run export:check   # bundles the app for iOS+Android without EAS
pnpm --filter mobile start   # Expo dev server
npx supabase start && npx supabase db reset && npx supabase test db   # local DB + pgTAP guardrails (Docker)
cd supabase/functions && deno check health/index.ts && deno run _spike/core-smoke.ts   # core under Deno
```

## Workflow (short)
Idea → SPEC (`/spec-create`) → human approval → branch `feature/*` → smallest safe change → tests → `/pre-commit-review` → PR (template) → CODEOWNER review + green CI → squash merge → staging → human-gated production.
Details: `docs/architecture/ENGINEERING-WORKFLOW.md`. Security rules: `docs/security/SECURITY-BASELINE.md`.
