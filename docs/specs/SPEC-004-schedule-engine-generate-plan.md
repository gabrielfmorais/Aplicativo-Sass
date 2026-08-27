# SPEC-004 — Schedule Engine v1 + generate-plan (inclui Assessment/Diagnostic)

| Campo | Valor |
|---|---|
| ID | SPEC-004 |
| Status | **Draft** (via `spec-create` 2026-08-27; aguarda revisão humana — HUMAN GATE. Nenhum código, migration, dependência ou seed criado por esta SPEC) |
| Owner | @gabrielfmorais (humano) |
| Bounded Context | Schedule/Planning (Core) + Assessment/Diagnostic (Core) — DOMAIN-MAP §3.3/§3.4 |
| Related ADRs | ADR-007 (engines puros/versionados + A1 governança D-26 + **A2 vertical slice D-66**), ADR-004 (Supabase/RLS/RPC/Edge), ADR-001 (camadas), ADR-008 (time) |
| Related SPECs | SPEC-002 (Hair Profile — entrega `HairProfileSnapshot`) · SPEC-003 (**folded here** — D-66) · SPEC-005 (Care Tracking — transições de `scheduled_cares`) · SPEC-007 (Content — `care_types`/conteúdo) · SPEC-014 (Reassessment) |
| Decisões vinculantes | D-06 (engines puros/versionados/golden), **D-26** (não inventar regra capilar), **D-66** (fold Assessment+Schedule numa slice; `diagnostic_results` não pré-aprovada), D-28 (nunca deslocar cronograma silenciosamente) |
| Fase do roadmap | 4 — Schedule Engine v1 + generate-plan |
| Labels | `engine`, `db`, `security` |
| Criado / Atualizado | 2026-08-27 / 2026-08-27 |

> **Escopo D-26/D-66:** engenharia define **(A) o mecanismo** (dois engines puros `diagnostic/` e `schedule/`, execução server-enforced, persistência, versionamento, golden tests). O **(B) conteúdo capilar** — o que a avaliação infere, as regras, a cadência/ciclo, o conjunto de care types — é **hipótese até validação especializada** e **BLOQUEIA** a implementação user-facing (§13). Termo de produto: **"Avaliação capilar"** + **cronograma personalizado** (nunca diagnóstico médico).
>
> Esta SPEC segue a **regra de necessidade** (Ponytail/YAGNI): cada tabela/coluna/RPC/Edge/versão/objeto só existe se um requisito **atual** do MVP o exigir. `diagnostic_results` como tabela é **necessity-reviewed** aqui (§9), não herdada.

## 1. Context
SPEC-002 coleta o perfil (8 inputs). Nada ainda transforma isso em valor. Esta slice entrega o **primeiro loop de valor percebido** (P01/P05, H1): a usuária conclui o onboarding e vê **sua avaliação capilar + um cronograma de cuidados personalizado**. Pela ADR-007 A2 (D-66), Assessment e Schedule são módulos distintos mas entregues juntos.

## 2. Problem
Dado o `HairProfileSnapshot`, produzir de forma **determinística, server-enforced e reproduzível** um `HairPlan` com `ScheduledCares` (o que fazer e quando), preservando histórico ao reavaliar, sem que um cliente adulterado crie planos arbitrários, e mostrando à usuária um preview instantâneo. Sem inventar ciência capilar.

## 3. Goals
- G1 `assess(HairProfileSnapshot) → AssessmentOutput` e `generateSchedule(AssessmentOutput, context) → { plan, cares }`: **puros, determinísticos, sem I/O** (ADR-007/D-06); `referenceDate`/`timezone`/`startsOn` são inputs.
- G2 Criação oficial do plano é **server-enforced** (Edge Function reusa `packages/core`; cliente não grava plano direto — P10/ADR-004).
- G3 **Um plano `active` por usuária**; reavaliar cria novo plano e marca o anterior `superseded` (nunca regenera histórico — ADR-007).
- G4 Reprodutibilidade: dá para saber qual perfil + versões geraram um plano, com o **menor mecanismo de provenance** necessário (§10).
- G5 Preview instantâneo no cliente com a **mesma** lógica (P01).
- G6 Isolamento por RLS fail-closed (pgTAP); nunca deslocar o cronograma silenciosamente (D-28 — transições são SPEC-005).
- G7 Nenhuma regra/cadência/care type inventada por engenharia (D-26).

