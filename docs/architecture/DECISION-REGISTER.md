# DECISION REGISTER

| Campo | Valor |
|---|---|
| Status | v0.17 — 2026-08-28 — SPEC-000/001/002/004/**005/006/007** implementadas/merged; SPEC-003 folded (D-66); D-70/D-71/D-72 **ratificadas por decisão humana** (D-70 com correção: o gate depende do conteúdo, não do autor). Regras capilares V1 continuam `candidate` (D-67): **PUBLIC RELEASE bloqueado** até o domain sign-off (`candidate → validated`, D-26/OQ-REL). LEVEL 2 ativo; **§0.2 Master Autonomous Engineering Mode** ativo |
| Uso | Fonte de verdade sobre o estado de cada decisão. Nenhum item muda de status sem registro nesta tabela. Agentes nunca resolvem itens `HUMAN DECISION` por conta própria; sob `CLAUDE.md` §0.2 podem decidir o que é **pequeno, reversível e de baixo risco**, registrando o item como `DECIDED (agente, §0.2)` para ratificação humana (bloco B6). Ratificado vira `RATIFIED (humano, data)`. |

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
| D-66 | SPEC-003 / fronteira Diagnostic×Schedule | **FOLD**: a entrega MVP do Assessment/Diagnostic Engine acontece na **SPEC-004** (vertical slice), não numa SPEC-003 isolada (único consumidor do resultado é o Schedule; taxonomia só definível junto ao Schedule; SPEC-003 isolada seria pacote-esqueleto). **Fronteira de domínio preservada** (módulos `diagnostic/`+`schedule/`). `diagnostic_results` **não** pré-aprovada (necessity review na SPEC-004). Falsa precisão (`confidence`/score) proibida; `evidence`/reason codes no core, copy na UI. | **ADR-007 Amendment A2**; SPEC-003 → Folded; SPEC-004 index | **DECIDED** |
| D-67 | SPEC-004 regras de domínio V1 | **CANDIDATE rules** aprovadas (heurísticas de produto cosméticas, não diagnóstico): care types H/N/R; `AssessmentOutput={emphasis,includeReconstruction,evidenceCodes}` (sem levels/score/confidence); emphasis por `primary_goal`→`current_concerns`→`hair_pattern`; reconstruction 2-de-3 (CHEMICAL/HIGH_HEAT/DAMAGE); sessions/week por `wash_frequency`; janela 28d; ciclos H/N/R; 1 R após dia 14; offsets determinísticos; unknown never escalates. **Esclarece D-26:** `candidate` PODE ser implementada/testada em dev/internal beta; **PUBLIC RELEASE** exige `validated` (domain sign-off) — requisito de release **não** enfraquecido. | **ADR-007 A1** (add `candidate`); `docs/domain-rules/SPEC-004-domain-rules-worksheet.md`; SPEC-004 §13 | **DECIDED (candidate)** |
| D-68 | SPEC-004 | **APPROVED** (v0.5) por aprovação humana. Escopo confirmado: Assessment + Schedule na mesma vertical slice com módulos internos separados; regras V1 `candidate` autorizadas para implementação/internal beta; **D-26 permanece PUBLIC RELEASE GATE**; care types `hydration`/`nutrition`/`reconstruction`; `AssessmentOutput` V1; emphasis rules; reconstruction rule; cadência; janela de 28 dias; política `unknown`/`varies`; evidence codes mínimos; modelo técnico v0.3/v0.4 fechado. Implementação autorizada (LEVEL 2). | SPEC-004 → Approved; índice de SPECs | **DECIDED** |

## B5. DECIDED — decisões de produto da SPEC-005 Care Tracking (2026-08-27)

| ID | Decisão | Conteúdo decidido | Efeito | Status |
|---|---|---|---|---|
| D-12 | Desfazer execução | **SIM.** A usuária pode anular uma execução registrada por engano dentro de **15 minutos** da criação. A execução anulada **permanece** no histórico (`voided_at`), nunca é apagada; o cuidado volta ao estado derivado de não concluído (desde que não tenha sido pulado/reagendado) e pode ser registrado de novo. **Fora do escopo:** edição arbitrária de histórico, correção de execução de dias anteriores, undo ilimitado, fluxo administrativo. | SPEC-005 §7 BR4b/BR4c, §9 `void_execution`, AC16/AC17 | **DECIDED** |
| D-35 | Múltiplas execuções por `scheduled_care` | **NÃO.** Invariante de produto: um `ScheduledCare` → **0 ou 1** `CareExecution` **efetiva**. Uma execução anulada por D-12 não conta, portanto após desfazer é possível registrar de novo. Garantido **no banco** (índice único parcial `WHERE voided_at IS NULL`), não só na UI. Sem suporte a duas execuções válidas nem a repetição do mesmo cuidado como feature; execução avulsa continua DEFER. | SPEC-005 §8.3, AC18 | **DECIDED** |
| D-69 | SPEC-005 | **APPROVED** (v0.2). Escopo confirmado: Hoje/atrasado/próximos/histórico + concluir, pular, reagendar e desfazer (15 min). `status='completed'` **não** persistido — conclusão derivada da existência de execução efetiva (evita duas fontes de verdade). Reusa integralmente D-28 e as regras já aprovadas de reagendar/pular/overdue. Implementação autorizada (LEVEL 2). | SPEC-005 → Approved; índice de SPECs | **DECIDED** |

## B6. DECIDED — SPEC-007 Content v1 (2026-08-28)

> **Origem:** decisões tomadas pelo **agente** sob `CLAUDE.md` §0.2 (Master Autonomous Engineering Mode), aplicando um precedente humano já existente (D-67). **Todas as três foram RATIFICADAS por decisão humana em 2026-08-28**, D-70 com uma correção (o gate depende do conteúdo, não do autor). Não reabrir.

| ID | Decisão | Conteúdo decidido | Efeito | Status |
|---|---|---|---|---|
| D-70 | Autoria do conteúdo capilar V1 (SPEC-007 OQ-1) | **Aplica-se o precedente D-67 ao texto.** A engenharia redige os guias V1 com `validationStatus: 'candidate'` e `rationaleSource` declarando "hipótese de engenharia — requer revisão especializada". Liberados para **dev/internal beta**; entram em **OQ-REL**, o mesmo sign-off de domínio que já bloqueia o PUBLIC RELEASE das regras V1. **Nenhum gate novo; o gate de PUBLIC RELEASE permanece inalterado** (D-26 / ADR-007 A1). O conteúdo é **procedimental e cosmético**: sem marca, sem produto comercial, sem dosagem química, sem promessa de resultado e sem linguagem de diagnóstico dermatológico — o tempo de pausa remete sempre à embalagem do produto da usuária, nunca a um número inventado pela engenharia. Reversível: é texto num único arquivo. **RATIFICADA por decisão humana (2026-08-28) com uma correção:** o gate depende do **conteúdo**, não de quem escreveu. (A) Copy puramente editorial/UX, sem nova orientação capilar, segue o processo editorial normal. (B) Texto com **orientação ou regra capilar substantiva** continua sujeito a D-26 e ao sign-off do revisor de domínio **mesmo quando fornecido pelo owner humano** — nenhuma origem de texto torna conteúdo `validated` automaticamente, e **OQ-REL não é enfraquecida**. | SPEC-007 §7 BR2/**BR2b**/BR3, §17 AC3/AC4; `packages/core/src/content/v1/guides.ts` | **RATIFIED (humano, 2026-08-28)** |
| D-71 | Armazenamento do conteúdo V1 (SPEC-007 OQ-2) | **Sem tabelas `care_types`/`content_articles` nesta fatia** (necessity review D-47/D-48; precedente direto: `diagnostic_results` removido na SPEC-004). O conteúdo vive no bundle (`packages/core/src/content/`): disponível offline, sem loading/erro/retry, sem policy ou grant novos. **Gatilho nomeado para criar as tabelas** — o primeiro que ocorrer: (1) conteúdo precisar mudar sem release do app; (2) gating premium entrar em escopo (SPEC-010); (3) existir editor/admin de conteúdo; (4) segundo idioma. A migração é aditiva: `CareGuide` já é o formato de leitura. **RATIFICADA por decisão humana (2026-08-28)**: para a V1, manter o conteúdo no bundle; não criar tabela, CMS, conteúdo remoto nem infraestrutura de publicação dinâmica agora. | SPEC-007 §8.2; DATA-MODEL §3.9/§3.10 (nota de adiamento) | **RATIFIED (humano, 2026-08-28)** |
| D-72 | SPEC-007 | **APPROVED** (v0.2) sob §0.2, uma vez que D-70 e D-71 removem a única questão BLOCKING. Escopo: guias "como fazer" por care type na tela Hoje. Sem tabela, sem RPC, sem migration, sem dependência, sem analytics. Implementação autorizada (LEVEL 2). **RATIFICADA por decisão humana (2026-08-28)**, junto com a autorização de auto-merge das PRs da SPEC-007. | SPEC-007 → Approved; índice de SPECs | **RATIFIED (humano, 2026-08-28)** |

