# Runbook — Security / data incident

## Severity
- **SEV1**: data of other users readable/writable (RLS failure, IDOR), leaked `service_role`, admin compromise.
- **SEV2**: leaked non-privileged secret, abuse of an Edge Function, availability loss.
- **SEV3**: single-user data issue, suspicious but contained.

## First 30 minutes
1. Name an incident owner (human). Open a private incident note (template below). No customer data in the note.
2. Contain:
   - RLS/IDOR: hot-fix policy via emergency migration through the prod workflow (human), or temporarily `REVOKE` the affected grant.
   - Leaked secret: `docs/runbooks/secret-rotation.md`.
   - Abusive traffic: pause the Edge Function (Dashboard) / tighten rate limit; never pause the whole project without owner decision.
   - Compromised session/account: `auth.admin.signOut(user, scope: 'global')` via Dashboard SQL/Admin API; force MFA re-enrol for admins.
3. Preserve evidence: export relevant Supabase logs (`postgres`, `auth`, `edge`) for the window; note request ids.

## Assessment
- Which tables/rows were exposed? Query `audit_log` and Postgres logs.
- Personal data involved? → LGPD assessment (notify DPO/legal; ANPD notification window is decided by legal).
- Root cause: policy, function, client, dependency, human?

## Remediation
- Fix via SPEC/PR with tests that would have caught it (negative RLS test, fixture).
- Update `docs/security/THREAT-MODEL.md` (new/adjusted threat) and, if applicable, an ADR.

## Communication
- Internal timeline; user communication drafted by product/legal if personal data was affected.

## Incident note template
```
Date/UTC:            Owner:            Severity:
Summary (1 line):
Detection:           Exposure window:
Systems/tables:
Users affected (count, no ids):
Containment actions (timestamps):
Root cause:
Follow-ups (PRs/SPECs):
```