## 4. Non-Goals
- Transições de cuidado (completar/pular/reagendar/desfazer) e projeção de calendário/"Today" → **SPEC-005**.
- Catálogo de conteúdo por care type e telas de conteúdo → **SPEC-007** (esta SPEC só precisa dos **códigos** de care type — §9).
- Notificações → SPEC-008. Check-ins → SPEC-006. Progresso → SPEC-009.
- Reavaliação como fluxo de UI → SPEC-014 (o mecanismo de supersede é preparado aqui).
- **As regras de assessment/schedule e o conjunto de care types** (conteúdo capilar) — **HUMAN GATE / D-26** (§13).
- `confidence`/score/porcentagem de dano (falsa precisão — proibido, D-66).
- IA; nova dependência além do já aprovado.

## 5. User-facing flow (valor mínimo)
1. Usuária conclui o onboarding (SPEC-002) → há um `HairProfileSnapshot`.
2. App roda **preview local** (mesmo core) e mostra **"Avaliação capilar"** (poucos reason codes → copy) **+ "Este é o seu cronograma"** (próximas semanas de cuidados) numa **experiência integrada** (sem tela isolada de "diagnóstico").
3. Ao confirmar, o app chama `generate-plan` (Edge) que **persiste** o `HairPlan` + `ScheduledCares` de forma transacional.
4. A usuária passa a ter um plano ativo; a tela "hoje/calendário" e as ações são da SPEC-005.

## 6. Assessment responsibilities
`packages/core/src/diagnostic/` (puro): `HairProfileSnapshot` → `AssessmentOutput` = **apenas inferências** que habilitam uma decisão do Schedule e que **não** estão diretamente no perfil (§8). Sem reempacotar dado observado. Conteúdo (o que infere, como) = domínio (§13).

## 7. Schedule responsibilities
`packages/core/src/schedule/` (puro): `AssessmentOutput` + contexto aprovado (`startsOn`, `timezone`, janela, frequência de lavagem lida do perfil) → `HairPlanDraft` + `ScheduledCareDraft[]`. Cadência/ciclo/janela = domínio (§13). O engine **não** lê o relógio (referenceDate injetado, ADR-008).

## 7b. Boundary between both
Assessment responde **"do que este cabelo precisa"** (inferência); Schedule responde **"quando/quais cuidados"** (cadência a partir das necessidades). Dois módulos puros, uma slice. O Schedule lê dado **observado** direto do `HairProfileSnapshot`; consome do Assessment só o **inferido**.

## 8. Minimum AssessmentOutput candidates
Regra: manter só inferências que habilitam uma decisão do Schedule **não** derivável direto do perfil.

| Output | Consumer | Decision enabled | Observed/Inferred | Can derive directly? | KEEP / REMOVE / TBD |
|---|---|---|---|---|---|
| Necessidades (eixos/níveis — ex. hidratação/nutrição/reconstrução) | Schedule | escolher ciclo/mix de cuidados | **inferred** (regra) | Não (é o conhecimento capilar) | **TBD — domínio (§13)**; provável KEEP |
| Flags (ex. dano por calor/química) | Schedule / Content | ênfase/segurança do plano | inferred, mas próximo do observado | Parcial (`heat_usage`, `chemical_treatments` já observados) | **TBD** — KEEP só se decidir algo além das necessidades; senão REMOVE (§5 falsa inteligência) |
| `evidence` (reason codes) | UI (preview) | explicar personalização (P05) | inferred (qual regra disparou) | Não | **TBD** — KEEP mínimo se a tela exibir "por quê"; copy fica na UI/conteúdo |
| Passthrough de `primary_goal`/`chemical_treatments`/etc. | Schedule | — | **observed** | **Sim** (lê do snapshot) | **REMOVE** (não reempacotar) |
| `confidence`/score | — | nenhuma | inventado | — | **REMOVE** |

Conclusão provável: `AssessmentOutput` mínimo = **necessidades inferidas (+ reason codes se houver "por quê" na tela)**; tudo observado o Schedule lê do snapshot. Forma final = após §13.

