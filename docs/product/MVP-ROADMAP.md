# MVP ROADMAP

> ✅ **Estado real (2026-08-31).** As fases **0 a 9 estão implementadas e mergeadas**, e a
> **SPEC-016 (Beta Experience)** está nas fatias finais. Este documento continua valendo como o
> **grafo de dependências do MVP** — que foi respeitado — mas não é mais a fonte do que o produto
> vai ter.
>
> 📌 **O escopo do produto vive em [`MASTER-PRODUCT-BACKLOG.md`](MASTER-PRODUCT-BACKLOG.md)** (D-92,
> decisão humana): 55 capabilities COMMITTED, cada uma com estado, e a ordem é decidida pelo agente
> (CLAUDE.md §0.4). Duas restrições de sequenciamento são do dono e não do agente: o **Assistente IA
> é obrigatoriamente a última** grande capability (e até lá é proibida infraestrutura antecipada de
> IA), e **Community fica `DEFERRED BY DEPENDENCY`** sem sair do roadmap.
>
> ⛔ **O que ainda bloqueia o beta/release** são gates humanos, não engenharia: Auth real
> (D-86) · sign-off de domínio capilar para as regras V1 e o conteúdo dos guias (D-26/OQ-REL) ·
> base legal LGPD e a tabela `consents`, que não existe (D-32) · purchase flow / IAP (D-79).

| Campo | Valor |
|---|---|
| Status | Fases 0–9 **entregues**; SPEC-016 em fatias finais. Escopo do produto: `MASTER-PRODUCT-BACKLOG.md` (D-92) |
| Princípio | Cada fase entrega algo testável end-to-end; nenhuma fase começa sem SPEC aprovada |
| DONE | **Não basta CI verde** quando há DEV real: a jornada afetada é executada e observada de ponta a ponta (CLAUDE.md §0.1, D-90) |


## 1. Grafo de dependências

```mermaid
flowchart LR
    F0[0 Foundation] --> F1[1 Identity & Account]
    F0 --> F3[3 Diagnostic Engine v1<br/>core puro — pode começar em paralelo]
    F0 --> F4c[4a Schedule Engine v1<br/>core puro]
    F1 --> F2[2 Hair Profile + Onboarding]
    F2 --> F3
    F3 --> F4[4b generate-plan + persistência]
    F4c --> F4
    F4 --> F5[5 Care Tracking: Today · Calendar · Execute · Reschedule + Content v1]
    F5 --> F6[6 Check-ins]
    F5 --> F7[7 Notifications local]
    F6 --> F8[8 Progress v1 + Reassessment]
    F8 --> F9[9 Subscription & Entitlements]
    F7 --> F10[10 Release: analytics · observability · stores · LGPD]
    F9 --> F10
```

Racional da ordem:
- **Engines antes de UI** (fases 3/4a): são puros, testáveis sem app, e são o maior risco de produto (regras capilares). Podem ser desenvolvidos em paralelo com Identity/Onboarding.
- **Check-ins depois de Execution**: dependem de `care_executions`.
- **Notifications depois de Care Tracking**: intents precisam de plano e execuções.
- **Subscription por último antes do release**: valor primeiro (P01); entitlements já existem como stub free desde a Foundation.
- **Analytics provider no fim, catálogo desde o início**: eventos são emitidos para adapter no-op desde a fase 1; provider entra na fase 10 com consentimento.

## 2. Fases

