# SPEC-005 — Care Tracking: Hoje, próximos cuidados e transições

| Campo | Valor |
| --- | --- |
| ID | SPEC-005 |
| Status | **Draft** (v0.1, 2026-08-27). Aguarda aprovação humana. Nenhum código/migration criado por esta SPEC. |
| Owner | @gabrielfmorais (humano) |
| Bounded Context | Care Tracking (Core) — DOMAIN-MAP §3.5 |
| Related ADRs | ADR-001 (camadas), ADR-004 (Supabase/RLS/RPC), ADR-008 (time), ADR-007 (fronteira: o engine **não** é invocado para reagendar) |
| Related SPECs | SPEC-004 (entrega `hair_plans`/`scheduled_cares`) · SPEC-006 (Check-ins) · SPEC-007 (Content) · SPEC-008 (Notifications) · SPEC-009 (Progress) |
| Decisões vinculantes | **D-28** (cuidado atrasado: nunca deslocar o cronograma em silêncio) · **D-26** (não inventar regra capilar) · D-25 (sem streaks) · D-65 (precedente: analytics DEFER → SPEC-011) |
| Decisões pendentes que esta SPEC precisa resolver | **D-12** (desfazer execução) · **D-35** (múltiplas execuções por cuidado) — §23 |
| Fase do roadmap | 5 — Care Tracking (a parte Content v1 da fase é a SPEC-007, fora daqui) |
| Labels | `db`, `security` |
| Criado / Atualizado | 2026-08-27 / 2026-08-27 |

> **Escopo desta fatia:** tornar o cronograma da SPEC-004 **utilizável no dia a dia**. Nada de conteúdo, check-in, notificação, progresso ou reavaliação.
>
> **Regra de necessidade (Ponytail/YAGNI, D-47/D-48):** cada tabela, coluna, RPC, índice e abstração abaixo existe porque um fluxo **desta** fatia exige. O que não exige está em §4 ou §8 como REMOVE/DEFER, com o gatilho para reabrir.

## 1. Context

A SPEC-004 entrega um plano ativo com 28 dias de `scheduled_cares` — mas o app só sabe **mostrar** o cronograma. A usuária não consegue registrar nada. Sem isso o plano é um cartaz, não um assistente: não há loop diário, e as SPECs 006/008/009 (check-in, notificação, progresso) não têm sobre o que operar, porque todas dependem de fatos de execução.

Esta fatia fecha o loop: **abrir o app → ver o que fazer hoje → registrar → o estado continua certo amanhã.** É a hipótese H2 do roadmap.

## 2. Problem

Registrar um cuidado parece trivial e não é. Três coisas precisam ser verdade ao mesmo tempo:

1. **Planejado ≠ executado.** O que foi planejado nunca é reescrito para fingir que sempre foi diferente. Reagendar não move uma data: encerra a linha original e cria outra.
2. **O servidor decide o dia.** "Hoje" depende do fuso da usuária, que só o cliente conhece — e um cliente adulterado poderia alegar qualquer dia para concluir o cuidado de outro dia (T22).
3. **Rede instável é o caso normal.** Um toque em "Fiz hoje" que não recebe resposta será repetido. O retry não pode virar dois fatos.

## 3. Goals

- **G1** Tela "Hoje": o que fazer hoje, o que está atrasado e os próximos cuidados, derivados do plano ativo.
- **G2** Três ações da usuária sobre um cuidado planejado: **concluir**, **pular**, **reagendar** (D-28).
- **G3** `CareExecution` é um fato append-only, distinto do `ScheduledCare` que o originou; histórico planejado nunca é reescrito.
- **G4** "Atrasado" é **derivado** (`planned_date < hoje` e sem desfecho), nunca armazenado, nunca movido pelo sistema (D-28).
- **G5** Concluir é **idempotente** por `client_execution_id`: retry devolve o mesmo fato.
- **G6** Escritas só por RPC server-enforced; o cliente não tem privilégio de escrita em nenhuma das tabelas. Isolamento por RLS fail-closed, com pgTAP positivo e negativo.
- **G7** A derivação de "hoje/atrasado/próximos" é **pura e determinística** em `packages/core` (`today` é input, nunca lido do relógio) — a mesma função serve a tela e os testes.

## 4. Non-Goals

