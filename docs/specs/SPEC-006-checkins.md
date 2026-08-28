# SPEC-006 — Check-ins: como ficou o cabelo depois do cuidado

| Campo | Valor |
| --- | --- |
| ID | SPEC-006 |
| Status | **Implemented** (v0.2, 2026-08-28 — aprovada por **D-73**, sob `CLAUDE.md` §0.2). Evidência em §25. |
| Owner | @gabrielfmorais (humano) |
| Bounded Context | Care Tracking (Core) — DOMAIN-MAP §3.5 |
| Related ADRs | ADR-001 (camadas) · ADR-004 (Supabase/RLS/RPC) · ADR-006 (Check-in é subdomínio de Care Tracking, D-04) · ADR-008 (time) |
| Related SPECs | SPEC-005 (entrega `care_executions`, a âncora do check-in) · SPEC-007 (padrão de painel inline na Hoje) · SPEC-008 (lembrete `checkin_pending`) · SPEC-009 (Progress — o consumidor futuro dos dados) · SPEC-011 (analytics) |
| Decisões vinculantes | **D-04** (Check-in dentro de Care Tracking) · **D-69/D-35** (0 ou 1 execução efetiva) · **D-12** (undo de execução) · D-47/D-48 (necessidade) · D-25 (sem streaks) · D-65 (analytics DEFER) |
| Decisões desta SPEC | **D-73** (SPEC approved; escopo de uma pergunta, sem nota livre) — DECISION-REGISTER **B7** |
| Fase do roadmap | 6 — Check-ins |
| Labels | `db`, `security`, `ui` |
| Criado / Atualizado | 2026-08-28 / 2026-08-28 |

> **Escopo:** fechar o loop diário com o retorno da usuária. Ela concluiu o cuidado; agora diz **como ficou**, e vê a própria resposta registrada. Nada de gráficos, tendências, streaks, texto livre ou notificação.

---

## 1. Context

A SPEC-005 fechou o loop de **execução**; a SPEC-007 fechou o de **compreensão**. O app hoje sabe o que foi planejado e o que foi feito — mas não sabe **se funcionou**, e a usuária não tem onde dizer.

É a hipótese **H4** do PRODUCT-BRIEF: "check-ins simples aumentam percepção de personalização", meta ≥ 50% dos cuidados com check-in. E é o insumo que o Progress (SPEC-009) vai consumir: sem fatos de percepção acumulados, a Fase 8 começa sem histórico.

## 2. Problem

Um cronograma que só registra presença é uma lista de tarefas. O que transforma isso em assistente é a usuária conseguir dizer "essa hidratação foi ótima / essa não fez diferença" — e o app guardar isso ligado ao cuidado exato que ela fez.

Três coisas precisam ser verdade ao mesmo tempo:

1. **Baixíssimo atrito.** Se custar mais que alguns toques, ninguém preenche e H4 morre por desenho, não por hipótese.
2. **Ancorado no fato certo.** Um check-in pertence a **uma execução**, não a um cuidado planejado nem a um dia. Se a execução for desfeita (D-12), o check-in daquela execução não pode migrar para outra.
3. **Retorno imediato.** Coletar dado sem devolver nada é formulário, não produto. A resposta precisa aparecer de volta na mesma tela, agora — mesmo que a análise só chegue na SPEC-009.

## 3. Goals

- G1 — Depois de concluir um cuidado, a usuária responde **uma pergunta** ("Como ficou?", 1–5) em **um toque**.
- G2 — A resposta aparece imediatamente no próprio cuidado; o convite some.
- G3 — **Um check-in por execução**, garantido no banco.
- G4 — Escrita **idempotente**: retry após resposta perdida não cria um segundo check-in.
- G5 — Autorização server-side: cliente adulterado não escreve check-in de outra pessoa nem em execução alheia.
- G6 — Check-in é **opcional**: pular não bloqueia nada e não gera cobrança visual permanente.

## 4. Non-Goals

