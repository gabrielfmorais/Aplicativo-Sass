# SPEC-002 — Hair Profile & Onboarding

| Campo | Valor |
|---|---|
| ID | SPEC-002 |
| Status | **Draft** (via `spec-create` 2026-08-27; aguarda revisão humana — HUMAN GATE. Nenhum código, migration, dependência ou seed criado por esta SPEC) |
| Owner | @gabrielfmorais (humano) |
| Bounded Context | Hair Profile (Core) — DOMAIN-MAP §3.2; provisionamento de `profiles` toca Identity & Account §3.1 |
| Related ADRs | ADR-001 (camadas), ADR-004 (Supabase/RLS), ADR-005 (auth — provisionamento de perfil A1/Opção B), ADR-006 (fronteiras), ADR-007 A1 (governança de regras capilares — D-26), ADR-008 (timezone), ADR-010 (analytics) |
| Related SPECs | SPEC-001 (Identity — implemented; entrega `auth.uid()` e sessão) · SPEC-003 (Diagnostic — consome `HairProfileSnapshot`) · SPEC-013 (consentimentos/termos) |
| Decisões vinculantes | D-52 (`profiles` nasce aqui por comando idempotente, sem trigger em `auth.users`), D-11 (`hair_profiles.version` por trigger com advisory lock, INSERT direto), D-26 (engenharia projeta o mecanismo; **não** inventa regra capilar de produção) |
| Fase do roadmap | 2 — Hair Profile + Onboarding |
| Labels | `db`, `security` (toca `supabase/`, RLS, provisionamento de perfil) |
| Criado / Atualizado | 2026-08-27 / 2026-08-27 |

> Princípio (herdado da SPEC-001): **máxima segurança com a mínima complexidade necessária**. Cada mecanismo (tabela / RPC / trigger / Edge Function / dependência / estado / serviço) só existe se responder SIM a pelo menos uma de: (1) funcionalidade central do MVP, (2) segurança/integridade/privacidade, (3) caro/perigoso corrigir depois, (4) valida hipótese central. Caso contrário: **DEFER** ou **REMOVE**. As perguntas/enums concretos do questionário são **hipóteses de engenharia — requerem revisão especializada** (D-26); nada aqui é conhecimento capilar validado.

## 1. Context
SPEC-001 entregou identidade e sessão. O produto ainda não coleta **nada** sobre o cabelo da usuária, e o Diagnostic Engine (SPEC-003) não tem entrada. Esta SPEC captura a representação estruturada do cabelo e hábitos — o insumo de todo o valor do produto. Hipótese central: **H1 (≥ 60% concluem o onboarding)** — o onboarding precisa ser curto (≤ ~8 perguntas, P02: não forçar respostas) e a coleta precisa ser versionada para suportar reavaliação (SPEC-014).

## 2. Problem
Depois de autenticar, a usuária precisa registrar seu cabelo (padrão de curvatura, espessura, porosidade, tratamentos, hábitos, objetivos) de forma rápida, sem fricção, com perguntas que ela consiga responder honestamente (permitindo "não sei"), gerando um perfil **imutável e versionado** que sirva de entrada determinística para o diagnóstico e possa ser refeito no futuro sem apagar o histórico. Não existe ainda uma linha `profiles` para ancorar dados de produto.

## 3. Goals
- G1 A usuária conclui o onboarding e tem exatamente **um** `hair_profile` atual salvo.
- G2 O perfil é **append-only versionado**: refazer cria nova versão; a anterior é preservada (histórico para SPEC-014).
- G3 `profiles` (âncora 1:1 de dados de produto) é provisionado de forma **idempotente** na primeira sessão autenticada, sem trigger em `auth.users` (D-52, ADR-005 A1).
- G4 Isolamento por RLS fail-closed em `profiles` e `hair_profiles`, provado por pgTAP; nenhuma usuária lê/escreve o perfil de outra.
- G5 Enums fechados validados **duas vezes**: zod no cliente e `CHECK`/constraint no banco (defesa em profundidade, ADR-004).
- G6 Permitir "não sei"/desconhecido sem bloquear o avanço (P02).
- G7 Nenhuma regra capilar de produção é inventada por engenharia; o conteúdo do questionário nasce `draft` e requer validação especializada (D-26).

