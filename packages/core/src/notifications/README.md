# notifications (bounded context)

Implementado na **SPEC-008** (Notifications, canal local). Ver `docs/architecture/DOMAIN-MAP.md` §3.7
e `docs/adr/ADR-009-notification-architecture.md`.

Responsabilidade: decidir **o quê** e **quando** lembrar. Como entregar é adapter (D-22).

## Layout

- `domain/intent.ts` — `NotificationIntent`, `NotificationPreferences`, o catálogo de textos e
  `buildNotificationIntents`.
- `application/ports.ts` — `NotificationPreferencesPort`, `NotificationSchedulerPort`.
- `index.ts` — superfície pública.

## Invariantes

- **Puro e sem relógio.** `today` e `nowLocalTime` são entrada (ADR-008). É isso que torna "não
  agendar no passado" uma regra testável em vez de um acidente de runtime.
- **Opt-in duplo:** preferência ligada **e** permissão do SO. Faltando qualquer uma, o conjunto de
  intents é vazio.
- **Nunca lembra do que já foi resolvido:** só cuidado `planned`/`overdue` gera intent. Um lembrete
  sobre algo que ela já fez destrói a confiança no app inteiro.
- **Volume:** no máximo `MAX_NOTIFICATIONS_PER_DAY = 2` por dia, descartando por prioridade
  `care_overdue` > `care_today` > `checkin_pending`. Horizonte de 14 dias — no máximo 28 pendentes,
  contra o limite de 64 do iOS.
- **Sem PII:** o texto vem de um catálogo fixo parametrizado **só por contagem** — nunca o tipo de
  cuidado, nome ou nota. Notificação aparece na tela de bloqueio, onde qualquer um vê.
- **Determinismo:** `id = tipo:data`. O mesmo estado produz sempre o mesmo conjunto, então
  reconciliar é idempotente e reabrir o app nunca duplica nada.
- **O domínio não conhece `expo-notifications`** (D-22). Só o `LocalNotificationAdapter` conhece.
- **Notificação não muda estado:** nunca completa, pula ou reagenda. D-28 continua valendo.
