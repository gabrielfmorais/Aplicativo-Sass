# SPEC-004 — Schedule Engine v1 + generate-plan (inclui Assessment/Diagnostic)

| Campo | Valor |
|---|---|
| ID | SPEC-004 |
| Status | **Implemented** (v0.6, 2026-08-27 — aprovada por **D-68**; modelo técnico CLOSED + **regras V1 CANDIDATE** — D-67). Evidência em §21. **PUBLIC RELEASE** continua bloqueado até `validated` (D-26/OQ-REL). |
| Owner | @gabrielfmorais (humano) |
| Bounded Context | Schedule/Planning (Core) + Assessment/Diagnostic (Core) — DOMAIN-MAP §3.3/§3.4 |
| Related ADRs | ADR-007 (engines puros/versionados + A1 governança D-26 + **A2 vertical slice D-66**), ADR-004 (Supabase/RLS/RPC/Edge), ADR-001 (camadas), ADR-008 (time) |
| Related SPECs | SPEC-002 (Hair Profile — entrega `HairProfileSnapshot`) · SPEC-003 (**folded here** — D-66) · SPEC-005 (Care Tracking — transições de `scheduled_cares`) · SPEC-007 (Content — `care_types`/conteúdo) · SPEC-014 (Reassessment) |
| Decisões vinculantes | **D-68** (SPEC-004 approved), D-06 (engines puros/versionados/golden), **D-26** (não inventar regra capilar), **D-66** (fold Assessment+Schedule numa slice; `diagnostic_results` não pré-aprovada), D-28 (nunca deslocar cronograma silenciosamente) |
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
→ **Decisão: REMOVE/DEFER `diagnostic_results` como tabela independente.** `AssessmentOutput` é **transitório** entre os engines. Reprodutibilidade **não** exige snapshot copiado: como os engines são **determinísticos** e as versões liberadas são **imutáveis** (ADR-007), um plano é reproduzível a partir de **`hair_profile_id` (snapshot imutável da SPEC-002) + `assessment_algorithm_version` + `schedule_algorithm_version`**. Por isso **`input_snapshot jsonb` também é REMOVIDO** (§10). Reabrir só com requisito concreto (ex.: histórico de avaliação sem plano) — reportar antes.

**KEEP (necessidade atual do MVP):**
- `hair_plans` — a usuária precisa de um plano persistido e ativo.
- `scheduled_cares` — os itens do cronograma que a SPEC-005 vai exibir/transicionar.

**TBD/mínimo:**
- `care_types` — `scheduled_cares` precisa tipar cada cuidado. O **conjunto** de care types é conteúdo capilar (§13). Proposta mínima: `scheduled_cares.care_type_code text` validado por **CHECK contra o conjunto aprovado**; **tabela `care_types` + FK e conteúdo ficam na SPEC-007** (Content) — não criar catálogo agora. Reavaliar se a SPEC-007 vier antes.

## 10. Minimal proposed data model (conceitual; sem migration) — pós-poda técnica
`hair_plans` (raiz; RLS por `auth.uid()`):
| Coluna | KEEP/REMOVE/TBD | Motivo |
|---|---|---|
| id | **KEEP** | identidade do plano |
| user_id | **KEEP** | ownership; RLS uniforme `user_id = auth.uid()` (convenção DATA-MODEL §1) + índice |
| hair_profile_id | **KEEP** | proveniência do snapshot (reprodutibilidade — §9) |
| starts_on | **KEEP** | dia local de início (input do engine) |
| assessment_algorithm_version | **KEEP** | provenance mínimo de um plano persistido (§11) |
| schedule_algorithm_version | **KEEP** | idem |
| status (active/superseded) | **KEEP** | menor garantia **server-side** de 1 ativo (índice parcial); alternativa "ativo = mais recente" descartada por não ser garantida no servidor |
| client_request_id (uuid) | **KEEP** | idempotência de `generate-plan` (§9-idempotency); `UNIQUE (user_id, client_request_id)` |
| created_at | **KEEP** | ordenação/histórico |
| ~~timezone~~ | **REMOVE/DEFER** | geração usa só `DATE`s (starts_on/planned_date); tz é de SPEC-005/008 |
| ~~strategy jsonb~~ | **REMOVE** | materializado em `scheduled_cares`; nenhuma feature MVP consulta a estratégia isolada |
| ~~input_snapshot jsonb~~ | **REMOVE** | reprodutível de `hair_profile_id` + versões (§9); sem escape hatch |
| ~~updated_at~~ | **REMOVE** | plano é histórico/imutável exceto supersessão; sem consumidor |
| ~~superseded_by_plan_id / superseded_at~~ | **DEFER** | `status` + índice já identificam ativo e preservam histórico; linkage/timestamp só se SPEC-014 exigir |

