# Dependency audit exceptions

`pnpm audit --audit-level=high` runs in CI (SECURITY-BASELINE §11) and is **never weakened**. Advisories
listed here are explicitly accepted by a human, with justification, expiry and objective invalidation
conditions. The machine-readable source of truth is `docs/security/audit-exceptions.json`; the ignore list in
`package.json#pnpm.auditConfig.ignoreGhsas` must match it, and `scripts/check-security-exceptions.mjs`
(run by `pnpm verify` and CI) re-validates the premises below on every run — **fail closed**.

No security exception is permanent. An expired or invalidated exception fails CI until a human re-reviews it.

---

## EX-001 / EX-002 — `image-size@1.2.1` (two advisories, same package, same chain)

| Field | GHSA-w3rx-r6r6-pgpr | GHSA-5p2g-fcmc-qvqq |
|---|---|---|
| CVE | CVE-2025-71330 | CVE-2025-71329 |
| Summary | ICNS parser: infinite loop (DoS) on crafted buffer | JXL / HEIF parsers: infinite loop (DoS) on crafted buffer |
| **Upstream severity** | **HIGH** (CVSS 7.5) — not reduced | **HIGH** (CVSS 7.5) — not reduced |
| Vulnerable range | `<= 2.0.2` (all published versions) | `<= 2.0.2` |
| Patched version | **none** (`patched: null`; advisory published 2026-06-10, no fix released) | none |
| Installed | `image-size@1.2.1` (single hoisted copy) | same |
| Decision | **ACCEPTED TEMPORARILY** (human review 2026-08-26) | same |
| Expiry | **2026-11-30** — must be re-validated on or before this date | same |

### Project-specific exploitability (distinct from upstream severity)

| Classification | Value |
|---|---|
| Exposure | build / dev tooling (Metro bundler, Node) |
| Production runtime exposure | **NO** — not part of the Hermes bundle |
| Remote user exposure | **NO** |
| Current project execution path | **NOT REACHABLE** (see topology) |
| Accepted risk | temporary |

### Real dependency chain

```
mobile (apps/mobile — direct dependency: react-native, pinned by Expo SDK 57)
└─ react-native@0.86.2
   └─ @react-native/community-cli-plugin@0.86.2
      └─ @react-native/metro-config@0.86.2
         └─ metro@0.87.0            (NESTED copy: node_modules/@react-native/metro-config/node_modules/metro)
            └─ image-size@1.2.1     (hoisted to node_modules/image-size)
```

### Two copies of Metro are installed

| Path | Version | Declares/imports `image-size`? | Who uses it |
|---|---|---|---|
| **Expo execution path** — `node_modules/metro` | `metro@0.84.5` | **No.** No dependency declared; asset dimensions come from Metro's internal parser `src/lib/imageSize.js` (BMP, GIF, JPEG, KTX, PNG, PSD, SVG, TIFF, WebP — no ICNS/JXL/HEIF). | `@expo/cli` (`expo start`, `expo export`, EAS builds) — the only Metro this project executes |
| **Bare React Native CLI path** — `node_modules/@react-native/metro-config/node_modules/metro` | `metro@0.87.0` | **Yes** — `"image-size": "^1.0.2"`, called from `src/Assets.js` | `@react-native/community-cli-plugin` (`react-native start` / `react-native bundle`) — **not used by this project's workflow** |

### Exploitation scenario (for the record)
A crafted `.icns` (entry length 0) or `.jxl`/`.heif` (box size 0) file processed by **Metro 0.87 reading assets** would hang the bundler process (DoS of the build machine). This requires (i) the malicious asset to be committed to this repository (write access or a merged PR — CODEOWNERS review) and (ii) bundling through the bare RN CLI. No remote vector against end users exists.

### Why no patch / what would resolve it
- No `image-size` release fixes the issue; the upstream project appears unmaintained (last release 2025-04-02).
- Resolution comes from consumers: a `@react-native/metro-config` that depends on a Metro without `image-size` (as the Expo-used 0.84.5 already is), or a patched `image-size`. `metro@latest` in the registry still declares `^1.0.2`.

### Mitigations considered and rejected (by human decision)
`pnpm.overrides` on Metro or `image-size`, forking/patching `image-size`, `patch-package`, manual Metro edits, forced removal of the transitive dependency, changing React Native / Expo SDK, asset blacklists without proven need — all rejected: they would touch Expo-managed packages (D-44) or add fragile tooling to protect a code path the project does not execute.

### Invalidation conditions (exception becomes invalid automatically if ANY occurs)
1. `image-size` publishes a patched version (advisory gains `first_patched_version`).
2. The dependency chain disappears (nothing installed depends on `image-size`) → remove the exception.
3. `@expo/cli` resolves/imports a Metro that declares or uses `image-size`.
4. The project starts running `react-native start`, `react-native bundle` or an equivalent bare CLI command.
5. Assets with extensions `.icns`, `.jxl`, `.heif`, `.heic` appear in the repository.
6. The build architecture changes (bundler, monorepo layout, package manager import method).
7. Expiry (2026-11-30) passes without re-validation.
8. The advisory changes materially (new vectors, severity, affected versions).
9. An exploitable vector appears in the project's normal workflow.

Conditions 2–5 and 7 are checked mechanically by `scripts/check-security-exceptions.mjs`; 1, 6, 8, 9 are checked at re-validation and at every Expo/RN upgrade.

### Re-validation procedure
Run `pnpm check:security-exceptions`; re-read both advisories; confirm the topology table above; either extend the expiry (new human decision recorded here and in `audit-exceptions.json`) or remove the exception and the GHSA from `package.json#pnpm.auditConfig.ignoreGhsas`.

---

## Findings without exception
`uuid@7.0.3` — GHSA-w5hq-g745-h8pq (moderate; missing buffer bounds check in v3/v5/v6). Below the CI threshold; transitive dev tooling; tracked by the regular audit. **No exception created.**