## 9. Persistence necessity review
**`diagnostic_results` (tabela independente) — necessity review (D-66):**
- Lifecycle independente do `HairPlan`? **Não** (no MVP a avaliação só existe para gerar um plano).
- Consultada independentemente? **Não** (nenhuma feature MVP lê avaliação sem plano).
- Feature MVP que precise dela sem plano? **Não**.
- Identidade própria necessária? **Não** agora.
- Reusada por >1 consumidor atual? **Não** (só Schedule).
- Auditoria/reprodutibilidade impossível de preservar mais simplesmente junto ao plano? **Não** — pode ser gravada **inline** no `HairPlan` (snapshot jsonb).
→ **Decisão proposta: REMOVE/DEFER `diagnostic_results` como tabela independente.** `AssessmentOutput` é **transitório** entre os engines; a reprodutibilidade vive **inline** no `hair_plans` (`input_snapshot` + versões). Reabrir só se surgir requisito concreto (ex.: histórico de avaliação sem plano) — reportar antes.

**KEEP (necessidade atual do MVP):**
- `hair_plans` — a usuária precisa de um plano persistido e ativo.
- `scheduled_cares` — os itens do cronograma que a SPEC-005 vai exibir/transicionar.

**TBD/mínimo:**
- `care_types` — `scheduled_cares` precisa tipar cada cuidado. O **conjunto** de care types é conteúdo capilar (§13). Proposta mínima: `scheduled_cares.care_type_code text` validado por **CHECK contra o conjunto aprovado**; **tabela `care_types` + FK e conteúdo ficam na SPEC-007** (Content) — não criar catálogo agora. Reavaliar se a SPEC-007 vier antes.

## 10. Minimal proposed data model (conceitual; sem migration)
`hair_plans` (raiz; RLS por `auth.uid()`):
| Coluna | Tipo | Necessidade |
|---|---|---|
| id | uuid PK | identidade do plano |
| user_id | uuid not null FK auth.users on delete cascade | ownership |
| hair_profile_id | uuid not null FK hair_profiles | proveniência (qual snapshot) |
| status | text CHECK (active/superseded) | 1 ativo por usuária |
| starts_on | date | dia local de início |
| timezone | text | snapshot da tz na geração (ADR-008) |
| strategy | jsonb | ciclo/cadência gerados (**conteúdo = §13**) |
| input_snapshot | jsonb | perfil + `AssessmentOutput` usados (reprodutibilidade inline — substitui `diagnostic_results`) |
| assessment_version, schedule_version | text | provenance **só se** §11 concluir que é necessário |
| superseded_by_plan_id | uuid null FK hair_plans | reavaliação (SPEC-014) |
| created_at / updated_at | | `updated_at` só na transição de status |

Invariante DB: `CREATE UNIQUE INDEX one_active_plan_per_user ON hair_plans(user_id) WHERE status='active'`.

`scheduled_cares` (itens do plano; RLS por `auth.uid()`):
| Coluna | Tipo | Necessidade |
|---|---|---|
| id | uuid PK | |
| user_id | uuid not null FK auth.users | ownership/RLS |
| plan_id | uuid not null FK hair_plans | pertence ao plano |
| care_type_code | text CHECK (conjunto aprovado — §13) | tipo do cuidado (FK→`care_types` só na SPEC-007) |
| planned_date | date | dia local planejado |
| sequence | int | posição no ciclo |
| status | text CHECK default 'planned' | **apenas `planned` nesta SPEC**; transições (completed/skipped/rescheduled) = SPEC-005 |
| created_at | | |

Índices: `(user_id, planned_date)`, `(plan_id, planned_date)`. **Sem** `diagnostic_results`, sem colunas de reagendamento (SPEC-005), sem `algorithm_version` cerimonial (§11).

## 11. Algorithm versioning necessity
- `assessment_version` / `schedule_version` só se **mudanças nas regras puderem gerar resultados diferentes para o mesmo input** E houver necessidade **real** de provenance de um plano persistido. Como o plano **é** persistido e a reavaliação cria novos planos (não regenera), há um caso real: explicar/reproduzir um plano histórico. → Proposta: **manter uma única string de versão por engine, gravada no plano** (o menor provenance útil). Não criar registro/tabela de versões nem versionar o que não persiste. Golden tests protegem cada versão liberada; versão só incrementa quando o comportamento muda.