Invariantes DB: `CREATE UNIQUE INDEX one_active_plan_per_user ON hair_plans(user_id) WHERE status='active'` (1 ativo, server-side); `UNIQUE (user_id, client_request_id)` (idempotência); `UNIQUE (id, user_id)` (alvo do composite FK de ownership de `scheduled_cares` — §10 abaixo).

`scheduled_cares` (itens do plano; RLS por `auth.uid()`):
| Coluna | KEEP/REMOVE/TBD | Motivo |
|---|---|---|
| id | **KEEP** | |
| plan_id | **KEEP** | pertence ao plano |
| user_id | **KEEP** | convenção DATA-MODEL §1 (RLS uniforme + índice); gravado consistente pela RPC |
| care_type_code | **TBD (domain gate §13)** | text + CHECK contra o conjunto aprovado; tabela/FK `care_types` → SPEC-007 |
| planned_date | **KEEP** | dia local planejado |
| created_at | **KEEP** | |
| ~~sequence~~ | **REMOVE** | ordem derivável por `(planned_date, id)`; reintroduzir só se o domínio exigir ordem intra-dia |
| ~~status~~ | **DEFER → SPEC-005** | nenhuma feature da SPEC-004 consulta status; todos nascem "planejados" implicitamente |

**Integridade de ownership (constraint, não só a RPC):** `FOREIGN KEY (plan_id, user_id) REFERENCES hair_plans (id, user_id) ON DELETE CASCADE` — o banco **impede** `scheduled_cares.user_id` divergir do dono do `plan_id` (não depende da RPC). Menor solução: uma composite FK contra `hair_plans (id, user_id)` (viável pela `UNIQUE (id, user_id)`) cobre existência do plano **e** consistência do dono numa só constraint. `scheduled_cares.user_id` também referencia `auth.users` `on delete cascade` (purga de conta). RLS permanece `user_id = (select auth.uid())`.

Índices: `(plan_id, planned_date)` (e `(user_id, planned_date)` se a leitura por usuária/dia exigir — confirmar na implementação). **Sem** `diagnostic_results`, sem `input_snapshot`, sem `strategy`, sem colunas de reagendamento/execução (SPEC-005).

## 11. Algorithm versioning necessity
- **KEEP** `assessment_algorithm_version` + `schedule_algorithm_version` como **duas strings gravadas no plano** — são, junto de `hair_profile_id`, o **provenance/reprodutibilidade** completo do plano (agora que `input_snapshot` foi removido — §9). Justificativa real: o plano é persistido e a reavaliação cria novos planos (não regenera); é preciso saber "qual perfil + quais regras" geraram um plano histórico.
- Não criar tabela/registro de versões nem versionar o que não persiste. Golden tests protegem cada versão liberada; versão só **incrementa quando o comportamento muda** (mesmo input ⇒ saída diferente). Reprodução: rodar as versões gravadas sobre o snapshot de `hair_profile_id`.

## 12. Proposed execution architecture
- **Preview:** cliente executa `assess`+`generateSchedule` do `packages/core` (sem persistir) — P01.
- **Criação oficial:** Edge Function **`generate-plan`** (Deno; importa `packages/core` — D-40/CORE-RUNTIME-SPIKE) valida a sessão, roda os engines e grava via **RPC transacional `create_plan_tx`** (supersede o plano ativo + insere `hair_plans` + `scheduled_cares` numa transação; garante o índice de 1 plano ativo). Cliente **nunca** insere plano direto (ADR-004/ADR-007). Rate limit por usuária na Edge (T07).
- Necessity (ambos KEEP; sem solução menor com as mesmas garantias): **Edge** é necessária porque o engine é TS/core e a criação precisa ser server-enforced + validação de input; **RPC** dá atomicidade (supersede + plano + cares numa transação) e concentra os invariantes (1-ativo, idempotência) no banco. Rodar o engine em plpgsql (dispensaria a Edge) viola D-06; inserts sequenciais na Edge (dispensaria a RPC) perdem atomicidade. **Não** enfraquecer a atomicidade para reduzir mecanismo.

