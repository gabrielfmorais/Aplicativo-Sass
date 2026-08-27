# SPEC-002 — Hair Profile & Onboarding

| Campo | Valor |
|---|---|
| ID | SPEC-002 |
| Status | **Draft** (v0.2, necessity review 2026-08-27; aguarda revisão humana — HUMAN GATE. Nenhum código, migration, dependência ou seed criado por esta SPEC) |
| Owner | @gabrielfmorais (humano) |
| Bounded Context | Hair Profile (Core) — DOMAIN-MAP §3.2 |
| Related ADRs | ADR-001 (camadas), ADR-004 (Supabase/RLS), ADR-006 (fronteiras), ADR-007 A1 (governança de regras capilares — D-26), ADR-008 (time) |
| Related SPECs | SPEC-001 (Identity — implemented; entrega `auth.uid()` e sessão) · SPEC-003 (Diagnostic — consome `HairProfileSnapshot`; **define o conjunto mínimo de inputs** — ver §7/§23) |
| Decisões vinculantes | D-11 (versionamento server-authoritative de `hair_profiles`; **implementação revista** — ver §9), D-26 (engenharia projeta o mecanismo; **não** inventa dimensão/opção/regra capilar) |
| Fase do roadmap | 2 — Hair Profile + Onboarding |
| Labels | `db`, `security` |
| Criado / Atualizado | 2026-08-27 / 2026-08-27 |

> Princípio (Ponytail/YAGNI + herdado da SPEC-001): **a menor solução correta**. Cada mecanismo (tabela / RPC / trigger / dependência / estado / serviço) só existe se responder SIM a: (1) funcionalidade central do MVP, (2) segurança/integridade/privacidade, (3) caro/perigoso corrigir depois, (4) valida hipótese central. Senão: **DEFER** ou **REMOVE**. Uma decisão anterior de DEFER **não** obriga a implementar agora.
>
> **Separação obrigatória (D-26):** esta SPEC define a **estrutura técnica** de armazenar/versionar um perfil (engenharia). **NÃO** define **quais** dimensões, opções ou perguntas compõem o perfil — isso é **conteúdo de domínio** e exige validação especializada. Ver §7-B e §23 (BLOCKING).

## 1. Context
SPEC-001 entregou identidade e sessão. O produto ainda não coleta nada sobre o cabelo, e o Diagnostic Engine (SPEC-003) não tem entrada. Esta SPEC fixa **como** um perfil capilar é armazenado (imutável, versionado, isolado por usuária). Hipótese: **H1 (≥ 60% concluem o onboarding)** — daí o alvo de produto de baixa fricção (§14), não um número fixo de perguntas.

## 2. Problem
Depois de autenticar, a usuária precisa registrar seu cabelo gerando um snapshot **imutável e versionado**, isolado por RLS, que sirva de entrada determinística para o diagnóstico e possa ser refeito no futuro sem apagar o histórico (base para SPEC-014). O **conteúdo** desse perfil (dimensões/opções) ainda não está validado por domínio.

## 3. Goals
- G1 A usuária conclui o onboarding e tem exatamente **um** snapshot capilar atual.
- G2 Snapshots são **append-only versionados**: refazer cria nova versão; a anterior é preservada.
- G3 Isolamento por RLS fail-closed em `hair_profiles`, provado por pgTAP; nenhuma usuária lê/escreve o de outra.
- G4 `version` é **server-authoritative**: o cliente nunca escolhe; concorrência não corrompe o histórico.
- G5 "Onboarding concluído" é **estado derivado** (existe snapshot atual?), não coluna persistida.
- G6 Nenhuma dimensão/opção/regra capilar é inventada por engenharia; o conteúdo é `draft` e **bloqueia** a implementação até validação de domínio (D-26).

## 4. Non-Goals
- Interpretar o perfil / diagnóstico / plano → **SPEC-003/004**.
- **Tabela `profiles`** — REMOVIDA desta SPEC (§8). Nasce quando um requisito concreto de produto precisar dela (SPEC futura).
- `onboarding_status`, `timezone`, `display_name`, `locale` — não entram (derivado ou DEFER; §8).
- `extra_attributes jsonb` — REMOVIDO (§8); sem escape hatch para requisitos futuros.
- Edição granular in-place (o modelo é versionado: "editar" = nova versão).
- Fotos, faixa etária/gênero; estado global (Zustand — D-36); nova dependência npm; preview de diagnóstico.
- **Definição do conteúdo do questionário** (é domínio; §7-B, §23 BLOCKING).

