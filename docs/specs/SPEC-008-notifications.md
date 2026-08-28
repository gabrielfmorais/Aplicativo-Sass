# SPEC-008 — Notifications: lembrar na hora certa (canal local)

| Campo | Valor |
| --- | --- |
| ID | SPEC-008 |
| Status | **Implemented** (v0.2, 2026-08-28 — aprovada por **D-74**; dependência `expo-notifications` **aprovada por decisão humana**). Evidência em §25. |
| Owner | @gabrielfmorais (humano) |
| Bounded Context | Notifications (Supporting) — DOMAIN-MAP §3.7 |
| Related ADRs | **ADR-009** (Intent → Scheduler → Adapter; canal local) · ADR-001 (camadas) · ADR-004 (RLS) · ADR-008 (time) |
| Related SPECs | SPEC-004/005 (plano e execuções que geram os intents) · SPEC-006 (check-in pendente) · SPEC-011 (analytics de H3) · SPEC-014 (`reassessment_due`) |
| Decisões vinculantes | **D-07/D-22** (canal local; domínio não conhece Expo) · **D-28** (nunca deslocar o cronograma) · D-47/D-48 (necessidade) · D-65 (analytics DEFER) |
| Decisões desta SPEC | **D-74** (escopo: 3 intents, cap como constante, sem tabela de deliveries) — DECISION-REGISTER **B8** |
| Fase do roadmap | 7 — Notifications |
| Labels | `db`, `security`, `ui`, `deps` |
| Criado / Atualizado | 2026-08-28 / 2026-08-28 |

> **Escopo:** a última peça do ciclo diário — o app lembra a usuária **na hora que ela escolheu**, sem servidor de notificações e sem token de push. Nada de campanhas, reengajamento especulativo ou push remoto.

---

## 1. Context

As SPECs 004–007 entregaram o loop: abrir → saber o que fazer → saber como → executar → dizer como ficou. Falta a condição que faz o loop acontecer: **a usuária precisa lembrar de abrir o app.**

É a hipótese **H3** do PRODUCT-BRIEF: "lembretes e calendário aumentam adesão", medida como adesão com notificação ON vs OFF, meta Δ ≥ 15 p.p. É a única hipótese do MVP que não tem como ser testada sem esta fatia.

## 2. Problem

Um cronograma que depende da usuária lembrar sozinha é um cronograma que ela abandona na segunda semana. Mas notificação é a superfície mais fácil de tornar hostil: notificar demais, na hora errada, ou sobre algo que ela já fez, desinstala o app.

Quatro coisas precisam ser verdade:

1. **Opt-in real.** Nada é agendado antes de ela pedir e o SO permitir.
2. **Nunca lembrar do que já foi feito.** Um lembrete sobre um cuidado já concluído destrói a confiança no app inteiro.
3. **Volume contido.** No máximo 2 por dia, no horário que ela escolheu.
4. **Sem servidor.** Canal local (D-22): funciona offline, sem token de push, sem PII saindo do aparelho.

## 3. Goals

- G1 — A usuária liga os lembretes e escolhe o horário; nada é agendado antes disso.
- G2 — Nos dias com cuidado a fazer, ela recebe **um** lembrete no horário escolhido.
- G3 — Um cuidado **atrasado** é lembrado hoje, sem que o cronograma se mova (D-28).
- G4 — Cuidado já concluído, pulado ou reagendado **nunca** gera lembrete.
- G5 — Reconciliação idempotente: reabrir o app ou mudar o plano nunca duplica notificação.
- G6 — Zero PII no texto e zero dado saindo do aparelho — o texto vem de um catálogo fixo.

## 4. Non-Goals

