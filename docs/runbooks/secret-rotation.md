# Runbook — Secret rotation

Trigger: a secret was committed, logged, pasted into a chat/MCP, or is suspected leaked (THREAT-MODEL T05/T06).

## 0. Contain (minutes)
1. Do **not** try to "hide" it with a force push first — assume it is already copied. Rotate first.
2. Identify the secret class: Supabase anon key (public by design — no rotation needed unless paired with a broken RLS), Supabase `service_role`, Supabase access token (CLI/CI), DB password, billing webhook secret, provider API keys, Apple/Google OAuth secrets, EAS/Expo tokens, GitHub tokens.

## 1. Rotate
| Secret | Where to rotate | Then update |
|---|---|---|
| Supabase `service_role` / `anon` (JWT secret) | Supabase Dashboard → Project Settings → API → *Generate new JWT secret* (rotates both) | Edge Function secrets (auto), CI environment secrets, `EXPO_PUBLIC_SUPABASE_ANON_KEY` in EAS env → new app build/OTA |
| Supabase access token | Supabase Dashboard → Account → Access Tokens → revoke + create | GitHub Actions `SUPABASE_ACCESS_TOKEN` (staging/prod environments) |
| DB password | Dashboard → Database → Reset password | GitHub Actions `SUPABASE_DB_PASSWORD`; local `.env.local` |
| Billing webhook secret | Provider dashboard | `supabase secrets set BILLING_WEBHOOK_SECRET=...` (dev/staging/prod separately) |
| OAuth client secrets (Apple/Google) | Apple Developer / Google Cloud console | Supabase Auth provider settings |
| EAS / Expo token | expo.dev → Access tokens | GitHub Actions secret |
| GitHub PAT | github.com → Settings → Developer settings | wherever used; prefer GitHub App / OIDC |

## 2. Purge from history (only after rotation)
- If the secret is in git history: rewrite with `git filter-repo`, force-push **with explicit human approval** (CLAUDE.md §4), and ask collaborators to re-clone. Record the incident.
- Add the pattern to `.gitleaks.toml` only if it is a false positive; never allowlist a real secret.

## 3. Verify
- `gitleaks detect --source . --redact` locally; CI green.
- Check Supabase logs for use of the old credential after rotation window.

## 4. Record
- `docs/runbooks/incident.md` template → incident note (date, secret class, exposure window, actions). No secret values in the note.