## 5. User Stories
- US1 Recém-autenticada, a usuária responde o onboarding e o perfil é salvo.
- US2 Em qualquer pergunta que não saiba, escolhe "não sei" e segue (P02) — *quando o conjunto de perguntas estiver definido por domínio*.
- US3 Reabrindo com perfil atual salvo, a usuária **não** repete o onboarding (estado derivado).
- US4 (base para SPEC-014) A usuária refaz o onboarding depois; a nova versão vira a atual, a antiga é preservada.

## 6. Functional Requirements
| ID | Requisito |
|---|---|
| FR1 | Após autenticação, se **não** existe snapshot atual da usuária, o app roteia para o onboarding; caso contrário, para o destino pós-onboarding (placeholder nesta SPEC — SPEC-003+ substitui). "Existe snapshot atual" = `SELECT 1 FROM hair_profiles WHERE user_id = auth.uid() LIMIT 1`. |
| FR2 | Salvar o perfil = **um** `INSERT` em `hair_profiles` (RLS `WITH CHECK user_id = auth.uid()`); o cliente **não** envia `version` (servidor atribui — §9). |
| FR3 | "Perfil atual" = maior `version` da usuária (derivado; sem flag `is_current`). |
| FR4 | Refazer o onboarding cria nova `version`; nenhuma linha anterior é alterada ou apagada. |
| FR5 | Validação: zod no cliente **e** `CHECK`/constraints no banco — **do conjunto de dimensões que o domínio aprovar** (§7-B). Até lá, o schema concreto é TODO (BLOCKING). |
| FR6 | Onboarding parcial não persiste linha (só o `INSERT` final atômico); todo estado dá feedback (§14). |

## 7. Business Rules

### 7-A. Estrutura técnica (engenharia — definida aqui)
| ID | Regra | Onde |
|---|---|---|
| BR1 | `hair_profiles` é **append-only e imutável**: sem UPDATE, sem DELETE pela usuária (só cascade de conta). | RLS/grants |
| BR2 | `version` é **server-authoritative**: atribuída por trigger `BEFORE INSERT` (`max+1` por usuária), valor do cliente ignorado; integridade garantida por `UNIQUE (user_id, version)` (§9). | trigger + constraint |
| BR3 | Concorrência de dois INSERTs não corrompe o histórico: no pior caso um falha com `unique_violation` e o cliente reenvia; nunca há duas linhas com a mesma versão nem sobrescrita (§9). | `UNIQUE (user_id, version)` |
| BR4 | Ownership e autorização exclusivamente por RLS/grants/constraints com `(select auth.uid())`; nenhuma regra em componente. | Postgres |
| BR5 | Nenhuma PII sensível nova; características do cabelo são dado pessoal **não sensível** (LGPD); notas livres (se o domínio as incluir) nunca em logs/analytics. | catálogo + adapter de log |

### 7-B. Conteúdo de domínio (NÃO definido aqui — HUMAN GATE / D-26)
As **dimensões** candidatas em DOMAIN-MAP §3.2 (`curl_pattern`, `strand_thickness`, `porosity`, `scalp_oiliness`, `elasticity`, `wash_frequency`, `heat_usage`, `chemical_treatments`, `goals`) e suas opções/subtipos são **hipótese de engenharia — não validadas**. Não são aprovadas por esta SPEC. O conjunto **mínimo** de inputs de perfil é determinado pelo que o **Diagnostic Engine (SPEC-003)** precisa e exige **validação de domínio/produto** antes da implementação (§23, **BLOCKING**). Engenharia entrega o envelope (7-A); o domínio entrega o conteúdo.

## 8. Data Model Impact (conceitual; sem migration)

Necessity review por mecanismo:

