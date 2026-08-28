# DATA MODEL — Modelo conceitual

| Campo | Valor |
|---|---|
| Status | Draft v0.1 — **conceitual; nenhuma migration criada** |
| Relacionados | [DOMAIN-MAP](DOMAIN-MAP.md) · [SUPABASE-RLS-STRATEGY](../security/SUPABASE-RLS-STRATEGY.md) · [ADR-008 Time](../adr/ADR-008-time-and-dates.md) |

> Nomes de tabelas/colunas abaixo são **propostas** para dar precisão ao raciocínio. Só viram schema real via SPEC + migration revisada. Nada aqui autoriza um agente a criar tabelas.

---

## 1. Convenções de dados (obrigatórias)

| Convenção | Regra |
|---|---|
| Schema | Tabelas de produto em `public`; nenhum objeto de app em `auth`/`storage` além de triggers documentados |
| PK | `id uuid primary key default gen_random_uuid()` (exceto `profiles.user_id`) |
| Timestamps | `created_at timestamptz not null default now()`; `updated_at` só em tabelas mutáveis (trigger `public.set_updated_at()` — criada em `supabase/migrations/20260826000000_foundation.sql`, SECURITY INVOKER) |
| Ownership | Coluna `user_id uuid not null references auth.users(id) on delete cascade` em **toda** tabela de dados da usuária, mesmo quando derivável por FK (simplifica RLS e índices) |
| Datas locais | `date` (sem timezone) para "dia da usuária"; `timestamptz` para instantes reais; nunca `timestamp` sem tz |
| Enums | `text` + `CHECK (col in (...))` no MVP (mais fácil de migrar que `enum type`); valores em snake_case; espelhados em zod |
| JSON | `jsonb` apenas para snapshots imutáveis e atributos versionados por algoritmo; nunca para dados consultados por filtro sem índice |
| Soft delete | **Não.** Exclusão de conta usa `account_deletion_requests` (estado explícito + grace) e depois hard delete em cascade. Histórico é preservado por status, não por `deleted_at` |
| Versionamento | `assessment_algorithm_version` + `schedule_algorithm_version` (text) em `hair_plans`; `hair_profiles` sem numeração (snapshots por `id` — D-64) |
| Status | Máquinas de estado explícitas com `CHECK`; transições validadas em RPC |
| Índices | Sempre em `(user_id, ...)` para tabelas de usuária; índices parciais para `status = 'active'` |
| Naming | snake_case; tabelas no plural; FKs `<entidade>_id`; booleans `is_` / `has_` |

## 2. Diagrama ER (conceitual)

```mermaid
erDiagram
    auth_users ||--|| profiles : "1:1"
    profiles ||--o{ consents : has
    auth_users ||--o{ hair_profiles : "snapshots (SPEC-002; ownership direto — D-63)"
    auth_users ||--o{ hair_plans : "planos (SPEC-004; ownership direto)"
    profiles ||--o{ diagnostic_results : has
    profiles ||--o{ care_executions : has
    profiles ||--o| notification_preferences : has
    profiles ||--o{ subscriptions : has
    profiles ||--o| account_deletion_requests : has
    hair_profiles ||--o{ hair_plans : "generates (SPEC-004; sem diagnostic_results — D-66/§9)"
    hair_plans ||--o{ scheduled_cares : contains
    scheduled_cares o|--o{ care_executions : "fulfilled by"
    care_executions ||--o| checkins : has
    care_types ||--o{ scheduled_cares : "typed (código text + CHECK até a SPEC-007)"
    care_types ||--o{ care_executions : typed
    care_types ||--o{ content_articles : explains
    admin_users }o--|| auth_users : is
    audit_log }o--o| auth_users : actor
```

## 3. Entidades

### 3.1 `profiles` — Identity & Account
| Coluna | Tipo | Notas |
|---|---|---|
| user_id | uuid PK, FK auth.users | **entidade conceitual/futura** — **NÃO** criada pela SPEC-002 (D-63): nasce numa SPEC futura quando houver requisito concreto (ex.: `timezone` para Schedule, SPEC-004). Dados de produto ancoram direto em `auth.users` até lá; sem trigger em `auth.users` |
| display_name | text null | dado pessoal (nome/apelido) — opcional |
| timezone | text not null default 'America/Sao_Paulo' | IANA; validada |
| locale | text not null default 'pt-BR' | |
| onboarding_status | text CHECK (not_started/in_progress/completed) | |
| created_at / updated_at | | |