## B7. DECIDED — SPEC-006 Check-ins (2026-08-28)

> Decisão do agente sob `CLAUDE.md` §0.2, registrada para ratificação humana. Nenhuma regra capilar nova: perguntar "como ficou?" e guardar a resposta não afirma nada sobre cabelo, então **D-26 não é acionada**.

| ID | Decisão | Conteúdo decidido | Efeito | Status |
|---|---|---|---|---|
| D-73 | SPEC-006 | **APPROVED** (v0.1). Escopo: **uma** pergunta ("Como ficou?", escala 1..5 já aprovada em DATA-MODEL §3.8), ancorada na **execução efetiva**, opcional, com retorno imediato na própria tela Hoje. Necessity review: as outras quatro dimensões (`hydration_feel`, `softness`, `definition`, `dryness`) e o texto livre `note` ficam **DEFER** — as primeiras existem para o Progress (Fase 8) e cada pergunta extra é atrito direto contra a hipótese H4; `note` é PII sem consumidor. Colunas anuláveis são aditivas, então a SPEC-009 acrescenta o que precisar sem migração de dados. Editar/apagar check-in: DEFER. Implementação autorizada (LEVEL 2). | SPEC-006 → Approved; DATA-MODEL §3.8; índice de SPECs | **DECIDED (agente, §0.2)** |

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
| ~~D-12~~ | movido para B5 (**DECIDED** 2026-08-27: sim, janela de 15 min) | — | — | — | DECIDED |
| D-30 | Nome do produto | placeholder "Hairo" | Antes da fase 10 | L/M | OPEN |
| D-31 | Provider analytics / crash | PostHog + Sentry | Fase 10 | L | DEFERRED |
| D-32 | Base legal LGPD para analytics | consentimento | Antes da fase 10 (jurídico) | L | OPEN |
| D-33 | Lib de datas (`date-fns-tz` vs `Temporal`) | date-fns-tz | **SPEC-000** (proposta em §Dependencies) | L | OPEN → proposta em SPEC-000 |
| D-34 | Janela de geração de `scheduled_cares` | 8 semanas | SPEC-004 | L | DEFERRED |
| ~~D-35~~ | movido para B5 (**DECIDED** 2026-08-27: 0 ou 1 execução efetiva) | — | — | — | DECIDED |
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
| 2026-08-27 | v0.9: doc-sync DATA-MODEL/DOMAIN-MAP/CLAUDE.md feito (PR #8). **SPEC-003 FOLDED INTO SPEC-004** (D-66; ADR-007 Amendment A2) — não implementada, fronteira Diagnostic preservada. |
| 2026-08-27 | v0.10: SPEC-004 modelo técnico CLOSED; **regras de domínio V1 CANDIDATE (D-67)**; ADR-007 A1 ganha status `candidate` (implementável em dev/internal beta; PUBLIC RELEASE exige `validated`). |
| 2026-08-27 | v0.11: **SPEC-004 APPROVED (D-68)** por aprovação humana; implementação autorizada (LEVEL 2). PUBLIC RELEASE continua bloqueado até o domain sign-off das regras V1 (`candidate → validated`). |
| 2026-08-27 | v0.12: **SPEC-004 implementada e mergeada** em `main` (PR #11) via LEVEL 2; required CI verde (pgTAP 030 29/29). Engines `assess`/`generateSchedule` v1 puros com golden; `hair_plans`/`scheduled_cares` + RPC `create_plan_tx` (advisory lock por usuária, idempotência por `client_request_id`, FK composta de ownership); Edge `generate-plan`; preview/confirmação no app. **Nenhuma decisão nova**: implementação dentro de D-66/D-67/D-68. **Único bloqueio remanescente para PUBLIC RELEASE: OQ-REL — sign-off de domínio das regras V1.** |
| 2026-08-27 | v0.13: **SPEC-005 APPROVED (D-69)** por aprovação humana, com **D-12** (desfazer execução: sim, janela de 15 min, registro anulado preservado) e **D-35** (0 ou 1 execução efetiva por cuidado, garantido no banco) **decididas** e movidas de C para B5. `status='completed'` não persistido. Implementação autorizada (LEVEL 2). MVP-ROADMAP sincronizado: o checkpoint de especialista "antes de F5" foi re-escopado por D-67/D-68 — **o gate de PUBLIC RELEASE permanece inalterado**. |
| 2026-08-27 | v0.14: **SPEC-005 implementada e mergeada** em `main` (PR #14) via LEVEL 2; required CI verde (pgTAP 040 41/41). Loop diário completo: Hoje/atrasado/próximos/histórico + concluir, pular, reagendar e desfazer (15 min). `care_executions` com índice único parcial garantindo 0 ou 1 execução efetiva (D-35); `voided_at` preserva o registro anulado (D-12); conclusão e atraso **derivados**, sem coluna. **Nenhuma decisão nova**: implementação dentro de D-28/D-69. **Bloqueio remanescente para PUBLIC RELEASE: OQ-REL — sign-off de domínio das regras V1 (D-26/D-67), inalterado por esta fatia.** |
| 2026-08-28 | v0.15: **CLAUDE.md §0.2 — Master Autonomous Engineering Mode** autorizado por decisão humana (PR #18): autonomia técnica plena dentro de SPEC aprovada; human/external gates estreitados para o material/irreversível; §6 reconciliado com o LEVEL 2 (o GitHub executa o merge após as required checks). Skill **`improve`** instalada como auditoria obrigatória antes de DONE (PR #17). Novo bloco **B6**: **D-70** (conteúdo capilar V1 nasce `candidate`, aplicando o precedente D-67, e entra em OQ-REL), **D-71** (conteúdo no bundle, sem `care_types`/`content_articles`, com gatilho nomeado para reabrir) e **D-72** (**SPEC-007 APPROVED**) — decididas pelo agente sob §0.2, pequenas e reversíveis, sujeitas a ratificação humana. **O gate de PUBLIC RELEASE permanece inalterado.** |
| 2026-08-28 | v0.16: **SPEC-007 implementada e mergeada** em `main` (PR #19) via LEVEL 2; required CI verde; pgTAP **inalterada em 115 asserções** (nenhuma SQL tocada). Guias "como fazer" por care type na tela Hoje, no bundle (D-71), `candidate` (D-70). **Fase 5 do roadmap fechada.** **D-70/D-71/D-72 RATIFICADAS por decisão humana**, D-70 com correção: o gate segue o **conteúdo**, não o autor — texto com orientação capilar substantiva exige sign-off do revisor de domínio mesmo vindo do owner (SPEC-007 BR2b); **OQ-REL não foi enfraquecida**. Auditoria `improve`: 1 passe, 3 IMPORTANT corrigidos, 0 BLOCKER — o principal foi um teste AC4 cujas âncoras `\b` tornavam duas verificações incapazes de casar (proteção inexistente com CI verde). |
| 2026-08-28 | v0.17: **SPEC-006 implementada e mergeada** em `main` via LEVEL 2 (**D-73**, agente §0.2 — aguarda ratificação). Check-in de uma pergunta (1..5) ancorado na execução efetiva; `checkins` com RLS ON+FORCE, grant só de SELECT, escrita só por `submit_checkin` (DEFINER allowlistada, `search_path` fixo, idempotente, recusa execução anulada/alheia). pgTAP passa a **141 asserções** (115 + 26). Necessity review: 4 dimensões e `note` continuam DEFER. **Nenhuma regra capilar nova — D-26 não acionada; gate de PUBLIC RELEASE inalterado.** Auditoria `improve`: 1 BLOCKER (a tela não passava `checkIns` para `buildTodayView` — compilava e o core passava, mas nenhum check-in apareceria) e 2 IMPORTANT corrigidos; 1 IMPORTANT **reportado sem corrigir**: `tests.unapproved_security_definer_functions()` não verifica o pin de `search_path`, e endurecer o helper compartilhado é fatia própria. |