| Fora | Por quê | Onde volta |
| --- | --- | --- |
| Nota em texto livre (`note`) | PII sem consumidor nesta fatia; mesmo raciocínio que já adiou `care_executions.note` | quando houver consumidor |
| 4 dimensões (`hydration_feel`, `softness`, `definition`, `dryness`) | Existem para alimentar o Progress (Fase 8), que não existe. Colunas anuláveis são **aditivas** — §8.2 | SPEC-009 |
| Gráficos, tendências, adesão, streaks | Progress é a SPEC-009; streaks são DEFER (D-25) | SPEC-009 |
| Editar ou apagar um check-in | Sem consumidor; a execução já tem seu próprio undo (D-12) | §8.3 |
| Lembrete de check-in pendente | Intent `checkin_pending` é da SPEC-008 | SPEC-008 |
| Check-in avulso, sem execução | Execução avulsa continua DEFER desde a SPEC-005 | quando aquela voltar |
| Analytics (`checkin_completed`) | Precedente D-65 → Fase 10 | SPEC-011 |
| Tela ou rota própria | O cuidado já está na Hoje; tirar a usuária de lá aumenta o atrito que G1 tenta eliminar | — |

## 5. User Stories

- **US1** — Como usuária que acabou de fazer a hidratação, quero dizer em um toque como ficou, sem sair da tela.
- **US2** — Como usuária, quero ver o que respondi, para saber que foi registrado.
- **US3** — Como usuária com pressa, quero poder ignorar o check-in sem que nada quebre.
- **US4** — Como usuária que desfez uma execução por engano, quero que o check-in daquela execução não seja atribuído à execução nova.

## 6. Functional Requirements

| ID | Requisito |
| --- | --- |
| FR1 | Um cuidado com execução efetiva e **sem** check-in mostra "Como ficou?" com as opções **1–5**. |
| FR2 | Escolher uma opção registra o check-in e a tela passa a mostrar a resposta ("Você marcou: 4/5"); o convite some. |
| FR3 | Um cuidado que **não** está concluído nunca mostra o convite. |
| FR4 | O check-in é anexado à **execução efetiva**, nunca ao `scheduled_care`. |
| FR5 | Escrita exclusivamente pela RPC `submit_checkin`; o cliente tem apenas `SELECT` em `checkins`. |
| FR6 | Idempotente por `(user_id, client_checkin_id)`: o mesmo intent repetido devolve o mesmo check-in. |
| FR7 | Uma ação em andamento bloqueia um segundo envio para o mesmo cuidado (mesmo guard `busyId` da SPEC-005). |
| FR8 | Falha recuperável mostra mensagem e permite tentar de novo **com a mesma chave**. Conflito recarrega a tela. |

## 7. Business Rules

| ID | Regra |
| --- | --- |
| BR1 | **Um check-in por execução** — `UNIQUE (care_execution_id)`. Garantido no banco, não na UI. |
| BR2 | O check-in só existe sobre execução **efetiva** (`voided_at is null`). Check-in em execução anulada é recusado. |
| BR3 | **Desfazer não migra check-in** (D-12): anular a execução deixa o check-in preso à execução anulada — histórico, não fraude. A execução nova nasce sem check-in e pode receber o seu. |
| BR4 | `overall_feel ∈ [1,5]`, inteiro, **obrigatório**. Não existe check-in vazio: sem resposta, não há linha. |
| BR5 | Check-in é **append-only** pela usuária: sem UPDATE, sem DELETE, sem grant. |
| BR6 | O `user_id` vem de `auth.uid()`, **nunca** de parâmetro. |

## 8. Data Model Impact

### 8.1 `checkins` (nova) + uma constraint aditiva em `care_executions`

```sql
-- alvo do FK composto de ownership (o mesmo padrão de scheduled_cares na SPEC-005)
alter table public.care_executions add constraint care_executions_id_user_unique unique (id, user_id);

create table public.checkins (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  care_execution_id uuid not null,
  overall_feel      smallint not null check (overall_feel between 1 and 5),
  client_checkin_id uuid not null,
  created_at        timestamptz not null default now(),
  constraint checkins_execution_unique unique (care_execution_id),          -- BR1
  constraint checkins_client_unique    unique (user_id, client_checkin_id), -- FR6
  constraint checkins_execution_owner_fk
    foreign key (care_execution_id, user_id) references public.care_executions (id, user_id)
    on delete cascade                                                        -- BR6
);
```