## 4. Non-Goals
- Interpretar o perfil / rodar diagnóstico / gerar plano → **SPEC-003/004**.
- Definir o **conteúdo validado** das perguntas, enums, subtipos e copy do questionário (é hipótese `draft` — validação especializada, fora da engenharia).
- `display_name` (personalização — DEFER; sem necessidade de MVP), `locale` (sempre `pt-BR` — REMOVE), consentimentos/termos (**SPEC-013**).
- Editar campos isolados do perfil (o modelo é versionado: "editar" = nova versão via refazer onboarding; edição granular in-place não entra).
- Fotos, análise por imagem, faixa etária/gênero (DATA-MODEL §3.1 — não coletar no MVP).
- Estado global (Zustand — D-36 DEFER) e qualquer state manager novo.
- Preview do diagnóstico ("este é o seu cabelo") — pertence à saída do engine (SPEC-003+).

## 5. User Stories
- US1 Recém-autenticada, a usuária vê o onboarding e responde ≤ ~8 perguntas simples.
- US2 Em qualquer pergunta que não saiba responder, escolhe "não sei" e segue.
- US3 Ao concluir, o app confirma que o perfil foi salvo e a leva ao próximo passo (sem diagnóstico ainda nesta SPEC).
- US4 Reabrindo o app com onboarding concluído, a usuária **não** repete o onboarding.
- US5 (base para SPEC-014) A usuária pode refazer o onboarding depois; a versão nova passa a ser a atual, a antiga é preservada.

## 6. Functional Requirements
| ID | Requisito |
|---|---|
| FR1 | Após autenticação, se não há `hair_profile` atual, o app roteia para o onboarding; caso contrário, para o destino pós-onboarding (nesta SPEC, um placeholder — SPEC-003+ substitui). |
| FR2 | Provisionamento de `profiles`: na primeira sessão autenticada, `INSERT ... ON CONFLICT (user_id) DO NOTHING` (idempotente) via PostgREST, sob RLS. Sem trigger em `auth.users`, sem RPC (D-52; não adiciona fronteira de segurança). |
| FR3 | O questionário coleta as dimensões do perfil (§7/§8). Toda dimensão aceita valor "desconhecido"/"não sei" quando aplicável (P02). |
| FR4 | Salvar o perfil = **um** `INSERT` em `hair_profiles` (RLS `WITH CHECK user_id = auth.uid()`); o cliente **não** envia `version` (trigger define — D-11). |
| FR5 | Validação: zod no cliente (enums, cardinalidade de sets, `extra_attributes`) **e** `CHECK`/constraints no banco. Entrada inválida é rejeitada nos dois lados. |
| FR6 | "Perfil atual" = maior `version` da usuária (derivado; não armazenar flag `is_current`). |
| FR7 | Todo estado de onboarding dá feedback (loading/erro/offline/sucesso); nenhuma ação sem resposta. Onboarding parcial não persiste linha em `hair_profiles` (só o `INSERT` final atômico). |
| FR8 | Refazer o onboarding cria nova `version`; nenhuma linha anterior é alterada ou apagada. |