| Fora | Por quê | Onde volta |
| --- | --- | --- |
| Push remoto, `device_tokens`, `notification_deliveries` | D-22: canal local basta para validar H3; o SO é a fila | quando houver campanha/servidor |
| Intent `reassessment_due` | **Impossível hoje**: não existe reavaliação no produto | SPEC-014 |
| Intent `habit_recovery` (D+3/D+7 sem abrir) | Especulativo: dispara justamente quando ela **não** está usando o app — maior risco de irritação, sem dado que justifique | quando houver dado de retenção (SPEC-011) |
| Coluna `max_per_day` | Regra central sem UI que a altere: é constante no core, não coluna que ninguém escreve | quando a usuária puder mudar o limite |
| Janela silenciosa | Redundante: o horário é escolhido por ela — ninguém escolhe 3h | se surgirem intents não ancorados no horário dela |
| Rota de deep link (`/checkin/[executionId]`) | Só há um destino útil hoje, e abrir o app já cai nele. Evita toda a superfície de validação de deep link (T10) | quando houver um segundo destino |
| Analytics de H3 | Precedente D-65 → Fase 10 | SPEC-011 |
| Som, badge, categorias, ações na notificação | Não necessários para G1–G6 | design |

## 5. User Stories

- **US1** — Como usuária, quero ligar os lembretes e escolher a hora, para o app me avisar quando faz sentido para mim.
- **US2** — Como usuária, quero ser lembrada do cuidado de hoje uma vez, não a cada abertura.
- **US3** — Como usuária que esqueceu ontem, quero um lembrete de que há algo atrasado — sem que o app mude meu cronograma sozinho.
- **US4** — Como usuária que já fez o cuidado, **não** quero ser lembrada dele.
- **US5** — Como usuária, quero desligar tudo num toque e não receber mais nada.

## 6. Functional Requirements

| ID | Requisito |
| --- | --- |
| FR1 | Preferências: ligar/desligar, horário do lembrete e ligar/desligar o lembrete de check-in. Padrão: **tudo desligado** (opt-in). |
| FR2 | Ligar pede permissão ao SO. Permissão negada → nada é agendado e a tela diz isso. |
| FR3 | Com lembretes ligados, cada dia dentro do horizonte que tenha cuidado **acionável** gera um intent `care_today`. |
| FR4 | Havendo cuidado atrasado, o dia de hoje gera um intent `care_overdue`. |
| FR5 | Com o lembrete de check-in ligado, um cuidado concluído hoje **sem** check-in gera `checkin_pending` hoje. |
| FR6 | No máximo **2** intents por dia; excedente é descartado por prioridade (`care_overdue` > `care_today` > `checkin_pending`). |
| FR7 | Nada é agendado para um horário **já passado** hoje. |
| FR8 | Reconciliação: cancela tudo que o app agendou e reagenda a partir dos intents. Executada ao abrir e a cada mudança do board. |
| FR9 | Cada intent tem `id` **determinístico** (`tipo:data`): o mesmo estado produz sempre o mesmo conjunto (G5). |
| FR10 | Desligar cancela tudo imediatamente. |

## 7. Business Rules

| ID | Regra |
| --- | --- |
| BR1 | **Opt-in duplo:** preferência ligada **e** permissão do SO concedida. Faltando qualquer uma, o conjunto de intents é vazio. |
| BR2 | Só cuidado **acionável** gera lembrete: `planned` ou `overdue`, sem execução efetiva. Concluído/pulado/reagendado nunca (G4). |
| BR3 | **Horizonte de 14 dias** (ADR-009). Com o cap de 2/dia, o máximo é 28 notificações pendentes — bem abaixo do limite de 64 do iOS. |
| BR4 | O texto vem de um **catálogo fixo por tipo**, parametrizado só pela **quantidade** de cuidados. Nunca nome, nota, produto ou qualquer dado da usuária (G6). |
| BR5 | Notificação **não** altera estado: nunca completa, pula ou reagenda nada. D-28 continua valendo — atraso pede ação explícita. |
| BR6 | O domínio **não conhece** `expo-notifications` (D-22): intents são puros; agendar é adapter. |

## 8. Data Model Impact

### 8.1 `notification_preferences` (nova)