### 12b. Concorrência e idempotência de `create_plan_tx` (IMPORTANT)
Cenário: request chega, resposta se perde, cliente repete → sem proteção, dois `HairPlan` para **uma** ação; ou duas requests concorrentes criam dois planos ativos.

- **Serialização por usuária — inclusive no primeiro plano:** a `create_plan_tx` começa com **`pg_advisory_xact_lock(hashtext(user_id::text))`** (lock transaction-scoped derivado do `user_id`). Isto serializa **todas** as criações/supersessões da mesma usuária, inclusive quando ela **ainda não tem plano** (o `SELECT ... FOR UPDATE` do ativo não bastava: sem linha, nada é travado). O lock é liberado no fim da transação. *Existe especificamente para esta race de criação/supersessão — não é abstração genérica.*
- **Idempotência:** `client_request_id uuid` enviado pelo cliente e persistido com `UNIQUE (user_id, client_request_id)`. **Sem tabela/framework de idempotência.**
- **Fluxo (sob o lock):** (1) advisory xact lock por `user_id`; (2) se existe plano com o mesmo `(user_id, client_request_id)` → **retorna-o** (idempotente, sem novo/supersede); (3) senão, `UPDATE` do ativo → `superseded`; (4) `INSERT` do novo plano (`active`, versões, `client_request_id`); (5) `INSERT` dos `scheduled_cares`; (6) commit → lock liberado.
- **Duas requests, mesma key:** o advisory lock serializa — a 2ª entra após o commit da 1ª, seu pré-check acha o plano e o **retorna** (sem 23505). Rede de segurança para qualquer caminho fora do lock: o `INSERT` do plano fica num bloco `BEGIN ... EXCEPTION WHEN unique_violation THEN ... END` (subtransação/savepoint) — a colisão de `UNIQUE (user_id, client_request_id)` **não aborta** a transação externa; o handler faz `SELECT` do plano existente por `(user_id, client_request_id)` e o retorna. **Duas requests, keys diferentes:** serializadas pelo lock + índice parcial `active` — a 2ª supersede a 1ª deterministicamente.

## 13. DOMAIN RULES — V1 CANDIDATE (D-67)
> **Regras V1 CANDIDATE definidas** (decisão humana de produto D-67): care types H/N/R; `AssessmentOutput={emphasis, includeReconstruction, evidenceCodes}`; emphasis por `primary_goal→current_concerns→hair_pattern`; reconstruction 2-de-3; sessions/week por `wash_frequency`; janela 28d; ciclos H/N/R; 1 R após dia 14; offsets determinísticos; unknown never escalates. Detalhe em [`docs/domain-rules/SPEC-004-domain-rules-worksheet.md`](../domain-rules/SPEC-004-domain-rules-worksheet.md).
>
> **Status D-26/D-67:** são **heurísticas de produto cosméticas** (`validation_status = candidate`), **não** ciência validada. **Implementação, testes e internal beta autorizados** com as regras `candidate`. **PUBLIC RELEASE bloqueado** até `validated` (domain reviewer sign-off) — ADR-007 A1.

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
- Invariante de **1 plano ativo** por índice único parcial. **Idempotência** por `client_request_id` + `UNIQUE (user_id, client_request_id)` + `FOR UPDATE` na `create_plan_tx` (§12b) — evita planos duplicados em retry.
- Rate limit por usuária na Edge (T07). Sem PII/segredos em logs. pgTAP positivo/negativo (isolamento A/B, anon negado, escrita direta negada, 1-ativo).
- Guardrails da Foundation (`tables_without_rls`, `unapproved_grants`, `unapproved_security_definer_functions`) permanecem verdes (a RPC DEFINER entra na allowlist com referência SPEC-004 + justificativa).