- **Ownership:** usuária. **Lifecycle:** criado numa SPEC futura (não SPEC-002 — D-63) → ativo → (pedido de exclusão em `account_deletion_requests`, cancelável; política de purga pendente — D-55) → hard delete cascade a partir de `auth.users`. *(Revisão v0.2: coluna `deleted_at` removida — fonte única de verdade é `account_deletion_requests`.)*
- **PII:** display_name. Email/telefone vivem apenas em `auth.users`.
- **Não armazenar:** gênero, data de nascimento completa (se necessário para ICP, usar faixa etária opcional em `hair_profiles.attributes`... ou não coletar — **decisão: não coletar no MVP**).

### 3.2 `consents`
| Coluna | Tipo |
|---|---|
| id, user_id | |
| consent_type | text CHECK (terms/privacy/analytics/marketing) |
| version | text (versão do documento aceito) |
| granted_at / revoked_at | timestamptz |

Append-only por versão; permite comprovar base legal (LGPD).

### 3.3 `hair_profiles` — Hair Profile (append-only, implementado na SPEC-002)
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | identidade estável do snapshot; referenciada pelo downstream como `hair_profile_id` (D-64) |
| user_id | uuid not null, FK `auth.users` on delete cascade | ownership direto (sem `profiles` — D-63) |
| hair_pattern, strand_thickness, scalp_tendency, wash_frequency, heat_usage, primary_goal | text CHECK | 8 inputs aprovados (D-62; conjuntos em SPEC-002 §6) |
| chemical_treatments | text[] not null default '{}' | subconjunto validado; `[]` = nenhuma (sem valor `none`) |
| current_concerns | text[] not null | `cardinality>=1`; `no_major_concern` exclusivo |
| created_at | timestamptz | sem `updated_at` — imutável |

- **Invariante:** snapshots **imutáveis**; cada avaliação = nova linha; "snapshot atual" = o mais recente (`ORDER BY created_at DESC, id DESC LIMIT 1`). **Sem `version` sequencial, sem `is_current`** (D-64). Índice `(user_id, created_at desc, id desc)`.
- **Atribuição:** INSERT direto pelo cliente (RLS `WITH CHECK user_id = auth.uid()`); **sem trigger, sem advisory lock, sem RPC** (D-64). Imutabilidade por ausência de grant UPDATE/DELETE.
- **Sem** `extra_attributes` (D-64/necessity review); `porosity`/`elasticity`/`scalp_oiliness`/`density`/`goals` genérico/2A–4C **fora do MVP** (SPEC-002 §10).
- **PII:** sensibilidade baixa/média (características físicas). Tratar como dado pessoal (LGPD), não sensível de saúde.

### 3.4 `diagnostic_results` — **NÃO EXISTE** (necessity review SPEC-004 §9, D-66)
Removida do modelo: no MVP a avaliação só existe para gerar um plano, nenhuma feature a consulta isoladamente e a reprodutibilidade não exige cópia (engines determinísticos + versões liberadas imutáveis). O `AssessmentOutput` é um **artefato transitório** entre os dois engines. Reabrir só com requisito concreto (ex.: histórico de avaliação sem plano).

### 3.5 `hair_plans` — Schedule (raiz do agregado; implementado na SPEC-004)
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid not null, FK `auth.users` on delete cascade | RLS `user_id = auth.uid()` |
| hair_profile_id | uuid not null, FK `hair_profiles` on delete cascade | proveniência do snapshot |
| starts_on | date not null | dia local da 1ª sessão (input do engine) |
| assessment_algorithm_version | text not null | provenance (§11) |
| schedule_algorithm_version | text not null | provenance (§11) |
| status | text CHECK (active/superseded) | sem `archived` no MVP |
| client_request_id | uuid not null | idempotência de `generate-plan` |
| created_at | timestamptz | sem `updated_at` (plano é histórico) |

- **Invariantes DB:** `hair_plans_one_active_per_user` (único parcial em `user_id` where `status='active'`); `UNIQUE (user_id, client_request_id)` (idempotência); `UNIQUE (id, user_id)` (alvo do FK composto de `scheduled_cares`). Índice `(user_id, created_at desc)`.
- **REMOVIDOS na necessity review (SPEC-004 §10):** `diagnostic_result_id`, `timezone`, `strategy`, `input_snapshot`, `updated_at`, `superseded_by_plan_id`. Reprodutibilidade = `hair_profile_id` + as duas versões de algoritmo.
- **Escrita só server-side:** `authenticated` tem apenas SELECT próprio; criação/supersessão exclusivamente pela RPC `create_plan_tx` (SECURITY DEFINER, EXECUTE só para `service_role`), chamada pela Edge Function `generate-plan`.

