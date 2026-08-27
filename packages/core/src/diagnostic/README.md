# diagnostic (bounded context)

Assessment half of the SPEC-004 vertical slice (ADR-007 Amendment A2 / D-66). Pure, deterministic,
no I/O: `assess(HairProfileSnapshot) → AssessmentOutput`.

- `domain/assessment.ts` — `AssessmentOutput` = `{ emphasis, includeReconstruction, evidenceCodes }`.
  No score, no confidence, no repackaging of observed profile values.
- `engine/v1/` — **immutable once released**. Changing behaviour means `v2`, never an edit here
  (ADR-007). `rules.ts` is the governance register of the V1 rules.
- `__fixtures__/` — golden fixtures; any behaviour change fails CI.

The rules are **cosmetic product heuristics** with `validation_status = candidate` (D-67), never a
medical or dermatological diagnosis (D-26). PUBLIC RELEASE requires a domain reviewer sign-off
(`validated`); the wording lives in `docs/domain-rules/SPEC-004-domain-rules-worksheet.md`.