- **Check-ins** (`checkins`, "como ficou o cabelo") → SPEC-006.
- **Conteúdo por care type** ("como fazer uma hidratação"), catálogo `care_types` → SPEC-007. Aqui o care type continua sendo um **código**.
- **Notificações / lembretes** → SPEC-008.
- **Progresso, adesão, gráficos, streaks** → SPEC-009 (streaks: D-25, sem tabela).
- **Reavaliação** (novo perfil → novo plano) → SPEC-014. O supersede já existe desde a SPEC-004.
- **Calendário em grade mensal.** A fatia entrega lista de hoje + próximos + histórico do plano ativo; a grade é UI que nenhum fluxo desta fatia exige.
- **Execução avulsa** (`scheduled_care_id NULL`, cuidado sem agendamento) — DOMAIN-MAP §3.5 a permite, mas nenhum fluxo desta fatia a exige. DEFER (§8).
- **Nota livre na execução** e **motivo do pulo** — DEFER (§8); nota é território de check-in (SPEC-006).
- **Fila offline / sincronização otimista.** O `executed_on` é calculado pelo servidor (§9); uma fila local reintroduziria exatamente o problema que a RPC resolve. Erro com retry explícito cobre rede instável.
- **Analytics.** Nenhum evento nesta SPEC (precedente D-65) → SPEC-011.
- IA, monetização, gamificação, social, catálogo de produtos, design final.

## 5. User Stories

- **US1** Como usuária, quero abrir o app e ver **o que fazer hoje**, para não precisar interpretar um cronograma.
- **US2** Como usuária, quero **marcar um cuidado como feito**, para o app saber o que já aconteceu.
- **US3** Como usuária, quero ver que um cuidado **está atrasado** e decidir o que fazer com ele, em vez de o app decidir por mim (D-28).
- **US4** Como usuária, quero **pular** um cuidado que não vou fazer, sem que ele fique me cobrando para sempre.
- **US5** Como usuária, quero **reagendar** um cuidado para um dia que funcione, sem perder o registro de que ele era para outro dia.
- **US6** Como usuária, quero ver os **próximos cuidados** para me organizar.
- **US7** Como usuária, quero **reabrir o app** e encontrar exatamente o estado que deixei.

## 6. Functional Requirements

- **FR1** A tela "Hoje" mostra, do plano **ativo**: cuidados de hoje, cuidados **atrasados** e os próximos.
- **FR2** Cada cuidado planejado sem desfecho oferece **Fiz hoje**, **Pular** e **Reagendar** (D-28).
- **FR3** **Concluir** cria um `CareExecution` ligado ao `ScheduledCare`. O `ScheduledCare` **não** é alterado (§7 BR2).
- **FR4** **Pular** marca o `ScheduledCare` como `skipped`. Não gera execução.
- **FR5** **Reagendar** marca o original como `rescheduled`, aponta `rescheduled_to_id` para uma **nova** linha `planned` no mesmo plano, na data escolhida. A `planned_date` original **nunca** muda.
- **FR6** Um cuidado só transiciona a partir de `planned`. Tentar transicionar um cuidado já resolvido é rejeitado (`conflict`), não silenciosamente aceito.
- **FR7** Concluir é idempotente por `client_execution_id`: a mesma chave devolve a execução existente, sem criar um segundo fato.
- **FR8** O servidor calcula `executed_on` e "hoje" a partir do **fuso IANA** enviado pelo cliente, validando plausibilidade (§11 / T22).
- **FR9** O histórico do plano ativo (feitos, pulados, reagendados) é consultável na tela.
- **FR10** Sem plano ativo, a tela "Hoje" não existe: a rota continua no fluxo da SPEC-004 (preview/confirmação).

## 7. Business Rules

Todas as regras abaixo são **mecanismo**, não conhecimento capilar — nenhuma decide *o que* é bom para o cabelo (D-26 não é acionado).