## 15. Acceptance Criteria (técnicos — verificáveis sem o conteúdo de domínio)
| ID | Critério |
|---|---|
| AC1 | `assess` e `generateSchedule` são **puros/determinísticos** (mesma entrada+versão ⇒ mesma saída; golden); sem relógio/rede/random (dep-cruise). |
| AC2 | Módulos `diagnostic/` e `schedule/` não importam React/Expo/`@supabase/*`; o `AssessmentOutput` é puro (dep-cruise). |
| AC3 | Preview no cliente e criação na Edge produzem o **mesmo** plano para o mesmo input+versão. |
| AC4 | Criação oficial só ocorre server-side; `authenticated` não consegue INSERT/UPDATE direto em `hair_plans`/`scheduled_cares` (pgTAP + grants). |
| AC5 | Existe no máximo **1 plano `active`** por usuária, inclusive sob **duas criações concorrentes com a usuária sem plano** (advisory xact lock por `user_id` + índice parcial único; teste de concorrência). |
| AC6 | Reavaliar cria novo plano e marca o anterior `superseded`; planos antigos e seus `scheduled_cares` permanecem (histórico). |
| AC7 | Isolamento: A não lê plano/cuidados de B; anon nada (pgTAP). |
| AC8 | Um plano persistido é reproduzível a partir de `hair_profile_id` + `assessment_algorithm_version` + `schedule_algorithm_version` — **sem** `diagnostic_results` e **sem** `input_snapshot`. |
| AC9 | **Idempotência:** dois `generate-plan` com o mesmo `client_request_id` resultam em **um** plano; o retry retorna o plano existente (nenhum novo, nenhum supersede espúrio) — teste concorrente. |
| AC10 | Guardrails da Foundation verdes com o novo schema/RPC (allowlist SPEC-004). |
| AC11 | Nada de `confidence`/score na saída; nenhum valor de perfil em logs. |
| AC13 | O banco **rejeita** um `scheduled_care` cujo `user_id` não seja o dono do `plan_id` (composite FK `(plan_id,user_id)→hair_plans(id,user_id)`) — pgTAP, independente da RPC. |
| AC12 | Golden fixtures refletem as regras **V1 CANDIDATE** (D-67/worksheet) — determinísticas e testáveis já. **PUBLIC RELEASE** exige as mesmas regras `validated` (domain sign-off); build de release público falha se referenciar regra não `validated` (ADR-007 A1). |

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
| **OQ1** | **RESOLVED — V1 CANDIDATE (D-67)** | care types, emphasis, reconstruction, cadência, janela, offsets, unknown, evidence codes. | definidos como `candidate` (§13/worksheet); **implementação autorizada**. |
| **OQ-REL** | **BLOCKING BEFORE PUBLIC RELEASE (D-26/D-67)** | domain reviewer sign-off das regras V1 (`candidate → validated`). | release público bloqueado até `validated`; dev/internal beta liberado. |
| **OQ2** | **IMPORTANT — necessity (confirmar)** | Confirmar **REMOVE de `diagnostic_results` E de `input_snapshot`/`strategy`/`timezone`/`updated_at`/`sequence`/`scheduled_cares.status`** (§10) — reprodutibilidade por `hair_profile_id` + versões. | adotar a poda (§9/§10); reabrir item só com requisito concreto |
| OQ3 | IMPORTANT | Manter as **duas** versões inline no plano como provenance? | sim (§11) |
| OQ4 | IMPORTANT | `care_types` como texto+CHECK aqui e tabela/FK na SPEC-007? | sim (§9), evita catálogo antecipado |
| OQ5 | **RESOLVED (technical close 2026-08-27)** | Concorrência/idempotência: advisory xact lock por `user_id` (cobre 1º plano) + `UNIQUE (user_id, client_request_id)` + subtransação `EXCEPTION` (§12b); ownership por composite FK (§10). | fechado |
| OQ6 | CAN DEFER | Preview offline / reconciliação com versão do servidor (ADR-007 `expected_version`); rate limit exato | tratar na implementação |

> **Modelo técnico CLOSED FOR REVIEW + regras V1 CANDIDATE (2026-08-27).** Blocker para **IMPLEMENTAÇÃO = NENHUM** (regras `candidate` autorizadas — D-67). Blocker para **PUBLIC RELEASE = domain validation/sign-off** (`candidate → validated`, D-26/OQ-REL). Sem gaps técnicos abertos.