| Mecanismo | (1) MVP | (2) Seg./integr. | (3) Caro depois? | (4) Hipótese | Decisão |
|---|---|---|---|---|---|
| Tabela `hair_profiles` (versionada, append-only) | **sim** — insumo do diagnóstico | integridade (imutável) | **sim** (H) | H1 | **KEEP** |
| Tabela `profiles` | onboarding é **derivável** de "existe snapshot"; nenhum requisito atual usa dados de `profiles` | nenhuma | não (L) | — | **REMOVE** (nasce numa SPEC futura com requisito concreto) |
| `ProfilePort` / provisionamento / `INSERT ON CONFLICT` / RLS+testes de `profiles` | dependem de `profiles` | — | — | — | **REMOVE** (sem função sem a tabela) |
| Coluna `onboarding_status` | derivável (existe snapshot atual?) | nenhuma | não | — | **REMOVE** — estado derivado, não duplicado |
| Colunas `timezone` / `display_name` / `locale` | nenhum fluxo desta SPEC os usa | nenhuma | não (L) | — | **DEFER** (timezone → SPEC-004 Schedule; display_name → quando houver personalização; locale sempre `pt-BR`) |
| `extra_attributes jsonb` | nenhum atributo atual aprovado é impossível de tipar | nenhuma | evitar escape hatch | — | **REMOVE** (colunas tipadas quando o domínio definir; §7-B) |
| Trigger `BEFORE INSERT` (version) | sim — server-authoritative | **sim** (cliente não escolhe versão) | integridade | — | **KEEP** |
| Advisory lock no trigger | `UNIQUE` já garante integridade; lock só evita um retry raro | não agrega correção | — | — | **REMOVE** (§9; revisão de D-11 — IMPORTANT) |
| RPC / Edge Function / custom claim / dependência npm | nada no MVP; zod já existe | — | — | — | **NONE** |

**Modelo mínimo resultante:**
```
auth.users
   ↓  user_id (FK, on delete cascade) — ownership only
hair_profiles   (imutável, versionado)
```

`hair_profiles` — **envelope técnico (definido)**:
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK default gen_random_uuid() | |
| user_id | uuid not null, FK `auth.users` on delete cascade | ownership |
| version | int not null | server-authoritative (§9); `UNIQUE (user_id, version)` |
| created_at | timestamptz not null default now() | **sem `updated_at`** — imutável |
| *(atributos de perfil)* | **TBD** | **BLOCKING (D-26/§23):** colunas tipadas + CHECK definidas só após o conjunto mínimo de inputs ser validado por domínio (§7-B) |

Índice: `(user_id, version desc)`. **Consequência documental:** DATA-MODEL §3.1 (previa `profiles` criado nesta SPEC) e §3.3 recebem nota de atualização em commit da implementação, refletindo a remoção de `profiles` desta SPEC e o versionamento revisto.

## 9. Versioning mechanism review (D-11)
Requisito arquitetural preservado: `hair_profiles` **imutável e versionado, server-authoritative**. Revisão da implementação proposta em D-11 ("trigger + advisory lock"):

- **Qual race concreta o mecanismo resolve?** Dois INSERTs concorrentes da mesma usuária lendo o mesmo `max(version)=N` e ambos calculando `N+1`.
- **`UNIQUE(user_id, version)` sozinho é insuficiente? Por quê?** Para **integridade**, é **suficiente**: impede duas linhas com a mesma versão e qualquer sobrescrita — o segundo INSERT falha com `unique_violation` (23505). O que `UNIQUE` sozinho **não** dá é a *alocação server-authoritative* (impedir o cliente de escolher a versão) — isso vem do **trigger**. E não dá *ausência de erro* sob concorrência — isso viria do advisory lock.
- **Solução mais simples mantendo server-authoritative?** **Trigger `BEFORE INSERT`** que faz `NEW.version = COALESCE(max(version) por user_id, 0) + 1` e **ignora** o valor do cliente, **+ `UNIQUE (user_id, version)`**. **Sem advisory lock.**
- **O cliente consegue influenciar `version`?** **Não** — o trigger sobrescreve qualquer valor enviado.
- **Como a concorrência de dois INSERTs é resolvida?** Ambos calculam `N+1`; `UNIQUE` deixa **um** commitar e o outro falha com 23505; o cliente reenvia e obtém `N+2`. Nenhuma corrupção; histórico intacto. O botão de salvar já é desabilitado durante `submitting` (§14), tornando a colisão rara.
- **Decisão:** **trigger + `UNIQUE`, remover o advisory lock.** É a menor solução correta; preserva imutabilidade, unicidade de versão e autoridade do servidor. Advisory lock só converteria um erro raro em espera serializada — complexidade sem ganho de correção para um cenário single-user. **Isto revisa a implementação sugerida em D-11 (que citava advisory lock) — requer confirmação humana (§23, IMPORTANT).** Alternativa considerada e descartada: eliminar `version int` e ordenar por `created_at` — muda mais o contrato (D-11/DATA-MODEL) e complica "versão N" da reavaliação (SPEC-014).

