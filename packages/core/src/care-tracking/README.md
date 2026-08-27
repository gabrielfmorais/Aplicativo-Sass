# care-tracking (bounded context)

What actually happened against the plan (SPEC-005). Pure, deterministic, no I/O: `today` is an
input, never read from a clock (ADR-008).

- `domain/care-tracking.ts` — `buildTodayView(cares, executions, today)` derives overdue / today /
  upcoming / history, plus `canUndo` and the approved windows.
- `application/ports.ts` — `CareTrackingPort`: reads under RLS, writes only through the RPCs.

Two things are **derived, never stored** (SPEC-005 §8.2, D-69):

- **overdue** — `planned_date < today` with no outcome yet.
- **done** — an *effective* (non-voided) `CareExecution` exists.

That is what keeps the intention (`ScheduledCare`) and the fact (`CareExecution`) apart: completing
inserts a fact and never rewrites the plan, and rescheduling ends the original row rather than
moving a date (D-28). Undo (D-69/D-12) marks the execution voided within 15 minutes and keeps it in
history; the `0 or 1 effective execution` invariant lives in the database, not here.
