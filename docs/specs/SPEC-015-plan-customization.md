# SPEC-015 — Plan Customization (primeira capacidade premium)

| Campo | Valor |
|---|---|
| ID | SPEC-015 |
| Status | **Draft** (aguardando aprovação humana; escopo de produto e uma decisão arquitetural em aberto — ver §23) |
| Owner | (humano) — projetopaporeto.erp@gmail.com |
| Bounded Context | Schedule / Planning (DOMAIN-MAP §3.4), gated por Subscription & Entitlements (§3.9) |
| Related ADRs | ADR-007 (versionamento de engine), ADR-011 (Subscription & Entitlements), ADR-001 (arquitetura), ADR-008 (datas) |
| Related SPECs | SPEC-004 (Schedule Engine + generate-plan), SPEC-010 (entitlement `plan_customization` + gate server-side), SPEC-014 (reavaliação/supersede), SPEC-005 (reagendar/pular) |
| Fase do roadmap | 9 (a **primeira capacidade premium** — consome o gate entregue pela SPEC-010 Parte 2; OQ3 resolvida como `plan_customization`, D-79) |
| Criado / Atualizado | 2026-08-30 / 2026-08-30 |

> **Nota do autor (agente, §0.3):** rascunho criado para dar um alvo concreto ao gate server-side `has_entitlement('plan_customization')` que a SPEC-010 já entrega. O **escopo exato da customização é decisão de produto do dono** (§23 OQ1) e **uma das opções exige um ADR** (§23 OQ2 — mutação do agregado `HairPlan`). Nada aqui inventa regra capilar (D-26): a customização proposta mexe em **quando/como os cuidados são colocados**, nunca em **quais cuidados ou com que frequência** (isso é domínio e continua com o engine V1 `candidate`). Seções sem decisão estão marcadas `TODO`.

## 1. Context
Hipótese **H5** (PRODUCT-BRIEF): existe disposição a pagar. A SPEC-010 entregou toda a infraestrutura de Subscription/Entitlement e o gate reutilizável `has_entitlement('plan_customization')` (server-side) + a leitura de entitlements no app (PR-D provider-agnóstico). Falta a **capacidade premium** que o paywall vende e que o gate protege — OQ3 foi resolvida pelo dono como **`plan_customization`** (D-79) por ter o **menor risco de domínio**: não inventa ciência capilar.

Hoje a usuária recebe um cronograma **decidido pelo engine** (SPEC-004) e só pode, no plano corrente, **reagendar/pular cuidados individuais** (SPEC-005, grátis). Não há como moldar *quando* os cuidados caem de forma sistemática.

## 2. Problem
Parte das usuárias tem uma rotina fixa (ex.: "só lavo aos sábados", "prefiro cuidados à noite", "quero começar semana que vem"). Reagendar cuidado por cuidado toda semana é fricção. Uma capacidade premium que deixe a usuária **definir preferências de colocação/horário** e receber um cronograma que as respeite — **sem alterar a cadência clínica** que o engine decide — entrega valor claro e cobrável, e é a prova ponta a ponta da cadeia Subscription → Entitlement → recurso gated.

## 3. Goals
- G1 — Usuária **premium** define preferências de customização do plano; free recebe o padrão do engine.
- G2 — A customização é **gated server-side** por `has_entitlement('plan_customization')` (FR5 da SPEC-010): um cliente adulterado sem entitlement **não** consegue aplicar customização — a verdade é o servidor.
- G3 — **Domínio intocado (D-26):** a customização **não** muda quais cuidados, a frequência, a proporção H/N/R nem qualquer regra do engine. Só influencia **colocação/tempo** (ver OQ1 para o escopo exato).
- G4 — **Imutabilidade preservada:** nenhum plano ativo é editado retroativamente; a customização é aplicada **gerando um novo plano** pelo fluxo de supersede já existente (SPEC-014), ou é um parâmetro da geração — nunca um UPDATE nas linhas de um plano vivo (ver OQ2).
- G5 — Reversível: sem entitlement (expirou), a usuária volta ao padrão do engine na próxima geração; o histórico permanece.

