# schedule (bounded context)

Schedule half of the SPEC-004 vertical slice. Pure, deterministic, no I/O: it never reads a clock —
`startsOn` is an input (ADR-008).

- `domain/plan.ts` — `HairPlanDraft`, `ScheduledCareDraft`, `CARE_TYPE_CODES`.
- `engine/v1/` — **immutable once released** (ADR-007); `rules.ts` is the governance register.
- `application/build-plan.ts` — `buildPlan(snapshot, startsOn)`, the single authoritative path from a
  profile to a plan. The client preview and the `generate-plan` Edge Function both call it, so an
  instant preview and the persisted plan cannot drift (SPEC-004 AC3).
- `application/ports.ts` — `HairPlanPort`: reads under RLS, creation only through the Edge Function.
  `ScheduledCare` is the shared kernel with care-tracking (DOMAIN-MAP §6): Schedule creates cares,
  Care Tracking transitions them (SPEC-005).

Persistence and the one-active-plan / idempotency invariants live in the database
(`supabase/migrations/20260829000000_hair_plans_scheduled_cares.sql`), not here.