O FK composto faz o **banco** impedir que o `user_id` do check-in divirja do dono da execução — mesmo padrão de `care_executions → scheduled_cares` (SPEC-005 AC13).

### 8.2 Necessity review — por que **uma** coluna e não quatro

DATA-MODEL §3.8 previa `hydration_feel`, `softness`, `definition`, `dryness` e `note`. Aplicando D-47/D-48:

| Coluna | Consumidor nesta fatia? | Decisão |
| --- | --- | --- |
| `overall_feel` | Sim — é a pergunta e o retorno imediato (G1/G2) | **KEEP** |
| `hydration_feel` / `softness` / `definition` / `dryness` | Não — existem para o Progress (Fase 8). E cada pergunta extra é atrito direto contra G1, que é a própria hipótese H4 | **DEFER** — colunas anuláveis são aditivas; a SPEC-009 acrescenta as que precisar |
| `note` (texto livre ≤ 280) | Não — e é **PII**: texto livre sobre o corpo da usuária, sem nenhum consumidor. Mesmo motivo que já adiou `care_executions.note` | **DEFER** |

**Gatilho para reabrir:** a SPEC-009 (Progress) definir qual insight precisa de qual dimensão. Aí as colunas entram anuláveis, sem migração de dados.

### 8.3 Editar / apagar check-in — DEFER

Sem consumidor. A execução já tem undo (D-12, 15 min); errar o check-in custa um toque, não um dia de cuidado. Reabrir se a usuária relatar o problema.

## 9. API / Contracts

### 9.1 RPC `submit_checkin`

```sql
submit_checkin(p_care_execution_id uuid, p_overall_feel smallint, p_client_checkin_id uuid) returns uuid
```

`SECURITY DEFINER`, `search_path` fixo, allowlistada, `EXECUTE` para `authenticated`.

Ordem das verificações:
1. `care_current_user()` — `auth.uid()` ou `42501`.
2. `client_checkin_id` obrigatório (`22023`).
3. **Replay idempotente**: já existe check-in com essa chave para essa usuária → devolve o mesmo id, sem escrever (FR6).
4. `overall_feel` entre 1 e 5 (`22023`) — antes de tocar em qualquer linha.
5. Carrega a execução `for update` com `id = p_care_execution_id and user_id = v_user`; não achou → `P0002` (**não revela** se a execução não existe ou é de outra pessoa).
6. Anulada → `23514` (BR2).
7. Já tem check-in → `23514` (BR1). O `FOR UPDATE` da execução serializa dois aparelhos; o índice único é o backstop.
8. Insere e devolve o id.

**Por que `EXECUTE` para `authenticated` é seguro** (mesmo argumento da SPEC-005, oposto ao de `create_plan_tx`): a função recebe apenas um id que **já pertence** à chamadora, uma nota de 1 a 5 e uma chave de idempotência. A usuária vem de `auth.uid()`, nunca de parâmetro — não há o que forjar.

### 9.2 Core

`CheckIn` e `submitCheckIn` entram em `packages/core/src/care-tracking/` (D-04: check-in é subdomínio de Care Tracking, não contexto novo). `CareBoard` ganha `checkins`; `buildTodayView` anexa `checkIn` ao item pela execução. `CHECKIN_SCALE` é a lista de opções.

## 10. Authorization

| Papel | `checkins` |
| --- | --- |
| `anon` | nada |
| `authenticated` | **apenas `SELECT`** das próprias linhas (`user_id = auth.uid()`) |
| escrita | só `submit_checkin` (DEFINER) |
| `postgres` | policy explícita `for all` — `FORCE RLS` vale para o dono da tabela, e as funções DEFINER rodam como ele |

RLS `enable` + `force`. Sem UPDATE/DELETE para ninguém: BR5 é grant, não convenção.

## 11. Security Considerations