## 4. Non-Goals
- NG1 — **Mudar regra de domínio**: cadência, tipos de cuidado, frequência de lavagem→carga, proporção H/N/R. Isso é o engine (SPEC-004, `candidate`/D-26); fora de escopo e proibido aqui.
- NG2 — **Editar um plano ativo in place** (violaria a invariante de imutabilidade do agregado `HairPlan`, DOMAIN-MAP §3.4). Se o design escolhido exigir isso → **ADR primeiro** (OQ2).
- NG3 — Customização para free. O padrão do engine é o tier grátis.
- NG4 — Múltiplos planos ativos simultâneos; templates compartilháveis; customização por terceiros.
- NG5 — A infraestrutura de billing/paywall/purchase (SPEC-010 Parte 2) e o adapter nativo RevenueCat — pré-requisito, não escopo desta SPEC.

## 5. User Stories
- US1 — Como usuária premium, quero dizer em que **dias da semana** prefiro meus cuidados, para o cronograma caber na minha rotina sem eu reagendar toda semana.
- US2 — Como usuária premium, quero **adiar/antecipar o início** do plano, para alinhá-lo à minha semana. *(candidata; ver OQ1)*
- US3 — Como usuária free, quero entender que a customização é premium e ver o padrão atual, sem bloqueio confuso (leva ao paywall — SPEC-010 §14).
- US4 — Como usuária cujo premium expirou, quero que meu histórico permaneça e o próximo cronograma volte ao padrão, sem perder dados (G5).

## 6. Functional Requirements
- FR1 — Uma tela de preferências de plano, visível a premium; para free, estado bloqueado que leva ao paywall (SPEC-010 §14, `EntitlementService.can('plan_customization', …)` só para UI).
- FR2 — Ao (re)gerar o plano, as preferências da usuária premium são aplicadas na **colocação** dos cuidados (o *quê*/cadência vem do engine, inalterado).
- FR3 — O servidor **revalida** `has_entitlement('plan_customization')` antes de aceitar qualquer customização (FR5/G2). Sem entitlement ⇒ ignora as preferências e gera o padrão (fail closed).
- FR4 — Aplicar customização passa pelo fluxo de **preview + confirmação + supersede** já existente (SPEC-014): a usuária vê o cronograma customizado antes de confirmar; só a confirmação substitui o plano ativo.
- FR5 — TODO: comportamento quando a customização é impossível de satisfazer (ex.: preferiu 1 dia/semana mas a cadência pede 3 cuidados) — ver §15/§23.

## 7. Business Rules
- BR1 — Entitlement é verificado **no servidor** (`has_entitlement('plan_customization')` na Edge `generate-plan`/RPC `create_plan_tx`); `EntitlementService.can` no cliente é só UI (ADR-011/§2). `if (plan === 'premium')` fora do `EntitlementService` é bug.
- BR2 — A customização é **input da geração**, não regra de negócio do engine: vive fora de `packages/core/src/schedule/engine/<versão>/` (que permanece `candidate`, imutável por release). Onde exatamente vive é OQ2 (ex.: um novo parâmetro de placement puro em `packages/core/src/schedule/…` separado do engine de regras).
- BR3 — Preferências **não** são regra capilar: nenhuma preferência muda avaliação, cadência ou tipos (D-26). Mudança de comportamento de *colocação* que dependa de nova lógica no engine de regras exigiria **nova versão de engine** (ADR-007) — evitar; preferir uma camada de placement separada (OQ2).
- BR4 — TODO: precedência entre a customização e um reagendamento manual (SPEC-005) de um cuidado específico.

## 8. Data Model Impact
Atualizar `DATA-MODEL.md`. **Necessidade (YAGNI):** só o mínimo para guardar a preferência da usuária premium.

- **Candidata `public.plan_preferences`** (ou colunas no input de geração) — TODO/OQ2:
  - `user_id uuid` (PK, 1:1), preferências (ex.: `preferred_weekdays int[]`, `preferred_time_of_day text`), `updated_at`.
  - RLS ON+FORCE; SELECT/UPSERT da própria linha por `authenticated` **com `with check`** (é preferência da usuária, não guarda invariante de servidor — padrão `notification_preferences`, SPEC-008), **exceto** que a *aplicação* da preferência é gated server-side na geração (BR1).
  - Alternativa (OQ2): não persistir tabela; passar a preferência como parâmetro do `generate-plan` no momento da (re)geração. Preferir a alternativa mais simples que atenda FR2/FR4.
- Sem migração de dados (contexto novo). Sem PII nova além da preferência.

