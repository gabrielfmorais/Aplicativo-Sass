# Dependency audit exceptions

`pnpm audit --audit-level=high` runs in CI (SECURITY-BASELINE §11). Advisories listed here are
explicitly accepted, with justification, owner and **expiry**. An expired exception fails review.
Exceptions live in `package.json#pnpm.auditConfig.ignoreGhsas` and must match this table.

| GHSA | Package | Severity | Path | Why accepted | Expires | Added by |
|---|---|---|---|---|---|---|
| GHSA-w3rx-r6r6-pgpr | image-size ≤2.0.2 | high | `expo > expo-modules-core > react-native-worklets > @react-native/metro-config > metro-config > metro > image-size` | **No patched version exists** (`patched: <0.0.0`). Used only by Metro at bundle time to read asset dimensions of images committed to this repo; not shipped in the app bundle; no untrusted input. DoS via crafted ICNS/JXL/HEIF requires a malicious image in the repo, which code review controls. | 2026-11-30 | SPEC-000 |
| GHSA-5p2g-fcmc-qvqq | image-size ≤2.0.2 | high | same as above | same as above | 2026-11-30 | SPEC-000 |

Review cadence: at every Expo SDK/patch upgrade and at expiry. If Metro upgrades `image-size`, remove the entries.