### 3.6 `scheduled_cares` — planejado (implementado na SPEC-004; colunas de execução → SPEC-005)
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| plan_id, user_id | FK composto `(plan_id, user_id) → hair_plans (id, user_id)` on delete cascade | o banco impede `user_id` divergir do dono do plano (SPEC-004 AC13); `user_id` também FK `auth.users` |
| care_type_code | text CHECK (hydration/nutrition/reconstruction) | conjunto aprovado em D-67; tabela/FK `care_types` → SPEC-007 |
| planned_date | date not null | dia local |
| created_at | timestamptz | |

- **Adicionado pela SPEC-005:** `status text not null default 'planned'` CHECK `in ('planned','skipped','rescheduled')` — **sem `completed`** (D-69: concluído é derivado da existência de execução efetiva, evita duas fontes de verdade); `rescheduled_to_id uuid null` com CHECK `(status='rescheduled') = (rescheduled_to_id is not null)` e FK composta `(rescheduled_to_id, user_id)`; `UNIQUE (id, user_id)` (alvo do FK de ownership de `care_executions`); índice parcial `(user_id, planned_date) WHERE status='planned'`.
- **Ainda adiado:** `origin`, `skip_reason`, `updated_at` (SPEC-005 §8.1 — sem consumidor). `sequence` removido (ordem derivável de `(planned_date, id)`).
- **Escrita só server-side:** `authenticated` tem apenas SELECT próprio.
- **Índices:** `(user_id, planned_date)`, `(plan_id, planned_date)`.
- **Invariantes:** `status='rescheduled' ⇔ rescheduled_to_id is not null` (CHECK); `status='completed'` só via `complete_care` (trigger/RPC); usuária **não** altera `planned_date` (reagendar = nova linha).
- "Atrasado" é calculado, nunca armazenado. Por D-28, não existe job/trigger que mova `planned_date` ou crie reagendamentos automáticos; toda transição de cuidado atrasado nasce de ação explícita da usuária via RPC.

### 3.7 `care_executions` — executado (append-only; implementado na SPEC-005)
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid not null, FK `auth.users` on delete cascade | RLS `user_id = auth.uid()` |
| scheduled_care_id | uuid **not null**, FK composta `(scheduled_care_id, user_id) → scheduled_cares (id, user_id)` on delete cascade | execução avulsa (`null`) **DEFER**; soltar o NOT NULL depois é aditivo |
| care_type_code | text CHECK (hydration/nutrition/reconstruction) | o **fato histórico**: sobrevive a renomeações do catálogo da SPEC-007 |
| client_execution_id | uuid not null | `UNIQUE (user_id, client_execution_id)` — idempotência (T19) |
| executed_at | timestamptz not null default now() | instante do servidor; a janela de undo é medida a partir dele |
| executed_on | date not null | dia civil da usuária, **calculado no servidor** a partir da tz IANA + validação de plausibilidade (T22) |
| voided_at | timestamptz null | "desfazer" em **15 min** (D-69/D-12); a linha **permanece** no histórico, nunca é apagada |
| created_at | timestamptz | |
| ~~note~~ | **DEFER** | texto livre é PII e território de check-in (SPEC-006) |

- **Invariante (D-69/D-35):** no máximo **uma execução efetiva** por `scheduled_care_id` — índice único **parcial** `WHERE voided_at IS NULL`. Uma execução anulada não ocupa a vaga, então desfazer libera o cuidado para ser registrado de novo.
- **Imutabilidade:** `voided_at` é a **única** coluna mutável, e só pela RPC `void_execution`. Nunca UPDATE de `executed_at`, `executed_on`, `care_type_code` ou `scheduled_care_id`. Nunca DELETE pela usuária (sem grant).
- **Escrita só server-side:** `authenticated` tem apenas SELECT próprio; toda transição passa por `complete_care` / `skip_care` / `reschedule_care` / `void_execution` (SECURITY DEFINER, allowlistadas).

### 3.8 `checkins` — Care Tracking (implementado na SPEC-006)
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid not null, FK `auth.users` on delete cascade | RLS `user_id = auth.uid()` |
| care_execution_id | uuid not null, FK composta `(care_execution_id, user_id) → care_executions (id, user_id)` on delete cascade; **UNIQUE** | 1:1 com a execução — o banco impede o `user_id` divergir do dono (BR1/BR6) |
| overall_feel | smallint not null CHECK between 1 and 5 | a única pergunta: "Como ficou?" |
| client_checkin_id | uuid not null | `UNIQUE (user_id, client_checkin_id)` — idempotência (FR6) |
| created_at | timestamptz | |
| ~~hydration_feel, softness, definition, dryness~~ | **DEFER** | existiam para alimentar o Progress (Fase 8), que não existe. Colunas anuláveis são **aditivas** — a SPEC-009 acrescenta as que precisar |
| ~~note~~ | **DEFER** | texto livre é PII sem consumidor (mesmo motivo que adiou `care_executions.note`) |