```sql
create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,                    -- opt-in (BR1)
  reminder_time_local time not null default '19:00',
  checkin_reminder_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
```

Sem RPC: a preferência é da própria usuária sobre o próprio aparelho e **não protege nenhum invariante do servidor** — diferente de plano, execução e check-in. Ownership por RLS e `with check`, como em `account_deletion_requests` (SPEC-001). `updated_at` pelo trigger `set_updated_at` que a Foundation já provê.

### 8.2 Necessity review

| Item previsto | Consumidor hoje? | Decisão |
| --- | --- | --- |
| `max_per_day` (DATA-MODEL §3.11) | Não — nenhuma UI muda o limite | **REMOVE**: constante `MAX_NOTIFICATIONS_PER_DAY = 2` no core. Vira coluna quando a usuária puder alterá-la |
| `notification_deliveries` | Não — o SO é a fila (ADR-009) | **DEFER** até haver push |
| `device_tokens` | Não — canal local | **DEFER** até haver push |
| Tabela de intents agendados | Não — o estado vive no SO e é derivável do board | **REMOVE**: reconciliação é idempotente, não precisa de espelho no banco |

## 9. API / Contracts

Nenhuma RPC, nenhuma Edge Function, nenhum contrato de rede novo além do CRUD da própria preferência sob RLS.

### 9.1 Core — `packages/core/src/notifications/`

```ts
export const NOTIFICATION_HORIZON_DAYS = 14;
export const MAX_NOTIFICATIONS_PER_DAY = 2;

export type NotificationIntentType = 'care_overdue' | 'care_today' | 'checkin_pending';

export type NotificationIntent = {
  readonly id: string;    // `${type}:${date}` — determinístico (FR9)
  readonly type: NotificationIntentType;
  readonly date: string;  // LocalDate em que dispara
  readonly time: string;  // 'HH:MM' local
  readonly title: string; // catálogo fixo (BR4)
  readonly body: string;
};

buildNotificationIntents({ view, preferences, today, nowLocalTime }): readonly NotificationIntent[]
```

Puro e determinístico: recebe o `TodayView` (published language de Care Tracking, DOMAIN-MAP §4), as preferências, o dia e a **hora local atual** — esta última para não agendar no passado (FR7) sem ler relógio ambiente (ADR-008).

### 9.2 Ports

`NotificationPreferencesPort` (`get`/`save`) e `NotificationSchedulerPort` (`ensurePermission`/`reconcile`). O `LocalNotificationAdapter` sobre `expo-notifications` é a única coisa que conhece o SO (BR6).

## 10. Authorization

| Papel | `notification_preferences` |
| --- | --- |
| `anon` | nada |
| `authenticated` | `SELECT`, `INSERT`, `UPDATE` **da própria linha** (`user_id = auth.uid()` em `using` e `with check`) |
| `DELETE` | **ninguém** — não há o que apagar; desligar é `enabled = false` |

RLS `enable` + `force`. Entradas na allowlist de grants; **nenhuma** função `SECURITY DEFINER` nova.

## 11. Security Considerations

| Item | Situação |
| --- | --- |
| RLS | ON + FORCE; teste positivo e negativo |
| Grants mínimos | SELECT/INSERT/UPDATE próprios; sem DELETE; allowlistados |
| `SECURITY DEFINER` | **Nenhuma função nova** — nada a allowlistar, e o guardrail de `search_path` continua em zero |
| Trust boundary | `user_id` de `auth.uid()` no `with check`: cliente adulterado não escreve preferência de outra pessoa |
| Cliente modificado | Pode agendar o que quiser **no próprio aparelho** — não é escalação: notificação local não lê nem escreve dado de ninguém, e nenhuma decisão do servidor depende dela |
| PII | Nenhuma. Texto de catálogo fixo, parametrizado só por contagem (BR4). Nada sai do aparelho |
| Deep link | **Superfície evitada**: sem rota parametrizada (§4); abrir o app já cai no destino certo (T10 não é acionada) |
| Dependência nova | `expo-notifications ~57.0.15`, instalada por `expo install` (D-44), gerenciada pelo SDK 57. `pnpm audit --audit-level=high` continua em exit 0 |

