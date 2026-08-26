# DECISION REGISTER

| Campo | Valor |
|---|---|
| Status | v0.2 — 2026-08-26 — **arquitetura aprovada por revisão humana**; fase autorizada: SPEC-000 (Engineering Foundation) |
| Uso | Fonte de verdade sobre o estado de cada decisão. Nenhum item muda de status sem registro humano nesta tabela. Agentes nunca resolvem itens `HUMAN DECISION` por conta própria. |

Legenda de custo de mudança tardia: **L** (horas) · **M** (dias) · **H** (semanas ou migração de dados).
Status: `APPROVED` · `DECIDED` (decisão humana com conteúdo específico) · `DEFERRED` · `OPEN`.

> Nota de integridade (2026-08-26): a aprovação B1 referiu-se ao "bloco D-01…D-15". O bloco READY TO ACCEPT da Foundation Review continha **D-01…D-11 e D-13…D-15**; **D-12** estava (e permanece) em DEFER. Os itens aprovados abaixo são exatamente os que constavam no bloco, sem alteração de conteúdo.

---

## A. APPROVED — bloco READY TO ACCEPT (aprovação humana B1, 2026-08-26)

| ID | Decisão | Opção adotada | Motivo | Custo tardio | Status |
|---|---|---|---|---|---|
| D-01 | Camadas pragmáticas + domínio em `packages/core` (ADR-001) | camadas pragmáticas | Protege engines da UI/IA sem boilerplate | M | **APPROVED** |
| D-02 | Repo único, 2 workspaces (ADR-003) | 2 workspaces | Fronteira física do domínio com custo mínimo | L | **APPROVED** |
| D-03 | RLS como autorização primária; RPC para transações; Edge só para engine/segredos (ADR-004) | Supabase nativo | Menos infra; RLS testável | H | **APPROVED** |
| D-04 | Fusão Calendar + Execution + Check-in em Care Tracking (ADR-006) | 1 contexto, 3 subpastas | Mesmo agregado | L | **APPROVED** |
| D-05 | `Instant` vs `LocalDate` + tz IANA no perfil; `new Date()` proibido (ADR-008) | — | Sem alternativa séria | M | **APPROVED** |
| D-06 | Engines puros, versionados, golden tests; preview local + persistência server-side (ADR-007) | ambos com mesma versão | P01 + P10 | M | **APPROVED** |
| D-07 | Intent/Channel/Delivery para notificações (ADR-009, forma) | — | Port permite trocar canal | L | **APPROVED** |
| D-08 | Catálogo tipado de eventos + port; PII proibida (ADR-010) | — | — | L | **APPROVED** |
| D-09 | Billing ≠ Subscription ≠ Entitlement; entitlements por capacidade (ADR-011, forma) | 3 camadas | flag `is_premium` é insegura | M | **APPROVED** |
| D-10 | Exclusão de conta via `account_deletion_requests` (sem `profiles.deleted_at`) | tabela de pedido | Fonte única; cancelável | L | **APPROVED** |
| D-11 | `hair_profiles.version` por trigger com advisory lock (INSERT direto) | trigger | Evita RPC trivial | L | **APPROVED** |
| D-13 | Sem Storage, Realtime, uploads, usuários anônimos no MVP | — | Superfície menor | L | **APPROVED** |
| D-14 | `CLAUDE.md` + proibições + CODEOWNERS + PR template | — | Governança de agentes | L | **APPROVED** |
| D-15 | 5 skills iniciais, read-only exceto `/spec-create` | — | — | L | **APPROVED** |

## B. DECIDED — decisões humanas com conteúdo específico (2026-08-26)

