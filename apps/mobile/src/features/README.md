# features/

Presentation layer per bounded context (ADR-001): `screens`, `components`, `hooks`, `queries`.
Never import `@supabase/*` or `@app/core/<ctx>/domain|application/*` here (enforced by ESLint + dependency-cruiser).

`foundation-status/` is a SPEC-000 smoke screen, not a product feature — replaced under SPEC-001.