### Fase 0 — Foundation (SPEC-000) · ~1 semana
Skeleton `apps/mobile` (vazio, sem telas de produto) + `packages/core` (shared: errors, time, result; contextos vazios com README) · pnpm workspaces · TS strict · ESLint boundaries + dependency-cruiser · Vitest/Jest · Supabase local + migration `0000_foundation` (extensões, `set_updated_at` — `is_admin`/`has_entitlement` movidos para SPEC-001/010, ver SPEC-000 §8) · pgTAP + checks de RLS em CI · GitHub Actions · branch protection · CODEOWNERS · `.claude/skills` (5) · runbooks base · spike: Edge Function importando `packages/core`.
**Saída:** CI verde num repo sem produto; regra de dependência verificável.
**Status (2026-08-26): IMPLEMENTADA — ready for merge** (PR #1; `ci`, `core-deno`, `supabase-test` verdes; AC12 deferred, D-50). Próxima fase permitida: 1 — Identity (SPEC-001, ainda não autorizada).

### Fase 1 — Identity & Account (SPEC-001) · ~1–2 semanas
Auth (Apple, Google, email) · sessão segura · `profiles` + trigger · timezone/locale · consentimentos · exclusão de conta (RPC + purga) · testes RLS.
**Saída:** usuária cria conta, entra, sai, exclui.

### Fase 2 — Hair Profile + Onboarding (SPEC-002) · ~1–2 semanas
Perguntas (≤ 8) · `hair_profiles` versionado · validação zod + CHECK · tela de onboarding com estados · evento `onboarding_*`.
**Saída:** perfil salvo; "preview" ainda não.

### Fase 3 — Diagnostic/Assessment Engine v1 (**folded into SPEC-004** — D-66/ADR-007 A2) · (sem entrega isolada)
Regras v1 com especialista capilar · `runDiagnostic`/assessment puro · reason codes · golden tests · contratos. **A entrega MVP acontece na vertical slice da Fase 4/SPEC-004** (o resultado da avaliação tem um único consumidor, o Schedule). O módulo `packages/core/src/diagnostic/` permanece separado.
**Saída:** absorvida pela Fase 4.

### Fase 4 — Schedule Engine v1 + generate-plan (SPEC-004) · ~2 semanas
4a: `generateSchedule` puro (ciclo H/N/R por necessidade, frequência de lavagem, janela 8 semanas, referenceDate injetado, golden tests).
4b: Edge Function `generate-plan` + RPC `create_plan_tx` + tabelas `diagnostic_results`, `hair_plans`, `scheduled_cares` + RLS + rate limit + preview no cliente + tela "Este é o seu cronograma".
**Saída:** H1 mensurável (onboarding → plano).

### Fase 5 — Care Tracking + Content v1 (SPEC-005, SPEC-007) · ~2 semanas — **CONCLUÍDA (2026-08-28)**
Tela Hoje · calendário (planejado vs executado) · `complete_care` idempotente · reagendar/pular · desfazer · conteúdo contextual por care_type (seed) · eventos.
**Saída:** loop diário completo; H2 mensurável. **Entregue:** SPEC-005 (PR #14) — Hoje/atrasado/próximos/histórico, concluir/pular/reagendar/desfazer; SPEC-007 (PR #19) — "Como fazer" por care type. **Calendário mensal e execução avulsa continuam adiados** (sem consumidor). Próximas fatias disponíveis: F6 (SPEC-006 Check-ins) e F7 (SPEC-008 Notifications) — o grafo §1 mostra as duas dependendo só de F5.

### Fase 6 — Check-ins (SPEC-006) · ~1 semana — **CONCLUÍDA (2026-08-28)**
`submit_checkin` · UI de 3–4 toques · evento.
**Saída:** H4 mensurável. **Entregue:** SPEC-006 (PR #21) — uma pergunta ("Como ficou?", 1..5) ancorada na execução efetiva, idempotente, append-only, com retorno imediato na Hoje. **Adiado:** as outras 4 dimensões e a nota livre (necessity review D-73 — entram na SPEC-009 como colunas anuláveis, sem migração de dados). Próxima fatia disponível: F7 (SPEC-008 Notifications) — **exige aprovação humana da dependência `expo-notifications`** (CLAUDE.md §4).

### Fase 7 — Notifications (SPEC-008) · ~1 semana — **CONCLUÍDA (2026-08-28)**
Intents puros · preferências · permissão · canal local · reconciliação · deep links validados.
**Saída:** H3 mensurável (ON vs OFF). **Entregue:** SPEC-008 (PR #24) — canal local, opt-in duplo, 3 intents puros (`care_today`, `care_overdue`, `checkin_pending`), ≤2/dia, horizonte de 14 dias, reconciliação idempotente, texto sem PII. **Adiado:** `reassessment_due` (depende da SPEC-014), `habit_recovery` (sem dado que justifique), push remoto, deep link parametrizado. **Próxima fatia: F8 — SPEC-009 (Progress) + SPEC-014 (Reassessment)**, agora com check-ins e execuções acumulando dados.

### Fase 8 — Progress v1 + Reassessment (SPEC-009, SPEC-014) · ~1–2 semanas — **CONCLUÍDA (2026-08-28)**
Adesão, histórico, streak (se aprovado) · reavaliar → novo diagnóstico → novo plano (supersede).
**Saída:** loop mensal. **Entregue:** SPEC-009 (PR #26) — resumo do plano com três fatos derivados (concluídos/decididos, pulados, avaliação auto-relatada), **zero persistência**, sem score, porcentagem, tendência, gráfico ou streak (D-25). **Entregue:** SPEC-014 (PR #28) — reavaliar a partir da conta, reusando onboarding e preview; supersede só na confirmação; total vitalício preserva o histórico (resolve SPEC-009 OQ-2). **Nenhuma regra capilar nova** — os engines V1 são invocados, não alterados, então o gate de PUBLIC RELEASE não se moveu. **Ainda fora:** intent `reassessment_due` (agora possível; precisa da regra de "quando lembrar") e navegar planos passados. **Próximas fases: 9 (Subscription) e 10 (Release) — ambas exigem gate humano** (provider de billing/analytics = custo real e credencial externa; base legal LGPD, D-32).

### Fase 9 — Subscription & Entitlements (SPEC-010, SPEC-015) · ~2 semanas — **FECHADA menos o purchase flow (2026-08-31)**
Provider (RevenueCat candidato) · webhook · `subscriptions` · `has_entitlement` · paywall · 1–2 features premium (insights avançados, customização) · sandbox testing.
**Saída:** H5 mensurável. **Entregue:** SPEC-010 Parte 1 (#35/#36/#37) — `subscriptions`, `billing_events`, `apply_billing_event`, `has_entitlement`/`get_my_entitlements`, Edge `billing-webhook` (HMAC+zod, sem deploy); SPEC-010 Parte 2 provider-agnóstica (#39) — leitura de entitlements + status na conta; **SPEC-015** (#42/#43/#44, D-81) — a **primeira capacidade premium**: dias da semana preferidos, por uma **camada de placement pura fora do engine**, gated no servidor, com `plan_preferences` + RLS. **Nenhuma regra capilar nova** — o engine V1 não mudou um byte, então o gate de PUBLIC RELEASE não se moveu.
**DEFERRED com dono claro:** adapter nativo RevenueCat (`react-native-purchases`, exige development build — constraint do dono) e IAP real (conta RevenueCat + produtos em App Store Connect / Google Play = **credencial**). Sem isso ninguém consegue *virar* premium, então **H5 não é mensurável ainda** — mas toda a cadeia atrás do gate está construída e testada.
**Também entregue fora de fase (D-82):** o fim do ciclo de 4 semanas deixou de ser beco sem saída — a Hoje oferece a reavaliação e o intent `reassessment_due` avisa no dia seguinte ao último dia do plano.
**Próxima fase: 10 (Release) — densa em gates humanos** (provider de analytics = custo real; base legal LGPD = revisão jurídica; contas de loja = credencial; sign-off capilar D-26 = validação profissional externa).

### Fase 10 — Release (SPEC-011, 012, 013) · ~1–2 semanas
Analytics provider + consentimento · crash reporting · privacy labels · política de privacidade · store listings · E2E Maestro da jornada crítica · beta (TestFlight / internal testing) · lançamento.

**Total estimado: ~14–18 semanas** com 1 dev + agente, sem contar validação com especialista capilar e design.

## 3. Pós-MVP (roadmap, sem compromisso)
Push remoto · exportação de dados (UI) · share cards / referral / deep links (Growth) · admin web (`apps/admin`) · regras configuráveis via admin · "o que tenho em casa" (produtos) · fotos e análise · AI assistant · creators/afiliados · comunidade · B2B/salões.

## 4. Marcos de decisão (checkpoints humanos)
- ✅ Aprovação da fundação (este pacote).
- Após F4: revisar regras dos engines com especialista. **Re-escopado por D-67/D-68 (2026-08-27):** as regras V1 são `candidate` — dev/internal beta liberados, então este checkpoint **não bloqueia F5**. O sign-off de domínio (`candidate → validated`) permanece **obrigatório antes do PUBLIC RELEASE** (D-26 / ADR-007 A1 / SPEC-004 OQ-REL).
- Após F7: decidir streaks (gamificação) com base em dados qualitativos.
- Antes de F9: decidir provider de billing e preços.
- Antes de F10: revisão jurídica LGPD (base legal para analytics).