## 7. Business Rules
| ID | Regra | Onde vive |
|---|---|---|
| BR1 | `hair_profiles` é **append-only e imutável**: sem UPDATE, sem DELETE pela usuária (só cascade de conta). | `hair_profiles` RLS/grants |
| BR2 | `version` é monotônica e atribuída **pelo servidor** (trigger `BEFORE INSERT` sob `pg_advisory_xact_lock(hashtext(user_id::text))`); valor enviado pelo cliente é ignorado (D-11). | trigger + `UNIQUE (user_id, version)` |
| BR3 | Enums são conjuntos **fechados**, validados por `CHECK`/constraint de subconjunto e espelhados em zod; valores em `snake_case`. | banco + `packages/core/src/hair-profile` (zod) |
| BR4 | `profiles` é 1:1 com `auth.users`, no máximo um por usuária; provisionado idempotente (Opção B), nunca por trigger em `auth.users`. | `profiles` PK + RLS + FR2 |
| BR5 | "Não sei"/desconhecido é um valor de enum de primeira classe onde aplicável; nunca invalida o avanço (P02). | zod + CHECK + UX |
| BR6 | O **conteúdo** do questionário (perguntas, opções, subtipos, copy) é `draft` — hipótese de engenharia que **requer revisão especializada** antes de ser tratada como validada (D-26). Engenharia entrega o **mecanismo**, não a verdade capilar. | SPEC (§8 TODO) + revisão de domínio |
| BR7 | Autorização é exclusivamente RLS/grants/constraints com `(select auth.uid())`; nenhuma regra de ownership em componente. | Postgres |
| BR8 | Nenhuma PII sensível nova; características do cabelo são dado pessoal **não sensível** (LGPD); notas livres (se houver) nunca em logs/analytics. | catálogo + adapter de log |

## 8. Data Model Impact (conceitual; sem migration)

Análise de necessidade por mecanismo (regra §topo). Detalhe de colunas em DATA-MODEL §3.1 e §3.3 — esta SPEC **não** cria migration.

| Mecanismo | (1) MVP | (2) Seg./integr./privac. | (3) Caro depois? | (4) Hipótese central | Decisão |
|---|---|---|---|---|---|
| Tabela `hair_profiles` (versionada, append-only) | **sim** — insumo do diagnóstico | integridade (imutável) | **sim** (H — retrofitar versionamento migra dados) | H1 | **KEEP** |
| Tabela `profiles` (âncora 1:1) | sim — precisa existir para dados de produto (D-52) | ownership | não (L) | — | **KEEP, mínimo** |
| Trigger `hair_profiles` `BEFORE INSERT` (version + advisory lock) | sim | **sim** — invariante de versão no servidor; sem ele o cliente forja versão | sim (integridade de dados) | — | **KEEP** (D-11; `SECURITY INVOKER`) |
| Provisionamento de `profiles` = `INSERT ON CONFLICT DO NOTHING` direto (Opção B) | sim | grants+RLS bastam | não | — | **KEEP** (sem RPC) |
| RPC `ensure_my_profile` / RPC de insert de perfil | — | INVOKER usa perms do caller → **não** adiciona fronteira | — | — | **REMOVE** (acesso direto, espelha D-55/SPEC-001) |
| Trigger em `auth.users` para criar `profiles` | — | pode bloquear signup; DEFINER em schema `auth`; invisível ao app | — | — | **REMOVE** (D-52) |
| Coluna `profiles.onboarding_status` | onboarding concluído já é **derivável** de "existe `hair_profile` atual?" | nenhuma | não | — | **DEFER/DERIVE** — ver OQ1 (só vira coluna se houver onboarding multi-etapa retomável) |
| Coluna `profiles.timezone` | usada por Schedule/Care (SPEC-004/005), **não** pelo onboarding | nenhuma | não (L) | — | **OQ2** — capturar já na Opção B (barato/natural) vs. deferir para SPEC-004 |
| Coluna `profiles.display_name` | personalização, sem uso de MVP | nenhuma | não | — | **DEFER** |
| Coluna `profiles.locale` | sempre `pt-BR` | nenhuma | não | — | **REMOVE** |
| Coluna `hair_profiles.extra_attributes jsonb` | acomoda atributos ainda não promovidos a coluna sem migration | nenhuma | evita migrations futuras | — | **KEEP** (schema zod versionado) |
| Edge Function / Auth hook / custom claim | nada no MVP (sem segredo, sem engine aqui) | — | — | — | **REMOVE** |
| Nova dependência npm | zod já existe (Foundation); sem crypto, sem state manager, sem lib de form | — | — | — | **NONE** |