## 21. Implementation evidence (2026-08-27)

| AC | Como é atendido | Onde |
|---|---|---|
| AC1 | `assess` e `generateSchedule` puros/determinísticos; golden fixtures por ramo de regra; nenhum relógio/rede/random (eslint `no-restricted-syntax`/`no-restricted-globals` + dep-cruise) | `packages/core/src/{diagnostic,schedule}/engine/v1/`, `diagnostic/__fixtures__/`, testes `diagnostic.test.ts`/`schedule.test.ts` |
| AC2 | Módulos sem React/Expo/`@supabase/*`; `AssessmentOutput` puro | `pnpm dep-cruise` + `pnpm lint` verdes; `pnpm check:boundaries` (8 fixtures negativos) |
| AC3 | Preview e Edge chamam a **mesma** `buildPlan` | `packages/core/src/schedule/application/build-plan.ts`; `PlanScreen.tsx`; `supabase/functions/generate-plan/index.ts` |
| AC4 | `authenticated` só tem SELECT; INSERT/UPDATE/DELETE e o próprio `create_plan_tx` negados (42501) | migration `20260829000000`; pgTAP 030 (5 asserções) |
| AC5 | Índice único parcial `hair_plans_one_active_per_user` + `pg_advisory_xact_lock(hashtext(user_id))` cobrindo o **primeiro** plano | migration; pgTAP 030 (índice rejeita 2º ativo; presença do lock verificada em `pg_proc.prosrc`) |
| AC6 | Nova criação supersede a anterior; planos e cuidados antigos permanecem | `create_plan_tx`; pgTAP 030 |
| AC7 | RLS `user_id = (select auth.uid())` nas duas tabelas; anon sem grant | migration; pgTAP 030 (A/B + anon) |
| AC8 | Plano reproduzível por `hair_profile_id` + `assessment_algorithm_version` + `schedule_algorithm_version`; sem `input_snapshot`, sem `diagnostic_results` | migration; `schedule.test.ts` ("stamps both algorithm versions") |
| AC9 | `client_request_id` + `UNIQUE (user_id, client_request_id)`; pré-check sob o lock devolve o plano existente; subtransação faz o supersede voltar atrás numa colisão; a UI reusa o mesmo id no retry | `create_plan_tx`; pgTAP 030; `plan-screen.test.tsx` |
| AC10 | `tables_without_rls`, `unapproved_grants`, `unapproved_security_definer_functions` = 0 com o novo schema; allowlist SPEC-004 com justificativa | `supabase/security/allowlists.sql`; pgTAP 030 (3 asserções) |
| AC11 | Saída sem `confidence`/score (teste explícito das chaves); Edge não loga perfil nem token, só o `code` do erro | `diagnostic.test.ts`; `generate-plan/index.ts` |
| AC12 | Golden fixtures refletem as regras V1 **candidate**; `assertProductionRules` **falha** para tudo que não é `validated` — o gate de PUBLIC RELEASE é testado | `engine/v1/rules.ts`; testes de governança em ambos os módulos |
| AC13 | FK composta `(plan_id, user_id) → hair_plans (id, user_id)` | migration; pgTAP 030 (rejeita 23503 independente da RPC) |

**Decisões técnicas tomadas na implementação (dentro do modelo aprovado):**
- `create_plan_tx` recebe `p_user_id` e tem **EXECUTE só para `service_role`**: a Edge valida o JWT e passa a identidade resolvida. Conceder EXECUTE a `authenticated` deixaria um cliente adulterado montar o plano que quisesse (viola G2). `auth.uid()` continua validado quando presente, e a posse do `hair_profile_id` é reconferida no servidor.
- `FORCE row level security` também vale para o dono da tabela, e a função DEFINER roda como ele: policies explícitas `to postgres` tornam o caminho da RPC determinístico em vez de depender de o papel de plataforma ter `BYPASSRLS`. Nada é concedido a `anon`/`authenticated` por elas.
- `scheduled_cares` recebe índices `(plan_id, planned_date)` (leitura do app) e `(user_id, planned_date)` (cascade de exclusão de conta) — OQ2/§10 confirmados.
- Rate limit da Edge (T07) é **em memória por isolate**: throttle, não quota; a proteção real contra plano duplicado é a idempotência + o índice de 1-ativo. Marcado no código com o teto e o caminho de upgrade.
- `startsOn` vem do cliente (dia civil dela; o modelo não guarda timezone — §10) e é validado na Edge contra ±2 dias do dia UTC.
- `DomainRuleValidationStatus` ganhou `candidate` (ADR-007 A1 já amendada por D-67).