- **BR1** *(D-28)* O sistema **nunca** desloca um cuidado. Não existe job, trigger ou regra que altere `planned_date` ou crie reagendamento automático. Todo movimento nasce de ação explícita.
- **BR2** *(planejado ≠ executado)* `ScheduledCare` guarda a **intenção**; `CareExecution` guarda o **fato**. Concluir insere um fato e não reescreve a intenção. `packages/core/src/care-tracking/`.
- **BR3** *(atrasado é derivado)* `overdue ⇔ planned_date < hoje ∧ status = 'planned' ∧ sem execução`. Nunca persistido.
- **BR4** *(concluído é derivado)* Um cuidado está concluído **se e somente se** existe uma `CareExecution` para ele. Não há `status='completed'` — ver a necessity review em §8.
- **BR5** *(transição a partir de `planned`)* `planned → skipped`, `planned → rescheduled`, `planned → (execução criada)`. Nenhuma outra transição existe. Estados resolvidos são terminais nesta fatia.
- **BR6** *(invariante de reagendamento)* `status = 'rescheduled' ⇔ rescheduled_to_id IS NOT NULL` (CHECK) — invariante 6 do DATA-MODEL.
- **BR7** *(fronteira ADR-007)* Reagendar **não** invoca o Schedule Engine. O engine cria cuidados; Care Tracking transiciona e cria a linha de reagendamento.
- **BR8** *(janela de reagendamento)* A nova data é `hoje ≤ data ≤ hoje + 28`. O limite reusa a janela de plano já aprovada (D-67) em vez de inventar um número; o piso impede "reagendar para ontem", que criaria um atraso artificial. A nova linha pode cair fora da janela original do plano — a janela governa **geração**, não reagendamento.
- **BR9** *(um plano por vez)* Todas as leituras e ações operam sobre o plano `active`. Cuidados de planos `superseded` permanecem no banco e não aparecem na tela.

## 8. Data Model Impact

### 8.1 `scheduled_cares` — colunas que a SPEC-004 adiou explicitamente para cá

| Coluna | KEEP/DEFER | Motivo |
| --- | --- | --- |
| `status text not null default 'planned'` | **KEEP** | CHECK `in ('planned','skipped','rescheduled')`. Sem `completed` — ver 8.2. |
| `rescheduled_to_id uuid null` | **KEEP** | FK composta `(rescheduled_to_id, user_id) → scheduled_cares (id, user_id)`; CHECK do BR6. |
| `UNIQUE (id, user_id)` | **KEEP** | alvo das FKs compostas de ownership (mesmo padrão da SPEC-004). |
| ~~`origin`~~ | **DEFER** | derivável: uma linha é destino de reagendamento sse alguma linha aponta para ela. Reabrir se a UI precisar distinguir sem join. |
| ~~`skip_reason`~~ | **DEFER** | nenhum fluxo desta fatia coleta ou exibe motivo. |
| ~~`updated_at`~~ | **DEFER** | sem consumidor; a transição é registrada pelo próprio `status`. |

Índice novo: `(user_id, planned_date) WHERE status = 'planned'` — é exatamente a consulta de "hoje/atrasado/próximos". O índice `(plan_id, planned_date)` da SPEC-004 permanece.

### 8.2 Necessity review — `status = 'completed'` é **REMOVIDO**

O DATA-MODEL §3.6 previa `completed` no enum. Nesta fatia isso seria uma **segunda fonte de verdade** para um fato que já vive em `care_executions`: duas coisas que podem discordar, e uma delas mentindo sobre o histórico. Como a tela precisa da execução de qualquer forma (para mostrar quando foi feito), o join não custa nada.

→ `completed` sai do enum. **Concluído = existe execução** (BR4). Isso torna a distinção planejado/executado **estrutural**, não convencional. `DATA-MODEL.md` §3.6 é atualizado na implementação.

### 8.3 `care_executions` — nova tabela (append-only)

| Coluna | KEEP/DEFER | Motivo |
| --- | --- | --- |
| `id uuid PK` | **KEEP** | |
| `user_id` FK `auth.users` on delete cascade | **KEEP** | convenção DATA-MODEL §1 (RLS uniforme) |
| `scheduled_care_id uuid not null` | **KEEP** | FK composta `(scheduled_care_id, user_id) → scheduled_cares (id, user_id)`: o banco impede uma execução apontar para o cuidado de outra pessoa, independente da RPC. **`not null` porque execução avulsa está fora do escopo** (§4); permitir avulsa depois é `DROP NOT NULL`, aditivo. |
| `care_type_code text not null` | **KEEP** | CHECK contra o conjunto D-67. Redundante com o cuidado hoje, mas é o **fato histórico**: se a tabela `care_types` da SPEC-007 mudar rótulos, o que foi feito continua legível. |
| `client_execution_id uuid not null` | **KEEP** | idempotência; `UNIQUE (user_id, client_execution_id)` |
| `executed_at timestamptz not null default now()` | **KEEP** | instante real, do servidor |
| `executed_on date not null` | **KEEP** | dia civil da usuária, **calculado pelo servidor** (§9/T22) |
| `created_at timestamptz` | **KEEP** | |
| ~~`note`~~ | **DEFER** | texto livre é PII e território de check-in (SPEC-006) |
| ~~`voided_at`~~ | **DEPENDE DE D-12** | §23 — sem D-12 aprovado, a coluna não existe |