Colunas de `hair_profiles` (dimensões estáveis, candidatas — DOMAIN-MAP §3.2 / DATA-MODEL §3.3): `curl_pattern`, `strand_thickness`, `porosity`, `scalp_oiliness`, `elasticity`, `wash_frequency`, `heat_usage` (text + CHECK); `chemical_treatments text[]`, `goals text[]` (subconjunto validado); `extra_attributes jsonb default '{}'`; `version int` (trigger); `user_id`, `created_at` (sem `updated_at` — imutável). **O conjunto exato de dimensões, opções e subtipos é TODO/`draft` (§23 OQ3, D-26).**

**Consequência documental:** DATA-MODEL §3.1 já prevê `profiles` criado pela SPEC-002 e §3.3 já descreve `hair_profiles`; esta SPEC, se aprovada, atualiza essas seções (marcar `onboarding_status`/`timezone`/`display_name` conforme decisão de OQ1/OQ2) e a matriz RLS, em commit documental próprio da implementação.

## 9. API / Contracts
- **Sem RPC e sem Edge Function.** Acesso direto por PostgREST sob RLS (espelha SPEC-001 §9/§18).
- Contrato do app (core `hair-profile`, application):
  - `HairProfileSchema` (zod): enums, cardinalidade de `chemical_treatments`/`goals`, forma de `extra_attributes`. Espelha os `CHECK` do banco.
  - `HairProfilePort { getCurrent(): HairProfile | null; save(input): HairProfile }` (implementado em `apps/mobile/src/infrastructure/supabase`; `save` = `INSERT`; `getCurrent` = `SELECT ... ORDER BY version DESC LIMIT 1`).
  - `ProfilePort { ensure(): void }` = `INSERT INTO profiles (user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING`.
  - `HairProfileSnapshot` (tipo em core) = contrato consumido por Diagnostic (SPEC-003; Conformist — DOMAIN-MAP §4). Definido aqui, sem lógica de diagnóstico.
- Erros mapeados para `AppError` da Foundation.

## 10. Authorization
- `profiles`: `enable` + `force row level security`; `revoke all from anon, authenticated`; `grant select, insert, update to authenticated` (UPDATE só se OQ1/OQ2 mantiverem coluna mutável; caso contrário **sem UPDATE**); **sem DELETE** (cascade de conta). Policies `authenticated`: select/insert/update `using`/`with check (user_id = (select auth.uid()))`. `anon`: nada.
- `hair_profiles`: `enable` + `force`; `revoke all from anon, authenticated`; `grant select, insert to authenticated` (**sem UPDATE, sem DELETE** — append-only, BR1). Policies: select `using (user_id = (select auth.uid()))`, insert `with check (user_id = (select auth.uid()))`. `anon`: nada.
- Entradas na allowlist de grants (`supabase/security/allowlists.sql`) com referência SPEC-002; o trigger de versão é `SECURITY INVOKER` (não entra na allowlist de DEFINER). Guardrails da Foundation (`tables_without_rls`, `unapproved_grants`, `unapproved_security_definer_functions`) permanecem em zero.
- Sem entitlements (feature não-premium).

## 11. Security Considerations
Checklist SECURITY-BASELINE §13:
- RLS ON + FORCE nas 2 tabelas, policy por verbo ✔; sem policy = negado ✔.
- `SECURITY DEFINER`: **0**; RPCs: **0** ✔. Trigger de versão é INVOKER ✔.
- Inputs validados: zod (cliente) **e** CHECK/constraints (servidor) ✔.
- Idempotência: provisionamento de `profiles` via `ON CONFLICT DO NOTHING` ✔; `hair_profiles` é append (cada save = nova versão, sem colisão graças ao advisory lock) ✔.
- PII nova: características do cabelo (pessoal, **não** sensível) — sem tokens/segredos; sem PII em logs/analytics ✔.
- Testes RLS positivos e negativos (pgTAP) ✔.
- Rollback: migration aditiva com `-- ROLLBACK:` ✔.