**Fora do escopo (confirmado):** SPEC-005 (transições/Today/calendário), SPEC-007 (`care_types`, conteúdo), IA, monetização, analytics, `diagnostic_results`, `confidence`/score, design final.

**Não verificável neste ambiente:** `supabase test db` exige Docker + Supabase CLI, ausentes no notebook; o workflow `supabase-test` é o gate autoritativo do pgTAP. O smoke manual do fluxo real (Expo + projeto Supabase) permanece pendente — mesma situação de SPEC-001/002.

## 20. Change Log
| Data | Mudança | Autor |
|---|---|---|
| 2026-08-27 | v0.1 Draft via `spec-create` (vertical slice D-66: Assessment+Schedule). Necessity review: **`diagnostic_results` REMOVE/DEFER**; `AssessmentOutput` só inferências (sem reempacotar observado, sem `confidence`); `care_types` texto+CHECK (tabela/FK → SPEC-007); criação server-enforced (Edge `generate-plan` + RPC `create_plan_tx`); 1 plano ativo; supersede. Conteúdo capilar = **HUMAN GATE / BLOCKING** (§13, D-26). | Claude |
| 2026-08-27 | v0.2 **Final technical necessity review:** REMOVE `input_snapshot` (reprodutibilidade = `hair_profile_id` + 2 versões), `strategy`, `timezone`, `updated_at`, `sequence`, `scheduled_cares.status` (→ SPEC-005); KEEP `user_id` nas duas tabelas (convenção RLS DATA-MODEL §1); supersessão mínima = `status` + índice parcial único (superseded_by/at DEFER); **idempotência promovida a IMPORTANT**; Edge+RPC confirmados. | Claude |
| 2026-08-27 | v0.4 **Domain V1 CANDIDATE** (D-67): regras de produto cosméticas definidas (care types H/N/R; `AssessmentOutput` emphasis/includeReconstruction/evidenceCodes; emphasis por goal→concerns→pattern; reconstruction 2-de-3; sessions/week por wash_frequency; janela 28d; ciclos; 1 R após dia 14; offsets; unknown never escalates). `validation_status=candidate`: **implementação/internal beta autorizados**; PUBLIC RELEASE exige `validated` (ADR-007 A1 ganha `candidate`). OQ1 resolvido; blocker de implementação = NENHUM. | Humano / Claude |
| 2026-08-27 | v0.6 **IMPLEMENTED** — vertical slice completa: engines v1 puros + golden, `hair_plans`/`scheduled_cares` + `create_plan_tx`, Edge `generate-plan`, preview/confirmação no app. Evidência por AC em §21. PUBLIC RELEASE segue bloqueado por OQ-REL. | Claude |
| 2026-08-27 | v0.5 **APPROVED (D-68)** — aprovação humana da SPEC. Escopo confirmado sem alteração técnica: vertical slice Assessment+Schedule com módulos internos separados, regras V1 `candidate` autorizadas para implementação/internal beta, D-26 mantido como PUBLIC RELEASE GATE. Nenhuma decisão aprovada reaberta. | Humano |
| 2026-08-27 | v0.3 **Technical close** — 2 gaps de integridade resolvidos: (1) concorrência do **primeiro plano** por `pg_advisory_xact_lock(hashtext(user_id))` (o `FOR UPDATE` não travava com zero linhas); (2) **ownership** por composite FK `(plan_id,user_id)→hair_plans(id,user_id)` + `UNIQUE (id,user_id)` (o banco impede `user_id` divergir do dono do plano); colisão de `UNIQUE(user_id,client_request_id)` tratada por subtransação `EXCEPTION` que retorna o plano existente sem abortar. **Modelo técnico CLOSED FOR REVIEW**; único blocker = DOMAIN RULES (D-26). | Claude |
