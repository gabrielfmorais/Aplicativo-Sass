# FOUNDATION REVIEW — auditoria crítica da fundação (v0.2)

| Campo | Valor |
|---|---|
| Data | 2026-08-26 |
| Fase | **ARQUITETURA APROVADA (2026-08-26) · SPEC-000 IMPLEMENTADA — READY FOR MERGE** |
| Resultado | Revisão humana concluída; decisões em [DECISION-REGISTER](DECISION-REGISTER.md) v0.3. Este documento é mantido como registro histórico da auditoria; §8 (auth) foi resolvido por D-21 (OTP). Close-out em §17. |

## 17. Close-out da Foundation (2026-08-26)

| Item | Estado |
|---|---|
| Arquitetura | Aprovada; ADR-001…011 `Accepted` (nenhuma reaberta) |
| SPEC-000 | Implementada na branch `foundation/spec-000` (PR #1, HEAD `46c5fe8`) — [evidência](../specs/SPEC-000-engineering-foundation.md#25-implementation-evidence-2026-08-26-branch-foundationspec-000) |
| CI `ci` (lint · typecheck · tests · boundaries · `expo export` · audit · gitleaks) | **verde** |
| CI `core-deno` (core sob Deno) | **verde** |
| CI `supabase-test` (Postgres local + pgTAP, fixture negativo) | **verde** |
| Guardrail de exceções de segurança (`check:security-exceptions`) | **verde** (2 exceções válidas até 2026-11-30) |
| AC12 (autossuficiência documental) | **DEFERRED por decisão humana (D-50)** — não bloqueante; não executado nem simulado |
| Foundation | **pronta para merge** (merge é ação humana) |
| Próxima SPEC permitida | SPEC-001 — Identity & Authentication (**não** autorizada nesta execução; requer `/spec-create` + aprovação humana) |

Os guardrails que existiam apenas como documento na v0.1 desta revisão (§16, ressalva de "vibe coding safety") agora são executáveis: lint/dep-cruiser de fronteiras com fixtures negativos, pin de Node, pgTAP fail-closed, verificação de exceções de audit, skills com stop conditions.

---

## 1. Verificação dos entregáveis

| Deliverable | Existe? | Completo? | Status | Observação |
|---|---|---|---|---|
| PRODUCT-BRIEF | Sim | Sim | Draft | 166 linhas; inclui glossário |
| SYSTEM-ARCHITECTURE | Sim | Sim | Draft | C4 contexto/containers, fluxos, trust boundaries, erros, offline |
| DOMAIN-MAP | Sim | Sim | Draft | 11 contextos; Analytics é cross-cutting (ver §3) |
| DATA-MODEL | Sim | Sim | Draft v0.2 | Corrigido nesta revisão: `deleted_at` removido, `voided_at` adicionado, versão por trigger |
| SECURITY-BASELINE | Sim | Sim | Draft | 12 regras invioláveis + checklist por SPEC |
| THREAT-MODEL | Sim | Sim | Draft | 23 ameaças classificadas |
| SUPABASE-RLS-STRATEGY | Sim | Sim | Draft v0.2 | Matriz por tabela; RPC list ajustada |
| MCP-POLICY | Sim | Sim | Draft | Inclui estado observado (Supabase sem escopo, Lovable) |
| ADR index | Sim | Sim | — | 11 ADRs, todos `Proposed` |
| ADR-001…011 | Sim (11/11) | Sim | Proposed | Todas com 8 seções obrigatórias |
| SPEC README | Sim | Sim | — | DoR/DoD + índice reservado SPEC-000…014 |
| SPEC TEMPLATE | Sim | Sim | — | 24 seções |
| CLAUDE.md | Sim | Sim | — | 62 linhas; aponta para docs |
| SKILLS-PLAN | Sim | Sim | Draft | 5 skills + adiadas |
| REPOSITORY-STRUCTURE | Sim | Sim | Draft | Critica estrutura original |
| ENGINEERING-WORKFLOW | Sim | Sim | Draft | Git, PR, CI, migrations, testes, supply chain |
| MVP-ROADMAP | Sim | Sim | Draft | Grafo de dependências + 11 fases |
| .env.example | Sim | Sim | — | Só nomes |
| .gitignore | Sim | Sim | — | |
| PR template | Sim | Sim | — | 12 seções pedidas + checklist |
| CODEOWNERS | Sim | Sim | — | Handle placeholder `@gabrielfmorais` — confirmar |
| docs/README (index) | Sim | Sim | — | |
| runbooks/README | Sim | Placeholder | — | Runbooks reais na fase Foundation (esperado) |
| DECISION-REGISTER | **Criado nesta revisão** | Sim | v0.1 | |
| FOUNDATION-REVIEW | **Este arquivo** | — | — | |

**Nenhum entregável ausente.** Nada de código, migration, dependência ou integração existe no repositório.

## 2. Revisão de consistência

### Inconsistências objetivas encontradas e corrigidas
| # | Problema | Onde | Correção |
|---|---|---|---|
| C1 | Dupla fonte de verdade para exclusão de conta (`profiles.deleted_at` **e** `account_deletion_requests`) | DATA-MODEL | Removido `deleted_at`; `account_deletion_requests` é a única fonte (D-10) |
| C2 | INSERT de `hair_profiles` descrito como "trigger/RPC" — ambíguo entre acesso direto e função | RLS-STRATEGY, DATA-MODEL | INSERT direto + trigger BEFORE INSERT com advisory lock; RPC removida (D-11) |
| C3 | `voided_at` citado como mecanismo de "desfazer" mas ausente da tabela `care_executions` | DATA-MODEL | Coluna adicionada como proposta; unique parcial ajustado; decisão pendente D-12 |
| C4 | Catálogo de eventos não permitia calcular retenção D1/D7/D30 (nenhum evento de abertura) | ADR-010 | Adicionados `app_opened` e `today_viewed` |

### Verificações sem inconsistência
- Nomes de módulos: idênticos em DOMAIN-MAP, ADR-006, SYSTEM-ARCHITECTURE, REPOSITORY-STRUCTURE (`packages/core/src/<ctx>`), ROADMAP e índice de SPECs.
- Responsabilidades duplicadas: nenhuma. "Dia local" é calculado só em `core/shared/time`; "atrasado" só em Care Tracking (calculado); entitlement só em Subscription.
- Dependências circulares: Progress → Diagnostic ("gatilho de reavaliação") é **consulta de leitura** (pontilhada), não import; Subscription não depende de ninguém; Notifications lê Care Tracking e não é lido por ele.
- Entidades sem owner: nenhuma. Tabelas sem `user_id` são catálogos (`care_types`, `content_articles`) ou administrativas (`admin_users`, `audit_log`) com policies próprias.
- Features no Data Model fora do MVP: `content_articles.is_premium` (fase 9, dentro do MVP); `notification_deliveries`, `device_tokens`, uploads, `export_my_data` estão marcados como fora/pós-MVP e **não** têm tabela definida. OK.
- Roadmap vs arquitetura: todas as fases mapeiam para contextos existentes; SPEC-014 (Reassessment) usa Diagnostic + Schedule. OK.
- ADRs contraditórias: ADR-004 (engine nunca em PL/pgSQL) × ADR-007 (engine em Edge) coerentes; ADR-009 (local) × PRODUCT-BRIEF non-goals (push) coerentes; ADR-005 (sem anônimos) × ROADMAP fase 1 antes de 2 coerente.
- Segurança dependente de frontend: nenhuma operação crítica (ver §5). Preview do engine no cliente **não persiste**.
- RLS × ownership: toda tabela de usuária tem `user_id` NOT NULL FK; policies usam `user_id = (select auth.uid())`; tabelas server-only sem policy de escrita. Coerente.
- Overengineering: pontos aceitáveis mas vigiados — `consents` versionado (justificado por LGPD), `origin` em `scheduled_cares` (barato), `input_snapshot` jsonb (necessário para reprodutibilidade). Removido nesta revisão: RPC desnecessária para versão de perfil.

## 3. Auditoria de modularização

| Context | Responsibility | Owns | Does NOT own | Dependencies | Public contracts | Critical invariants |
|---|---|---|---|---|---|---|
| **Identity & Account** | Sessão, conta, perfil técnico, consentimentos, exclusão | `profiles`, `consents`, `account_deletion_requests`; `TimeZone` VO | Autorização de negócio; dados de cabelo | Supabase Auth (infra) | `Profile`, `TimeZone`, `requestAccountDeletion` | 1 profile por auth.user; tz IANA válida; exclusão com grace cancelável |
| **Hair Profile** | Representar cabelo/hábitos | `hair_profiles` (versões) + VOs | Interpretar o perfil | Identity (user_id) | `HairProfileSnapshot`, `HairProfileInput` schema | version única e monotônica; imutável |
| **Diagnostic** | Perfil + respostas → avaliação | `diagnostic_results`, engine `v*`, `rules.ts` | Decidir cronograma; UI de perguntas | Hair Profile (snapshot) | `runDiagnostic(input) → DiagnosticResult`, `CURRENT_DIAGNOSTIC_VERSION` | puro, determinístico, imutável, versionado |
| **Schedule / Planning** | Avaliação + contexto → plano + cuidados planejados | `hair_plans`, `scheduled_cares` (geração), engine `v*` | Execução; notificação; conteúdo | Diagnostic (result), Identity (tz) | `generateSchedule(input) → {plan, cares}`, `HairPlan`, `ScheduledCare` | 1 plano ativo; nunca edita plano liberado; supersede |
| **Care Tracking** (calendar · execution · check-in) | O que fazer hoje; feito vs planejado; reagendar/pular; feedback | `care_executions`, `checkins`; mutações de status em `scheduled_cares`; projeção calendário | Gerar cuidados (Schedule); agregações históricas (Progress) | Schedule (leitura), Identity (tz) | `getToday`, `completeCare`, `rescheduleCare`, `skipCare`, `voidExecution`, `submitCheckIn`, `CalendarDay` read model | idempotência por `client_execution_id`; histórico append-only; reagendar = nova linha; atrasado calculado |
| **Progress** | Adesão, histórico, streak, evolução de check-ins | Nada persistido no MVP (cálculos) | Dados brutos | Care Tracking (read models), Subscription (entitlement p/ insights) | `computeAdherence`, `computeStreak`, `ProgressSummary` | puro; janelas em dias locais |
| **Notifications** | Decidir o que lembrar; entregar por canal | `notification_preferences`; intents; port de canal | Conteúdo do cuidado; regras de plano | Schedule, Care Tracking (leitura), Identity (tz) | `computeIntents`, `NotificationChannelPort` | opt-in; ≤ max/dia; intent_id determinístico; nada após execução |
| **Content** | Explicar o cuidado | `care_types`, `content_articles` | Decidir qual cuidado | Subscription (premium) | `getContentForCareType` | só `published` visível; premium via entitlement server-side |
| **Subscription & Entitlements** | Refletir assinatura; derivar capacidades | `subscriptions`; catálogo de entitlements; `EntitlementService` | Cobrança (lojas/provider); UI de paywall (feature) | Nenhuma (ACL isola provider) | `EntitlementService.can(code)`, `get_my_entitlements()` | escrita só server; entitlements por capacidade; free por ausência |
| **Audit** | Registrar ações sensíveis | `audit_log`, `admin_users` | Regras de produto | — | `audit(action, target)` (server-only) | append-only |
| **Analytics (cross-cutting, não é bounded context)** | Catálogo tipado + port | `core/analytics/events.ts`, `AnalyticsPort` | Provider | Todos emitem; nenhum depende | `track(event)` | eventos só do catálogo; sem PII |
| **Growth / Admin UI** | placeholders | — | — | — | — | — |

**Por que agrupamentos:** Calendar + Care Planning + Execution + Check-in vivem em Care Tracking porque compartilham o agregado (ScheduledCare ↔ CareExecution ↔ CheckIn) e a noção de dia local; separar geraria três módulos com FK cruzadas e a mesma regra de "atrasado" em dois lugares. **Care Planning (geração)** continua em Schedule; Care Tracking só **muta status** de `scheduled_cares` e cria linhas de reagendamento — fronteira: *Schedule cria, Care Tracking transita*. Analytics não é contexto de negócio; é infraestrutura tipada.

**Responsabilidade ambígua identificada (resolvida):** quem cria a nova `scheduled_care` no reagendamento — Schedule ou Care Tracking? Decisão: Care Tracking (`rescheduleCare`), com `origin='rescheduled'`; o engine nunca é invocado para reagendar. Documentado acima e no DOMAIN-MAP §3.5.

## 4. Auditoria dos engines

### Diagnostic Engine
| Pergunta | Resposta |
|---|---|
| Input | `DiagnosticInput = { hairProfile: HairProfileSnapshot, answers: DiagnosticAnswers, algorithmVersion }` (zod, versionado) |
| Output | `DiagnosticResult = { algorithmVersion, needs: {hydration, nutrition, reconstruction: low/medium/high}, flags[], explanations[], confidence }` |
| Regras | `packages/core/src/diagnostic/engine/v1/rules.ts` (dados declarativos) + `run.ts` |
| Versionamento | Diretório imutável por versão; `CURRENT_DIAGNOSTIC_VERSION`; nova versão = novo diretório; `diagnostic_results.algorithm_version` |
| Testes | Unit + golden fixtures (`__fixtures__/*.json`) em Vitest; cobertura ≥ 90%; teste de determinismo (mesma entrada → mesma saída) |
| Quem invoca | Cliente (preview, não persistido) e Edge Function `generate-plan` (autoritativo). Nunca o banco |
| Histórico ou mutável | **Histórico**: `diagnostic_results` imutável; reavaliação cria nova linha |

### Schedule Engine
| Pergunta | Resposta |
|---|---|
| Input | `ScheduleInput = { diagnostic: DiagnosticResult, context: { washFrequency, startsOn: LocalDate, timezone, horizonWeeks, preferences? }, referenceDate: LocalDate, algorithmVersion }` |
| Output | `{ plan: HairPlanDraft(strategy, explanations), cares: ScheduledCareDraft[](careType, plannedDate, sequence) }` |
| Regras | `packages/core/src/schedule/engine/v1/rules.ts` (matriz needs → ciclo) + `generate.ts` |
| Versionamento | Igual ao Diagnostic; `hair_plans.algorithm_version` |
| Evitar alteração retroativa | Plano liberado nunca é editado: reavaliação/regeneração cria novo `hair_plans` (`active`) e marca o anterior `superseded`; `scheduled_cares` do plano antigo permanecem (histórico); OTA nunca muda comportamento sem bump de versão |
| Reagendamento | Fora do engine: `rescheduleCare` marca original `rescheduled` + `rescheduled_to_id` e insere nova linha (`origin='rescheduled'`) |
| Planned vs actual | Tabelas distintas: `scheduled_cares` (data civil planejada) vs `care_executions` (instante real + `executed_on`). Status `completed` em `scheduled_cares` é **derivado** da existência de execução não anulada (mantido por RPC, verificável por consistência) |
| Idempotência | `care_executions.client_execution_id UNIQUE` gerado e persistido no dispositivo antes do envio; RPC `ON CONFLICT DO NOTHING` retorna a execução existente; `generate-plan` recebe `idempotency_key` e índice único de plano ativo impede duplicidade |
| Impedir forja pelo frontend | `authenticated` **não tem grant de INSERT/UPDATE** em `diagnostic_results`, `hair_plans`, `scheduled_cares` (exceto transições via RPC); `create_plan_tx` tem `REVOKE EXECUTE FROM authenticated, anon` e só a Edge Function (service role, após validar JWT e ownership do `hair_profile_id`) a chama; o snapshot e a versão são gravados pelo servidor, não recebidos do cliente |

```mermaid
sequenceDiagram
    autonumber
    participant U as Usuária
    participant App as Mobile (presentation)
    participant Core as packages/core (mesma versão)
    participant EF as Edge generate-plan
    participant DB as Postgres (RLS + RPC)
    U->>App: conclui onboarding
    App->>Core: validar HairProfileInput (zod)
    App->>DB: INSERT hair_profiles (RLS own; trigger define version)
    App->>Core: runDiagnostic + generateSchedule (PREVIEW, não persiste)
    App-->>U: "Prévia do seu cronograma"
    App->>EF: POST /generate-plan {hair_profile_id, idempotency_key, expected_versions}
    EF->>EF: verifica JWT → auth.uid()
    EF->>DB: SELECT hair_profiles WHERE id AND user_id = uid (service role, filtro explícito)
    EF->>Core: runDiagnostic(v-current)
    EF->>Core: generateSchedule(v-current, referenceDate = hoje local do perfil)
    EF->>DB: RPC create_plan_tx(uid, result, plan, cares, versions) — transação: insere diagnostic_result, supersede plano ativo, insere hair_plan + scheduled_cares; audit
    DB-->>EF: plan_id (ou existente, se idempotency_key repetida)
    EF-->>App: {plan_id, versions}
    App->>DB: SELECT hair_plans/scheduled_cares (RLS)
    App-->>U: "Este é o seu cronograma"
    Note over App,DB: Loop diário
    App->>DB: RPC complete_care(scheduled_care_id, client_execution_id, executed_at, client_tz)
    DB->>DB: ownership via RLS; executed_on calculado; ON CONFLICT DO NOTHING; status derivado
    App->>DB: RPC submit_checkin(execution_id, ...)
    App->>DB: RPC reschedule_care(id, new_date) → original=rescheduled, nova linha origin=rescheduled
```

## 5. Server authority matrix

| Operation | Client allowed? | Server validation? | DB constraint? | RLS? | Function/RPC? |
|---|---|---|---|---|---|
| Criar Hair Profile (nova versão) | INSERT direto | zod (cliente) + CHECK enums | UNIQUE(user_id,version); CHECKs; trigger version | `WITH CHECK user_id = auth.uid()` | Não (trigger) |
| Alterar Hair Profile | **Não** (imutável) | — | sem grant UPDATE | sem policy UPDATE | — |
| Enviar respostas de diagnóstico | Só como parte de `generate-plan` (body validado) | zod na Edge | — | — | Edge |
| Gerar diagnóstico (persistir) | **Não** | Edge executa engine; grava snapshot | `algorithm_version NOT NULL`; FK | SELECT own apenas | Edge + `create_plan_tx` (service role) |
| Gerar cronograma (persistir) | **Não** | idem; rate limit por usuária; idempotency_key | unique parcial 1 plano ativo | SELECT own apenas | Edge + `create_plan_tx` |
| Reagendar cuidado | Via RPC | ownership, status atual = planned, data ≥ hoje-1 | CHECK status⇔rescheduled_to_id | INVOKER → RLS aplica | `reschedule_care` |
| Pular cuidado | Via RPC | ownership, status = planned | CHECK status | RLS | `skip_care` |
| Concluir cuidado | Via RPC | ownership; `executed_on` calculado c/ tz do perfil; divergência ±1 dia | `client_execution_id UNIQUE`; unique parcial por scheduled_care | RLS | `complete_care` / `log_adhoc_care` |
| Desfazer execução | Via RPC | ownership; janela 10 min | `voided_at` | RLS | `void_execution` (D-12) |
| Registrar check-in | Via RPC (ou INSERT direto — ver §6) | execução pertence à usuária e não anulada | UNIQUE(care_execution_id); CHECK 1..5 | RLS | `submit_checkin` (recomendado pela validação cruzada) |
| Consultar progresso | SELECT direto (read models) | — | — | RLS own | Não; insights premium: `has_entitlement` na RPC/view |
| Alterar subscription | **Não** | webhook HMAC + idempotência | UNIQUE(provider, id) | sem policy de escrita | Edge `billing-webhook` (service role) |
| Consultar entitlement | SELECT via RPC | derivado de `subscriptions` | — | RLS own | `get_my_entitlements()` INVOKER |
| Usar recurso premium | UI mostra/oculta | **servidor decide** | — | policy chama `has_entitlement()` | RPCs premium checam |
| Alterar preferências de notificação | UPSERT direto | zod + CHECK | CHECK max_per_day ≤ 3 | RLS own | Não |
| Consentimentos | INSERT direto | CHECK type/version | — | RLS own (INSERT/SELECT) | Não |
| Pedir exclusão de conta | Via RPC | auth.uid() interno | — | — | `request_account_deletion` **DEFINER** (allowlist) |
| Ação administrativa | **Não pelo app** | claim `app_role` + `admin_users` + aal2 | — | policies `is_admin()` | migrations/seeds ou RPCs admin com audit |

Nenhuma linha depende do cliente para segurança. O cliente só é "autoridade" sobre preferências próprias e sobre o texto de notas.

## 6. Supabase review

| Item | Avaliação | Ajuste |
|---|---|---|
| Tabela por ownership | Todas as tabelas de usuária têm `user_id` NOT NULL FK `auth.users ON DELETE CASCADE` | OK |
| Relação com `auth.users` | Apenas `profiles` (1:1, trigger de criação) e FKs; nenhum outro objeto em `auth` | OK; trigger documentado como exceção única |
| RLS | ON + FORCE em todas; fail closed | CI verifica `relrowsecurity`/`relforcerowsecurity` |
| `auth.uid()` | `(select auth.uid())` em policies; nunca lido de body | OK |
| Políticas transitivas | Evitadas por `user_id` redundante em `scheduled_cares`, `care_executions`, `checkins` — deliberado (performance + simplicidade) | OK |
| service_role | Só em `generate-plan`, `billing-webhook`, CI de migrations; nunca em app | OK |
| Edge Functions | 2 no MVP; ambas com motivo (engine TS / segredo+webhook) | OK |
| RPC | 8 INVOKER + 1 DEFINER + 1 server-only | Ver lista abaixo |
| SECURITY DEFINER | 1 (`request_account_deletion`) + `create_plan_tx` chamada apenas por service role (não precisa ser DEFINER) | Allowlist versionada |
| Storage | Não usado no MVP | OK |
| Migrations | CLI, aditivas, expand/contract para destrutivas, 3 ambientes | OK |
| Seed | `care_types`, `content_articles` idempotentes | OK |
| Ambientes | local / staging / prod; dados de prod nunca descem | OK |

**O que usa acesso normal (SDK + RLS), sem RPC:** leitura de tudo que é próprio; INSERT `hair_profiles`; INSERT `consents`; UPSERT `notification_preferences`; UPDATE colunas permitidas de `profiles`; leitura de catálogos. Isso cobre ~70% das chamadas.

**O que justifica função server-side:** transições de estado com regra (`complete_care`, `reschedule_care`, `skip_care`, `void_execution`), idempotência, cálculo autoritativo de `executed_on`, derivação de entitlements, escrita em `audit_log`, geração de plano (engine + transação multi-tabela).

**Check-in:** poderia ser INSERT direto com RLS `EXISTS (execution own AND voided_at IS NULL)`. Mantido como RPC apenas para evitar policy com subselect e para validar janela; se a SPEC-006 preferir INSERT direto, é aceitável — decisão local, sem impacto arquitetural.

## 7. Core package / runtime compatibility

Alvos: React Native (Hermes), Node 20+ (Vitest/CI), Deno (Supabase Edge Runtime).

Regras para `packages/core` (a codificar em SPEC-000 via tsconfig + ESLint + CI):
1. `tsconfig`: `"lib": ["ES2022"]`, **sem** `DOM` e sem `@types/node`; `"module": "ESNext"`, `"moduleResolution": "bundler"`; `"isolatedModules": true`.
2. Proibidos: `node:*`, `fs`, `path`, `crypto` (Node), `Buffer`, `process.env`, `require`, `__dirname`, `setTimeout` em domínio, `Intl` avançado sem verificar Hermes, `Date` fora de `shared/time`.
3. Permitidos: `globalThis.crypto.randomUUID()` (Web Crypto — disponível em Hermes ≥ RN 0.71 via polyfill do Expo, Node 19+, Deno), `structuredClone` (verificar Hermes; preferir cópia explícita).
4. Dependências: apenas `zod` e `date-fns` + `date-fns-tz` (ESM puro, sem side effects, funcionam nos 3 runtimes). Qualquer nova dep exige verificação nos 3 runtimes.
5. Sem side effects de módulo (nenhum código executado no import); `"sideEffects": false` no package.json.
6. Determinismo: engines recebem `referenceDate`, `seed`; nenhum acesso a relógio/random.
7. **CI de compatibilidade:** job que roda `deno check` (ou `deno test`) sobre `packages/core/src` além de Vitest em Node. Falha = incompatibilidade detectada antes de chegar à Edge.

**Como a Edge importa o core:** opção A (preferida, validar em spike SPEC-000): `supabase/functions/import_map.json` mapeando `@app/core` → `../../packages/core/src/index.ts` (o CLI bundla arquivos referenciados fora do diretório da função). Opção B (fallback, zero risco): script `pnpm build:core-edge` gera `supabase/functions/_shared/core.js` (ESM único via esbuild) commitado/gerado em CI; a função importa `../_shared/core.js`. **Se A falhar no spike, adotar B sem nova ADR** (é detalhe de build). Em nenhum caso duplicar o código do engine.

## 8. Authentication review (ADR-005 — não alterada)

| Critério | (a) Atual: Apple + Google + email/senha c/ confirmação | (b) Apple + Google + **email OTP** (passwordless) | (c) Só social |
|---|---|---|---|
| Fricção onboarding | Média (senha + confirmação de email) | Baixa (código de 6 dígitos) | Mínima |
| iOS/Android | OK | OK | OK (Google no Android é natural) |
| Recuperação de acesso | Fluxo de reset (tela + email + rate limit) | Não existe: o OTP **é** o login | Depende do provedor |
| Account linking / duplicidade | Supabase vincula identidades com mesmo email verificado; Apple "Hide My Email" gera relay → conta duplicada possível | Igual | Igual |
| Segurança | Credential stuffing, senhas fracas (HIBP mitiga) | Sem senha: elimina T01 parcial; risco = acesso ao email | Delegada |
| Complexidade MVP | Maior (reset, HIBP, confirmação) | Menor (1 fluxo de email) | Menor, mas exclui usuárias sem conta social e complica QA |
| Testes E2E | Precisa inbox de teste | Precisa inbox de teste (Supabase local expõe Inbucket) | Difícil (OAuth em E2E) |

**Recomendação:** (b). Mantém email como fallback universal, elimina o fluxo de reset e a superfície de senha, e é o padrão que apps do ICP usam. Risco a aceitar: dependência da caixa de email na primeira entrada. Requer decisão humana (D-21) antes da SPEC-001; a ADR-005 seria substituída por ADR-012 se aprovado. Independente da escolha: tratar Apple relay documentando "vincular contas" como pós-MVP e usando o email como chave de linking automático quando verificado.

## 9. Time & calendar review

Mapeamento dos nomes conceituais do pedido para o modelo:

| Conceito | Nome no modelo | Tipo | Definição |
|---|---|---|---|
| `scheduled_for` | `scheduled_cares.planned_date` | `date` | **Data civil** da usuária em que o cuidado está previsto. Sem hora; sem tz. Não muda com viagem |
| `executed_at` | `care_executions.executed_at` | `timestamptz` | **Instante absoluto** em UTC em que a usuária marcou como feito |
| `user_local_date` | `care_executions.executed_on` | `date` | Data civil derivada de `executed_at` + tz do perfil **no servidor**; usada para adesão/streak/calendário |
| `timezone` | `profiles.timezone` (atual) e `hair_plans.timezone` (snapshot) | IANA | Fonte para "hoje"; snapshot registra sob qual tz o plano foi gerado |
| `created_at` | todas | `timestamptz` | Instante técnico de inserção; nunca usado para lógica de calendário |
| `rescheduled_from` | `scheduled_cares.rescheduled_to_id` (na original) + `origin='rescheduled'` (na nova) | FK | Lineage preservada nos dois sentidos por consulta; original mantém sua `planned_date` |

Regras:
- **Hoje** = `toLocalDate(clock.now(), profile.timezone)`. O app calcula para render; o servidor recalcula para gravar.
- **Viagem** (tz do dispositivo ≠ perfil): app detecta e pergunta se atualiza o perfil. Enquanto não atualiza, "hoje" segue o perfil (previsível). Ao atualizar: nada muda em `planned_date`; notificações locais são reconciliadas.
- **Mudança de timezone permanente**: idem; `hair_plans.timezone` preserva o snapshot histórico.
- **Reagendamento**: nova linha com nova `planned_date`; original mantém a data e vira `rescheduled`. Adesão conta a nova.
- **Atraso**: `planned_date < today AND status='planned'` — calculado; política de tratamento é decisão D-28.
- **DST**: Brasil sem DST desde 2019, mas tz IANA cobre se voltar; notificações locais convertidas pelo SO na hora local (19:00 continua 19:00).
- **Notificações**: intent = (`planned_date`, `reminder_time_local`, tz do perfil) → adapter agenda no SO; `intent_id` determinístico permite reconciliação.
- **Meia-noite**: execução às 00:10 do dia D+1 para cuidado de D: `executed_on = D+1`; RPC aceita vincular à `scheduled_care` de D se `|executed_on − planned_date| ≤ 1` (regra em SPEC-005) — evita "atrasado" injusto.

## 10. Notification review (local no MVP)

| Aspecto | Análise | Mitigação/decisão |
|---|---|---|
| Vantagens | Zero backend, sem tokens de device (menos PII), funciona offline, suficiente para H3 | — |
| Atualização de cronograma | Notificações antigas ficam obsoletas | Reconciliação total (cancel all + reschedule) a cada abertura, mudança de plano, execução, reagendamento |
| Múltiplos dispositivos | Cada device agenda; usuária pode receber 2× | Aceito no MVP (raro no ICP); pós-MVP push resolve |
| Logout | Lembretes continuariam | Cancelar todas as notificações no logout/exclusão (regra no adapter, testada) |
| Timezone | SO usa tz do dispositivo; perfil pode divergir | Reconciliar ao detectar divergência; texto não menciona hora |
| Revogação de permissão | Silêncio | Checar status ao abrir; UI mostra estado; evento `notification_permission_*` |
| Reinstalação | Perde agenda | Reagendada no primeiro open após login |
| Limite iOS (64 pendentes) | Estouro | Janela 14 dias × ≤ 2/dia = 28 |
| Sem abrir o app | Nada novo após a janela | `habit_recovery` agendado localmente para D+3 e D+7 da última abertura |
| Migração para push | — | `NotificationChannelPort` com implementação `local` hoje; `push` adiciona adapter + `device_tokens` + `notification_deliveries`; **intents e domínio inalterados** |

Conclusão: a abstração permite trocar canal sem tocar no domínio. Recomendo manter (D-22).

## 11. Entitlements review

```
Store (App Store / Play)      → cobrança, recibo, renovação           [fora do nosso domínio]
   ↓
Billing Provider (RevenueCat) → normaliza recibos; emite webhooks     [ACL: Edge billing-webhook]
   ↓
Subscription State            → subscriptions(status, product_code, períodos) [Postgres, server-only]
   ↓
Entitlements                  → has_entitlement(code) / get_my_entitlements() [derivação server-side; catálogo em core]
   ↓
Application Authorization     → RLS/RPC checam entitlement; EntitlementService.can() decide UI
```

- **Billing ≠ Subscription**: billing é evento do provider (compra, renovação, reembolso); subscription é o **estado** consolidado que nós controlamos.
- **Subscription ≠ Entitlement**: subscription diz "qual produto e até quando"; entitlement diz "o que pode". Um produto pode dar N entitlements; um entitlement pode vir de produtos diferentes ou de concessão manual (`provider='manual'`).
- Nenhum módulo importa SDK do provider fora de `infrastructure/billing` (app: SDK para compra) e `supabase/functions/billing-webhook`.
- Fluxo de compra: app chama SDK → provider → webhook → `subscriptions` → app faz `refetch get_my_entitlements`. Latência de segundos: UI mostra "ativando…".

## 12. Privacy / LGPD

| Categoria | Dados | Finalidade | Necessário? | Retenção | Exclusão | Exportação | Risco |
|---|---|---|---|---|---|---|---|
| Account | email, provider ids, tz, locale, display_name (opcional) | autenticar, calendário local | Sim | até exclusão | cascade + purga Auth | sim | Médio (identificação) |
| Hair Profile | características e hábitos capilares | diagnóstico | Sim | até exclusão | cascade | sim | Baixo-médio |
| Diagnostic | respostas e resultado | plano; auditoria de versão | Sim | até exclusão | cascade | sim | Baixo-médio |
| Schedule | planos e cuidados planejados | core | Sim | até exclusão | cascade | sim | Baixo |
| Execution / Check-in | execuções, sensações 1–5, notas livres | adesão, evolução | Sim (notas: opcional) | até exclusão | cascade | sim | Médio (notas livres) — nunca em logs/analytics |
| Analytics | eventos pseudonimizados | validar hipóteses | Sim, com base legal | ≤ 12 meses | request ao provider (runbook) | não | Médio (re-identificação) |
| Marketing | — | — | **Não coletado no MVP** | — | — | — | — |
| Admin/Audit | ações admin/sistema, ids | segurança/compliance | Sim | ≥ 12 meses | não (obrigação) | não | Baixo (sem PII além de ids) |

Não coletados: gênero, nascimento, telefone, localização, fotos, contatos. Consentimentos versionados. Disclaimer não-médico.

## 13. Analytics review

Catálogo (ADR-010) já descreve comportamento, não UI. Eventos essenciais por métrica:

| Métrica | Eventos |
|---|---|
| Onboarding completion | `onboarding_started`, `onboarding_completed` |
| Diagnostic completion | `diagnostic_started`, `diagnostic_completed` |
| Activation (chegar a "seu cronograma" ≤ 5 min) | `onboarding_started` → `schedule_created` (delta de timestamps) |
| First schedule creation | `schedule_created` (prop `is_first: true`) |
| D1/D7/D30 | `app_opened` (**adicionado nesta revisão**) |
| Care adherence | `care_completed`, `care_skipped`, `care_rescheduled` + planejados (do banco) |
| Check-in rate | `checkin_completed` / `care_completed` |
| Trial conversion | `subscription_viewed`, `trial_started` (server-side) |
| Paid conversion | `subscription_started`, `subscription_cancelled` (server-side) |
| Hábito diário | `today_viewed` (**adicionado**) |

Props permitidas: ids opacos, enums de domínio, `algorithm_version`, números agregados, plataforma/versão. Proibido: PII, textos livres.

## 14. MVP scope review

| Capacidade | Classificação | Nota |
|---|---|---|
| Conta (Apple/Google/email), exclusão | MUST | Apple exige exclusão |
| Onboarding ≤ 8 perguntas → Hair Profile | MUST | |
| Diagnóstico v1 explicável | MUST | |
| Plano + calendário (planejado vs feito) | MUST | |
| Tela Hoje + concluir (idempotente) | MUST | core loop |
| Conteúdo contextual por care_type (seed) | MUST (mínimo: 3 textos) | J5 |
| Reagendar / pular | MUST | rede real de uso |
| Check-in 3–4 toques | MUST | H4 |
| Lembretes locais (hoje, check-in pendente) | MUST | H3 |
| Lembrete "atrasado" / habit_recovery | SHOULD | |
| Progresso: adesão + histórico | SHOULD | pode ser tela simples |
| Streak | SHOULD → decidir (D-25) | calculado, sem badges |
| Reavaliação (novo plano) | SHOULD | pode ser "refazer diagnóstico" bruto |
| Paywall + 1–2 features premium | MUST (para H5) | última fase |
| Desfazer execução | SHOULD | |
| Exportação de dados (UI) | LATER | arquitetura pronta |
| Push remoto | LATER | |
| Share cards / referral / deep links de campanha | LATER | |
| Admin web | LATER | |
| "Produtos que tenho em casa" | LATER | |
| Multi-idioma | LATER | |
| Comunidade / feed / chat / seguidores | REMOVE do MVP | |
| Marketplace / e-commerce / afiliados | REMOVE do MVP | |
| IA generativa / assistente conversacional | REMOVE do MVP | |
| Diagnóstico por câmera/foto | REMOVE do MVP | |
| Gamificação complexa (badges, níveis, rankings) | REMOVE do MVP | |
| Integração salões / B2B | REMOVE do MVP | |

## 15. ADR review

| ADR | Decision | Confidence | Human approval? | Reason |
|---|---|---|---|---|
| 001 | Camadas pragmáticas, core separado | HIGH | Sim (formal) | Padrão consolidado; baixo risco |
| 002 | Expo + RN + TS | HIGH | **Sim (H)** | Irreversível na prática; preferência declarada coincide |
| 003 | Repo único, 2 workspaces, admin adiado | HIGH | Sim | Reversível; admin adiado é decisão de produto |
| 004 | RLS/RPC/Edge; 3 ambientes | HIGH | Sim | Coerente com segurança |
| 005 | Auth: Apple + Google + email/senha | **MEDIUM** | **Sim (H)** | Alternativa OTP recomendada (§8, D-21) |
| 006 | Fronteiras; Care Tracking unificado | HIGH | Sim | Reversível |
| 007 | Engines puros versionados; preview + Edge | HIGH | Sim | Núcleo do produto; depende do spike de import (D-40) |
| 008 | Tempo/datas | HIGH | Sim | Sem alternativa séria |
| 009 | Notificações locais | MEDIUM | **Sim (H)** | Trade-off de reengajamento (D-22) |
| 010 | Analytics tipado | HIGH | Sim | Sem custo |
| 011 | Billing/Subscription/Entitlements; RevenueCat candidato | HIGH (forma) / MEDIUM (provider) | **Sim (H)** para provider | Provider decidido só na fase 9 (D-24) |

Nenhuma ADR foi movida para `Accepted`.

## 16. Final architecture check

| Dimensão | Resposta | Observação |
|---|---|---|
| Modularidade — responsabilidade clara por módulo? | **SIM** | Ambiguidade reagendamento resolvida (§3) |
| Segurança — operação crítica confiando no cliente? | **NÃO** | Matriz §5; preview do engine não persiste |
| Dados — entidade sem ownership claro? | **NÃO** | Catálogos/admin têm policies próprias |
| Histórico — ação sobrescreve fatos? | **NÃO** | Único mutável: `voided_at` (marca, não apaga) e status derivado |
| Testabilidade — engines isolados? | **SIM** | Puros; golden tests; Node + Deno em CI |
| Evolução — trocar analytics/billing/notification sem reescrever domínio? | **SIM** | Ports + ACL; provider nunca no core |
| Vibe coding safety — agente novo entende via SPEC/ADR/boundaries/security/tests sem chat? | **SIM, com ressalva** | Depende de SPEC-000 materializar lint boundaries, CI de RLS e skills. Até lá é só documento |

Problema residual honesto: **a fundação é 100% documental**. Sua eficácia contra agentes depende da fase Foundation (SPEC-000) transformar regras em lint/CI/testes. Isso é intencional (ARCHITECTURE FIRST), mas deve ser a primeira coisa implementada após aprovação.