**Cliente hostil:** possui só `anon key` + JWT próprio. Não pode: ler/escrever `profiles`/`hair_profiles` de terceiros (RLS por `auth.uid()`); forjar `version` (trigger ignora valor do cliente); forjar `user_id` (policy `with check`); alterar/apagar um `hair_profile` (sem grant UPDATE/DELETE); inserir enum fora do conjunto (CHECK). Pode: criar muitas versões próprias (custo baixo; se virar abuso, rate limit no release — fora do MVP).

Ameaças do THREAT-MODEL potencialmente afetadas: T01 (isolamento por usuária), T05 (validação de input), T10 (integridade de dados). **TODO:** confirmar os T-ids exatos contra `docs/security/THREAT-MODEL.md` na revisão.

## 12. Privacy Considerations
Dados pessoais novos: características do cabelo e hábitos (`hair_profiles`) — categoria **pessoal não sensível** (LGPD); finalidade: gerar diagnóstico/plano; retenção: até exclusão de conta (cascade). `profiles` mínimo (sem `display_name` no MVP) não adiciona PII relevante. Nada em logs/analytics além de eventos sem propriedades sensíveis (§13). Exportação: coberta pela arquitetura (`user_id` em tudo) — RPC `export_my_data` é pós-MVP (DATA-MODEL §4). Consentimento/termos: **SPEC-013**.

## 13. Analytics Events
Definir os **tipos** no catálogo (core), emitindo para o **adapter no-op** da Foundation (provider real = SPEC-011); catálogo desde o início (MVP-ROADMAP §2):
- `onboarding_started {}`
- `onboarding_completed { question_count }`
- `hair_profile_saved { version }`
Proibido em propriedades: qualquer valor de resposta do questionário, `user_id` cru, notas livres, PII. (Eventos podem ser adiados para SPEC-011; a decisão de emitir agora vs. depois é OQ4.)

## 14. UX Notes (sem design visual)
- Telas: **Onboarding** (sequência de ≤ ~8 perguntas de escolha; "não sei" disponível; barra de progresso) → **confirmação** ("perfil salvo") → destino pós-onboarding (placeholder nesta SPEC).
- Estados: `loading` (checando perfil atual) · `answering` · `submitting` · `success` · `error` (retry) · `offline` (não perde respostas em memória; só o `INSERT` final precisa de rede).
- Roteamento: reusa o gate de auth da SPEC-001 (`apps/mobile/src/app/index.tsx`) — autenticada **sem** perfil atual → onboarding; **com** perfil → placeholder pós-onboarding. Substitui o placeholder de produto pós-auth, não a lógica de auth.
- Acessibilidade: labels em cada opção, alvo de toque adequado, Dynamic Type, contraste; foco anunciado a cada pergunta.

## 15. Edge Cases
- EC1 Perfil parcial + app fechado no meio: nada persistido (só `INSERT` final atômico); ao voltar, onboarding recomeça (sem retomada — a menos que OQ1 introduza `onboarding_status`).
- EC2 Double submit do save: cada `INSERT` cria uma versão; o advisory lock serializa e a versão é monotônica — resultado: no pior caso, duas versões idênticas consecutivas (aceitável; a atual é a maior). Mitigar no cliente desabilitando o botão durante `submitting`.
- EC3 Timezone (se OQ2 mantiver a coluna): capturar IANA do dispositivo; validar como IANA (ADR-008); inválida → default `America/Sao_Paulo`.
- EC4 Enum novo introduzido em versão futura do app contra banco antigo: CHECK rejeita → erro tratado; compatibilidade coberta por migração aditiva + versão de schema zod.
- EC5 `profiles` já existe (retorno de usuária): `ON CONFLICT DO NOTHING` é no-op.
- EC6 Rede cai no save: estado `error` com retry; respostas preservadas em memória.

