# schedule (bounded context)

Schedule half of the SPEC-004 vertical slice. Pure, deterministic, no I/O: it never reads a clock —
`startsOn` is an input (ADR-008).

- `domain/plan.ts` — `HairPlanDraft`, `ScheduledCareDraft`, `CARE_TYPE_CODES`.
- `engine/v1/` — **immutable once released** (ADR-007); `rules.ts` is the governance register.
- `placement/preferred-weekdays.ts` — SPEC-015, the premium `plan_customization` layer. Deliberately
  **outside** `engine/v1/`: it only moves dates onto the weekdays she prefers, and is bound by an
  invariant that the care types, their count and their order come out exactly as the engine produced
  them. Which cares and how often stays domain (D-26); when they land does not.
- `application/build-plan.ts` — `buildPlan(snapshot, startsOn, preferences?)`, the single
  authoritative path from a profile to a plan. The client preview and the `generate-plan` Edge
  Function both call it, so an instant preview and the persisted plan cannot drift (SPEC-004 AC3).
  Passing `preferences` does not grant the premium capability — the server decides that
  (`has_entitlement`, SPEC-015 FR3) and omits them when she is not entitled.
- `application/ports.ts` — `HairPlanPort`: reads under RLS, creation only through the Edge Function.
  `ScheduledCare` is the shared kernel with care-tracking (DOMAIN-MAP §6): Schedule creates cares,
  Care Tracking transitions them (SPEC-005).

Persistence and the one-active-plan / idempotency invariants live in the database
(`supabase/migrations/20260829000000_hair_plans_scheduled_cares.sql`), not here.
