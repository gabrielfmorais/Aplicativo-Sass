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
| [SPEC-002](SPEC-002-hair-profile-onboarding.md) | Hair Profile & Onboarding | Hair Profile | 2 | **IMPLEMENTED — merged em `main` (PR #6, 2026-08-27); required CI verde (pgTAP incl.)** |
| [SPEC-003](SPEC-003-diagnostic-engine-v1.md) | Diagnostic Engine v1 | Diagnostic | 3 | **FOLDED INTO SPEC-004 (D-66, 2026-08-27; ADR-007 A2) — não implementada; fronteira de domínio preservada** |
| [SPEC-004](SPEC-004-schedule-engine-generate-plan.md) | Schedule Engine v1 + generate-plan (inclui Assessment — D-66) | Schedule | 4 | **IMPLEMENTED (v0.6, 2026-08-27; aprovada por D-68) — engines v1 + generate-plan + RLS/pgTAP; PUBLIC RELEASE exige regras `validated` (D-26/OQ-REL)** |
| [SPEC-005](SPEC-005-care-tracking-today.md) | Care Tracking: Hoje, próximos cuidados e transições (concluir/pular/reagendar) | Care Tracking | 5 | **IMPLEMENTED (v0.3, 2026-08-27; aprovada por D-69) — Hoje/atrasado/próximos + concluir, pular, reagendar, desfazer (15 min); RLS/pgTAP verdes** |
| [SPEC-006](SPEC-006-checkins.md) | Check-ins: como ficou o cabelo depois do cuidado | Care Tracking | 6 | **IMPLEMENTED** (v0.2, 2026-08-28; aprovada por D-73) — uma pergunta 1..5 ancorada na execução; RLS/pgTAP verdes |
| [SPEC-007](SPEC-007-content-v1-care-guides.md) | Content v1: como fazer cada cuidado (guias por care type na tela Hoje) | Content | 5 | **IMPLEMENTED** (v0.3, 2026-08-28; aprovada por D-72) — guias `candidate` por care type na tela Hoje; sem tabela (D-71); PUBLIC RELEASE exige conteúdo `validated` (D-26/OQ-REL) |
| [SPEC-008](SPEC-008-notifications.md) | Notifications: lembrar na hora certa (canal local) | Notifications | 7 | **IMPLEMENTED** (v0.2, 2026-08-28; aprovada por D-74) — 3 intents puros, opt-in duplo, ≤2/dia, 14 dias; RLS/pgTAP verdes |
| [SPEC-009](SPEC-009-progress-v1.md) | Progress v1: o que ela já fez, sem inventar nada | Progress | 8 | **IMPLEMENTED** (v0.2, 2026-08-28; aprovada por D-76) — 3 fatos derivados, zero persistência, sem score/tendência |
| [SPEC-010](SPEC-010-subscription-entitlements.md) | Subscription & Entitlements | Subscription | 9 | **IMPLEMENTED — Parte 1** (D-78): PR-A core (#35), PR-B banco (#36), PR-C Edge (#37) merged 2026-08-30. **Parte 2 IMPLEMENTADA (parte provider-agnóstica)** (D-79): PR-D leitura de entitlements + status na conta (#39); o gate `has_entitlement('plan_customization')` é consumido pela SPEC-015. **DEFERRED:** adapter nativo RevenueCat + IAP real (development build + conta/produtos = credencial). Requer label `security` |
| SPEC-011 | Analytics provider & consent | Analytics | 10 | Reservado |
| SPEC-012 | Observability (crash, logs) | — | 10 | Reservado |
| SPEC-013 | Release readiness (stores, privacy labels, LGPD) | — | 10 | Reservado |
| [SPEC-014](SPEC-014-reassessment.md) | Reavaliação: o cabelo mudou, o cronograma acompanha | Diagnostic/Schedule | 8 | **IMPLEMENTED** (v0.2, 2026-08-28; aprovada por D-77) — reusa onboarding + preview; supersede só na confirmação; total vitalício preserva o histórico |
| [SPEC-015](SPEC-015-plan-customization.md) | Plan Customization (primeira capacidade premium) | Schedule/Planning (gated por Subscription) | 9 | **IMPLEMENTED** (v0.2, 2026-08-31; aprovada por D-81) — dias da semana preferidos por **camada de placement pura fora do engine** (ADR-007 e o gate D-26 intactos), gated server-side na `generate-plan`; **nada da customização vem do request**. PR-1 #42 · PR-2 #43 · PR-3 #44. Requer label `security` |
| [SPEC-016](SPEC-016-beta-experience.md) | Beta Experience: identidade visual, design system e refinamento da jornada | — (transversal de apresentação) | entre 9 e 10 | **IMPLEMENTADA** (2026-08-31; D-88/D-89/D-93) — as cinco fatias entregues e validadas no DEV real: tokens + primitivas, onboarding em etapas, Hoje com cartão de foco e week strip, preview por semana, Conta rolável e premium como adição, passada de consistência + `improve --full`. Não tocou regra, schema nem autorização |
| [SPEC-017](SPEC-017-plan-rationale.md) | "Por que isso está no meu plano?" — a avaliação que originou o cronograma, na tela Hoje | Diagnostic / Assessment (exposto em Care Tracking) | pós-beta-experience | **Draft** (v0.1, 2026-08-31) — capability F21 do MASTER PRODUCT BACKLOG (D-92). **OQ1 é BLOCKING:** decide se a SPEC toca `packages/core` ou o schema. Aguarda aprovação humana |
| [SPEC-018](SPEC-018-huna-first-experience.md) | Huna: a primeira experiência — abertura, login, nome, ritmo do onboarding, criação e revelação | — (transversal de apresentação) | prioridade de produto | **IMPLEMENTED** (v0.4, 2026-09-01) — quatro fatias entregues (#69, #70/#71, #72, #73), todas validadas a 390px no DEV real. OQ1 em aberto: o **asset autoral de cabelo** que substitui o hero abstrato (decisão do dono) |
| [SPEC-019](SPEC-019-cycle-view.md) | Visão de ciclo: as quatro semanas dela, depois de começarem | Care Tracking (calendar projection) | MASTER PRODUCT BACKLOG — F20 | **IMPLEMENTED** (v0.2, 2026-09-01) — fecha o F20. Sem SQL, sem contrato, sem dependência; `groupIntoWeeks` migrou do app para o core. Validada a 390px no DEV real |
| [SPEC-020](SPEC-020-hair-events.md) | "Meu cabelo mudou": o app fica sabendo | Hair Profile | MASTER PRODUCT BACKLOG — F23 | **DONE** (v0.3, 2026-09-01) — o Free **registra e oferece reavaliar**; não interpreta, não aconselha e não diagnostica, que é o que mantém a capability fora do gate D-26. Tabela + 2 RPCs `SECURITY DEFINER`, 17 asserções pgTAP. Jornada completa validada no DEV real a 390px |
| [SPEC-021](SPEC-021-cycle-summary.md) | Resumo de ciclo: o mês contado por ela mesma | Progress (lido na visão de ciclo) | MASTER PRODUCT BACKLOG — F29 | **IMPLEMENTADA** (v0.2, 2026-09-01) — contagens, nunca nota: os números são os do `Progress`, reusados em vez de recontados. Zero banco, zero contrato. Validada a 390px no DEV real |
| [SPEC-022](SPEC-022-schedule-pause.md) | Pausa: parar sem perder nada, e voltar sem culpa | Schedule / Planning | MASTER PRODUCT BACKLOG — F22 | **DONE** (v0.5, 2026-09-01) — OQ2 resolvida pelo dono (D-98). Pausada nada atrasa e nenhum lembrete toca; a volta desloca preservando os intervalos, com o fim do ciclo como limite. 25 asserções pgTAP. Validada no DEV real |
| [SPEC-023](SPEC-023-my-shelf.md) | Minha Prateleira: os produtos que ela já tem | Hair Profile | MASTER PRODUCT BACKLOG — F26, **antes** do F25 | **DONE** (v0.3, 2026-09-01) — o Free registra o que ela possui, do jeito que ela chama. Não é loja, não é catálogo, não interpreta. Tabela sem RPC, 15 asserções pgTAP. Validada no DEV real a 390px |
| [SPEC-024](SPEC-024-wash-day.md) | Wash Day: o que ela realmente fez | Care Tracking | MASTER PRODUCT BACKLOG — F25, F27 | **Implemented** (v0.3, 2026-09-01) — o hub do que ela realmente fez, e **estrutural**: produtos da prateleira dela, catorze técnicas de lista fechada, **zero campo de texto sobre o cuidado**. Hub sem colunas de conteúdo, para `F28`/`F31`/`P21` pendurarem sem mexer nas anteriores. Fecha o `F25` e o `F27`, validados no DEV real a 390px |
