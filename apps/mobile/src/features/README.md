# features/

Presentation layer per bounded context (ADR-001): `screens`, `components`, `hooks`, `queries`.
Never import `@supabase/*` or `@app/core/<ctx>/domain|application/*` here (enforced by ESLint + dependency-cruiser).

`auth/` and `account/` implement SPEC-001 (sign-in, logout, deletion request). No product features yet.