| Item | Situação |
| --- | --- |
| RLS | ON + FORCE; policy positiva e negativa em pgTAP |
| Grants mínimos | Só `SELECT`; entrada na allowlist |
| `SECURITY DEFINER` | Uma função, justificada em §9.1, `search_path` fixo, allowlistada |
| Trust boundary | `user_id` de `auth.uid()`; `overall_feel` validado na RPC **e** por `CHECK`; ownership re-verificada server-side |
| Cliente modificado | Pode enviar qualquer `care_execution_id`: o `where user_id = auth.uid()` faz virar `P0002`, sem vazar existência. Pode enviar `overall_feel = 99`: recusado duas vezes. Pode repetir o request: idempotência devolve o mesmo id |
| Concorrência | `FOR UPDATE` na execução + `UNIQUE (care_execution_id)` como backstop |
| PII | **Nenhuma** — não há texto livre (§8.2). Um inteiro 1–5 ligado a uma execução |
| Logs | Nada logado |
| Dependência nova | **Nenhuma** |

## 12. Privacy Considerations

Um inteiro por execução. Sem texto livre, portanto sem risco de a usuária escrever algo sensível num campo que ninguém lê. Cascade de `auth.users` já apaga tudo na exclusão de conta. DATA-MODEL §4 ganha a linha correspondente.

## 13. Analytics Events

**DEFER** → SPEC-011 (precedente D-65). `checkin_completed` é a métrica de H4 e entra junto com o provider e o consentimento.

## 14. UX Notes (sem design visual)

```
Hoje
  Hidratação                              qui, 10/09
  Feito     [ Desfazer ]
  Como ficou?   [1] [2] [3] [4] [5]        ← some após responder

  (depois)
  Feito     [ Desfazer ]
  Você marcou: 4/5
```

- Cinco alvos de ≥ 44 pt, cada um com `accessibilityLabel` dizendo o significado ("4 de 5").
- Legenda curta `1 = nada bom · 5 = muito bom`, para o número não ficar sem âncora.
- O convite aparece junto com "Feito", **na mesma linha do cuidado** — zero navegação (G1).
- Desfazer e check-in convivem: desfazer continua disponível dentro da janela de 15 min.

## 15. Edge Cases

| ID | Caso | Comportamento |
| --- | --- | --- |
| EC1 | Execução desfeita depois do check-in | O check-in fica na execução anulada (BR3). A tela volta a oferecer "Fiz hoje"; a execução nova nasce sem check-in |
| EC2 | Dois aparelhos respondem ao mesmo tempo | `FOR UPDATE` serializa; o segundo recebe `23514` → a tela recarrega e mostra a resposta que valeu |
| EC3 | Retry após resposta perdida | Mesma `client_checkin_id` → mesmo id, um só check-in (FR6) |
| EC4 | Toque duplo | `busyId` bloqueia o segundo envio antes de sair do aparelho (FR7) |
| EC5 | `overall_feel` fora de 1–5 vindo de cliente adulterado | `22023` na RPC; `CHECK` no banco como backstop |
| EC6 | Execução de outra usuária | `P0002` — indistinguível de "não existe" |
| EC7 | Cuidado pulado ou reagendado | Sem execução ⇒ sem convite (FR3) |
| EC8 | App reaberto | O check-in vem do servidor com o board; a resposta continua visível |
| EC9 | Sem rede | Erro recuperável com retry; a mesma chave é reusada (FR8) |

## 16. Failure Modes

| Modo | Tratamento |
| --- | --- |
| Rede/servidor indisponível | Mensagem "Não foi possível registrar. Tente novamente.", chave preservada para o retry |
| Conflito (`23514`/`P0002`) | `ConflictError` → recarrega o board e mostra a verdade, em vez de discutir (mesmo padrão da SPEC-005) |
| Resposta perdida após escrita | Retry idempotente devolve o mesmo check-in |
| Falha de leitura do board | Já tratada pela SPEC-005; `checkins` entra na mesma leitura |

## 17. Acceptance Criteria