Invariantes:

- `UNIQUE (user_id, client_execution_id)` — idempotência (T19). *(O DATA-MODEL §3.7 dizia `UNIQUE` global; escopar por usuária mantém a mesma garantia e segue o padrão de `hair_plans.client_request_id` da SPEC-004.)*
- `UNIQUE (scheduled_care_id)` — no máximo uma execução por cuidado (**depende de D-35**; ver §23).
- Índice `(user_id, executed_on desc)` para o histórico.

**Sem** `checkins`, **sem** `care_types`, **sem** tabela de progresso.

## 9. API / Contracts

Não há Edge Function nesta fatia. A SPEC-004 precisou de uma porque o **engine** (TypeScript) tinha de rodar no servidor; aqui as transições são mudanças de estado com invariantes que o Postgres já sabe impor. Adicionar uma Edge só para repassar a chamada seria mecanismo sem necessidade.

Três RPCs `SECURITY DEFINER`, `search_path` fixo, `EXECUTE` para `authenticated`. A usuária **nunca** é um parâmetro: sai de `auth.uid()`.

| RPC | Entrada | Saída | Erros |
| --- | --- | --- | --- |
| `complete_care` | `p_scheduled_care_id uuid`, `p_client_execution_id uuid`, `p_timezone text` | `uuid` (execution id) | `P0002` cuidado não encontrado/não é seu · `23514` estado inválido (não é `planned`) · `22023` fuso implausível |
| `skip_care` | `p_scheduled_care_id uuid` | `void` | idem |
| `reschedule_care` | `p_scheduled_care_id uuid`, `p_new_date date`, `p_timezone text` | `uuid` (novo scheduled care) | idem + `22023` data fora de `[hoje, hoje+28]` |

Comportamento comum:

- Ownership verificada por `auth.uid()` **e** pela FK composta — nunca só pela RPC.
- `complete_care` é idempotente: se já existe execução com `(auth.uid(), p_client_execution_id)`, retorna-a sem criar nada. A colisão de `UNIQUE` é tratada em subtransação, então um retry concorrente nunca aborta a transação externa (mesmo padrão de `create_plan_tx`).
- `skip_care` e `reschedule_care` só agem sobre `status = 'planned'`; a linha é travada com `FOR UPDATE` (a linha **existe**, então aqui `FOR UPDATE` basta — o advisory lock da SPEC-004 existia por causa do caso "nenhuma linha ainda").
- **Fuso:** `executed_on := (now() AT TIME ZONE p_timezone)::date`. O Postgres rejeita fuso inválido. Plausibilidade (T22): a data resultante deve estar a **≤ 1 dia** da data UTC do servidor — o offset civil real vai de −12h a +14h.

Leitura: `SELECT` direto nas duas tabelas sob RLS. A derivação de hoje/atrasado/próximos é `packages/core` (§G7), não view nem query mágica.

## 10. Authorization

| Ator | `scheduled_cares` | `care_executions` | RPCs |
| --- | --- | --- | --- |
| `anon` | nada | nada | nada |
| `authenticated` | **SELECT** próprio | **SELECT** próprio | EXECUTE nas três |
| RPC (DEFINER) | SELECT/UPDATE | INSERT | — |

RLS ON + FORCE nas duas tabelas; policies `SELECT` por `user_id = (select auth.uid())`. **Nenhum grant de escrita para `authenticated`** — é o que impede um cliente adulterado de forjar um fato. Como `FORCE RLS` vale também para o dono da tabela e a função DEFINER roda como ele, as policies explícitas `to postgres` da SPEC-004 são estendidas a `care_executions` (mesmo motivo: não depender de `BYPASSRLS` do papel de plataforma).