- **Âncora:** o check-in pertence a uma **execução**, nunca a um `scheduled_care` nem a um dia. É isso que faz o undo (D-12) se comportar: anular a execução deixa o check-in preso à linha anulada — histórico, não fraude — e a execução substituta nasce sem check-in.
- **Append-only:** sem UPDATE, sem DELETE, sem grant. Editar/apagar check-in é DEFER (SPEC-006 §8.3).
- **Escrita só server-side:** `authenticated` tem apenas SELECT próprio; a única escrita é a RPC `submit_checkin` (SECURITY DEFINER, allowlistada), que recusa execução anulada, execução alheia (`P0002`, indistinguível de inexistente) e `overall_feel` fora de 1..5.

### 3.9 `care_types` / 3.10 `content_articles` — **NÃO EXISTEM** (necessity review SPEC-007 §8.2, D-71)

A SPEC-007 (Content v1) foi implementada **sem tabela**. O conteúdo — o que cada cuidado faz, os
passos, a duração aproximada e os erros comuns — vive no bundle, em
`packages/core/src/content/`, tipado por `CareGuide` e exaustivo por `Record<CareTypeCode, CareGuide>`.

Motivo (mesma regra que removeu `diagnostic_results` em §3.4): nenhum fluxo atual consome conteúdo
editável em runtime — não há CMS nem admin (ADR-003, pós-MVP), premium é Fase 9 (SPEC-010), não há
fluxo editorial, e a FK `scheduled_cares.care_type_code → care_types.code` não acrescenta invariante
sobre o `CHECK` que já existe. Uma leitura de rede **criaria** loading, erro, retry e falha offline
numa tela que hoje não tem nenhum desses estados.

**Gatilho para criar as tabelas** — o primeiro que ocorrer: (1) conteúdo precisar mudar sem release
do app; (2) gating premium entrar em escopo; (3) existir editor/admin de conteúdo; (4) segundo
idioma. A migração é **aditiva**: `CareGuide` já é o formato de leitura, então a tabela entra atrás
de um port sem alterar a tela.

**Governança (D-26/D-70):** cada guia declara `validationStatus` e `rationaleSource`. O conteúdo V1
é `candidate` — dev/internal beta liberados, **PUBLIC RELEASE bloqueado** até o sign-off de domínio
(OQ-REL), exatamente como as regras V1 dos engines.

### 3.11 `notification_preferences`
| Coluna | Tipo |
|---|---|
| user_id PK | |
| enabled | bool default false (opt-in) |
| reminder_time_local | time not null default '19:00' |
| checkin_reminder_enabled | bool |
| max_per_day | smallint (regra central; default 2) |
| updated_at | |

`notification_deliveries` (registro de entregas) fica **fora do MVP** enquanto o canal for local — o SO é a fila.

### 3.12 `subscriptions` — Subscription
| Coluna | Tipo |
|---|---|
| id, user_id | |
| provider | text CHECK (revenuecat/apple/google/manual) |
| provider_subscription_id | text; UNIQUE (provider, provider_subscription_id) |
| product_code | text |
| status | text CHECK (trial/active/grace/expired/cancelled/refunded) |
| trial_ends_at, current_period_ends_at, cancelled_at | timestamptz |
| last_event_id | text (idempotência de webhook) |
| raw_last_event | jsonb (sem PII; para debug) |
| created_at / updated_at | |

- Escrita **exclusivamente** por Edge Function (service role). Usuária: SELECT próprio. Nunca INSERT/UPDATE via client.
- Entitlements derivados por função `get_my_entitlements()` / `has_entitlement(code)` — sem tabela no MVP.

### 3.13 `admin_users`
| Coluna | Tipo |
|---|---|
| user_id PK FK | |
| role | text CHECK (admin/support/content) |
| granted_by | uuid |
| created_at | |

Só escrita por migration (SQL revisado em PR). Custom claim `app_role` sincronizado por Auth Hook. Ver SECURITY-BASELINE.