## 10. API / Contracts
- **Sem RPC e sem Edge Function.** Acesso direto por PostgREST sob RLS (espelha SPEC-001).
- Core `hair-profile` (application): `HairProfileSchema` (zod — **forma definida após §7-B**), `HairProfilePort { getCurrent(): HairProfile | null; save(input): HairProfile }` (`save` = `INSERT`; `getCurrent` = `SELECT ... ORDER BY version DESC LIMIT 1`). `HairProfileSnapshot` (tipo em core) = contrato Conformist para SPEC-003. Erros → `AppError` da Foundation.

## 11. Authorization
- `hair_profiles`: `enable` + `force row level security`; `revoke all from anon, authenticated`; `grant select, insert to authenticated` (**sem UPDATE, sem DELETE** — append-only, BR1). Policies `authenticated`: select `using (user_id = (select auth.uid()))`, insert `with check (user_id = (select auth.uid()))`. `anon`: nada.
- Entradas na allowlist de grants (`supabase/security/allowlists.sql`) com referência SPEC-002; trigger de versão é `SECURITY INVOKER` (não entra na allowlist de DEFINER). Guardrails da Foundation (`tables_without_rls`, `unapproved_grants`, `unapproved_security_definer_functions`) permanecem em zero. Sem entitlements.

## 12. Security Considerations
Checklist SECURITY-BASELINE §13:
- RLS ON + FORCE em `hair_profiles`, policy por verbo ✔; sem policy = negado ✔.
- `SECURITY DEFINER`: **0**; RPC: **0** ✔. Trigger de versão INVOKER ✔.
- Inputs validados: zod (cliente) **e** CHECK/constraints (servidor) — **após §7-B** ✔.
- Idempotência/consistência: versão server-authoritative + `UNIQUE` (§9) ✔.
- PII nova: características do cabelo (pessoal, **não** sensível); sem tokens/segredos; nada em logs/analytics ✔.
- Testes RLS positivos e negativos (pgTAP) ✔. Rollback: migration aditiva com `-- ROLLBACK:` ✔.

**Cliente hostil:** só `anon key` + JWT próprio. Não pode: ler/escrever `hair_profiles` de terceiros (RLS); forjar `version` (trigger); forjar `user_id` (policy `with check`); alterar/apagar snapshot (sem grant UPDATE/DELETE); inserir valor fora do CHECK (após §7-B). Ameaças candidatas: T01 (isolamento), T05 (input), T10 (integridade) — confirmar T-ids no THREAT-MODEL na revisão.

## 13. Privacy Considerations
Dado pessoal novo: características do cabelo (`hair_profiles`) — **pessoal não sensível** (LGPD); finalidade: diagnóstico/plano; retenção: até exclusão de conta (cascade). Nada em logs/analytics além de eventos sem propriedades sensíveis (§... ver abaixo). Exportação coberta pela arquitetura (`user_id` em tudo). Consentimento/termos: SPEC-013.

## 14. Analytics Events
Definir **tipos** no catálogo (core), emitindo para o **adapter no-op** (provider real = SPEC-011):
- `onboarding_started {}` · `onboarding_completed {}` · `hair_profile_saved { version }`
Proibido em propriedades: qualquer valor de resposta, `user_id` cru, notas livres, PII. Emitir agora vs. adiar para SPEC-011 = CAN DEFER.