## 9. API / Contracts
- **Edge `generate-plan`** (SPEC-004) ganha um parâmetro opcional de preferências; **revalida o entitlement server-side** antes de aplicá-las (BR1/FR3). Sem entitlement ⇒ ignora e gera padrão.
- **Camada de placement pura** no core (nome/local = OQ2): `applyPlacement(draft, preferences): HairPlanDraft` — pura, testável, **separada do engine de regras** (não muda cadência).
- Nenhuma escrita nova de cliente em `hair_plans`/`scheduled_cares` (continuam SELECT-only; escrita só por `create_plan_tx` — SPEC-004 §12b).
- zod valida as preferências (cliente **e** servidor).

## 10. Authorization
- `has_entitlement('plan_customization')` (INVOKER, RLS-scoped) checado **server-side** na geração antes de aplicar customização (FR5 da SPEC-010).
- `plan_preferences` (se existir): RLS própria da usuária (SELECT/UPSERT own, `with check`); ler/gravar a *preferência* não concede a *aplicação* — esta é gated na geração.
- Sem novo `SECURITY DEFINER` previsto (a aplicação acontece dentro de `create_plan_tx`, que já é DEFINER e já valida). Confirmar em OQ2.

## 11. Security Considerations
Checklist SECURITY-BASELINE §13 (preencher na implementação):
- Tabela/colunas novas + RLS por verbo: TODO (depende de OQ2).
- Entitlement verificado no servidor: **sim** (BR1/FR3) — ameaça **T04** (flag premium insegura) mitigada.
- Inputs validados nos dois lados (zod + CHECK): sim.
- Cliente adulterado: sem entitlement não aplica customização; com preferências forjadas, o servidor revalida o entitlement e a validade das preferências.
- Sem PII sensível nova; sem segredo. Rate limit: reusa o de `generate-plan` (SPEC-004 §14).

## 12. Privacy Considerations
Preferência de rotina (dias/horário) — dado de baixa sensibilidade, necessário à funcionalidade. Retenção enquanto a conta existir; `on delete cascade`. Fora de logs/analytics com PII.

## 13. Analytics Events
Reusa o funil da SPEC-010 §13 (emissor no app, port no-op até Fase 10). Evento candidato `plan_customized { }` (sem PII) — **TODO/adiado para Fase 10** junto do provider de analytics (D-31/consentimento). Não construir emissor antes disso (evita scaffolding morto — auditoria pré-release).

## 14. UX Notes (sem design visual)
- Tela de preferências: objetivo (moldar quando os cuidados caem), estados loading/erro/sem-entitlement (leva ao paywall), preview do cronograma resultante antes de confirmar (FR4). Acessibilidade: labels, alvos ≥ 44–48px, Dynamic Type.
- Free: estado bloqueado claro (não um erro) que abre o paywall (SPEC-010 §14).
- Pós-expiração: aviso de que a próxima geração volta ao padrão; histórico intacto.

## 15. Edge Cases
- EC1 — Preferência **insatisfazível** pela cadência (ex.: 1 dia/semana vs 3 cuidados): TODO — degradar para o mais próximo possível e avisar, sem quebrar a cadência (nunca reduzir cuidados; isso é domínio).
- EC2 — Entitlement expira entre salvar a preferência e gerar: geração revalida (FR3) e ignora a preferência.
- EC3 — Reagendamento manual (SPEC-005) de um cuidado depois de customizar: preservado (é transição de Care Tracking, não regeneração) — confirmar precedência (BR4).
- EC4 — Multi-device: preferência é server-side; converge.
- EC5 — Relógio/timezone: colocação usa o dia civil do servidor (ADR-008), não o device.

## 16. Failure Modes
- Falha ao ler entitlement na geração: **fail closed** ⇒ trata como free ⇒ gera padrão (nunca aplica premium por erro).
- Falha ao salvar preferência: erro + retry; a preferência anterior permanece.
- Preview indisponível: erro + retry; nada é substituído sem confirmação (FR4).

## 17. Acceptance Criteria
- AC1 — Dada usuária **com** entitlement, quando define preferências e confirma, então o novo plano respeita a colocação preferida **e** mantém a cadência/tipos do engine inalterados. (unit placement + RNTL + verificação de que os `care_type_code`/contagens batem com o engine)
- AC2 — Dada usuária **sem** entitlement, quando tenta aplicar customização (mesmo com cliente adulterado), então o servidor gera o **padrão** e nada premium é aplicado (fail closed). (pgTAP/edge)
- AC3 — Dado premium que **expira**, quando o plano é regerado, então volta ao padrão e o histórico permanece. (RNTL/integration)
- AC4 — Domínio inalterado: para o mesmo perfil, o **conjunto e a contagem** de cuidados gerados são idênticos com e sem customização; só as datas/colocação mudam. (golden/unit)
- AC5 — `EntitlementService.can` no cliente é só UI; boundaries verdes; nenhum `if plan === 'premium'` fora dele. (dep-cruise/lint)
- AC6 — TODO conforme OQ1/OQ2 resolverem o escopo.