### 3.14 `audit_log` (append-only)
| Coluna | Tipo |
|---|---|
| id | bigint identity |
| actor_user_id | uuid null (null = sistema) |
| actor_type | text CHECK (user/admin/system/webhook) |
| action | text (ex. `subscription.updated`, `account.deletion_requested`) |
| target_table, target_id | text |
| metadata | jsonb (sem segredos/PII além de ids) |
| created_at | |

Ninguém faz UPDATE/DELETE (nem service role por policy de app; retenção via job). INSERT somente por funções `SECURITY DEFINER` dedicadas ou service role.

### 3.15 `account_deletion_requests`
| Coluna | Tipo |
|---|---|
| user_id | uuid PK, FK auth.users on delete cascade |
| requested_at | timestamptz not null default now() |

**SPEC-001 (aprovada):** modelo mínimo — existência da linha = pedido ativo; cancelar = a usuária apaga a própria linha; sem coluna de status e sem `scheduled_purge_at` (a política de purga, imediata vs grace, é decisão humana pendente — D-55 — e lê `requested_at`). Escrita por acesso direto com grants mínimos (`SELECT/INSERT/DELETE` próprios, sem `UPDATE`) + RLS + PK; sem RPC. A exclusão efetiva de `auth.users` é privilegiada/server-owned (job/runbook futuro).

## 4. Matriz de dados pessoais (LGPD)

| Dado | Tabela | Categoria | Necessário? | Retenção | Exportável |
|---|---|---|---|---|---|
| Email / senha hash / provider ids | auth.users | Identificação | Sim (conta) | Até exclusão | Email sim |
| display_name | profiles | Identificação | Opcional | Até exclusão | Sim |
| timezone / locale | profiles | Técnico | Sim | Até exclusão | Sim |
| Características do cabelo | hair_profiles | Pessoal (não sensível) | Sim (core) | Até exclusão | Sim |
| Respostas/diagnóstico | diagnostic_results | Pessoal derivado | Sim | Até exclusão | Sim |
| Planos e execuções | hair_plans, scheduled_cares, care_executions | Comportamental | Sim | Até exclusão | Sim |
| Notas livres | care_executions.note, checkins.note | Pessoal (potencialmente sensível — texto livre) | Opcional | Até exclusão | Sim; **nunca em logs/analytics** |
| Assinatura | subscriptions | Financeiro (sem cartão) | Sim | Até exclusão + obrigação fiscal (avaliar) | Sim (status) |
| Eventos analytics | provedor externo | Comportamental pseudonimizado | Sim (com consentimento) | Política do provedor; ≤ 12 meses proposto | Não (pseudônimo) |
| Fotos | — | **Não coletado no MVP** | — | — | — |

**Exclusão:** pedido registrado pela usuária em `account_deletion_requests` (acesso direto, SPEC-001) → política de purga (D-55) → job privilegiado purga `auth.users` (cascade) + solicita exclusão no provedor de analytics/billing por runbook.
**Exportação:** RPC `export_my_data()` retorna JSON das tabelas próprias (fase pós-MVP inicial; arquitetura pronta porque tudo tem `user_id`).

## 5. Invariantes que o banco protege (resumo)

1. Um plano ativo por usuária (índice parcial único).
2. Execução idempotente (`client_execution_id` único por usuária); **no máximo 1 execução efetiva por `scheduled_care`** (índice único parcial `WHERE voided_at IS NULL` — D-69/D-35); "concluído" e "atrasado" são **derivados**, não existem como coluna.
3. Check-in 1:1 com execução.
4. `hair_profiles` imutável (append-only; sem UPDATE/DELETE); snapshot atual = mais recente por `(created_at, id)` — sem numeração de versão (D-64).
5. Enums fechados (CHECK).
6. Reagendamento consistente (CHECK status ⇔ rescheduled_to_id).
7. Toda linha de usuária tem `user_id` NOT NULL com FK cascade.
8. `algorithm_version` NOT NULL onde aplicável.
9. Assinaturas só mudam via servidor (ausência de policy de escrita para `authenticated`).
10. `audit_log` append-only.

## 6. Decisões em aberto (para SPECs)
- ~~Permitir "desfazer execução"?~~ — **DECIDIDA (D-69/D-12, SPEC-005): sim, janela de 15 minutos** via `voided_at` + RPC `void_execution`; a execução anulada permanece no histórico.
- ~~Janela de geração de `scheduled_cares`~~ — **DECIDIDA (D-67, SPEC-004): 28 dias / 4 semanas**, gerada na criação do plano. Extensão por job/on-demand não existe no MVP.
- Streaks: **DEFERRED (D-25)** — nenhuma tabela/campo de streak no MVP; se necessário, derivar de `care_executions`.
