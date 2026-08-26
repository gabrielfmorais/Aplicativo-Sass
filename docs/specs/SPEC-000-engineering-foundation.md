# SPEC-000 — Engineering Foundation

| Campo | Valor |
|---|---|
| ID | SPEC-000 |
| Status | **In Progress** (Approved for implementation em 2026-08-26 — D-41; escopo: somente Engineering Foundation) |
| Owner | Engenharia (humano: @gabrielfmorais — confirmado, D-45) |
| Bounded Context | Nenhum (transversal: repositório, tooling, CI, governança) |
| Related ADRs | ADR-001, ADR-002, ADR-003, ADR-004, ADR-007 (A1), ADR-008, ADR-009, ADR-010 |
| Related SPECs | Todas as posteriores dependem desta |
| Fase do roadmap | 0 — Foundation |
| Criado / Atualizado | 2026-08-26 / 2026-08-26 |

## 1. Context
A arquitetura foi aprovada (DECISION-REGISTER v0.2) e é, até agora, inteiramente documental. O projeto será desenvolvido majoritariamente por agentes de IA; regras que existem apenas em documentos serão eventualmente violadas. Esta SPEC transforma a arquitetura em **guardrails executáveis** (lint, typecheck, testes, CI, verificações de segurança, skills) num repositório **sem nenhuma feature de produto**.

## 2. Problem
Sem fundação executável: (a) fronteiras de camada são só convenção; (b) segredos podem ser commitados sem detecção; (c) não há como testar RLS antes de existir schema; (d) a hipótese central de compartilhar `packages/core` entre Hermes, Node e Deno não foi validada; (e) um agente novo não tem workflow verificável.

## 3. Goals
- G1 Repositório clonável com `pnpm install && pnpm lint && pnpm typecheck && pnpm test` verdes.
- G2 Regra de dependência (ADR-001) verificada automaticamente: violação falha lint/CI.
- G3 `packages/core` provado compatível com Expo/Hermes, Node (Vitest) e Deno (Edge Functions), com CI que detecta regressão.
- G4 Supabase local scaffolding com estrutura de migrations, seed, testes pgTAP e verificações de segurança automatizadas — **sem schema de produto**.
- G5 CI de PR: install, lint, typecheck, unit tests, build validation (typecheck do app + `expo export` dry), secret scanning, dependency audit.
- G6 Governança de agentes operacional: 5 skills com guardrails; `CLAUDE.md` apontando corretamente; PR template e CODEOWNERS ativos.
- G7 Primitivas transversais do core prontas e testadas: erros tipados, `Result`, `LocalDate/Instant/Clock`, catálogo de eventos vazio + port, schema de regra de domínio (D-26).
- G8 Um agente novo entende o workflow apenas lendo o repositório.

## 4. Non-Goals
- NG1 Autenticação funcional, login/signup, onboarding, Hair Profile, diagnóstico, cronograma, calendário, notificações, conteúdo, subscription, analytics provider, admin, qualquer UI ou design system visual.
- NG2 Supabase remoto (staging/produção), migrations de domínio, tabelas de produto, deploy, App Store / Play Store, EAS Build.
- NG3 Regras capilares (`DiagnosticRulesV1`, `ScheduleRulesV1`) — apenas o **schema** de regra é criado (D-26).
- NG4 Regras remotas do GitHub (branch protection, required checks) — propostas, aplicadas só com autorização.
- NG5 Instalar MCPs ou alterar configuração de MCP.
- NG6 Offline/cache, TanStack Query, estado global — pertencem à SPEC-001+.

## 5. User Stories
- US1 Como engenheira, quero clonar o repo e ter lint/typecheck/test verdes em minutos.
- US2 Como agente de IA, quero que uma importação proibida falhe imediatamente, para não vazar regra de negócio para a UI.
- US3 Como revisora, quero que CI bloqueie segredos e dependências vulneráveis antes de eu ler o diff.
- US4 Como arquiteta, quero prova de que o core roda em Deno antes de escrever a Edge Function `generate-plan`.
- US5 Como agente, quero skills que me guiem a criar/revisar SPECs, migrations e RLS sem improvisar.