| ID | Decisão | Conteúdo decidido | Efeito documental | Status |
|---|---|---|---|---|
| D-20 | Framework mobile | **Expo + React Native + TypeScript strict.** Estrutural: só muda com nova ADR que substitua ADR-002 | ADR-002 → Accepted | **DECIDED** |
| D-21 | Autenticação | **Apple + Google + Email OTP/passwordless.** Email+senha **não** é fluxo principal do MVP. SPEC de Identity deve cobrir: Sign in with Apple, Google, Email OTP, account linking, prevenção de duplicidade, colisão email/provider, expiração de OTP, rate limiting, deep link security, sessão, logout, account recovery | ADR-005 revisada (permanece Proposed até diff aprovado) | **DECIDED** |
| D-22 | Notificações | **Local no MVP.** Domínio não conhece Expo Notifications. Separação `NotificationIntent → NotificationScheduler → NotificationAdapter`; primeira implementação `LocalNotificationAdapter`; push remoto fora do MVP, adicionável sem alterar domínio | ADR-009 atualizada → Accepted | **DECIDED** |
| D-23 | Admin UI | **DEFER.** Não criar `apps/admin` por antecipação; só com necessidade operacional concreta. Arquitetura preserva possibilidade | ADR-003 → Accepted (sem mudança) | **DEFERRED** |
| D-24 | Billing provider | **DEFER PROVIDER.** Preservar Store → Billing Provider → Subscription State → Entitlements → Application; nenhum componente do domínio depende do provider. Escolha só antes da fase Subscription | ADR-011 → Accepted (forma); provider em SPEC-010 | **DEFERRED (provider)** |
| D-25 | Streaks | **DEFER.** Não persistir streak no MVP; sem tabelas/campos. Se necessário, derivar de fatos de execução | DATA-MODEL §6 | **DEFERRED** |
| D-26 | Regras capilares | **Engineering may design the engine; may NOT invent production hair-care rules.** `DiagnosticRulesV1`/`ScheduleRulesV1` formalizadas separadamente com `rule_id, version, description, inputs, output, rationale/source, validation_status ∈ {draft, awaiting_domain_review, validated, deprecated}`; só `validated` pode ser production-ready. Claude não apresenta suposições como conhecimento validado. Não bloqueia Foundation | ADR-007 amendment; CLAUDE.md §2 | **DECIDED** |
| D-27 | MCP policy | **Supabase MCP:** só projeto de desenvolvimento, read-only por padrão, `project-ref` explícito. Proibido: produção, SQL irrestrito, migrations automáticas, pausar projeto, comandos destrutivos, bypass do workflow de migrations. **Lovable:** remover/não usar. **GitHub:** git + `gh` CLI; sem MCP sem necessidade comprovada | MCP-POLICY §4 | **DECIDED** |
| D-28 | Cuidado atrasado | **Nunca alterar silenciosamente o cronograma.** Mostrar estado e pedir decisão: `[Fazer hoje] [Reagendar] [Pular]`. Sistema nunca desloca o plano sem ação explícita ou regra futura aprovada. Preservar histórico | DOMAIN-MAP §3.5; DATA-MODEL §3.6 | **DECIDED** |

## B2. DECIDED — revisão humana da SPEC-000 (2026-08-26)

