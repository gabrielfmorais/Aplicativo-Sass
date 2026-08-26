# Architecture Decision Records

Convenção: `ADR-NNN-slug.md`. Status: `Proposed` → `Accepted` | `Rejected` | `Superseded by ADR-XXX` | `Deprecated`.

Seções obrigatórias: Status · Context · Decision · Alternatives Considered · Trade-offs · Consequences · Security Impact · Reversibility.

Uma ADR **nunca é editada** após `Accepted` para mudar a decisão — cria-se uma nova que a substitui.

| ID | Título | Status |
|---|---|---|
| [ADR-001](ADR-001-application-architecture.md) | Application Architecture (camadas pragmáticas) | Accepted (D-01) |
| [ADR-002](ADR-002-mobile-framework.md) | Mobile Framework: Expo + React Native + TypeScript strict | **Accepted — estrutural** (D-20) |
| [ADR-003](ADR-003-repository-strategy.md) | Repository Strategy: single repo com pnpm workspaces mínimos; admin adiado | Accepted (D-02, D-23) |
| [ADR-004](ADR-004-supabase-architecture.md) | Supabase Architecture: RLS como autorização, RPC para transações, Edge para engine/segredos | Accepted (D-03) |
| [ADR-005](ADR-005-authentication-model.md) | Authentication Model: Apple + Google + Email OTP | Accepted (D-21; diff aprovado 2026-08-26) |
| [ADR-006](ADR-006-domain-boundaries.md) | Domain Boundaries | Accepted (D-04) |
| [ADR-007](ADR-007-schedule-engine-architecture.md) | Diagnostic & Schedule Engine Architecture + Amendment A1 (governança de regras) | Accepted (D-06, D-26) |
| [ADR-008](ADR-008-time-and-dates.md) | Time, Dates & Timezones | Accepted (D-05) |
| [ADR-009](ADR-009-notification-architecture.md) | Notification Architecture: Intent → Scheduler → Adapter; local no MVP | Accepted (D-07, D-22) |
| [ADR-010](ADR-010-analytics-architecture.md) | Analytics Architecture | Accepted (D-08) |
| [ADR-011](ADR-011-subscription-entitlements.md) | Subscription & Entitlements (forma); provider adiado | Accepted forma (D-09) / provider Deferred (D-24) |

Registro de decisões humanas: [DECISION-REGISTER](../architecture/DECISION-REGISTER.md).
