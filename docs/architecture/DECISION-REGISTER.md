# DECISION REGISTER

| Campo | Valor |
|---|---|
| Status | v0.8 — 2026-08-27 — arquitetura aprovada; SPEC-000, SPEC-001 e **SPEC-002 implementadas/merged** (SPEC-002 PR #6; D-62/D-63/D-64/D-65; D-64 amenda D-11); LEVEL 2 auto-merge ativo |
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
| D-11 | `hair_profiles.version` por trigger com advisory lock (INSERT direto) | trigger | Evita RPC trivial | L | **APPROVED — amendado por D-64 (2026-08-27):** snapshots imutáveis identificados por `id` estável, **sem** numeração sequencial/trigger/advisory lock no MVP |
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

## B3. DECIDED — aprovação da SPEC-001 Identity & Authentication (2026-08-26)

| ID | Decisão | Conteúdo decidido | Efeito | Status |
|---|---|---|---|---|
| D-51 | SPEC-001 | **APPROVED** (v0.3) após revisão humana de arquitetura, necessidade e segurança. Provedores: Apple + Google + Email OTP (reafirma D-21/ADR-005). Implementação **não** iniciada; escopo mínimo: Supabase Auth + persistência segura de sessão + `account_deletion_requests` + RLS/grants/constraints | SPEC-001 → Approved; índice | **DECIDED** |
| D-52 | Perfil de aplicação | `profiles` **adiado para a SPEC-002**; a SPEC-001 **não** usa trigger de provisionamento em `auth.users` nem RPC `ensure_my_profile`; quando existir, o perfil nasce por comando idempotente na primeira sessão autenticada (Opção B) | ADR-005 A1, DATA-MODEL §3.1, DOMAIN-MAP §3.1, RLS matrix | **DECIDED** |
| D-53 | Sessão | Armazenamento seguro do runtime obrigatório; **criptografia própria proibida** sem requisito demonstrado; storage seguro indisponível → sessão não persistente (fail-safe); expiração = configuração do Supabase | SPEC-001 §10 | **DECIDED** |
| D-54 | Account linking | **Provider-managed verified identity linking** (Supabase Auth, mesmo email verificado) aceito; **application heuristic account merging** proibido; nenhuma inferência sobre Apple Private Relay | SPEC-001 §7/§12 | **DECIDED** |
| D-55 | Exclusão de conta | Registro mínimo do pedido (`account_deletion_requests`: `user_id`, `requested_at`) por acesso direto com grants mínimos + RLS + PK; **sem RPC wrapper**; exclusão efetiva de `auth.users` permanece privilegiada/server-owned. **Pendente (humano):** exclusão imediata vs grace period e, com ela, o comportamento da sessão após o pedido | SPEC-001 §8/§18; DATA-MODEL §3.15 | **DECIDED (política de purga OPEN)** |

## B4. DECIDED — decisões de produto da SPEC-002 Hair Profile & Onboarding (2026-08-27)

| ID | Decisão | Conteúdo decidido | Efeito | Status |
|---|---|---|---|---|
| D-62 | Inputs mínimos do perfil capilar (MVP) | **8 inputs de produto aprovados** (não são diagnóstico médico/dermatológico): `hair_pattern`, `strand_thickness`, `scalp_tendency`, `wash_frequency`, `chemical_treatments` (multi), `heat_usage`, `current_concerns` (multi), `primary_goal`. Valores/UX em SPEC-002 §6. **Sem 2A–4C**, sem densidade. Não adicionar dimensões sem requisito concreto. Regras de diagnóstico continuam fora (D-26). | SPEC-002 §6; DATA-MODEL §3.3 (atualizar na implementação) | **DECIDED** |
| D-63 | `profiles` na SPEC-002 | **REMOVE.** `profiles`, `ProfilePort`, `onboarding_status`, provisioning e trigger em `auth.users` **não** são implementados agora. Ownership direto `auth.users → hair_profiles.user_id`; "onboarding concluído" é derivado da existência de um hair profile válido. `profiles` nasce numa SPEC futura com requisito concreto. Confirma a necessity review; um DEFER anterior (D-52) não obriga a implementar. | SPEC-002 §12; DATA-MODEL §3.1 (atualizar na implementação) | **DECIDED** |
| D-64 | Versionamento de `hair_profiles` (amenda D-11) | **"Versioned profile" = snapshots históricos imutáveis identificados por `id` estável, não necessariamente por número sequencial.** REMOVE `version int`, trigger de alocação, `MAX+1`, `UNIQUE(user_id,version)` e a lógica de concorrência criada só para numerar. Cada avaliação = nova linha imutável; atual = mais recente (`created_at desc, id desc`); downstream referencia `hair_profile_id`. Verificado: nenhum requisito atual depende de ordinal sequencial. | **Amenda D-11**; SPEC-002 §8/§9; DATA-MODEL §3.3 + DOMAIN-MAP §3.2 (atualizar na implementação) | **DECIDED** |
| D-65 | SPEC-002 | **APPROVED** (v0.4) após revisão humana. Clarificações vinculantes: `chemical_treatments` `[]` = nenhuma (sem enum `none`); `current_concerns.no_major_concern` exclusivo (`cardinality=1`) por validação de cliente + CHECK server-side (sem RPC/trigger); **analytics DEFER** (nenhum evento/no-op na SPEC-002 — SPEC-011). Implementação autorizada (LEVEL 2). | SPEC-002 → Approved; índice | **DECIDED** |

## C. DEFERRED / OPEN (não decidir agora)

### C1. Decisões de implementação da SPEC-001 (não reabrem a SPEC)
| ID | Decisão | Classe | Recomendação provisória | Quando |
|---|---|---|---|---|
| D-56 | Integração Apple/Google: SDK nativo vs OAuth por browser | **DECIDED (implementação SPEC-001, 2026-08-27)** | **OAuth por browser com PKCE** (`signInWithOAuth` + `expo-web-browser` `openAuthSessionAsync` + `exchangeCodeForSession`) para **ambos** os provedores: um único mecanismo, sem SDK nativo, sem dev build, sem rota de deep link (o browser devolve a URL de callback à função). Redirect `haircare://auth/callback` (+ `exp://` só em dev) allowlistado. Reavaliar SDK nativo só se a UX do browser se provar um problema medido | `apps/mobile/src/infrastructure/supabase/auth-adapter.ts` |
| D-57 | Provedor SMTP para OTP | IMPORTANT BEFORE RELEVANT IMPLEMENTATION (staging/prod) | inbox de teste local até lá | antes de OTP em staging |
| D-58 | Credenciais Apple Developer / Google Cloud, keystores, dev builds | IMPORTANT BEFORE RELEVANT IMPLEMENTATION | — | antes dos testes reais dos provedores |
| D-59 | Implementação concreta do storage seguro | **DECIDED (implementação SPEC-001, 2026-08-27)** | **`expo-secure-store`** como storage adapter do supabase-js; valores divididos em chunks de 1800 bytes (limite ~2 KB por chave; chunking não é criptografia — o keychain/keystore cifra); indisponível → sessão só em memória (nunca storage inseguro); reinstalação detectada por marcador em `expo-file-system` (`Paths.document`) → sessão residual descartada | `secure-session-storage.ts`, `fresh-install.ts` |
| D-60 | Política de exclusão: imediata vs grace period (+ sessão pós-pedido) | HUMAN DECISION — IMPORTANT BEFORE RELEVANT IMPLEMENTATION | não fixar; tabela registra só `requested_at` | antes do job de purga / release |
| D-61 | Caminho externo/web para solicitar exclusão (Google Play) | RELEASE REQUIREMENT | SPEC-013 | antes do release Android |

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
| 2026-08-26 | v0.3: revisão da SPEC-000 (D-41…D-49); implementação concluída (D-33, D-40 resolvidos); close-out com CI verde; D-50 AC12 deferred. |
| 2026-08-26 | v0.4: SPEC-001 aprovada (D-51…D-55); decisões de implementação rastreadas (D-56…D-61). Implementação de autenticação **não** iniciada. |
| 2026-08-27 | v0.5: SPEC-001 implementada e mergeada em `main` (PR #3) via LEVEL 2 auto-merge; required CI verde (`ci`, `core-deno`, `supabase-test`; pgTAP 13/13). D-56 e D-59 decididos na implementação. Proteção da `main` no GitHub habilitada (required checks + PR + strict + enforce_admins; force-push/deleção bloqueados). |
| 2026-08-27 | v0.6: correção de governança CI (PR #5, merged) — `core-deno`/`supabase-test` rodam em todo PR (required checks satisfazíveis). Decisões de produto da SPEC-002 (D-62/D-63/D-64); D-64 amenda D-11 (snapshots por `id`, sem numeração sequencial). SPEC-002 → Draft Ready for Approval (HUMAN GATE). |
| 2026-08-27 | v0.7: **SPEC-002 APPROVED** (D-65) com clarificações (`chemical_treatments` `[]`=nenhuma; `no_major_concern` exclusivo; analytics DEFER). Implementação autorizada (LEVEL 2). |
| 2026-08-27 | v0.8: **SPEC-002 implementada e mergeada** em `main` (PR #6) via LEVEL 2; required CI verde (pgTAP 020 18/18). `hair_profiles` imutável por `id` (D-64), sem `profiles` (D-63), 8 inputs (D-62). Pendente doc-sync de DATA-MODEL/DOMAIN-MAP. |