## 12. Proposed execution architecture
- **Preview:** cliente executa `assess`+`generateSchedule` do `packages/core` (sem persistir) — P01.
- **Criação oficial:** Edge Function **`generate-plan`** (Deno; importa `packages/core` — D-40/CORE-RUNTIME-SPIKE) valida a sessão, roda os engines e grava via **RPC transacional `create_plan_tx`** (supersede o plano ativo + insere `hair_plans` + `scheduled_cares` numa transação; garante o índice de 1 plano ativo). Cliente **nunca** insere plano direto (ADR-004/ADR-007). Rate limit por usuária na Edge (T07).
- Necessity: a Edge Function é necessária porque o engine é TS/core e a criação precisa ser server-enforced; a RPC dá atomicidade + o invariante de plano único num só lugar. Sem Edge/RPC extra além disso.

## 13. DOMAIN RULES REQUIRED (HUMAN/ESPECIALISTA — D-26; nada escrito agora)
A SPEC-004 primeiro fixa **quais decisões** o Schedule toma; depois lista o conhecimento a validar:
1. **Decisão do Schedule:** quais **tipos de cuidado** existem (o conjunto `care_type_code`) e o que cada um é.
2. **Cadência/ciclo:** com que frequência e em que ordem cada cuidado entra, em função das necessidades e da frequência de lavagem observada — a regra `ScheduleRulesV1`.
3. **Assessment:** quais **necessidades inferidas** existem e a regra `inputs(8) → necessidades` (incl. `unknown`/`varies`), e quais **flags** (se alguma) agregam decisão real.
4. **Janela de geração** (quantas semanas de `scheduled_cares` criar de início).
5. **reason codes** (se a tela exibir "por quê") e o mapeamento regra→code.
6. Critério de `validated`/`rationale_source` e assinatura (ADR-007 A1). Só `validated` vai a produção.

Até isso, `strategy`/`care_type_code`/necessidades permanecem **TBD**; a implementação do mecanismo (engines puros, Edge, RPC, RLS, tabelas) pode ser preparada, mas **nada user-facing entra em produção sem regras `validated`**.

## 14. Security / integrity
- Criação de plano **só server-side** (Edge + RPC/service role); `authenticated` **não** faz INSERT/UPDATE direto em `hair_plans`/`scheduled_cares` (só SELECT próprio). RLS ON+FORCE nas duas tabelas; policies SELECT por `auth.uid()`; sem grants de escrita para `authenticated` (escrita via RPC `SECURITY DEFINER` allowlistada com `search_path` fixo + `auth.uid()` validado — justificar na allowlist).
- Invariante de **1 plano ativo** por índice único parcial. Idempotência da criação (ex.: `client_execution_id`) para evitar planos duplicados por ret** — avaliar na implementação.
- Rate limit por usuária na Edge (T07). Sem PII/segredos em logs. pgTAP positivo/negativo (isolamento A/B, anon negado, escrita direta negada, 1-ativo).
- Guardrails da Foundation (`tables_without_rls`, `unapproved_grants`, `unapproved_security_definer_functions`) permanecem verdes (a RPC DEFINER entra na allowlist com referência SPEC-004 + justificativa).

## 15. Acceptance Criteria (técnicos — verificáveis sem o conteúdo de domínio)
| ID | Critério |
|---|---|
| AC1 | `assess` e `generateSchedule` são **puros/determinísticos** (mesma entrada+versão ⇒ mesma saída; golden); sem relógio/rede/random (dep-cruise). |
| AC2 | Módulos `diagnostic/` e `schedule/` não importam React/Expo/`@supabase/*`; o `AssessmentOutput` é puro (dep-cruise). |
| AC3 | Preview no cliente e criação na Edge produzem o **mesmo** plano para o mesmo input+versão. |
| AC4 | Criação oficial só ocorre server-side; `authenticated` não consegue INSERT/UPDATE direto em `hair_plans`/`scheduled_cares` (pgTAP + grants). |
| AC5 | Existe no máximo **1 plano `active`** por usuária (índice único parcial; teste). |
| AC6 | Reavaliar cria novo plano e marca o anterior `superseded`; planos antigos e seus `scheduled_cares` permanecem (histórico). |
| AC7 | Isolamento: A não lê plano/cuidados de B; anon nada (pgTAP). |
| AC8 | Um plano persistido é reproduzível a partir de `hair_profile_id` + `input_snapshot` (+ versões, se mantidas) — sem `diagnostic_results`. |
| AC9 | Guardrails da Foundation verdes com o novo schema/RPC (allowlist SPEC-004). |
| AC10 | Nada de `confidence`/score na saída; nenhum valor de perfil em logs. |
| AC11 | **(BLOCKED até §13)** Golden fixtures refletem regras/cadência/care types **validados** por especialista. |

