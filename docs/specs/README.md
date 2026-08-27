# SPEC System — Spec-Driven Development

Nenhuma feature significativa é implementada a partir de uma mensagem informal. O fluxo é:

```
Idea → Requirement → (ADR se decisão arquitetural) → SPEC → Implementation Plan → Implementation → Tests → Smoke Test → Review → Done
```

## Convenção
- Arquivo: `docs/specs/SPEC-NNN-slug.md` (template: [SPEC-TEMPLATE.md](SPEC-TEMPLATE.md)).
- Status: `Draft` → `In Review` → `Approved` → `In Progress` → `Implemented` → `Superseded`/`Rejected`.
- Uma SPEC = uma unidade implementável em ≤ ~2 semanas. Se maior, dividir (`SPEC-004a`, `SPEC-004b` ou novas).
- SPEC referencia ADRs; ADR não referencia SPEC específica.
- Alteração de comportamento após `Approved` = seção **Change Log** na SPEC + nova revisão; se muda o "o quê", nova SPEC.

## Definition of Ready (antes de `Approved`)
- [ ] Objetivo, escopo e non-goals claros
- [ ] Regras de negócio enumeradas (com IDs `BR-n`)
- [ ] Acceptance criteria verificáveis (`AC-n`)
- [ ] Segurança avaliada (checklist do SECURITY-BASELINE §13)
- [ ] Impacto em dados / RLS avaliado
- [ ] Analytics events definidos (ou "nenhum")
- [ ] Dependências identificadas
- [ ] Owner humano definido

## Definition of Done (antes de `Implemented`)
- [ ] Todos os AC atendidos
- [ ] Unit + integration (+ RLS quando aplicável) passando
- [ ] `typecheck`, `lint`, `dep-cruise` passando
- [ ] Autorização validada server-side
- [ ] Edge cases da SPEC revisados
- [ ] Analytics implementados conforme catálogo
- [ ] Docs atualizadas (DATA-MODEL, DOMAIN-MAP, README do contexto)
- [ ] Sem segredos; diff revisado por humano
- [ ] Smoke test manual executado e registrado no PR

## Índice de SPECs planejadas (numeração reservada; arquivos criados quando a fase chegar)

| ID | Título | Contexto | Fase | Status |
|---|---|---|---|---|
| [SPEC-000](SPEC-000-engineering-foundation.md) | Engineering Foundation (skeleton, CI, lint boundaries, time lib, error types, Supabase local, skills, spike) | — | 0 | **IMPLEMENTED — merged em `main` (PR #1, 2026-08-26); AC12 deferred (D-50)** |
| [SPEC-001](SPEC-001-identity-authentication.md) | Identity & Authentication (Apple, Google, Email OTP, sessão segura, linking, RLS, contrato mínimo de exclusão; `profiles` deferido para SPEC-002) | Identity & Account | 1 | **IMPLEMENTED — merged em `main` (PR #3, 2026-08-27); required CI verde; AC2/AC5/AC13 deferred (provider-managed/E2E), ver SPEC §25b** |
| [SPEC-002](SPEC-002-hair-profile-onboarding.md) | Hair Profile & Onboarding | Hair Profile | 2 | **Draft (2026-08-27) — aguarda revisão humana** |
| SPEC-003 | Diagnostic Engine v1 | Diagnostic | 3 | Reservado |
| SPEC-004 | Schedule Engine v1 + generate-plan | Schedule | 4 | Reservado |
| SPEC-005 | Care Tracking: Today, Calendar, Execution, Reschedule/Skip | Care Tracking | 5 | Reservado |
| SPEC-006 | Check-ins | Care Tracking | 6 | Reservado |
| SPEC-007 | Content v1 (seed + tela contextual) | Content | 5 | Reservado |
| SPEC-008 | Notifications (local) | Notifications | 7 | Reservado |
| SPEC-009 | Progress v1 | Progress | 8 | Reservado |
| SPEC-010 | Subscription & Entitlements | Subscription | 9 | Reservado |
| SPEC-011 | Analytics provider & consent | Analytics | 10 | Reservado |
| SPEC-012 | Observability (crash, logs) | — | 10 | Reservado |
| SPEC-013 | Release readiness (stores, privacy labels, LGPD) | — | 10 | Reservado |
| SPEC-014 | Reassessment (novo diagnóstico → novo plano) | Diagnostic/Schedule | 8 | Reservado |