## 12. Privacy Considerations

Nenhum dado pessoal novo. A preferência é um booleano, um horário e um booleano. Sem token de push, portanto sem identificador de dispositivo — uma das razões de D-22. Cascade de `auth.users` apaga na exclusão de conta.

## 13. Analytics Events

**DEFER** → SPEC-011. H3 compara adesão com notificação ON vs OFF; o coorte sai de `notification_preferences.enabled`, que passa a existir a partir daqui.

## 14. UX Notes (sem design visual)

Na tela **Sua conta** (a superfície de configuração que já existe):

```
Lembretes
  [ Ligados / Desligados ]
  Horário   [ 08:00 ] [ 12:00 ] [ 19:00 ] [ 21:00 ]
  [ ] Lembrar do check-in

  (permissão negada)
  "As notificações estão bloqueadas nas configurações do sistema."
```

- Horários fixos em vez de time picker: quatro toques cobrem o caso real, sem dependência nova de UI.
- Alvos ≥ 44 pt, estado comunicado por `accessibilityState={{ selected }}`.
- Salvar é otimista com reconciliação em seguida; falha mostra erro e mantém o valor anterior.

## 15. Edge Cases

| ID | Caso | Comportamento |
| --- | --- | --- |
| EC1 | Permissão negada no SO | Preferência não liga; nada agendado; mensagem explica (FR2) |
| EC2 | Permissão revogada depois | A próxima reconciliação não agenda nada; o app não trava |
| EC3 | Cuidado concluído depois de agendado | O board muda → reconciliação → o lembrete daquele dia some (G4/FR8) |
| EC4 | Plano novo (SPEC-004) | Board muda → reconciliação cancela os intents do plano velho |
| EC5 | Horário de hoje já passou | Nenhum intent para hoje (FR7); amanhã segue normal |
| EC6 | Dois cuidados no mesmo dia | **Um** lembrete, com a contagem no texto |
| EC7 | Mais de 2 intents num dia | Sobram os 2 de maior prioridade (FR6) |
| EC8 | Sem plano ativo | Nenhum intent |
| EC9 | Desligar | Cancela tudo na hora (FR10) |
| EC10 | Sem rede | Preferência falha ao salvar e o erro aparece; o que já estava agendado continua valendo (é local) |

## 16. Failure Modes

| Modo | Tratamento |
| --- | --- |
| Permissão negada | Estado explícito na tela, sem retry automático |
| Falha ao salvar preferência | Mensagem + valor anterior preservado; nada é reconciliado com um estado que não persistiu |
| Falha ao agendar no SO | Erro logado sem PII; a preferência permanece como está — a tela nunca mente dizendo que está ligado |
| Leitura da preferência falha | Trata como desligado (**fail closed**): melhor não notificar do que notificar errado |

## 17. Acceptance Criteria