| ID | Critério |
| --- | --- |
| AC1 | `checkins` existe com RLS ON **e** FORCE; `anon` sem nada; `authenticated` só `SELECT` |
| AC2 | A usuária A não lê check-in da B (pgTAP positivo e negativo) |
| AC3 | `authenticated` não consegue `INSERT`/`UPDATE`/`DELETE` direto em `checkins` |
| AC4 | `submit_checkin` cria o check-in e o devolve pela leitura sob RLS |
| AC5 | Repetir com a mesma `client_checkin_id` devolve o mesmo id e **não** cria segunda linha |
| AC6 | Segundo check-in na mesma execução com chave diferente é recusado (BR1) |
| AC7 | Check-in em execução **anulada** é recusado (BR2) |
| AC8 | Check-in em execução de outra usuária falha com `P0002` |
| AC9 | `overall_feel` = 0, 6 ou nulo é recusado |
| AC10 | `submit_checkin` está na allowlist com `search_path` fixo; `checkins`/`SELECT` na allowlist de grants |
| AC11 | `buildTodayView` anexa o check-in ao cuidado certo pela execução efetiva |
| AC12 | UI: cuidado concluído sem check-in mostra 1–5; responder mostra "Você marcou: N/5" e some o convite |
| AC13 | UI: cuidado não concluído nunca mostra o convite |
| AC14 | UI: retry após falha reusa a mesma `client_checkin_id` |
| AC15 | `pnpm verify` verde; `dep-cruise` e `check:boundaries` sem violação |
| AC16 | Docs sincronizadas: DATA-MODEL §3.8/§4, DOMAIN-MAP §3.5, allowlist, índice de SPECs |

## 18. Testing Strategy

| Camada | O que |
| --- | --- |
| Core (Vitest) | `buildTodayView` anexa check-in por execução; ignora check-in de execução anulada; `canCheckIn` só em concluído sem check-in |
| pgTAP | AC1–AC10: RLS ON/FORCE, grants, isolamento A/B, idempotência, unicidade por execução, execução anulada, execução alheia, faixa de `overall_feel`, allowlists |
| UI (RNTL) | AC12–AC14 |
| Guardrails | `dep-cruise`, `check:boundaries`, allowlist de DEFINER/grants |

## 19. Dependencies

Depende de SPEC-005 (`care_executions`) — `Implemented`. **Nenhuma dependência externa nova.** Não bloqueia nem é bloqueada pela SPEC-008.

## 20. Implementation Plan

1. `feat(care-tracking): checkins table + submit_checkin RPC` — migration, RLS, grants, allowlist, pgTAP.
2. `feat(care-tracking): attach check-ins to the board` — core (`CheckIn`, `CareBoard.checkins`, `buildTodayView`, `CHECKIN_SCALE`), testes.
3. `feat(care): "Como ficou?" on a completed care` — adapter, `TodayScreen`, testes RNTL.
4. `docs(spec-006): sync data model, domain map and evidence`.

## 21. Migration Plan

Uma migration aditiva: uma tabela nova, uma constraint `UNIQUE` nova em `care_executions`, uma função nova. **Nenhuma coluna alterada ou removida, nenhum backfill, nenhum dado tocado.**

## 22. Rollback Plan

Reverter o merge. A tabela nova fica órfã e inerte (sem leitor, sem escritor); nada existente depende dela. `care_executions_id_user_unique` é uma constraint que já era verdadeira por construção (`id` é PK) — mantê-la não afeta nada.

## 23. Open Questions

### BLOCKING

**Nenhuma.** O comportamento vem de decisões já aprovadas (D-04, D-69, D-12) e do PRODUCT-BRIEF §9.6 / H4. Nenhuma regra capilar nova: perguntar "como ficou?" e guardar a resposta não afirma nada sobre cabelo (D-26 não é acionada).

### IMPORTANT

| ID | Questão | Premissa |
| --- | --- | --- |
| OQ-1 | Uma dimensão em vez de quatro | §8.2 — as outras existem para o Progress (Fase 8) e cada pergunta extra é atrito contra a própria hipótese H4. Colunas anuláveis são aditivas |
| OQ-2 | Escala 1–5 | Reusa a escala que o DATA-MODEL §3.8 já aprovou (`smallint CHECK 1..5`). Não é invenção |

### CAN DEFER

| ID | Questão | Premissa |
| --- | --- | --- |
| OQ-3 | Editar/apagar check-in | §8.3 |
| OQ-4 | Check-in em cuidado pulado ("por que pulou?") | Sem consumidor; e transformaria pular numa ação com fricção, contra D-28 |

