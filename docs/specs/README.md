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
| [SPEC-000](SPEC-000-engineering-foundation.md) | Engineering Foundation (skeleton, CI, lint boundaries, time lib, error types, Supabase local, skills, spike) | — | 0 | **Draft — aguardando aprovação** |
| SPEC-001 | Identity & Account (auth, profile, exclusão) | Identity | 1 | Reservado |
| SPEC-002 | Hair Profile & Onboarding | Hair Profile | 2 | Reservado |
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