| ID | Critério |
| --- | --- |
| AC1 | `notification_preferences` com RLS ON+FORCE; `anon` sem nada; `authenticated` com SELECT/INSERT/UPDATE e **sem DELETE** |
| AC2 | A não lê nem escreve a preferência de B (pgTAP positivo e negativo) |
| AC3 | INSERT/UPDATE com `user_id` de outra pessoa é recusado pelo `with check` |
| AC4 | Padrões são opt-out: `enabled = false`, `checkin_reminder_enabled = false` |
| AC5 | Guardrails da Foundation seguem em zero, incluindo o de `search_path` (nenhuma função nova) |
| AC6 | Preferência desligada ⇒ **nenhum** intent |
| AC7 | Cada dia com cuidado acionável dentro de 14 dias gera um `care_today`; dois cuidados no mesmo dia geram **um** intent |
| AC8 | Cuidado atrasado gera `care_overdue` hoje |
| AC9 | Cuidado concluído, pulado ou reagendado **não** gera intent (BR2) |
| AC10 | `checkin_pending` só com a preferência ligada e cuidado concluído hoje sem check-in |
| AC11 | Nunca mais de 2 intents num mesmo dia, respeitando a prioridade (FR6) |
| AC12 | Nada é agendado para horário já passado hoje (FR7) |
| AC13 | Ids são determinísticos: mesma entrada ⇒ mesmos ids (FR9) |
| AC14 | Nenhum texto de intent contém dado da usuária (BR4), verificado por teste |
| AC15 | UI: ligar pede permissão; negada não liga; ligar/desligar reconcilia |
| AC16 | `packages/core` continua sem importar Expo/React/Supabase — `dep-cruise` e `check:boundaries` verdes |
| AC17 | `pnpm verify` verde; `pnpm audit --audit-level=high` exit 0 |
| AC18 | Docs sincronizadas: DATA-MODEL §3.11, DOMAIN-MAP §3.7, allowlist, índice de SPECs |

## 18. Testing Strategy

| Camada | O que |
| --- | --- |
| Core (Vitest) | AC6–AC14: opt-out, agrupamento por dia, atraso, exclusão do que foi resolvido, cap por prioridade, horário passado, determinismo, ausência de PII |
| pgTAP | AC1–AC5: RLS ON/FORCE, grants, isolamento A/B, `with check`, ausência de DELETE, padrões opt-out |
| UI (RNTL) | AC15: permissão negada não liga; ligar/desligar chama a reconciliação |
| Guardrails | `dep-cruise`, `check:boundaries`, allowlists, `audit` |

## 19. Dependencies

- **Nova dependência:** `expo-notifications ~57.0.15` — **aprovada por decisão humana em 2026-08-28**, instalada por `expo install` (D-44), gerenciada pelo SDK 57. Sem código nativo próprio; `pnpm audit --audit-level=high` segue em exit 0. O único advisory `moderate` (`uuid`) é **pré-existente**, não introduzido por esta instalação.
- Depende de SPEC-005 (`TodayView`) e SPEC-006 (`canCheckIn`) — ambas `Implemented`.

## 20. Implementation Plan

1. `feat(notifications): preferences table + RLS` — migration, grants, allowlist, pgTAP.
2. `feat(notifications): pure intent builder` — core + testes.
3. `feat(notifications): local adapter and settings` — adapters, tela, reconciliação, testes RNTL.
4. `docs(spec-008): sync data model, domain map and evidence`.

## 21. Migration Plan

Uma migration aditiva: uma tabela nova. Nenhuma coluna alterada, nenhum backfill. Usuária sem linha = tudo desligado (fail closed, §16).

## 22. Rollback Plan

Reverter o merge. A tabela fica órfã e inerte. Notificações já agendadas no aparelho expiram sozinhas; nenhum estado do servidor depende delas.

## 23. Open Questions

### BLOCKING

**Nenhuma.** A arquitetura vem de ADR-009 (Accepted), o canal de D-22, e a dependência foi aprovada por decisão humana. Nenhuma regra capilar: lembrar não afirma nada sobre cabelo (D-26 não acionada).

### IMPORTANT

| ID | Questão | Premissa |
| --- | --- | --- |
| OQ-1 | 3 intents em vez dos 5 da ADR-009 | `reassessment_due` é impossível (sem SPEC-014); `habit_recovery` dispara quando ela não está usando o app — maior risco de irritação, sem dado. §4 |
| OQ-2 | `max_per_day` como constante, não coluna | Nenhuma UI a altera; vira coluna quando alterar for possível. §8.2 |

### CAN DEFER

| ID | Questão | Premissa |
| --- | --- | --- |
| OQ-3 | Time picker em vez de 4 horários fixos | Quatro toques cobrem o caso real sem dependência de UI nova |
| OQ-4 | Deep link por rota parametrizada | Um destino só; abrir o app já cai nele, e evita T10 |

