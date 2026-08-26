# ADR-010 — Analytics Architecture

**Status:** **Accepted** (D-08, 2026-08-26; provider adiado D-31) · **Data:** 2026-08-26

## Context
As hipóteses do MVP dependem de eventos confiáveis. Sem estrutura, agentes espalham `track('clicked_button_3')` por componentes, com PII em propriedades.

## Decision
- **Catálogo tipado de eventos** em `packages/core/src/analytics/events.ts`: união discriminada `AnalyticsEvent = { name: 'onboarding_started'; props: {...} } | ...`. Evento fora do catálogo não compila.
- **Port** `AnalyticsPort.track(event)` no application; **um** adapter em `apps/mobile/src/infrastructure/analytics/` (provider decidido em SPEC própria; candidato: PostHog — open source, EU/US hosting, feature flags).
- **Onde chamar:** casos de uso e hooks de feature (não em componentes visuais genéricos). Regra: um evento por resultado de caso de uso, não por clique.
- **Naming:** `snake_case`, `<objeto>_<verbo_no_passado>`: `app_opened` (âncora de retenção D1/D7/D30), `today_viewed` (abriu a tela do dia, com ou sem cuidado), `onboarding_started`, `onboarding_completed`, `diagnostic_started`, `diagnostic_completed`, `schedule_created`, `schedule_regenerated`, `care_viewed`, `care_completed`, `care_skipped`, `care_rescheduled`, `checkin_completed`, `notification_permission_granted`, `notification_opened`, `progress_viewed`, `subscription_viewed`, `trial_started`, `subscription_started`, `subscription_cancelled`, `share_created` (futuro), `account_deleted`.
- **Propriedades permitidas:** ids opacos (uuid), enums do domínio (care_type, algorithm_version), números agregados (adherence_pct), booleanos, plataforma/versão do app. **Proibido:** email, nome, notas livres, respostas textuais, timezone exata (usar offset agrupado se necessário).
- **Identidade:** `distinct_id = user_id` (uuid); sem alias com email. Eventos pré-login usam id anônimo do device e são vinculados no signup (`identify`).
- **Consentimento:** adapter só envia após `consents.analytics` (ou base legal definida — jurídico). Sem consentimento: no-op.
- **Server-side events:** `subscription_started/cancelled` são emitidos pela Edge Function do webhook (fonte de verdade), não pelo app.
- **Versionamento:** adicionar evento = PR com atualização do catálogo + SPEC. Renomear = deprecação com período de sobreposição.

## Alternatives Considered
- Chamar SDK do provider diretamente na UI: rápido, mas sem tipos, sem controle de PII, lock-in.
- Analytics próprio no Postgres: controle total, mas custo de dashboards e volume; pode ser complementar (métricas de adesão já saem das tabelas).

## Trade-offs
+ Compile-time safety, PII sob controle, provider substituível.
− Fricção para adicionar evento (intencional).

## Consequences
Foundation cria o catálogo vazio + port + adapter no-op. Provider real em SPEC de Analytics (fase Release).

## Security Impact
Mitiga T17. Provider recebe apenas ids opacos.

## Reversibility
Alta.
