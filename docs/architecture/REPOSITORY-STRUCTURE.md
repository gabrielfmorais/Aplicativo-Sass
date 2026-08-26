# REPOSITORY STRUCTURE

| Campo | Valor |
|---|---|
| Status | Draft v0.1 — estrutura-alvo; diretórios de código são criados na fase Foundation (SPEC-000) |
| ADR | [ADR-003](../adr/ADR-003-repository-strategy.md) |

## 1. Crítica à estrutura proposta originalmente

| Item original | Decisão | Motivo |
|---|---|---|
| `apps/admin` | **Adiado** | Sem consumidor real no MVP; Supabase Studio + runbooks cobrem |
| `packages/domain` + `packages/application` separados | **Fundidos em `packages/core`** | Application sem domain não existe; dois pacotes dobram config sem ganho |
| `packages/ui` | **Adiado** | Só faz sentido com 2 apps; UI vive em `apps/mobile/src/shared/ui` |
| `packages/validation`, `packages/types` | **Fundidos em `packages/core`** | Schemas zod **são** os tipos; separar cria dependência circular na prática |
| `packages/config` | **Substituído por config na raiz** | ESLint/TS/Prettier compartilhados via arquivos raiz + `extends` |
| `supabase/{migrations,functions,seed,tests}` | **Mantido** + `security/` | Padrão da CLI |
| `docs/{architecture,adr,specs,security,product,runbooks}` | **Mantido** | |

## 2. Estrutura-alvo

```
.
├── CLAUDE.md                     # constituição do agente
├── README.md                     # onboarding humano (links para docs)
├── package.json                  # scripts raiz: typecheck, lint, test, dep-cruise
├── pnpm-workspace.yaml           # apps/*, packages/*
├── tsconfig.base.json            # strict, paths
├── eslint.config.js              # regras de fronteira por diretório
├── .dependency-cruiser.cjs       # dependency rule enforcement
├── .env.example                  # apenas nomes de variáveis
├── .gitignore
├── .github/
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── CODEOWNERS
│   └── workflows/
│       ├── ci.yml                # lint, typecheck, test, dep-cruise, audit, gitleaks
│       ├── supabase-test.yml     # supabase start + db reset + pgTAP + checks RLS
│       ├── supabase-deploy-staging.yml   # push migrations ao merge em main
│       └── supabase-deploy-prod.yml      # manual + environment approval
├── .claude/
│   └── skills/                   # /spec-create, /rls-review, ... (Foundation)
│
├── apps/
│   └── mobile/                   # Expo app
│       ├── app.config.ts
│       ├── src/
│       │   ├── app/              # Expo Router (rotas) — só composição, sem lógica
│       │   ├── features/         # por bounded context: onboarding/, today/, calendar/, checkin/, progress/, paywall/, account/
│       │   │   └── <feature>/{screens,components,hooks,queries}/
│       │   ├── infrastructure/   # implementações de ports
│       │   │   ├── supabase/     # client, database.types.ts (gerado), repositories/, queries/, errors.ts
│       │   │   ├── notifications/
│       │   │   ├── analytics/
│       │   │   ├── storage/      # secure store, cache
│       │   │   └── clock/        # SystemClock
│       │   ├── shared/           # ui/ (design system), theme/, i18n/, a11y/
│       │   └── bootstrap/        # providers, query client, DI wiring
│       └── __tests__/
│
├── packages/
│   └── core/                     # TypeScript puro — sem React/Expo/Supabase
│       ├── package.json          # deps: zod, date-fns(-tz) apenas
│       └── src/
│           ├── shared/           # errors.ts, time/, result.ts, ids.ts
│           ├── identity/         # domain/, application/, index.ts
│           ├── hair-profile/
│           ├── diagnostic/       # engine/v1/{rules.ts,run.ts,__fixtures__}, contracts/, index.ts
│           ├── schedule/         # engine/v1/..., contracts/
│           ├── care-tracking/    # calendar/, execution/, checkin/
│           ├── progress/
│           ├── notifications/    # intents
│           ├── content/
│           ├── subscription/     # entitlements/catalog.ts, EntitlementService
│           └── analytics/        # events.ts (catálogo), port.ts
│
├── supabase/
│   ├── config.toml
│   ├── migrations/               # <timestamp>_<slug>.sql
│   ├── functions/                # generate-plan/, billing-webhook/, _shared/
│   ├── seed/                     # care_types, content (idempotente)
│   ├── tests/                    # pgTAP: rls/, rpc/, constraints/
│   ├── security/                 # definer-allowlist.txt, grants-allowlist.txt
│   └── ops/                      # queries read-only para operação (runbooks)
│
└── docs/
    ├── product/                  # PRODUCT-BRIEF, MVP-ROADMAP
    ├── architecture/             # SYSTEM-ARCHITECTURE, DOMAIN-MAP, DATA-MODEL, REPOSITORY-STRUCTURE, ENGINEERING-WORKFLOW, SKILLS-PLAN
    ├── adr/
    ├── specs/
    ├── security/                 # SECURITY-BASELINE, THREAT-MODEL, SUPABASE-RLS-STRATEGY, MCP-POLICY
    └── runbooks/                 # secret-rotation, account-purge, content-update, incident, mcp-usage-log
```

## 3. Regras por diretório

| Diretório | Pode importar | Não pode importar | Revisão humana obrigatória |
|---|---|---|---|
| `packages/core/src/*/domain` | `core/shared`, próprio contexto | qualquer outro contexto (exceto via `index.ts`), application, infra, frameworks | **Sim** (engines) |
| `packages/core/src/*/application` | domain do próprio contexto, `index.ts` de outros, `core/shared` | infra, frameworks | Não |
| `apps/mobile/src/infrastructure` | `@app/core`, SDKs | `features`, `app` | Sim se `supabase/` |
| `apps/mobile/src/features` | `@app/core` (application/index), `infrastructure` **apenas via hooks/queries** do próprio feature, `shared` | `@supabase/*` direto, `domain/*` internals | Não |
| `apps/mobile/src/app` | `features` | tudo o resto | Não |
| `supabase/**` | — | — | **Sim** |
| `.github/**`, `CLAUDE.md`, `CODEOWNERS` | — | — | **Sim** |

## 4. Nomenclatura
- Arquivos TS: `kebab-case.ts`; componentes React: `PascalCase.tsx`.
- Testes: `*.test.ts` ao lado do código; fixtures em `__fixtures__/`.
- Alias: `@app/core` → `packages/core/src`; `@/` → `apps/mobile/src`.
- SQL: snake_case; migrations `YYYYMMDDHHMMSS_verb_object.sql`.