## 16. Failure Modes
- Falha de rede no `ensure()` de `profiles`: adiar/retry; onboarding pode prosseguir e o `INSERT` de `hair_profiles` (que exige `profiles`? — **decidir FK**: se `hair_profiles.user_id` referencia `auth.users` diretamente, não depende de `profiles`; ver OQ5) valida ownership por `auth.uid()`.
- CHECK/constraint viola no banco apesar do zod: erro genérico, sem detalhe interno; log sem PII.
- Storage/estado indisponível: onboarding é stateless até o save; sem persistência local necessária.

## 17. Acceptance Criteria
| ID | Critério |
|---|---|
| AC1 | Dado uma usuária autenticada sem perfil atual, quando conclui o onboarding, então existe exatamente **1** `hair_profile` com `version = 1` e uma linha `profiles` (idempotente), e nenhuma outra tabela de produto é preenchida. |
| AC2 | Dado uma usuária com perfil atual, quando refaz o onboarding, então uma nova linha com `version = anterior + 1` é criada, a anterior permanece inalterada, e "perfil atual" passa a ser a maior versão. |
| AC3 | Dado um cliente modificado que envia `version` arbitrária, quando insere, então o trigger ignora o valor e atribui `max+1` (verificado por pgTAP). |
| AC4 | Dado usuárias A e B, quando A usa cliente modificado, então A não faz SELECT/INSERT em `profiles`/`hair_profiles` de B, não faz UPDATE/DELETE em `hair_profiles`, e anon não acessa nada (pgTAP + revisão de grants). |
| AC5 | Dado um valor de enum fora do conjunto fechado, quando enviado, então é rejeitado por zod (cliente) **e** por CHECK (servidor) — teste unit + pgTAP. |
| AC6 | Dado qualquer pergunta, quando a usuária escolhe "não sei" onde aplicável, então o avanço não é bloqueado e o valor desconhecido é persistido validamente (P02). |
| AC7 | Dado provisionamento repetido de `profiles`, quando `ensure()` roda 2× (multi-device/retry), então há no máximo 1 linha (`ON CONFLICT DO NOTHING`). |
| AC8 | Nenhum valor de resposta, nota livre ou PII aparece em logs/analytics (teste do redactor + revisão do catálogo). |
| AC9 | Os guardrails da Foundation permanecem verdes com o novo schema: `tables_without_rls()` = 0, `unapproved_grants()` = 0 após allowlist, `unapproved_security_definer_functions()` = 0, `pnpm verify`. |
| AC10 | O `HairProfileSnapshot` (contrato para SPEC-003) é exportado por `packages/core` sem depender de React/Expo/Supabase (dep-cruise verde). |

## 18. Testing Strategy
- **Unit (core `hair-profile`):** `HairProfileSchema` (enums, cardinalidade, "não sei", `extra_attributes`), mapeamento de erros → `AppError`, forma de `HairProfileSnapshot`.
- **Integração (Supabase local + pgTAP):** trigger de versão (monotônica, ignora valor do cliente, advisory lock sob concorrência simulada); RLS positiva/negativa em `profiles` e `hair_profiles` (A vs B, anon, UPDATE/DELETE negados em `hair_profiles`); `ON CONFLICT DO NOTHING` de `profiles`; CHECK de enums/subconjunto.
- **Component (Jest + RNTL):** roteamento onboarding vs. pós-onboarding; estados; "não sei"; desabilitar botão em `submitting`.
- **E2E:** onboarding completo → perfil salvo → reabrir sem repetir (avaliar cobertura; não crítico como auth — decisão de ferramenta na fase 10).
- **Manual smoke:** checklist no PR.

## 19. Dependencies
- SPEC-001 (implemented) — sessão e `auth.uid()`; reusa o auth gate.
- ADR-001/004/005/006/007-A1/008/010.
- **Nenhuma dependência npm nova** (zod já presente na Foundation; sem lib de form, sem state manager, sem crypto).
- Credenciais/serviços externos: nenhum (sem SMTP, sem provider).