| ID | Decisão | Conteúdo decidido | Efeito | Status |
|---|---|---|---|---|
| D-41 | SPEC-000 | **APPROVED FOR IMPLEMENTATION** — somente Engineering Foundation; nenhuma feature de produto | SPEC-000 → Approved → In Progress | **DECIDED** |
| D-42 | ADR-005 | Diff aprovado → **Accepted**; auth só na SPEC-001 | ADR-005 Accepted | **DECIDED** |
| D-43 | Node.js | **22.23.x** (pin `.node-version` = `22.23.2` + `engines`). Não usar 20; não migrar para 24/26 automaticamente; upgrade de major é mudança intencional. Repo deve falhar cedo/avisar claramente em major não suportado | `.node-version`, `package.json#engines`, `scripts/check-node.mjs`, CI `setup-node` | **DECIDED** |
| D-44 | Expo | **SDK 57 / React Native 0.86**, pinado (sem "latest" flutuante); pacotes Expo via `expo install`; sem override manual de versões gerenciadas sem justificativa | `apps/mobile/package.json` | **DECIDED** |
| D-45 | CODEOWNERS | `@gabrielfmorais` **confirmado** por inspeção (remote `github.com/gabrielfmorais/Aplicativo-Sass`, API GitHub: login `gabrielfmorais`, type `User`, owner do repo). Sem segundo revisor inventado | `.github/CODEOWNERS` mantido | **DECIDED** |
| D-46 | Estratégia de implementação | Branch única `foundation/spec-000` com commits atômicos por checkpoint; revisão completa antes do merge; nunca em `main` | — | **DECIDED** |
| D-47 | Dependências da SPEC-000 | Aprovadas como **candidatas**, não obrigatórias; cada instalação justificada (requisito, manutenção, compatibilidade Node 22 + Expo 57 + runtime, install scripts, supply chain) | SPEC-000 §19 evidência | **DECIDED** |
| D-48 | `core != utils` | `packages/core` só contém primitivas de domínio/application independentes de runtime com razão arquitetural explícita; sem fs, env, rede, UI, side effects | `packages/core/README.md`, lint | **DECIDED** |
| D-49 | Spike core↔Deno | Estratégia A → B só com motivo documentado → **STOP** e escalar se B trouxer complexidade/duplicação/hacks; nunca emendar ADR-007 silenciosamente | `CORE-RUNTIME-SPIKE.md` | **DECIDED** |
| D-50 | AC12 — teste de autossuficiência documental (SPEC-000) | **DEFER.** Blocking: **NO**. Motivo: decisão de workflow humana — preservar a sessão ativa do agente em vez de abrir sessão nova exclusiva para o teste. Não executado, não simulado, sem evidência registrada. Trigger: próxima sessão naturalmente nova de agente ou onboarding de novo agente/desenvolvedor. Decisão operacional, não arquitetural | SPEC-000 §25 AC12 | **DEFERRED (2026-08-26)** |
| D-33 | date-fns / date-fns-tz | **Não introduzidas.** `toLocalDate` implementado com `Intl.DateTimeFormat` (nativo em Node, Deno e Hermes), testado incluindo DST histórico. Uma lib de datas só entra via SPEC futura com justificativa | `packages/core/src/shared/time/local-date.ts` | **DECIDED (2026-08-26, implementação SPEC-000)** |
| D-40 | Bundling core → Edge | **Estratégia A**: Deno consome `packages/core/src` diretamente via `supabase/functions/deno.json` (imports `.ts` no core). Sem build. Verificação residual do bundling de deploy na SPEC-004 | `docs/architecture/CORE-RUNTIME-SPIKE.md` | **DECIDED (2026-08-26)** |

## C. DEFERRED / OPEN (não decidir agora)

| ID | Decisão | Recomendação provisória | Quando decidir | Custo tardio | Status |
|---|---|---|---|---|---|
| D-12 | "Desfazer execução" (`voided_at`, 10 min) | (b) void em janela | SPEC-005 | L | DEFERRED |
| D-30 | Nome do produto | placeholder "Hairo" | Antes da fase 10 | L/M | OPEN |
| D-31 | Provider analytics / crash | PostHog + Sentry | Fase 10 | L | DEFERRED |
| D-32 | Base legal LGPD para analytics | consentimento | Antes da fase 10 (jurídico) | L | OPEN |
| D-33 | Lib de datas (`date-fns-tz` vs `Temporal`) | date-fns-tz | **SPEC-000** (proposta em §Dependencies) | L | OPEN → proposta em SPEC-000 |
| D-34 | Janela de geração de `scheduled_cares` | 8 semanas | SPEC-004 | L | DEFERRED |
| D-35 | Múltiplas execuções por scheduled_care | não | SPEC-005 | L | DEFERRED |
| D-36 | Estado global (Zustand vs Context) | Zustand só se necessário | SPEC-001+ | L | DEFERRED |
| D-37 | E2E: Maestro vs Detox | Maestro | Fase 10 | L | DEFERRED |
| D-38 | Captcha em signup/OTP | sim antes do lançamento | SPEC-001/013 | L | DEFERRED |
| D-39 | Retenção de `audit_log` e analytics | 12 meses | Antes da fase 10 | L | DEFERRED |
| ~~D-40~~ | movido para B2 (decidido: Estratégia A) | — | — | — | DECIDED |

## D. Histórico
| Data | Mudança |
|---|---|
| 2026-08-26 | v0.1 criado na Foundation Review. |
| 2026-08-26 | v0.2: aprovação humana B1 (D-01…D-11, D-13…D-15); ADR-002 aprovada; D-21…D-28 decididas/adiadas conforme registro humano. Fase autorizada: SPEC-000. |
| 2026-08-26 | v0.3: revisão da SPEC-000 (D-41…D-49); implementação concluída (D-33, D-40 resolvidos); close-out com CI verde; D-50 AC12 deferred. Próxima SPEC permitida: SPEC-001 (ainda **não** autorizada para redação/implementação). |