## 24. Change Log

| Versão | Data | Mudança |
| --- | --- | --- |
| v0.1 | 2026-08-28 | Criada e aprovada sob §0.2 (D-74), com `expo-notifications` aprovada por decisão humana. Necessity review: 3 intents, cap como constante, sem deliveries/tokens/tabela de intents, sem deep link parametrizado. Zero BLOCKING. |
| v0.2 | 2026-08-28 | **IMPLEMENTED.** Evidência em §25. |

## 25. Implementation evidence

### 25.1 Arquivos

| Arquivo | Papel |
| --- | --- |
| `supabase/migrations/20260901000000_notification_preferences.sql` | Tabela + RLS ON/FORCE + grants (sem RPC, sem DEFINER) |
| `supabase/tests/security/060_spec008_notification_preferences.sql` | **15 asserções** |
| `packages/core/src/notifications/domain/intent.ts` | `buildNotificationIntents` puro + catálogo de textos |
| `packages/core/src/notifications/application/ports.ts` | `NotificationPreferencesPort`, `NotificationSchedulerPort` |
| `apps/mobile/src/infrastructure/notifications/local-notification-adapter.ts` | Único arquivo que conhece `expo-notifications` |
| `apps/mobile/src/infrastructure/supabase/notification-preferences-adapter.ts` | Leitura/upsert sob RLS |
| `apps/mobile/src/features/account/NotificationSettings.tsx` | Ligar/desligar, horário, check-in |
| `apps/mobile/src/app/index.tsx` | Reconciliação a cada mudança de board ou preferência |
| `apps/mobile/app.json` | Config plugin `expo-notifications` |

### 25.2 Validação executada

`pnpm verify` **exit 0** — dep-cruise **111 módulos, 0 violações** · core **12 arquivos / 125 testes** · mobile **10 suítes / 65 testes** · boundaries 8/8 · docs-links 38/38 · `pnpm audit --audit-level=high` **exit 0**.
`expo export` ok · `check-deno-import-map` ok.

`supabase test db` **não executado localmente** (sem Docker/Supabase CLI); o workflow `supabase-test` é o gate. Total esperado: **161 asserções** (146 + 15).

### 25.3 Achados da auditoria `improve`

| Severidade | Achado | Correção |
| --- | --- | --- |
| **BLOCKER** | `expo-notifications` não estava registrada em `app.json` → `plugins`. Sem o config plugin, o Android 13+ **nunca declara `POST_NOTIFICATIONS`**, e a permissão fica impossível de conceder num aparelho real. Invisível para `typecheck`, para os testes (port mockado) e para `expo export`: a feature inteira seria inerte no dispositivo | Plugin registrado |
| **BLOCKER** | `reconcile` agendava mesmo depois de a permissão ser revogada nas configurações do sistema, contradizendo o EC2 da própria SPEC | Cancela tudo, confere `getPermissionsAsync()` e sai se não houver permissão — o aparelho fica no único estado honesto: nada pendente |
| IMPORTANT | AC18 não atendida: DATA-MODEL §3.11 ainda listava `max_per_day`, DOMAIN-MAP §3.7 descrevia o contexto como não implementado, README do contexto ainda era o stub | Todos sincronizados |
| OPTIONAL | Sem `setNotificationHandler`: com o app aberto no horário, nada é exibido | Não alterado — o objetivo do lembrete é trazê-la de volta ao app; se ela já está nele, não exibir é defensável |

### 25.4 Ameaças verificadas

Cliente adulterado gravando preferência alheia → recusado pelo `with check` (`42501`) · `anon` → sem grant nenhum (`42501`) · DELETE → não existe para ninguém · permissão negada → nada agendado e a tela não mente · preferência que falhou ao salvar → não reconcilia · leitura da preferência falhou → tratada como desligada (fail closed) · texto na tela de bloqueio → catálogo fixo, verificado por teste que proíbe o tipo de cuidado no texto.