`EXECUTE` para `authenticated` é seguro aqui — ao contrário de `create_plan_tx`. Aquela RPC recebia o **conteúdo** do plano, então quem pudesse chamá-la poderia inventar um plano. Estas recebem só o id de um cuidado que já é dela, uma chave de idempotência e um fuso; tudo mais é derivado no servidor. Não há nada a forjar.

As três funções entram em `supabase/security/allowlists.sql` com justificativa (SECURITY-BASELINE S5).

## 11. Security Considerations

| Ameaça | Tratamento |
| --- | --- |
| **T02** IDOR | RLS + `auth.uid()` na RPC + FK composta de ownership; erro indistinguível entre "não existe" e "não é seu" |
| **T19** replay / double submit | `client_execution_id` + `UNIQUE (user_id, …)` + subtransação; botão bloqueado em voo |
| **T22** timezone manipulation | `executed_on` calculado pelo servidor a partir do fuso IANA; validação de ±1 dia contra a data UTC |
| **T15** agente afrouxando autorização | pgTAP positivo/negativo obrigatório; guardrails da Foundation em 0 |
| **T17** PII em analytics | nenhum evento nesta SPEC; sem `note`/`skip_reason` para vazar |
| **T07** abuso de Edge | **não se aplica**: não há Edge Function nesta fatia |

Sem SQL dinâmico. Sem `service_role` no app. Nenhum dado de execução em log.

## 12. Privacy Considerations

Novo dado pessoal: **comportamental** (o que a usuária fez e quando). Não sensível, não é dado de saúde. Sem texto livre nesta fatia — logo, sem o campo de maior risco de PII do DATA-MODEL §4. Retenção: até a exclusão da conta; purga por cascade de `auth.users` (já testada desde a SPEC-001). Nada em log, analytics ou crash report.

## 13. Analytics Events

**Nenhum.** Segue o precedente D-65 (SPEC-002): o catálogo e o provider entram na SPEC-011, com consentimento. Não criar adapter no-op por antecipação.

## 14. UX Notes (sem design visual)

Uma tela, `apps/mobile/src/features/care/TodayScreen.tsx`, substituindo a tela de cronograma da SPEC-004 quando existe plano ativo.

Seções, nesta ordem: **Atrasados** (só se houver) → **Hoje** → **Próximos** → **Histórico** (recolhido).

Estados:

- **loading** — leitura em curso; sem flash de "vazio".
- **empty (hoje)** — "Nenhum cuidado hoje." Não é erro; próximos continuam visíveis.
- **empty (plano acabou)** — todos os cuidados do plano resolvidos ou passados: mensagem de fim de ciclo, sem oferecer reavaliação (SPEC-014).
- **error** — mensagem genérica + **Tentar novamente**. Nunca a mensagem do banco.
- **em voo** — o cuidado sendo transicionado fica desabilitado; sem duplo toque.
- **conflito** — se a ação falhar por já estar resolvido, a tela **recarrega** e mostra o estado real, em vez de insistir num erro.

Um cuidado atrasado mostra há quanto tempo ("atrasada há 2 dias") e as três ações lado a lado (D-28). Acessibilidade: alvos ≥ 44pt, `accessibilityRole="button"`, `accessibilityLiveRegion` nas mudanças de estado — mesmo padrão das telas existentes.

## 15. Edge Cases

- **EC1** Toque duplo em "Fiz hoje" → o botão trava em voo; e mesmo que dois cheguem, a chave de idempotência devolve o mesmo fato.
- **EC2** Resposta perdida e retry → mesma chave, mesma execução, nenhum segundo fato.
- **EC3** Dois aparelhos, mesma usuária, mesmo cuidado → o `FOR UPDATE` serializa; o segundo recebe conflito e a tela recarrega.
- **EC4** Virada do dia com o app aberto → "hoje" é recalculado a cada leitura; o servidor é a autoridade no momento da escrita.
- **EC5** Viagem entre fusos → o fuso vai em cada chamada; a validação de ±1 dia acomoda qualquer offset real.
- **EC6** Cuidado atrasado há semanas → continua atrasado, nunca é movido (BR1). As três ações continuam disponíveis.
- **EC7** Reagendar para hoje → válido (BR8); o cuidado passa a aparecer na seção Hoje.
- **EC8** Reagendar um cuidado já reagendado → rejeitado (BR5); a linha original é terminal.
- **EC9** Plano superseded no meio da sessão (outro aparelho reavaliou) → a leitura seguinte traz o novo plano ativo; cuidados do antigo somem da tela e permanecem no banco.
- **EC10** Todos os cuidados do plano no passado → seção Hoje vazia, Atrasados povoada; navegação intacta.
- **EC11** Relógio do aparelho adiantado em dias → o servidor calcula `executed_on`; a validação de plausibilidade rejeita o fuso implausível.