## 18. Testing Strategy
- Unit (core): camada de placement pura (determinística; golden com/sem preferência mostrando cadência idêntica).
- Integration (pgTAP/edge): revalidação server-side do entitlement na geração (AC2), fail closed.
- RNTL: tela de preferências (estados, sem-entitlement→paywall, preview→confirmar).
- E2E (Fase 10): jornada premium (depende do purchase flow — gate).

## 19. Dependencies
- **SPEC-010 Parte 2** (gate `has_entitlement('plan_customization')` + leitura de entitlements) — **entregue** (parte provider-agnóstica) / **purchase flow DEFERRED** (dev build + conta RevenueCat). O teste ponta a ponta de "virar premium" depende desse gate ser liberado.
- SPEC-004 (generate-plan/engine) e SPEC-014 (supersede) — reusados.
- Possível **ADR novo** se o design mutar o agregado `HairPlan` (OQ2).
- Sem dependência npm nova prevista.

## 20. Implementation Plan
(Provisório; depende de OQ1/OQ2.)
1. Definir o escopo mínimo de customização (OQ1) e o local da lógica (OQ2) — decisão humana / possível ADR.
2. Core: camada de placement pura + golden tests (cadência idêntica).
3. Servidor: `generate-plan` aceita preferências + revalida entitlement; (se OQ2) tabela `plan_preferences` + RLS + pgTAP.
4. App: tela de preferências + preview/confirm (reusa PlanScreen) + gate de UI via `EntitlementService`.
5. `improve` + testes; PR → CI → merge.

## 21. Migration Plan
Aditiva (se houver tabela). Compatível com app antigo: sem preferência ⇒ padrão do engine (comportamento atual).

## 22. Rollback Plan
Código: reverter PRs. Migration: `drop table plan_preferences` (sem dados de produção antes do release). Feature flag de UI oculta a tela sem afetar geração.

## 23. Open Questions
- **OQ1 — Escopo exato da customização (BLOCKING / decisão de produto do dono).** Qual(is) alavanca(s): (a) dias da semana preferidos; (b) adiar/antecipar início; (c) horário do dia preferido (faz mais sentido em Notifications, SPEC-008?). *Recomendação de engenharia:* começar por **(a) dias da semana preferidos** — maior valor percebido, claramente não-domínio, e aplicável como camada de placement. *Assunção enquanto aberta:* (a).
- **OQ2 — Arquitetura de aplicação (BLOCKING / pode exigir ADR).** Aplicar a preferência como **parâmetro puro na geração** (fit com a arquitetura atual, sem mutar agregado — **preferido**) vs. permitir **edição do plano ativo** (violaria imutabilidade → **ADR obrigatório**, NG2). *Assunção:* parâmetro na geração + fluxo de supersede (SPEC-014); **nenhuma** mutação retroativa.
- **OQ3 — Placement muda o engine? (IMPORTANT / ADR-007).** Se a colocação por dia-da-semana exigir lógica dentro do engine de regras, é **nova versão de engine** (ADR-007). *Assunção:* implementar como **camada separada de placement** (pós-engine), preservando o engine de regras `candidate` intacto — evita mover o gate de PUBLIC RELEASE (D-26).
- **OQ4 — Preferência insatisfazível (IMPORTANT).** Degradação quando a rotina preferida não cabe na cadência (EC1). *Assunção:* aproximar sem nunca reduzir/alterar cuidados; avisar a usuária.
- **OQ5 — Persistência (CAN DEFER).** Tabela `plan_preferences` vs. parâmetro efêmero por geração. *Assunção:* persistir (para reaplicar em reavaliações), tabela mínima estilo `notification_preferences`.

## 24. Change Log
| Data | Mudança | Autor |
|---|---|---|
| 2026-08-30 | Draft inicial: define a primeira capacidade premium (`plan_customization`, D-79/OQ3) consumindo o gate da SPEC-010. Escopo de produto (OQ1) e arquitetura de aplicação (OQ2, possível ADR) deixados como BLOCKING para aprovação humana; domínio (D-26) e imutabilidade do plano explicitamente preservados como Non-Goals. | agente (§0.3) |