## 15. UX Notes (sem design visual)
- **Alvo de produto (não requisito arquitetural):** baixa fricção para sustentar H1. O **número de perguntas é consequência** do conjunto mínimo de inputs (§7-B/§23), **não** um alvo fixo; não inventar perguntas para atingir um número.
- Telas: Onboarding (perguntas definidas por domínio; "não sei" onde aplicável) → confirmação ("perfil salvo") → destino pós-onboarding (placeholder).
- Estados: `loading` (checando snapshot atual) · `answering` · `submitting` (botão desabilitado) · `success` · `error` (retry) · `offline`.
- Roteamento: reusa o auth gate da SPEC-001 (`apps/mobile/src/app/index.tsx`); substitui o placeholder pós-auth, não a lógica de auth.
- Acessibilidade: labels, alvo de toque, Dynamic Type, contraste, foco por pergunta.

## 16. Edge Cases & Failure Modes
- App fechado no meio do onboarding: nada persistido (só `INSERT` final); recomeça (sem retomada — coerente com "sem `onboarding_status`").
- Double submit: cada `INSERT` tenta uma versão; `UNIQUE` + trigger serializam a integridade; UI desabilita o botão em `submitting`; colisão rara → retry (§9).
- Valor fora do CHECK apesar do zod: erro genérico, sem detalhe interno; log sem PII.
- Rede cai no save: estado `error` com retry; respostas preservadas em memória.

## 17. Acceptance Criteria (revisados pós-poda)
| ID | Critério |
|---|---|
| AC1 | Dado uma usuária autenticada **sem** snapshot atual, quando conclui o onboarding, então existe exatamente **1** `hair_profile` com `version = 1` e **nenhuma** outra tabela é criada/preenchida (sem `profiles`). |
| AC2 | **(preserva versão anterior)** Dado uma usuária com snapshot atual `version = N`, quando refaz o onboarding, então é criada uma linha `version = N+1`, a linha `N` permanece **inalterada**, e "perfil atual" passa a ser `N+1`. |
| AC3 | **(cliente não escolhe versão)** Dado um cliente modificado que envia `version` arbitrária, quando insere, então o trigger atribui `max+1` e ignora o valor enviado (pgTAP). |
| AC4 | **(concorrência não corrompe)** Dadas duas inserções concorrentes para a mesma usuária, então nunca resultam duas linhas com a mesma `version`; no máximo uma persiste por versão e a outra falha com `unique_violation` (pgTAP simulando concorrência/colisão de versão). |
| AC5 | **(isolamento A/B + imutabilidade + anon)** Dado usuárias A e B com cliente modificado: A não faz SELECT/INSERT em `hair_profiles` de B; A não faz UPDATE/DELETE em snapshot algum (sem grant); anon não acessa nada; `user_id` forjado no INSERT é rejeitado pela policy `with check` (pgTAP + revisão de grants). |
| AC6 | **(valores de domínio)** Uma vez aprovado o schema de domínio (§7-B), valores fora do conjunto fechado são rejeitados por zod (cliente) **e** por CHECK (servidor) — teste unit + pgTAP. *(Bloqueado até §23-BLOCKING resolvido.)* |
| AC7 | Os guardrails da Foundation permanecem verdes: `tables_without_rls()` = 0, `unapproved_grants()` = 0 após allowlist, `unapproved_security_definer_functions()` = 0, `pnpm verify`. |
| AC8 | `HairProfileSnapshot` é exportado por `packages/core` sem depender de React/Expo/Supabase (dep-cruise verde). |
| AC9 | Nenhum valor de resposta/nota/PII em logs ou analytics (teste do redactor + revisão do catálogo). |

## 18. Testing Strategy
- **Unit (core `hair-profile`):** `HairProfileSchema` (após §7-B), mapeamento de erros → `AppError`, forma de `HairProfileSnapshot`.
- **Integração (Supabase local + pgTAP):** trigger de versão (monotônica, ignora valor do cliente); colisão concorrente resolvida por `UNIQUE` (AC4); RLS positiva/negativa (A vs B, anon, UPDATE/DELETE negados); CHECK de domínio (após §7-B).
- **Component (Jest + RNTL):** roteamento onboarding vs. pós-onboarding (estado derivado); estados; botão desabilitado em `submitting`.
- **E2E:** onboarding → salvo → reabrir sem repetir (não crítico como auth; ferramenta na fase 10).
- **Manual smoke:** checklist no PR.