## 6. Functional Requirements
- FR1 `pnpm-workspace.yaml` com `apps/*` e `packages/*`; pnpm ≥ 9 com lockfile; Node LTS fixado (`.nvmrc`/`engines`).
- FR2 `packages/core` com `package.json` (`"sideEffects": false`, `"type": "module"`, exports `./src/index.ts`), `tsconfig` sem `DOM`/`node` types, deps apenas `zod`, `date-fns`, `date-fns-tz` (D-33 proposta).
- FR3 `apps/mobile` criado com `create-expo-app` (template blank TypeScript) + `expo-router`; **uma única rota** placeholder `src/app/index.tsx` exibindo "Foundation OK" (não é tela de produto); `metro.config.js` com `watchFolders` para o workspace; alias `@app/core`.
- FR4 TypeScript strict em todos os pacotes (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`); `tsconfig.base.json` na raiz; project references.
- FR5 ESLint flat config na raiz com `typescript-eslint`, `eslint-plugin-import`, regras `no-restricted-imports` por diretório (ver §7) e `no-restricted-syntax` para `new Date()`/`Date.now()` fora de `core/shared/time/system-clock.ts` e `apps/mobile/src/infrastructure/clock/`.
- FR6 `dependency-cruiser` com regras equivalentes (defesa em profundidade) + `pnpm dep-cruise` em CI.
- FR7 Prettier + `.editorconfig`; `pnpm format:check` em CI.
- FR8 Vitest em `packages/core` (com coverage); Jest (`jest-expo`) + RNTL em `apps/mobile` com 1 teste smoke da rota placeholder.
- FR9 `packages/core/src/shared`: `errors.ts` (`DomainError`, `ValidationError`, `AuthorizationError`, `NotFoundError`, `ConflictError`, `InfrastructureError`), `result.ts`, `time/` (`LocalDate`, `Instant`, `Clock` port, `SystemClock`, `toLocalDate`, `addDays`, `diffDays`), `ids.ts` (`newId()` via `globalThis.crypto.randomUUID`), `domain-rule.ts` (schema zod de regra: `rule_id, version, description, inputs, output, rationale_source, validation_status`), `analytics/` (`AnalyticsEvent` união vazia/placeholder + `AnalyticsPort` + `NoopAnalytics`). Diretórios de contexto (`identity/`, `hair-profile/`, `diagnostic/`, `schedule/`, `care-tracking/`, `progress/`, `notifications/`, `content/`, `subscription/`) contendo apenas `README.md` + `index.ts` vazio.
- FR10 Supabase local: `supabase init` → `config.toml` (auth: email OTP habilitado, senha desabilitada conforme ADR-005 — apenas configuração local), `migrations/` com **uma** migration `0000_foundation.sql` contendo **somente** helpers técnicos (`extension pgcrypto/pgtap`, função `set_updated_at()`), `seed/` vazio com README, `tests/` com harness pgTAP (`00_harness.sql` helpers: `test_user(uuid)`, `as_user(uuid)`, `as_anon()`), `security/definer-allowlist.txt` e `grants-allowlist.txt` vazios, `functions/_shared/` e `functions/health/` (função trivial usada pelo spike), `ops/README.md`.
- FR11 Scripts SQL de verificação (`supabase/tests/security/`): (a) toda tabela em `public` tem RLS + FORCE; (b) funções `SECURITY DEFINER` ⊆ allowlist; (c) grants de `anon`/`authenticated` ⊆ allowlist. Rodam em `supabase test db`.
- FR12 GitHub Actions (ver §18); ações pinadas por SHA; `concurrency` por PR; cache pnpm.
- FR13 `.claude/skills/{spec-create,spec-review,rls-review,migration-review,pre-commit-review}/SKILL.md` conforme SKILLS-PLAN com seções: Responsabilidade, Inputs, Outputs, Passos, Guardrails, Limites.
- FR14 Runbooks iniciais em `docs/runbooks/`: `secret-rotation.md`, `mcp-usage-log.md`, `migration-prod.md`, `incident.md` (os demais quando houver contexto).
- FR15 `README.md` raiz reescrito: propósito, links para docs, comandos, workflow em 10 linhas.
- FR16 Spike de compatibilidade executado e documentado (`docs/architecture/CORE-RUNTIME-SPIKE.md`) com resultado e decisão D-40.

## 7. Business Rules (regras de fronteira — mecanizadas)
- BR1 `packages/core/**` não importa `react`, `react-native`, `expo*`, `@supabase/*`, `node:*`, `fs`, `path`, `crypto`, `process`, `Buffer`.
- BR2 `apps/mobile/src/features/**` e `src/app/**` não importam `@supabase/*` nem `@app/core/**/domain/**` (só `index.ts` público de cada contexto).
- BR3 `apps/mobile/src/infrastructure/**` não importa `features` nem `app`.
- BR4 `packages/core/src/<ctx>/domain/**` não importa `application/**` nem outro contexto (exceto `shared/`).
- BR5 `new Date()`/`Date.now()` proibidos fora dos adapters de clock.
- BR6 Tabela em `public` sem RLS+FORCE ⇒ teste falha. Função DEFINER fora da allowlist ⇒ falha. Grant fora da allowlist ⇒ falha.
- BR7 Toda regra de domínio é validada pelo schema `DomainRule` e engines de produção só aceitam `validation_status = 'validated'` (mecanismo criado agora; regras não).

## 8. Data Model Impact
**Nenhuma tabela de produto.** Migration `0000_foundation.sql`: extensões (`pgcrypto`, `pgtap` apenas em local/test), função `public.set_updated_at()`. `is_admin()`/`has_entitlement()` **não** são criadas nesta SPEC (dependem de `admin_users`/`subscriptions`; ficam nas SPECs 001/010) — corrige a menção no roadmap. Atualizar DATA-MODEL §1 apenas com a referência ao trigger helper.

## 9. API / Contracts
- Nenhum endpoint de produto. Edge Function `health` (retorna `{ ok: true, coreVersion }` importando `@app/core`) existe **apenas** para o spike e testes de CI; sem service role; `verify_jwt = false` documentado como exceção porque não acessa dados.
- Contratos internos criados: `DomainRule` (zod), `Result<T,E>`, `AnalyticsEvent` (vazio), `Clock`.

## 10. Authorization
Não aplicável a dados (não há tabelas de usuária). Autorização de **processo**: CODEOWNERS em `supabase/**`, `packages/core/src/**/domain/**`, `.github/**`, `CLAUDE.md`, `docs/adr/**`, `docs/security/**`. Branch protection proposta (NG4: aplicar só com autorização): PR obrigatório, 1 review de code owner, status checks `ci`, `supabase-test`, sem force push, linear history.

## 11. Security Considerations
- Segredos: `.gitignore` já cobre; gitleaks em CI (`gitleaks/gitleaks-action` pinada) + `.gitleaks.toml` com allowlist do `.env.example`; opcional pre-commit local via `lefthook` (decidir em §23).
- Dependências: `pnpm audit --audit-level=high` em CI; `pnpm` com `ignore-scripts=true` em `.npmrc` (bloqueia postinstall de terceiros; exceções explícitas para pacotes Expo que exigem).
- Verificações RLS/DEFINER/grants (FR11) rodam desde já, mesmo sem tabelas — garantem que a **primeira** tabela de produto nasça protegida.
- `config.toml` local nunca contém segredos reais; chaves locais do Supabase são públicas de desenvolvimento.
- Edge `health` sem acesso a dados; removível.
- Ameaças cobertas: T03 (RLS off), T06 (segredos), T14 (supply chain), T15 (agente errante — lint/CI/skills).
- Checklist §13 do SECURITY-BASELINE: sem tabelas novas ✔; sem DEFINER ✔; inputs: nenhum ✔; PII: nenhuma ✔; rollback: remover diretórios ✔.

## 12. Privacy Considerations
Nenhum dado pessoal é criado ou processado. Placeholder da rota não coleta nada. Nenhum SDK de analytics/crash é instalado.

## 13. Analytics Events
Nenhum evento emitido. Cria-se o catálogo vazio tipado e o port `AnalyticsPort` com implementação `NoopAnalytics`.

## 14. UX Notes
Não há UX de produto. Rota placeholder exibe texto "Foundation OK" e versão do core — serve para smoke test e para validar alias/Metro; será substituída na SPEC-001.

## 15. Edge Cases
- EC1 Metro não resolve workspace symlinks → `watchFolders` + `nodeModulesPaths`; validado pelo smoke `expo export`.
- EC2 Hermes sem `crypto.randomUUID` em versões antigas → Expo SDK atual expõe via `expo-crypto` polyfill global; spike verifica; fallback: `newId()` recebe gerador injetado.
- EC3 Deno não resolve `node_modules` do workspace → ver §20 (spike) e fallback ESM prebuilt.
- EC4 `date-fns-tz` em Hermes depende de `Intl` — Hermes suporta `Intl.DateTimeFormat` com timezones desde RN 0.70+; spike inclui teste de `toLocalDate` em device/simulador.
- EC5 pgTAP indisponível no projeto remoto → só usado em local/CI; migration condiciona `create extension if not exists pgtap` a ambiente de teste (via `supabase/tests`, não em `migrations`).
- EC6 Windows (ambiente atual): scripts em `package.json` cross-platform (sem bash-isms); Supabase CLI requer Docker Desktop.

## 16. Failure Modes
- Lint boundary falha → CI vermelho com regra nomeada; agente deve mover código, não relaxar regra (CLAUDE.md §4).
- gitleaks falha → PR bloqueado; runbook `secret-rotation.md` se o segredo for real.
- Spike falha na opção A → adotar B (documentado, sem nova ADR); se B também falhar → **parar e escalar** (impacta ADR-007).
- `supabase start` indisponível em CI → job `supabase-test` marcado como required apenas após estabilizar (1 semana de execução).

## 17. Acceptance Criteria
- AC1 Dado clone limpo em Node LTS + pnpm, quando `pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm dep-cruise`, então tudo passa.
- AC2 Dado arquivo em `packages/core` importando `react` (ou `@supabase/supabase-js`, ou `node:fs`), quando `pnpm lint`, então falha com regra identificada; idem `dep-cruise`.
- AC3 Dado arquivo em `apps/mobile/src/features/x.ts` importando `@supabase/supabase-js`, quando lint, então falha.
- AC4 Dado `new Date()` em `packages/core/src/schedule/x.ts`, quando lint, então falha; em `system-clock.ts`, passa.
- AC5 Dado commit contendo string no formato de service role JWT ou `sk_live_...`, quando CI, então gitleaks falha.
- AC6 Dado `pnpm audit` com vulnerabilidade high, quando CI, então falha.
- AC7 Dado `supabase start && supabase db reset && supabase test db`, então harness e verificações de segurança passam (com 0 tabelas) e, ao adicionar uma tabela de teste sem RLS num teste negativo, a verificação falha.
- AC8 Dado `deno check`/`deno test` sobre `packages/core` (ou bundle), então passa; e a Edge `health` servida localmente responde com `coreVersion` vindo do core.
- AC9 Dado `expo export` (ou `expo start` + smoke Jest), então o app compila e a rota placeholder renderiza o valor de `LocalDate` calculado pelo core.
- AC10 Dado `CLAUDE.md`, todos os caminhos citados existem (script `pnpm check:docs-links`).
- AC11 Dado cada skill, ela declara guardrails e nenhuma executa migration/deploy/instalação/push.
- AC12 Dado um agente sem histórico de chat, lendo `README.md` → `CLAUDE.md` → `docs/README.md`, consegue localizar SPEC, ADR, Decision Register e comandos (validado por revisão humana com uma sessão nova de Claude Code em modo read-only).
- AC13 Nenhum arquivo em `apps/mobile/src/features` além de placeholder; nenhuma tabela em `public` além de nenhuma; nenhuma dependência fora da lista de §19.

## 18. Testing Strategy
- Unit (Vitest, core): `time/` (virada de dia, tz negativa/positiva, DST histórico `America/Sao_Paulo` 2018, viagem), `errors`, `result`, `domain-rule` schema (rejeita status inválido), `ids`.
- Lint/arch tests: fixtures negativos em `tooling/boundary-fixtures/` executados por script que espera falha (AC2–AC4).
- Component (Jest+RNTL): rota placeholder renderiza.
- Integration (Supabase local): harness pgTAP + verificações de segurança + teste negativo de RLS (tabela temporária sem RLS ⇒ falha esperada).
- Deno: `deno check` + `deno test` do core (ou do bundle) + `supabase functions serve health` com `curl`.
- CI workflows (proposta):
  | Workflow | Gatilho | Jobs |
  |---|---|---|
  | `ci.yml` | PR, push `main` | install (frozen lockfile) → format:check → lint → typecheck → dep-cruise → test (core + mobile) → build validation (`expo export --platform ios,android` sem EAS) → `pnpm audit` → gitleaks → check:docs-links |
  | `core-deno.yml` | PR tocando `packages/core` ou `supabase/functions` | `denoland/setup-deno` → `deno check`/`deno test` → `supabase functions serve health` smoke |
  | `supabase-test.yml` | PR tocando `supabase/**` ou `packages/core/**` | `supabase/setup-cli` → `supabase start` → `db reset` → `test db` |
  | Deploy staging/prod | **não criados nesta SPEC** (NG2) — propostos no ENGINEERING-WORKFLOW |

## 19. Dependencies
**Nenhuma instalada até aprovação.** Proposta (todas maduras, MIT/Apache/BSD; verificação de supply chain na PR de implementação):

| Pacote | Onde | Tipo | Motivo |
|---|---|---|---|
| `typescript` ^5.x | raiz | dev | |
| `eslint` ^9 (flat), `typescript-eslint`, `eslint-plugin-import`, `eslint-config-prettier` | raiz | dev | FR5 |
| `prettier` | raiz | dev | FR7 |
| `dependency-cruiser` | raiz | dev | FR6 |
| `vitest`, `@vitest/coverage-v8` | core | dev | FR8 |
| `zod` ^3 | core | **runtime** | contratos |
| `date-fns` ^3/4, `date-fns-tz` | core | **runtime** | ADR-008 (D-33 — alternativa `@js-temporal/polyfill` rejeitada por tamanho ~200 KB) |
| `expo` (SDK atual estável), `react`, `react-native`, `expo-router`, `expo-constants`, `expo-linking`, `expo-status-bar`, `react-native-safe-area-context`, `react-native-screens` | mobile | runtime | base do `create-expo-app` + router |
| `jest`, `jest-expo`, `@testing-library/react-native` | mobile | dev | FR8 |
| `deno` (CLI, via setup action) e `supabase` CLI (via `supabase/setup-cli` e `npx supabase`) | CI/dev | tool | FR10, spike |
| `esbuild` | raiz | dev | **só se** fallback B do spike for adotado |
| `lefthook` | raiz | dev | opcional (OQ2) |

Explicitamente **não** propostos agora: `@supabase/supabase-js` (SPEC-001), `@tanstack/react-query`, `zustand`, `expo-secure-store`, `expo-notifications`, analytics/crash SDKs, `expo-dev-client`, EAS.

## 20. Implementation Plan (PRs pequenas, em ordem)
| # | Branch | Conteúdo | AC |
|---|---|---|---|
| 0 | `docs/foundation-approval` | Commit deste pacote documental (docs + CLAUDE.md + .github + .env.example + .gitignore). Sem código | AC10 |
| 1 | `chore/workspace-tooling` | pnpm workspace, `.npmrc`, `.nvmrc`, tsconfig base, ESLint/Prettier/dep-cruiser, scripts raiz, `packages/core` vazio com `shared/` + testes | AC1, AC2, AC4 |
| 2 | `chore/boundary-fixtures` | Fixtures negativos + script que prova que lint/dep-cruise falham | AC2–AC4 |
| 3 | `chore/core-runtime-spike` | Spike Deno (§7 do FOUNDATION-REVIEW): tentar A (import map → workspace); documentar; se falhar, B (esbuild bundle). Escrever `CORE-RUNTIME-SPIKE.md`; registrar D-40 | AC8 |
| 4 | `chore/expo-skeleton` | `create-expo-app` em `apps/mobile`, expo-router, metro workspace config, alias, rota placeholder consumindo `@app/core`, Jest smoke | AC9 |
| 5 | `chore/supabase-local` | `supabase init`, `config.toml` (local), migration `0000_foundation`, harness pgTAP, verificações de segurança, teste negativo, Edge `health` | AC7 |
| 6 | `chore/ci` | Workflows `ci.yml`, `core-deno.yml`, `supabase-test.yml`; gitleaks config; `check:docs-links` | AC1, AC5, AC6 |
| 7 | `chore/agent-skills` | 5 skills + runbooks iniciais + README raiz | AC11, AC12 |
| 8 | `docs/foundation-done` | Atualizar DATA-MODEL §1, ROADMAP (helpers movidos), SPEC-000 → Implemented; revisão humana AC12 | — |

Cada PR: template preenchido, CI verde, revisão humana. Nenhuma PR toca produção. Estimativa: 4–6 dias úteis.

## 21. Migration Plan
Única migration técnica `0000_foundation.sql` (aditiva, idempotente com `if not exists`). Aplicada **apenas** em local (`supabase db reset`). Nenhum push remoto nesta SPEC.

## 22. Rollback Plan
Tudo é aditivo e sem estado: reverter PRs. Migration local: `supabase db reset` para estado anterior. Nenhum dado, ambiente remoto ou loja é afetado.

## 23. Open Questions
- OQ1 (**IMPORTANT**) Node LTS alvo: 20 ou 22? Assunção: **22 LTS** (compatível com Expo SDK atual e Vitest). Registrar em `.nvmrc`.
- OQ2 (CAN DEFER) Pre-commit local (`lefthook` com lint-staged + gitleaks)? Assunção: **não** no MVP; CI basta; evita fricção e postinstall.
- OQ3 (**IMPORTANT**) Versão do Expo SDK: usar a estável mais recente no momento da PR 4 (não fixar agora). Assunção: sim, registrar a versão na PR e no `CORE-RUNTIME-SPIKE.md`.
- OQ4 (CAN DEFER) Aplicar branch protection no GitHub agora (exige autorização — NG4)? Assunção: proposta na PR 6; aplicação manual pelo humano.
- OQ5 (CAN DEFER) `config.toml` local já desabilitar login por senha (ADR-005 ainda Proposed)? Assunção: deixar padrão do CLI nesta SPEC; SPEC-001 configura auth.
- OQ6 (**IMPORTANT**) Confirmar handle de CODEOWNERS (`@gabrielfmorais`) e se haverá um segundo revisor humano.

## 24. Change Log
| Data | Mudança | Autor |
|---|---|---|
| 2026-08-26 | Draft inicial após aprovação da arquitetura | Claude (agente) |