## 20. Implementation Plan (fases pequenas; blast radius mínimo)
1. `profiles` mínimo + RLS/grants + allowlist + pgTAP (provisionamento `ON CONFLICT DO NOTHING`). *(colunas conforme OQ1/OQ2 resolvidas)*
2. `hair_profiles` + trigger de versão (advisory lock) + CHECK/constraints + RLS/grants + allowlist + pgTAP.
3. `supabase gen types` → commit `database.types.ts`.
4. Core `hair-profile`: enums, `HairProfileSchema` (zod), `HairProfileSnapshot`, `HairProfilePort`/`ProfilePort`, erros.
5. Infra mobile: adapters PostgREST para os ports.
6. UI: onboarding (perguntas placeholder marcadas `draft` até validação de domínio — D-26), confirmação, roteamento no auth gate.
7. Catálogo de eventos (no-op) + docs (DATA-MODEL §3.1/§3.3, matriz RLS, README do contexto).

> **Bloqueio de conteúdo (D-26):** as fases 6 usa perguntas/enums `draft`; o conjunto validado exige revisão especializada antes do release (não bloqueia a implementação do mecanismo, mas o conteúdo não vai a produção como "validado" sem revisão — OQ3).

## 21. Migration Plan
Migrations aditivas, pequenas, na ordem do §20 (1 para `profiles`, 1 para `hair_profiles` + trigger), cada uma com pgTAP e `-- ROLLBACK:` comentado. `supabase gen types` commitado. Local → PR → staging automático (merge) → prod humano. Sem migração de dados existentes (tabelas novas).

## 22. Rollback Plan
Reverter código pela PR; migration reversível por `-- ROLLBACK:` (drop das tabelas/trigger/policies/grants + remoção das entradas de allowlist). Como as tabelas nascem vazias, rollback não perde dado de produção.

## 23. Open Questions
| ID | Classe | Pergunta | Assunção enquanto aberta |
|---|---|---|---|
| OQ1 | IMPORTANT BEFORE IMPLEMENTATION | `profiles.onboarding_status` como coluna, ou derivar "onboarding concluído" de "existe `hair_profile` atual"? | **derivar** (YAGNI); só criar coluna se houver onboarding multi-etapa retomável |
| OQ2 | IMPORTANT BEFORE IMPLEMENTATION | Capturar `profiles.timezone` já no provisionamento (Opção B), ou deferir para SPEC-004 (Schedule)? | capturar já (barato/natural, IANA do device), com default; reavaliar |
| OQ3 | HUMAN DECISION / DOMAIN REVIEW (D-26) | Conjunto **validado** de perguntas, opções, subtipos de curvatura e copy do questionário | usar hipótese `draft` de engenharia; **não** ir a produção como validada sem revisão especializada |
| OQ4 | CAN DEFER | Emitir os eventos de analytics agora (adapter no-op) ou só na SPEC-011? | definir tipos agora; emissão pode ser adiada |
| OQ5 | IMPORTANT BEFORE IMPLEMENTATION | `hair_profiles.user_id`/`profiles`: FK direta a `auth.users` (padrão DATA-MODEL §1) — confirmar que `hair_profiles` não depende de `profiles` existir (evita acoplamento de ordem no onboarding) | FK a `auth.users`; `profiles` e `hair_profiles` independentes, ambos ancorados em `auth.uid()` |
| OQ6 | CAN DEFER | Limite anti-abuso de versões por usuária (rate) | fora do MVP; endereçar no release se necessário |
| OQ7 | CAN DEFER | Ferramenta E2E para o onboarding | decidir na fase 10 (Maestro candidato — D-37) |

## 24. Change Log
| Data | Mudança | Autor |
|---|---|---|
| 2026-08-27 | v0.1 Draft via `spec-create`. Escopo mínimo (necessidade por mecanismo): `profiles` mínimo (Opção B, sem RPC/trigger em `auth.users`) + `hair_profiles` versionado (trigger D-11) + RLS/grants + core `hair-profile` + onboarding. Conteúdo do questionário marcado `draft`/domínio (D-26). Deferidos: `onboarding_status` (derivar), `display_name`, timezone (OQ), streaks, edição granular, diagnóstico. Aguarda revisão/aprovação humana | Claude |
