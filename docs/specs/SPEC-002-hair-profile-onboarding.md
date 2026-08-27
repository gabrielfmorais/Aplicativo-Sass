# SPEC-002 — Hair Profile & Onboarding

| Campo | Valor |
|---|---|
| ID | SPEC-002 |
| Status | **Implemented** — merged em `main` (PR #6, branch `feat/spec-002-hair-profile-onboarding`, 2026-08-27); required CI verde (pgTAP incl.). Aprovada v0.4 (D-62/D-63/D-64/D-65). |
| Owner | @gabrielfmorais (humano) |
| Bounded Context | Hair Profile (Core) — DOMAIN-MAP §3.2 |
| Related ADRs | ADR-001 (camadas), ADR-004 (Supabase/RLS), ADR-006 (fronteiras), ADR-007 A1 (governança de regras capilares — D-26), ADR-008 (time) |
| Related SPECs | SPEC-001 (Identity — implemented; entrega `auth.uid()` e sessão) · SPEC-003 (Diagnostic — consome `HairProfileSnapshot` por `hair_profile_id`) |
| Decisões vinculantes | D-62/D-63/D-64 (inputs mínimos, remoção de `profiles`, snapshots imutáveis por id — 2026-08-27); D-64 **amenda** D-11; D-26 (engenharia não inventa regra/ciência capilar) |
| Fase do roadmap | 2 — Hair Profile + Onboarding |
| Labels | `db`, `security` |
| Criado / Atualizado | 2026-08-27 / 2026-08-27 |

> Princípio (Ponytail/YAGNI): **a menor solução correta**. Um DEFER anterior não obriga a implementar agora; *future possibility ≠ current requirement*.
>
> **Escopo (D-26):** SPEC-002 **coleta e preserva** dados de perfil. **NÃO** diagnostica, não define pesos/scores/fórmulas/frequência ideal nem qualquer ciência capilar — isso é SPEC-003+ sob D-26. Os inputs abaixo são **inputs de produto para personalização**, aprovados por decisão humana; **não** constituem diagnóstico médico/dermatológico.

## 1. Context
SPEC-001 entregou identidade e sessão. O produto ainda não coleta nada sobre o cabelo. Esta SPEC coleta um perfil capilar mínimo e o preserva como **snapshot histórico imutável**, insumo do Diagnostic Engine (SPEC-003). Hipótese: **H1 (≥ 60% concluem o onboarding)** → baixa fricção (§15).

## 2. Problem
Depois de autenticar, a usuária registra seu cabelo, gerando um snapshot imutável, isolado por RLS, identificável de forma estável (por `id`), que sirva de entrada determinística ao diagnóstico e possa ser refeito no futuro sem apagar o histórico (base para SPEC-014).

## 3. Goals
- G1 A usuária conclui o onboarding e passa a ter um snapshot capilar atual.
- G2 Snapshots são **append-only imutáveis**: refazer cria nova linha; nenhuma anterior é sobrescrita.
- G3 Cada snapshot é identificável de forma estável por `hair_profiles.id`; downstream (SPEC-003/004) referencia esse `hair_profile_id`.
- G4 "Snapshot atual" é **derivado** (o mais recente), sem estado duplicado (`is_current`/`active_version`).
- G5 Isolamento por RLS fail-closed, provado por pgTAP; nenhuma usuária acessa o de outra; cliente hostil não burla ownership.
- G6 Engenharia coleta/preserva; **não** diagnostica (D-26).

## 4. Non-Goals
- Diagnóstico/plano/scores/fórmulas/frequência ideal → SPEC-003/004 (D-26).
- Tabela `profiles` e derivados (`ProfilePort`, provisioning, `onboarding_status`, `ensure_my_profile`, trigger em `auth.users`) — **REMOVE** (§12).
- Numeração sequencial de versão (`version int`, trigger `MAX+1`, `UNIQUE(user_id,version)`, lógica de concorrência para numerar) — **REMOVE** (§13; D-64 amenda D-11).
- Campos fora do conjunto aprovado (§10): porosity, elasticity, density, idade, gênero, comprimento, fotos, marcas/produtos/salão, histórico químico detalhado, classificação 2A–4C, `extra_attributes jsonb`.
- Edição granular in-place; estado global (Zustand — D-36); nova dependência npm.
- **Analytics** (eventos/adapter/no-op) — **DEFER** (revisão humana 2026-08-27): a existência de `hair_profiles` já permite derivar a conclusão do onboarding; nenhum código de analytics entra sem outro requisito aprovado (→ SPEC-011).

## 5. User Stories
- US1 Recém-autenticada, a usuária responde o onboarding e o perfil é salvo.
- US2 Onde aplicável, escolhe "Não sei"/"Varia" e segue (P02).
- US3 Reabrindo com um snapshot salvo, a usuária **não** repete o onboarding (estado derivado).
- US4 (base para SPEC-014) Refaz o onboarding depois; a nova avaliação vira a atual e as anteriores são preservadas.

## 6. Approved onboarding inputs (decisão humana — D-62)
8 inputs conceituais de produto. Não constituem diagnóstico. Não adicionar dimensões sem requisito concreto.

| # | Campo | Cardinalidade | Valores permitidos | "Não sei"? | Por que é necessário |
|---|---|---|---|---|---|
| 1 | `hair_pattern` | single | `straight` · `wavy` · `curly` · `coily` · `transitioning_or_mixed` · `unknown` | sim (`unknown`) | dimensão base de personalização; UX: Liso/Ondulado/Cacheado/Crespo/Misto ou Em transição/Não sei. **Sem 2A–4C no MVP.** |
| 2 | `strand_thickness` | single | `fine` · `medium` · `coarse` · `unknown` | sim | espessura do fio (≠ densidade); UX: Fino/Médio/Grosso/Não sei |
| 3 | `scalp_tendency` | single | `oily_quickly` · `balanced` · `dry_tendency` · `unknown` | sim | tendência do couro (não é diagnóstico dermatológico); UX: Fica oleoso rapidamente/Equilibrado/Tende a ficar seco/Não sei |
| 4 | `wash_frequency` | single | `once_or_less_weekly` · `twice_weekly` · `three_to_four_weekly` · `five_or_more_weekly` · `varies` | via `varies` | comportamento **atual** (não é a recomendação); UX: 1x ou menos/2x/3–4x/5x ou mais/Varia muito |
| 5 | `chemical_treatments` | multi (0..N) | `coloring` · `bleaching_or_highlights` · `straightening_relaxing_or_progressive` · `perm_or_chemical_texturizing` | vazio = **nenhum** | processos químicos presentes; conjunto vazio representa "nenhum" (sem opção artificial `multiple`). **Não** coletar marca/produto/salão/data/histórico detalhado |
| 6 | `heat_usage` | single | `almost_never` · `one_to_two_weekly` · `three_to_four_weekly` · `almost_daily` | — | uso de calor agregado (secador/chapinha/modelador/etc.), sem individualizar aparelho |
| 7 | `current_concerns` | multi (1..N) | `dryness` · `breakage` · `tangling` · `dullness` · `frizz` · `no_major_concern` | via `no_major_concern` | queixas atuais (não sintomas médicos); **`no_major_concern` é exclusivo — se presente, é o único elemento do array** (validado no cliente e por CHECK server-side); UX: Ressecado/Quebra com facilidade/Embaraça muito/Sem brilho/Com bastante frizz/Sem problema importante |
| 8 | `primary_goal` | single | `softness_and_hydration` · `reduce_breakage_and_strengthen` · `recover_chemical_or_heat_damage` · `definition_and_frizz_control` · `maintain_healthy_hair` | — | **uma** prioridade principal; UX conforme decisão humana §9 |

## 7. Business Rules
| ID | Regra | Onde |
|---|---|---|
| BR1 | `hair_profiles` é **append-only e imutável**: sem UPDATE, sem DELETE pelo papel do app (só cascade de conta). | RLS/grants |
| BR2 | Snapshot identificado por `id` uuid estável; downstream referencia `hair_profile_id`. **Sem numeração sequencial** (D-64). | PK + contrato |
| BR3 | "Snapshot atual" = o mais recente da usuária (`ORDER BY created_at DESC, id DESC LIMIT 1`); derivado, sem `is_current`/`active_version`. | query |
| BR4 | Refazer cria **nova linha**; nenhuma linha anterior é alterada ou apagada. | INSERT + ausência de UPDATE/DELETE |
| BR5 | Ownership e autorização exclusivamente por RLS/grants/constraints com `(select auth.uid())`; nada em componente. | Postgres |
| BR6 | Valores restritos aos conjuntos aprovados (§6), validados por `CHECK` (servidor) e zod (cliente); multi-selects por subconjunto. | banco + core |
| BR7 | Sem PII sensível nova; características do cabelo = pessoal **não sensível** (LGPD); nada de valores/respostas em logs/analytics. | catálogo + log adapter |

## 8. Final data model (conceitual; sem migration)
```
auth.users
   ↓  user_id (FK, on delete cascade) — ownership only
hair_profiles   (append-only, imutável)
```
`hair_profiles`:
| Coluna | Tipo | Fluxo que usa | Escreve | Lê | Source of truth? | Derivável? |
|---|---|---|---|---|---|---|
| `id` | uuid PK default gen_random_uuid() | identidade do snapshot (downstream) | servidor (default) | app, SPEC-003+ | **sim** (identidade) | não |
| `user_id` | uuid not null, FK `auth.users` on delete cascade | ownership/RLS | app (INSERT, `= auth.uid()`) | app | sim | não |
| `hair_pattern` | text not null, CHECK (§6) | onboarding/diagnóstico | app | app, SPEC-003 | sim | não |
| `strand_thickness` | text not null, CHECK (§6) | idem | app | idem | sim | não |
| `scalp_tendency` | text not null, CHECK (§6) | idem | app | idem | sim | não |
| `wash_frequency` | text not null, CHECK (§6) | idem | app | idem | sim | não |
| `chemical_treatments` | text[] not null default '{}', CHECK (elementos ⊆ §6; `[]` = nenhuma, sem valor `none`) | idem | app | idem | sim | não |
| `heat_usage` | text not null, CHECK (§6) | idem | app | idem | sim | não |
| `current_concerns` | text[] not null, CHECK (`cardinality>=1`; elementos ⊆ §6; **se contém `no_major_concern` então `cardinality=1`**) | idem | app | idem | sim | não |
| `primary_goal` | text not null, CHECK (§6) | idem | app | idem | sim | não |
| `created_at` | timestamptz not null default now() | ordenação/"atual"/histórico | servidor (default) | app | sim | não |

Sem `version`, sem `updated_at`, sem `is_current`, sem `profiles`, sem `extra_attributes`. Índice sugerido: `(user_id, created_at desc)` para o lookup do snapshot atual.

## 9. Snapshot / versioning decision (D-64; amenda D-11)
Necessidade real: **cada avaliação usada pelo produto permanece como snapshot histórico imutável e identificável.** Verificação no repositório: nenhum requisito atual depende de número sequencial (`v1/v2/v3`) — o downstream (`diagnostic_results.hair_profile_id`, DATA-MODEL §3.4; contrato `HairProfileSnapshot`, DOMAIN-MAP §4) referencia por **`hair_profile_id`**, nunca por número. Portanto:
- **REMOVE:** `version int`, trigger de alocação, `MAX(version)+1`, `UNIQUE(user_id, version)`, lógica de concorrência criada só para numerar, advisory lock.
- **Identidade do snapshot:** `hair_profiles.id` (uuid estável) — inforjável, único por padrão, sem trigger.
- **Atual:** o mais recente (`created_at desc, id desc`), determinístico.
- **Rastreabilidade:** downstream referencia o `hair_profile_id` que originou o diagnóstico/cronograma.

**D-11 impact:** D-11 dizia `version` sequencial por trigger com advisory lock. Amendado por **D-64**: *"versioned profile" = snapshots históricos imutáveis identificados por ID estável, não necessariamente por número sequencial.* Sem numeração no MVP. Nenhuma dependência concreta impede a simplificação (verificado). Se um requisito futuro exigir ordinal explícito, ele pode ser derivado por `row_number() over (order by created_at)` na leitura, sem coluna.

## 10. Removed inputs (§ decisão humana)
REMOVE/DEFER, sem criar campo "para depois": `porosity` · `elasticity` · `density` · idade · gênero · comprimento · fotos · marcas de produto/shampoo · salão · data/histórico químico detalhado · classificação 2A–4C (possível refinamento futuro, fora do MVP) · `extra_attributes jsonb`.

## 11. API / Contracts
- **Sem RPC, sem Edge Function, sem DEFINER.** Acesso direto por PostgREST sob RLS (espelha SPEC-001).
- Core `hair-profile` (application): `HairProfileSchema` (zod — enums e subconjuntos de §6), `HairProfilePort { getCurrent(): HairProfile | null; save(input): HairProfile }` (`save` = `INSERT`; `getCurrent` = `SELECT ... ORDER BY created_at DESC, id DESC LIMIT 1`). `HairProfileSnapshot` (tipo em core, com `hair_profile_id`) = contrato Conformist para SPEC-003. Erros → `AppError` da Foundation.

## 12. profiles decision (D-63)
`profiles` **REMOVIDA** da SPEC-002 e não implementada: `profiles`, `ProfilePort`, `onboarding_status`, provisioning, `ensure_my_profile`, trigger de provisionamento em `auth.users`. Ownership parte direto de `auth.users → hair_profiles.user_id`. "Onboarding concluído" = existe um `hair_profile` válido da usuária. `profiles` nasce numa SPEC futura quando houver requisito concreto (ex.: timezone para Schedule na SPEC-004).

## 13. RLS / grants
- `hair_profiles`: `ENABLE` + `FORCE ROW LEVEL SECURITY`; `REVOKE ALL FROM anon, authenticated`; `GRANT SELECT, INSERT TO authenticated` (**sem UPDATE, sem DELETE** — imutável, BR1). Policies `authenticated`: select `USING (user_id = (select auth.uid()))`; insert `WITH CHECK (user_id = (select auth.uid()))`. `anon`: nenhum grant.
- Allowlist de grants (`supabase/security/allowlists.sql`) com referência SPEC-002; sem entradas de DEFINER. Guardrails da Foundation (`tables_without_rls`, `unapproved_grants`, `unapproved_security_definer_functions`) permanecem em zero.

## 14. Security Considerations
Checklist SECURITY-BASELINE §13: RLS ON+FORCE, policy por verbo ✔; `SECURITY DEFINER`=0, RPC=0 ✔; inputs validados zod + CHECK ✔; imutabilidade por ausência de grant UPDATE/DELETE ✔; PII nova = pessoal não sensível, sem tokens/segredos, nada em logs/analytics ✔; pgTAP positivo/negativo ✔; rollback aditivo ✔. **Cliente hostil** (só `anon key` + JWT próprio) não pode: acessar snapshot de terceiros (RLS), forjar `user_id` (policy `with check`), alterar/apagar snapshot (sem grant), inserir valor fora do CHECK, criar coluna não suportada (PostgREST rejeita). Ameaças candidatas: T01/T05/T10 (confirmar T-ids no THREAT-MODEL na revisão).

## 15. UX Notes (sem design visual)
- **Alvo de produto (não requisito arquitetural):** baixa fricção (H1). Os 8 campos **não** implicam 8 telas; a composição visual é de UX. Objetivo: mínima fricção + respostas claras + opção "não sei"/"varia" onde aplicável. Não inventar perguntas para atingir um número.
- Fluxo: Onboarding → confirmação ("perfil salvo") → destino pós-onboarding (placeholder — SPEC-003+).
- Estados: `loading` (checando snapshot atual) · `answering` · `submitting` (botão desabilitado) · `success` · `error` (retry) · `offline`.
- Roteamento: reusa o auth gate da SPEC-001 (`apps/mobile/src/app/index.tsx`), por estado derivado (existe snapshot?); substitui o placeholder pós-auth, não a lógica de auth.
- Acessibilidade: labels, alvo de toque, Dynamic Type, contraste, foco por pergunta.

## 16. Analytics Events
**DEFER (revisão humana 2026-08-27).** Nenhum evento/adapter/no-op é criado nesta SPEC. A conclusão do onboarding é derivável da existência de `hair_profiles`; analytics entra na SPEC-011 (com consentimento). Sem código de analytics sem outro requisito aprovado.

## 17. Edge Cases & Failure Modes
- App fechado no meio: nada persistido (só `INSERT` final); recomeça (coerente com estado derivado).
- Double submit: cada `INSERT` cria uma linha nova imutável (sem numeração, não há colisão de versão); UI desabilita o botão em `submitting` para evitar duplicata acidental; se ocorrer, a "atual" é a mais recente e as demais ficam no histórico (aceitável).
- Valor fora do CHECK apesar do zod: erro genérico, sem detalhe interno; log sem PII.
- Rede cai no save: estado `error` com retry; respostas em memória.

## 18. Acceptance Criteria
| ID | Critério |
|---|---|
| AC1 | Usuária autenticada cria seu próprio snapshot válido (todos os campos de §6 respeitando cardinalidade/enum) e ele fica legível por ela. |
| AC2 | **Isolamento (pgTAP):** A não faz SELECT de snapshots de B; A não faz INSERT com `user_id` de B (rejeitado por `WITH CHECK`); `anon` não acessa `hair_profiles`. |
| AC3 | **Imutabilidade (pgTAP + grants):** o papel do app (`authenticated`) não faz UPDATE nem DELETE de snapshot histórico (sem grant). |
| AC4 | **Histórico:** enviar uma nova avaliação cria uma nova linha e preserva as anteriores inalteradas; o "atual" passa a ser o mais recente (`created_at desc, id desc`). |
| AC5 | **Identidade estável:** cada snapshot é referenciável por `hair_profiles.id`; o `HairProfileSnapshot` exposto ao downstream carrega esse `hair_profile_id`. |
| AC6 | **Validação de domínio (servidor + cliente):** valores fora dos conjuntos aprovados (§6) são rejeitados por CHECK (servidor) e por zod (cliente); multi-selects rejeitam elementos fora do subconjunto. |
| AC7 | **Cliente hostil:** código do cliente não cria campos/valores não suportados (colunas desconhecidas rejeitadas pelo PostgREST; enums inválidos pelo CHECK). |
| AC8 | **Guardrails Foundation verdes:** `tables_without_rls()`=0, `unapproved_grants()`=0 após allowlist, `unapproved_security_definer_functions()`=0, `pnpm verify`. |
| AC9 | `HairProfileSnapshot` é exportado por `packages/core` sem depender de React/Expo/Supabase (dep-cruise verde). |
| AC10 | Nenhum valor de resposta/PII/segredo aparece em logs da aplicação (analytics não é emitido nesta SPEC — §16). |

## 19. Testing Strategy
- **Unit (core `hair-profile`):** `HairProfileSchema` (enums, subconjuntos, "não sei"/"varia"), mapeamento de erros → `AppError`, forma de `HairProfileSnapshot` (com `hair_profile_id`).
- **Integração (Supabase local + pgTAP):** RLS positiva/negativa (A vs B, anon, `WITH CHECK` de `user_id`); imutabilidade (UPDATE/DELETE negados por ausência de grant); CHECK de enums e subconjuntos; "atual" = mais recente; nova avaliação preserva anteriores.
- **Component (Jest + RNTL):** roteamento por estado derivado; estados; botão desabilitado em `submitting`; multi-select com exclusividade de `no_major_concern`.
- **E2E:** onboarding → salvo → reabrir sem repetir (não crítico; ferramenta na fase 10).
- **Manual smoke:** checklist no PR.

## 20. Architecture mechanisms
| Mecanismo | KEEP / REMOVE / DEFER | Motivo |
|---|---|---|
| Tabela `hair_profiles` (append-only) | **KEEP** | insumo do diagnóstico; imutável; caro retrofitar (H) |
| CHECK de enums + `text[]` de subconjunto | **KEEP** | integridade server-side dos inputs aprovados |
| RLS ON+FORCE + grants (SELECT/INSERT) | **KEEP** | isolamento/imutabilidade fail-closed |
| `HairProfilePort` / `HairProfileSchema` / `HairProfileSnapshot` | **KEEP** | contrato mínimo para o app e SPEC-003 |
| Eventos de analytics (tipos/no-op) | **DEFER** | onboarding derivável de `hair_profiles`; sem requisito (SPEC-011) |
| Tabela `profiles` (+ `ProfilePort`, provisioning, `onboarding_status`) | **REMOVE** | onboarding derivado; sem requisito atual (D-63) |
| `version int` + trigger + `MAX+1` + `UNIQUE(user_id,version)` + advisory lock | **REMOVE** | identidade por `id`; nenhum requisito depende de ordinal (D-64) |
| `extra_attributes jsonb` | **REMOVE** | sem escape hatch para futuro |
| RPC / Edge Function / DEFINER / custom claim | **REMOVE** | acesso direto + RLS resolve |
| Nova dependência npm / state manager | **REMOVE (NONE)** | zod já existe; sem necessidade |
| `timezone` / `display_name` / `locale` | **DEFER** | nenhum fluxo desta SPEC os usa (timezone → SPEC-004) |
| classificação 2A–4C, porosity, elasticity, density, etc. | **DEFER/REMOVE** | fora do conjunto aprovado (§10) |

## 21. Dependencies
- SPEC-001 (implemented) — sessão e `auth.uid()`; reusa o auth gate.
- ADR-001/004/006/007-A1/008.
- **Nenhuma dependência npm nova** (zod já presente). Nenhum serviço externo.

## 22. Implementation Plan (fases pequenas — NÃO iniciar; HUMAN GATE)
1. `hair_profiles` (colunas de §6 + CHECK/subconjunto) + RLS/grants + allowlist + pgTAP (AC2–AC4, AC6–AC8).
2. `supabase gen types` → commit `database.types.ts`.
3. Core `hair-profile`: `HairProfileSchema`, `HairProfileSnapshot`, `HairProfilePort`, erros (AC9).
4. Infra mobile: adapter PostgREST do port.
5. UI onboarding (campos aprovados de §6) + confirmação + roteamento por estado derivado.
6. Docs (DATA-MODEL §3.3, DOMAIN-MAP §3.2, matriz RLS, README do contexto) refletindo a remoção de `profiles`/numeração. **Sem analytics** (§16 DEFER).

## 23. Migration / Rollback Plan
Uma migration aditiva (`hair_profiles` + CHECK + RLS/grants), pgTAP e `-- ROLLBACK:` (drop de tabela/policies/grants + remoção das entradas de allowlist). `supabase gen types` commitado. Local → PR → staging (merge) → prod humano. Tabela nasce vazia; rollback não perde dado.

## 24. Open Questions & Gates
| ID | Classe | Pergunta | Assunção |
|---|---|---|---|
| — | **BLOCKING NOW** | nenhuma | — |
| OQ1 | **RESOLVED (2026-08-27)** | `chemical_treatments` `[]` = nenhuma (sem enum `none`); `no_major_concern` exclusivo (`cardinality=1`) validado no cliente e por CHECK | aplicado (§6/§8) |
| OQ2 | **RESOLVED — DEFER (2026-08-27)** | Analytics não entra na SPEC-002 (§16) | — |
| OQ3 | CAN DEFER | Rate limit anti-abuso de criação de snapshots | fora do MVP |
| OQ4 | CAN DEFER | Ferramenta E2E do onboarding | fase 10 (Maestro — D-37) |
| OQ5 | CAN DEFER | Refinamento futuro (2A–4C, porosity) como opcional | fora do MVP (§10) |

## 25. Change Log
| Data | Mudança | Autor |
|---|---|---|
| 2026-08-27 | v0.1 Draft via `spec-create` (incluía `profiles` mínimo, `extra_attributes`, advisory lock, dimensões candidatas). | Claude |
| 2026-08-27 | v0.2 Necessity review: removeu `profiles`/`extra_attributes`; versionamento sem advisory lock; conteúdo de domínio como gate. | Claude |
| 2026-08-27 | v0.3 **Product decisions (humano):** 8 inputs aprovados (§6, D-62); `profiles` removida (D-63); **numeração sequencial removida** — snapshots imutáveis por `id`, atual = mais recente (D-64, **amenda D-11**); removidos porosity/elasticity/density/idade/gênero/comprimento/fotos/marcas/2A–4C/`extra_attributes`; número de perguntas = alvo de UX; ACs finais. Modelo mínimo `auth.users → hair_profiles`. Status → **Ready for Approval**. | Claude |
| 2026-08-27 | v0.4 **APPROVED** (revisão humana): clarificações finais — `chemical_treatments` `[]`=nenhuma sem enum `none`; `no_major_concern` exclusivo (`cardinality=1`) via cliente + CHECK; **analytics DEFER** (nenhum evento/no-op nesta SPEC). OQ1/OQ2 resolvidos. Implementação autorizada (LEVEL 2). | Humano / Claude |
| 2026-08-27 | **IMPLEMENTED** — mergeada em `main` (PR #6) via LEVEL 2 auto-merge; required CI verde (`ci`, `core-deno`, `supabase-test`; pgTAP 020 18/18). `hair_profiles` + RLS/grants + core `hair-profile` + onboarding mobile. Status → **Implemented**. Pendente: sincronizar DATA-MODEL §3.1/§3.3 e DOMAIN-MAP §3.2 (remoção de `profiles`/numeração) numa passada documental. | Claude |