## 24. Change Log

| Versão | Data | Mudança |
| --- | --- | --- |
| v0.1 | 2026-08-28 | Criada e aprovada sob §0.2 (D-73). Necessity review: 1 dimensão em vez de 4, sem texto livre, sem edição, sem tela própria. Zero questão BLOCKING. |
| v0.2 | 2026-08-28 | **IMPLEMENTED.** Evidência em §25. |

## 25. Implementation evidence

### 25.1 Arquivos

| Arquivo | Papel |
| --- | --- |
| `supabase/migrations/20260831000000_checkins.sql` | Tabela `checkins`, RLS ON+FORCE, grants, `care_executions_id_user_unique`, RPC `submit_checkin` |
| `supabase/security/allowlists.sql` | `submit_checkin` (DEFINER) + `checkins`/SELECT |
| `supabase/tests/security/050_spec006_checkins.sql` | **26 asserções** |
| `packages/core/src/care-tracking/domain/care-tracking.ts` | `CheckIn`, `CHECKIN_SCALE`, `canCheckIn`, `buildTodayView` anexa por execução |
| `packages/core/src/care-tracking/application/ports.ts` | `CareBoard.checkIns`, `CareTrackingPort.submitCheckIn` |
| `apps/mobile/src/infrastructure/supabase/care-tracking-adapter.ts` | Leitura de `checkins` + RPC |
| `apps/mobile/src/features/care/TodayScreen.tsx` | "Como ficou?" 1–5 e a resposta de volta |

### 25.2 Validação executada

`pnpm verify` **exit 0** — dep-cruise 101 módulos 0 violações · core **11 arquivos / 109 testes** · mobile **9 suítes / 57 testes** · boundaries 8/8 · docs-links 38/38.

`supabase test db` **não executado localmente** (sem Docker/Supabase CLI neste ambiente); o workflow `supabase-test` é o gate autoritativo. Total esperado da suíte: **141 asserções** (115 + 26).

### 25.3 Achados da auditoria `improve`

| Severidade | Achado | Correção |
| --- | --- | --- |
| BLOCKER | `TodayScreen` chamava `buildTodayView(cares, executions, today)` sem passar `board.checkIns`. O parâmetro é opcional, então **compilava e os testes de core passavam** — mas na tela nenhum check-in apareceria e o convite continuaria sendo oferecido para sempre, permitindo pedir ao servidor um check-in que ele já ia recusar. Só o teste de UI pegou. | Call site corrigido |
| IMPORTANT | `tests.unapproved_security_definer_functions()` verifica `prosecdef` + allowlist, mas **não** verifica se o `search_path` está fixado. Uma função DEFINER allowlistada com `search_path` livre passaria no guardrail — vetor de search-path hijacking com CI verde. | **Reportado, não corrigido:** o helper é compartilhado por todas as SPECs (SPEC-000..006), então mexer nele é expansão de escopo. Mitigado localmente: `050` afirma explicitamente o pin de `submit_checkin`. **Recomendação:** endurecer o helper numa fatia própria — todas as funções DEFINER existentes já cumprem, então a mudança nasce verde |
| IMPORTANT | A asserção do `search_path` dependia do formato exato de `proconfig` (`'%search_path=public, pg_temp%'`) e podia passar por acaso ou falhar por espaçamento | Reescrita com `array_to_string(proconfig, ' ') like 'search_path=%pg_temp%'` e qualificada pelo schema |
| OPTIONAL | Replay idempotente devolve o check-in existente sem conferir se é da mesma execução. Reusar uma chave para outra execução é bug de cliente; `complete_care` tem exatamente o mesmo comportamento, e a UI usa uma chave por cuidado (`ck:${id}`) | Não alterado — consistente com o padrão já aprovado |

### 25.4 Ameaças verificadas

Cliente adulterado enviando execução alheia → `P0002`, indistinguível de inexistente · `overall_feel = 99` → recusado na RPC **e** pelo `CHECK` · replay → mesmo id, uma linha · dois aparelhos → `FOR UPDATE` serializa, `UNIQUE` como backstop · INSERT/UPDATE/DELETE direto → `42501` · execução anulada → `23514`.
