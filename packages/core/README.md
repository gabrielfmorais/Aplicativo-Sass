# @app/core

Runtime-independent **domain + application** code shared by the mobile app, Supabase Edge Functions (Deno) and tests (Node).

## `core != utils` (DECISION-REGISTER D-48)

This package is **not** a dumping ground for helpers. Something belongs here only if it is:

1. a domain or application primitive (entity, value object, engine, port, use case, contract, typed error), **and**
2. needed by more than one runtime (mobile + Edge/tests), **and**
3. free of any runtime dependency.

Hard rules (enforced by `eslint.config.mjs`, `.dependency-cruiser.cjs`, `tsconfig.json` with `lib: ES2022` and `types: []`, and `deno check` in CI):

- No React / React Native / Expo / Supabase SDK.
- No Node built-ins (`node:*`, `fs`, `path`, `crypto`, `Buffer`, `process`).
- No environment variables, filesystem, network or storage access — use **ports**.
- No `new Date()` / `Date.now()` outside `shared/time/system-clock.ts` — inject a `Clock` (ADR-008).
- No side effects at import time (`"sideEffects": false`).
- Engines are pure and deterministic: time, randomness and ids are inputs.

## Layout

```
src/
  index.ts              public surface (+ CORE_VERSION)
  shared/               errors, Result, ids, time, domain-rule schema, analytics port
  <context>/            one folder per bounded context (DOMAIN-MAP.md)
    domain/             entities, value objects, engines, invariants
    application/        use cases, ports
    index.ts            the ONLY import path other contexts / the app may use
```

Contexts exist as empty folders with a README until their SPEC is approved. Do **not** add product code here without an approved SPEC (`docs/specs/`).

## Commands

```
pnpm --filter @app/core typecheck
pnpm --filter @app/core test
```
