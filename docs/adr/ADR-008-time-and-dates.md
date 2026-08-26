# ADR-008 — Time, Dates & Timezones

**Status:** **Accepted** (D-05, 2026-08-26) · **Data:** 2026-08-26

## Context
O produto é essencialmente temporal: "hoje", "atrasado", "próximo", lembretes, streaks. O Brasil tem múltiplos fusos e já teve DST; usuárias viajam; dispositivos têm relógio errado. `new Date()` espalhado gera bugs invisíveis.

## Decision

### Conceitos
| Conceito | Tipo | Onde |
|---|---|---|
| **Instante** (algo aconteceu) | `timestamptz` (UTC) / ISO-8601 string com offset | `executed_at`, `created_at`, webhooks |
| **Dia da usuária** (calendário) | `date` (YYYY-MM-DD, sem tz) | `planned_date`, `executed_on`, `starts_on` |
| **Hora local de preferência** | `time` | `reminder_time_local` |
| **Timezone** | IANA string (`America/Sao_Paulo`) | `profiles.timezone`; snapshot em `hair_plans.timezone` |

### Regras
1. **"Hoje" é o dia local da usuária** = `toLocalDate(now, profile.timezone)`. Nunca o dia UTC, nunca o dia do dispositivo sem tz explícita.
2. `packages/core/src/shared/time/` fornece: `LocalDate` (VO string validada), `toLocalDate(instant, tz)`, `addDays`, `diffDays`, `Clock` port (`now(): Instant`). **`new Date()` é proibido fora do adapter `SystemClock`** (lint rule `no-restricted-syntax`).
3. Engines recebem `referenceDate: LocalDate` como input; nunca chamam o clock.
4. O servidor calcula `executed_on` a partir de `executed_at` + tz do perfil; aceita `client_local_date` apenas para detectar divergência (> 1 dia ⇒ rejeita ou usa a do servidor e loga).
5. **Mudança de timezone** (viagem / edição de perfil): não altera `planned_date` já geradas (são dias de calendário). Apenas afeta a conversão de "hoje" e o agendamento de notificações (recalculadas localmente ao detectar mudança de tz do dispositivo ≠ perfil → perguntar à usuária se quer atualizar).
6. **Atrasado** = `planned_date < today_local AND status = 'planned'`. Calculado em query/engine, nunca armazenado.
7. **Reagendamento** cria nova `scheduled_care` (ver DATA-MODEL). Não há "mover" a mesma linha.
8. **Notificações**: agendadas em hora local da usuária (`reminder_time_local`) no dia planejado; o adapter local converte para o instante do SO usando a tz do dispositivo; DST é tratado pelo SO. Servidor (futuro push) usa `profiles.timezone`.
9. **Streaks** (se aprovados): contados em dias locais; um dia sem cuidado planejado não quebra o streak (regra no core, testada).
10. Biblioteca: `date-fns` + `date-fns-tz` **ou** `Temporal` polyfill — decidir na Foundation por tamanho de bundle; nunca `moment`. Nenhuma lógica de tz manual.
11. Testes de engine e de "hoje" usam relógio fixo e incluem casos: virada de dia, DST, tz negativa/positiva, viagem.

## Alternatives Considered
- Tudo em UTC inclusive dias: quebra "hoje" perto da meia-noite.
- Tz do dispositivo como verdade: muda ao viajar e é manipulável (T22).
- Armazenar "atrasado" como status: inconsistência garantida quando o dia vira.

## Trade-offs
+ Modelo explícito, testável.
− Dois tipos de data circulando (Instant vs LocalDate) exige tipos nominais no TS para não misturar — implementado no core.

## Consequences
`packages/core/src/shared/time` é parte da Foundation (com testes). SPECs de Schedule, Care Tracking e Notifications referenciam este ADR.

## Security Impact
Mitiga T22. Servidor é a autoridade sobre `executed_on`.

## Reversibility
Alta na biblioteca; baixa nas regras conceituais (deliberado).