## 16. Failure Modes

| Falha | Comportamento |
| --- | --- |
| Leitura falha | tela de erro com retry; nada é assumido |
| RPC falha (rede) | cuidado volta a habilitado; mensagem genérica; a chave de idempotência é **reusada** no retry |
| RPC falha (conflito) | recarrega e mostra o estado real |
| Fuso inválido/implausível | erro genérico; nenhum fato gravado |
| Sem plano ativo | rota volta ao fluxo da SPEC-004 |

Nenhuma mensagem de erro expõe SQL, id alheio ou detalhe interno.

## 17. Acceptance Criteria

| ID | Critério |
| --- | --- |
| **AC1** | Dado um plano ativo, a tela Hoje mostra os cuidados de hoje, os atrasados e os próximos, derivados por uma função **pura** de `packages/core` que recebe `today` como input (sem relógio; teste unitário). |
| **AC2** | Concluir um cuidado cria exatamente uma `CareExecution` ligada a ele e **não** altera a linha `scheduled_cares` (pgTAP compara a linha antes e depois). |
| **AC3** | Dois `complete_care` com o mesmo `client_execution_id` resultam em **uma** execução; o segundo devolve a existente (pgTAP). |
| **AC4** | `authenticated` não consegue INSERT/UPDATE/DELETE direto em `scheduled_cares` nem em `care_executions` (pgTAP, `42501`). |
| **AC5** | Pular marca `status='skipped'` e **não** cria execução; o cuidado sai de Hoje e aparece no histórico (pgTAP + teste de componente). |
| **AC6** | Reagendar marca o original `rescheduled` com `rescheduled_to_id` preenchido, cria uma nova linha `planned` na data escolhida, e a `planned_date` original permanece **inalterada** (pgTAP). |
| **AC7** | Transicionar um cuidado já resolvido é rejeitado; nenhum estado muda (pgTAP para as três RPCs). |
| **AC8** | Reagendar para antes de hoje ou depois de hoje+28 é rejeitado (pgTAP). |
| **AC9** | `executed_on` é calculado pelo servidor: um fuso implausível é rejeitado e dois fusos válidos distintos produzem o dia civil correto (pgTAP com fusos fixos). |
| **AC10** | Isolamento: A não lê nem transiciona cuidados/execuções de B; `anon` não lê nada (pgTAP). |
| **AC11** | Guardrails da Foundation (`tables_without_rls`, `unapproved_grants`, `unapproved_security_definer_functions`) continuam em 0 com o novo schema e as três RPCs. |
| **AC12** | "Atrasado" e "concluído" são **derivados**: não existe coluna para nenhum dos dois (inspeção de schema no pgTAP). |
| **AC13** | Reabrir o app reconstrói o estado a partir do servidor: sem cache local, o que foi feito continua feito (teste de componente com remount). |
| **AC14** | Duplo toque em uma ação dispara **uma** chamada; o retry após falha reusa o mesmo `client_execution_id` (teste de componente). |
| **AC15** | Estados vazios (sem cuidado hoje; plano todo no passado) renderizam sem quebrar a navegação. |

## 18. Testing Strategy

- **Unit (Vitest, core):** `buildTodayView` — hoje/atrasado/próximos/histórico, viradas de dia, plano todo no passado, cuidado reagendado não conta duas vezes. Determinismo com `today` injetado.
- **Integração (pgTAP):** `040_spec005_care_tracking.sql` — as três RPCs (feliz, conflito, idempotência, ownership, fuso), negação de escrita direta, isolamento A/B/anon, guardrails, ausência das colunas derivadas.
- **Component (Jest/RNTL):** tela Hoje — loading, vazio, erro+retry, duplo toque, conflito recarrega, remount preserva estado.
- **E2E:** fora (ferramenta na fase 10).
- **Boundary:** dep-cruise — `care-tracking` puro, sem React/Expo/Supabase.