## 19. Dependencies
- SPEC-001 (implemented) — sessão e `auth.uid()`; reusa o auth gate.
- **SPEC-003 (bloqueante de conteúdo):** o conjunto mínimo de inputs do diagnóstico determina as colunas de domínio (§7-B/§23).
- ADR-001/004/006/007-A1/008.
- **Nenhuma dependência npm nova** (zod já presente; sem lib de form, state manager ou crypto). Nenhum serviço externo.

## 20. Implementation Plan (fases pequenas — NÃO iniciar antes do gate de domínio §23)
1. `hair_profiles` **envelope** + trigger de versão (§9, sem advisory lock) + `UNIQUE` + RLS/grants + allowlist + pgTAP (AC2–AC5, AC7).
2. **[após §23-BLOCKING]** colunas de domínio tipadas + CHECK + zod correspondente (AC6).
3. `supabase gen types` → commit `database.types.ts`.
4. Core `hair-profile`: `HairProfileSchema`, `HairProfileSnapshot`, `HairProfilePort`, erros.
5. Infra mobile: adapter PostgREST do port.
6. UI onboarding (perguntas do domínio aprovado) + confirmação + roteamento por estado derivado.
7. Catálogo de eventos (no-op) + docs (DATA-MODEL §3.1/§3.3, matriz RLS, README do contexto).

## 21. Migration Plan
Migration aditiva (`hair_profiles` envelope + trigger + `UNIQUE` + RLS/grants), depois migration aditiva das colunas de domínio (fase 2). pgTAP e `-- ROLLBACK:` em cada uma. `supabase gen types` commitado. Local → PR → staging (merge) → prod humano. Sem migração de dados (tabela nova).

## 22. Rollback Plan
Reverter código pela PR; migrations reversíveis por `-- ROLLBACK:` (drop de tabela/trigger/policies/grants + remoção das entradas de allowlist). Tabela nasce vazia; rollback não perde dado de produção.

## 23. Open Questions & Gates
| ID | Classe | Pergunta | Assunção enquanto aberta |
|---|---|---|---|
| **OQ1** | **BLOCKING BEFORE IMPLEMENTATION (HUMAN GATE / D-26)** | Qual é o **conjunto mínimo de inputs de perfil** que o Diagnostic Engine (SPEC-003) exige, e quais dimensões/opções/subtipos são **validados por domínio**? | **A implementação da SPEC-002 não começa** enquanto isso não for definido. Dimensões de DOMAIN-MAP §3.2 são hipótese `draft`, não aprovadas. |
| OQ2 | IMPORTANT BEFORE IMPLEMENTATION | Confirmar a revisão de D-11: **remover o advisory lock**, mantendo trigger + `UNIQUE (user_id, version)` (§9)? | adotar a versão sem lock (menor solução correta); requer sign-off humano por ser item do Decision Register |
| OQ3 | CAN DEFER | Emitir os eventos de analytics agora (no-op) ou só na SPEC-011? | definir tipos agora; emissão pode ser adiada |
| OQ4 | CAN DEFER | Limite anti-abuso de versões por usuária (rate) | fora do MVP; tratar no release se necessário |
| OQ5 | CAN DEFER | Ferramenta E2E do onboarding | fase 10 (Maestro candidato — D-37) |

## 24. Change Log
| Data | Mudança | Autor |
|---|---|---|
| 2026-08-27 | v0.1 Draft via `spec-create` (incluía `profiles` mínimo, `extra_attributes`, advisory lock, lista de dimensões). | Claude |
| 2026-08-27 | v0.2 **Necessity review (Ponytail/YAGNI)**: `profiles` **removida** (onboarding derivado; sem requisito concreto) junto de `ProfilePort`/provisionamento/RLS de perfil; `onboarding_status` removido (estado derivado); `timezone`/`display_name`/`locale` **DEFER**; `extra_attributes jsonb` **removido**; versionamento revisto para **trigger + `UNIQUE`, sem advisory lock** (§9, revisão de D-11 — IMPORTANT); conteúdo de dimensões separado como **HUMAN GATE / BLOCKING** (§7-B, §23-OQ1, D-26); número de perguntas reclassificado como alvo de produto; ACs revisados. Modelo mínimo: `auth.users → hair_profiles`. | Claude |
