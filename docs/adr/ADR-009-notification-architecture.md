# ADR-009 — Notification Architecture

**Status:** **Accepted** (D-07 forma; D-22 canal local, 2026-08-26) · **Data:** 2026-08-26

> **Registro D-22:** nomenclatura oficial das camadas: `NotificationIntent` (domínio, puro) → `NotificationScheduler` (application: reconcilia intents com o que está agendado, via port) → `NotificationAdapter` (infrastructure; primeira implementação `LocalNotificationAdapter` sobre `expo-notifications`). O domínio **não conhece** Expo Notifications. Push remoto fora do MVP; adicionável como `PushNotificationAdapter` sem alteração de domínio. Os termos "Channel/Delivery" abaixo correspondem a Adapter/registro de entrega.

## Context
Lembretes são a alavanca da hipótese H3. Push remoto exige servidor de agendamento, tokens de device, provedores (APNs/FCM via Expo Push) e mais superfície. Notificações locais cobrem os casos do MVP.

## Decision
Separação em três conceitos no core:

```
NotificationIntent   (o quê / quando, em dia+hora local)  — regra de produto, puro
      ↓
NotificationChannel  (local | push | email)               — port
      ↓
NotificationDelivery (registro do agendado/enviado)       — infra
```

- **Intents (MVP):** `care_today`, `care_overdue`, `checkin_pending`, `reassessment_due`, `habit_recovery`. Gerados por `computeIntents(plan, executions, prefs, referenceDate)` em `core/notifications` (puro, testado).
- **Política central:** opt-in obrigatório; máximo `max_per_day` (default 2); janela silenciosa; sem notificação se cuidado já executado; cancelar intents obsoletos ao regenerar plano.
- **Canal MVP: local** (`expo-notifications`), agendado no dispositivo para os próximos N dias (ex. 14) a cada abertura do app / mudança de plano. Reconciliação: cancela tudo do app e reagenda a partir dos intents (idempotente por `intent_id` determinístico = hash de tipo+data+care_id).
- **Push remoto:** adiado. Quando necessário (`habit_recovery` após dias sem abrir, campanhas), adicionar canal `push` com Expo Push + tabela `device_tokens` + `notification_deliveries` sem alterar intents.
- Textos de notificação vêm do core (catálogo por intent) — sem PII (nunca nome do produto/nota da usuária).
- Deep link de cada notificação aponta para rota validada (`/today`, `/checkin/[executionId]`).

## Alternatives Considered
- Push desde o início (OneSignal/Expo Push + cron): mais capacidade de reengajamento, mas mais infra, tokens e PII; não necessário para validar H3.
- Notificações agendadas no servidor apenas: exige push; sem valor extra no MVP.

## Trade-offs
+ Zero backend de notificações; funciona offline.
− Se a usuária não abrir o app por > N dias, não há novos lembretes além dos agendados (mitigado com `habit_recovery` local agendado para D+3/D+7 na última abertura).
− Limites do SO para quantidade de notificações locais (iOS 64 pendentes) — respeitado pela janela de 14 dias × ≤ 2/dia.

## Consequences
SPEC de Notifications define intents, textos, testes e reconciliação. Tabela `notification_preferences` no DATA-MODEL; `notification_deliveries` só com push.

## Security Impact
Baixo. Deep links validados (T10). Sem tokens de push no MVP (menos PII).

## Reversibility
Alta: canal é um port.
