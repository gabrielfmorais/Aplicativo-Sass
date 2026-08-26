# Boundary fixtures (negative tests)

Each file here deliberately VIOLATES an architectural rule. `pnpm check:boundaries` copies them into
the protected locations, runs ESLint / dependency-cruiser and asserts the expected rule fires.
They are excluded from normal lint/typecheck. Never import them.