## 19. Dependencies

SPEC-004 (plano ativo e `scheduled_cares`). ADR-001/004/007/008. **Nenhuma dependência npm nova.** Nenhum serviço externo, nenhuma credencial nova. Sem gerenciador de estado global (D-36 permanece DEFER: um `useState` por tela continua bastando).

## 20. Implementation Plan

Uma PR, quatro commits, na ordem em que cada um pode ser verificado sozinho:

1. `packages/core/src/care-tracking/` — tipos, `buildTodayView` puro, `CareTrackingPort`, testes unitários.
2. Migration: colunas de transição em `scheduled_cares`, `care_executions`, RLS/grants/policies, as três RPCs, allowlist + pgTAP `040`.
3. App: adapter das RPCs + `TodayScreen` + rota; testes de componente.
4. Docs: DATA-MODEL §3.6/§3.7, DOMAIN-MAP §3.5, README do contexto, evidência por AC.

## 21. Migration Plan

Uma migration aditiva, `NNNNNNNNNNNNNN_care_tracking.sql`. `scheduled_cares.status` entra com `default 'planned'`, então as linhas existentes ficam corretas sem backfill. Nenhuma coluna é removida ou alterada. App antigo continua funcionando: ele só faz `SELECT`, e as colunas novas são aditivas.

## 22. Rollback Plan

Comentário `-- ROLLBACK:` na migration: drop das três funções → drop de `care_executions` → drop das colunas/índices adicionados em `scheduled_cares`. Sem perda de dados de outras SPECs (`care_executions` nasce vazia). Código: reverter a PR.

## 23. Open Questions

| ID | Classe | Pergunta | Recomendação |
| --- | --- | --- | --- |
| **OQ1** | **BLOCKING — decisão humana agendada para esta SPEC (D-12)** | Existe "desfazer" de uma execução? | **Sim, janela curta** (a recomendação provisória do registro). Sem isso, um toque errado em "Fiz hoje" é **irreversível** — a tabela é append-only e a usuária não tem DELETE. Custo: uma coluna `voided_at`, uma RPC `void_execution`, e o índice único vira parcial (`WHERE voided_at IS NULL`). Se a resposta for "não", removo os três e a fatia encolhe. |
| **OQ2** | **BLOCKING — decisão humana agendada para esta SPEC (D-35)** | Um mesmo `scheduled_care` pode ter mais de uma execução? | **Não** (a recomendação provisória do registro). Com "não", `UNIQUE (scheduled_care_id)` (parcial, se OQ1 for sim). Repetir um cuidado no mesmo dia seria execução avulsa, que está fora do escopo (§4). |
| OQ3 | IMPORTANT — resolvida nesta SPEC | Guardar `status='completed'` além do fato de execução? | **Não** (§8.2): segunda fonte de verdade para o mesmo fato. |
| OQ4 | IMPORTANT — resolvida nesta SPEC | Reagendar só cuidado atrasado, ou qualquer `planned`? | **Qualquer `planned`.** Uma regra só, e D-28 não restringe. |
| OQ5 | CAN DEFER | Histórico atravessa planos superseded? | Não nesta fatia (BR9): histórico é do plano ativo. Reabrir na SPEC-009 (Progress), que é quem precisa de série longa. |
| OQ6 | CAN DEFER | Limite de itens em "Próximos"/"Histórico"? | Janela de 28 dias cabe inteira na tela; paginar só se a SPEC-014 permitir planos longos. |

## 24. Change Log

| Data | Mudança | Autor |
| --- | --- | --- |
| 2026-08-27 | v0.1 Draft. Escopo: tornar o cronograma da SPEC-004 utilizável (hoje/atrasado/próximos + concluir/pular/reagendar). Necessity review: **sem Edge Function** (não há engine a rodar no servidor), **sem `status='completed'`** (derivado da execução), `origin`/`skip_reason`/`note`/`updated_at`/execução avulsa/calendário em grade **DEFER**, analytics **DEFER** (D-65). D-28 aplicada integralmente. **Dois BLOCKING**: D-12 e D-35, ambos agendados pelo registro para esta SPEC. | Claude |