## 16. Testing Strategy
- **Unit + golden (Vitest, core):** determinismo dos dois engines; `unknown`/`varies`; imutabilidade entre versões.
- **Integração (Supabase local + pgTAP):** RLS/grants (A/B, anon, escrita direta negada), 1-plano-ativo, supersede, RPC `create_plan_tx` transacional; Edge `generate-plan` (Deno test) reusando core.
- **Component (Jest/RNTL):** preview renderiza avaliação+cronograma; estados loading/erro/offline.
- **E2E:** onboarding → preview → confirmar → plano ativo (jornada crítica; ferramenta na fase 10).
- **Boundary (dep-cruise):** engines puros.

## 17. Dependencies
- SPEC-002 (`HairProfileSnapshot`). ADR-007/004/001/008. Spike core↔Deno (D-40) já validado.
- **Conteúdo de domínio (bloqueante):** §13. **Nenhuma dependência npm nova** prevista (TS puro + Supabase já presente). Prerrequisito operacional: projeto Supabase de staging para a Edge (não bloqueia o core/local).

## 18. Migration / Rollback Plan
Migrations aditivas: `hair_plans` + `scheduled_cares` + RLS/grants + índice único parcial + RPC `create_plan_tx` (DEFINER, allowlist) — pequenas, com `-- ROLLBACK:`. `supabase gen types` se necessário. `care_types` **não** criada aqui (SPEC-007). Rollback: drop aditivo; tabelas nascem vazias.

## 19. Open Questions & Gates
| ID | Classe | Pergunta | Assunção |
|---|---|---|---|
| **OQ1** | **BLOCKING BEFORE IMPLEMENTATION (HUMAN/ESPECIALISTA — D-26)** | O conteúdo de §13 (care types, cadência/`ScheduleRulesV1`, necessidades/`AssessmentRulesV1`, janela, reason codes). | não inventar; produção só com `validated`. Mecanismo pode ser preparado antes. |
| **OQ2** | **IMPORTANT — necessity** | Confirmar **REMOVE/DEFER de `diagnostic_results`** (avaliação transitória + snapshot inline no plano)? | adotar REMOVE (§9); reabrir só com requisito concreto |
| OQ3 | IMPORTANT | Manter `assessment_version`/`schedule_version` inline no plano (menor provenance)? | sim, uma string por engine (§11) |
| OQ4 | IMPORTANT | `care_types` como texto+CHECK aqui e tabela/FK na SPEC-007? | sim (§9), evita catálogo antecipado |
| OQ5 | CAN DEFER | Idempotência de criação (`client_execution_id`) e rate limit exato | definir na implementação |
| OQ6 | CAN DEFER | Preview offline / reconciliação com versão do servidor (ADR-007 `expected_version`) | tratar na implementação |

## 20. Change Log
| Data | Mudança | Autor |
|---|---|---|
| 2026-08-27 | v0.1 Draft via `spec-create` (vertical slice D-66: Assessment+Schedule). Necessity review: **`diagnostic_results` REMOVE/DEFER** (avaliação transitória + snapshot inline no `hair_plans`); `AssessmentOutput` só inferências (sem reempacotar observado, sem `confidence`); `care_types` texto+CHECK (tabela/FK → SPEC-007); provenance mínimo por versão inline; criação server-enforced (Edge `generate-plan` + RPC `create_plan_tx`); 1 plano ativo; supersede para reavaliação. Conteúdo capilar (regras/cadência/care types) = **HUMAN GATE / BLOCKING** (§13, D-26). | Claude |
