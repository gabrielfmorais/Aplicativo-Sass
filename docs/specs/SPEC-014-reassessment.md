# SPEC-014 — Reavaliação: o cabelo mudou, o cronograma acompanha

| Campo | Valor |
| --- | --- |
| ID | SPEC-014 |
| Status | **Implemented** (v0.2, 2026-08-28 — aprovada por **D-77**, sob `CLAUDE.md` §0.2). Evidência em §25. |
| Owner | @gabrielfmorais (humano) |
| Bounded Context | Diagnostic / Schedule (Core) — DOMAIN-MAP §3.3/§3.4 |
| Related ADRs | ADR-007 (engines puros e versionados) · ADR-004 (RLS/RPC) · ADR-001 · ADR-008 |
| Related SPECs | SPEC-002 (perfil append-only) · SPEC-004 (`create_plan_tx` já supersede) · SPEC-005/006 (histórico preservado) · SPEC-008 (`reassessment_due`) · SPEC-009 (resolve OQ-2) |
| Decisões vinculantes | **D-64** (snapshots imutáveis por `id`) · **D-67/D-26** (regras V1 `candidate` — **invocadas, nunca alteradas**) · **D-69** (histórico nunca reescrito) · D-47/D-48 |
| Decisões desta SPEC | **D-77** (fluxo cliente; supersede só na confirmação; total vitalício) — DECISION-REGISTER **B10** |
| Fase do roadmap | 8 — fecha a fase (Progress já entregue na SPEC-009) |
| Labels | `ui` — **sem** `db`, **sem** `security` (nenhuma migration, nenhuma RPC nova) |
| Criado / Atualizado | 2026-08-28 / 2026-08-28 |

> **Escopo:** deixar a usuária responder as perguntas de novo e trocar o cronograma, **sem perder nada** do que já registrou. Nenhuma regra capilar nova; os engines V1 são invocados, não tocados.

---

## 1. Context

O cabelo muda: química, estação, corte, rotina. O plano da SPEC-004 é um retrato de um momento — depois de 28 dias ele pode não descrever mais o cabelo dela, e hoje não existe caminho para atualizá-lo. É o item 11 do escopo do MVP (PRODUCT-BRIEF §9) e o que fecha o **loop mensal** da Fase 8.

**A máquina de servidor já existe inteira.** `hair_profiles` é append-only por `id` (D-64), então um novo snapshot é só mais uma linha; `create_plan_tx` já faz `supersede + insert` atomicamente sob advisory lock (SPEC-004); e a Edge Function `generate-plan` já lê **o snapshot mais recente** por conta própria. Esta fatia é o **caminho do cliente** que liga essas peças — e uma correção honesta no Progress que a existência de planos superseded torna necessária.

## 2. Problem

Reavaliar parece "gerar outro plano" e não é. Três coisas precisam ser verdade ao mesmo tempo:

1. **Nada pode ser perdido.** Execuções e check-ins pertencem aos cuidados do plano antigo. Supersede não apaga nada — mas a tela só lê o plano ativo, então o que ela fez **some de vista** no instante em que o plano novo nasce. Isso é a SPEC-009 OQ-2 disparando: o gatilho que documentei era exatamente "existir plano superseded".
2. **A troca só acontece quando ela confirma.** Salvar respostas novas não pode derrubar o cronograma atual: se ela desistir no meio, o plano de hoje continua valendo.
3. **Nenhuma regra capilar nova.** Reavaliar roda os mesmos engines `candidate` com entrada nova. Se esta fatia inventasse regra, entraria no gate de PUBLIC RELEASE — e não entra.

## 3. Goals

- G1 — Ela reavalia a partir da conta, responde as mesmas perguntas e **vê o cronograma novo antes de trocar**.
- G2 — A troca é **atômica**: ou o plano novo existe e o antigo virou `superseded`, ou nada mudou.
- G3 — Desistir no meio deixa o plano atual **intacto**.
- G4 — O que ela já fez continua contando: o resumo passa a mostrar o total **desde o início**, além do plano atual.
- G5 — Zero migration, zero RPC nova, zero regra de domínio nova.

## 4. Non-Goals

| Fora | Por quê | Onde volta |
| --- | --- | --- |
| Nova versão dos engines | Reavaliar usa os mesmos V1 `candidate` (D-67). Mudar comportamento exigiria **nova versão** (ADR-007) e é outra fatia | quando houver V2 |
| Lembrete `reassessment_due` | O intent existe na ADR-009 mas foi adiado na SPEC-008; agora é **possível**, não obrigatório | fatia própria, com regra de "quando lembrar" |
| Ver o cronograma antigo em detalhe | O total vitalício resolve a perda de vista; navegar planos passados é tela nova sem demanda | quando houver demanda |
| Comparar avaliação antiga vs nova ("o que mudou") | Seria inferência sobre o cabelo dela — território D-26 | com revisor de domínio |
| Editar o perfil no lugar de criar outro | **D-64**: snapshots são imutáveis; editar destruiria a proveniência do plano | nunca |
| Limite de reavaliações / cooldown | Nenhum problema observado; o rate limit da Edge Function (T07) já cobre abuso | se houver abuso real |
| Apagar planos superseded | Histórico é append-only (D-69) | nunca |

## 5. User Stories

- **US1** — Como usuária cujo cabelo mudou, quero responder as perguntas de novo e receber um cronograma novo.
- **US2** — Como usuária, quero **ver** o cronograma novo antes de aceitar trocar o atual.
- **US3** — Como usuária que desistiu no meio, quero meu cronograma atual do jeito que estava.
- **US4** — Como usuária que já fez 12 cuidados, **não** quero que o app me trate como se eu tivesse começado agora.

## 6. Functional Requirements

| ID | Requisito |
| --- | --- |
| FR1 | "Reavaliar meu cabelo" fica na tela **Sua conta**; explica que um cronograma novo substituirá o atual. |
| FR2 | Aceitar abre as **mesmas** perguntas do onboarding (SPEC-002), sem duplicar tela. |
| FR3 | Responder cria um **novo** `hair_profiles` (append-only) — o antigo permanece. |
| FR4 | Em seguida vem o **preview** do cronograma novo, com aviso explícito de que confirmar substitui o plano atual. |
| FR5 | Confirmar chama `generate-plan`, que supersede e cria numa transação só (SPEC-004). |
| FR6 | Cancelar em qualquer ponto volta para os cuidados, com o plano atual **inalterado**. |
| FR7 | O resumo de progresso passa a mostrar **"Desde o início, você concluiu N cuidados"** quando esse total for maior que o do plano atual. |
| FR8 | Retry reusa o mesmo `clientRequestId` — resposta perdida não gera segundo plano nem supersede espúrio (SPEC-004 AC9). |

## 7. Business Rules

| ID | Regra |
| --- | --- |
| BR1 | **Supersede só na confirmação.** Salvar o perfil novo não derruba plano nenhum: quem substitui é `create_plan_tx`, e só quando ela confirma (G3). |
| BR2 | **Perfil órfão é aceitável e honesto.** Se ela abandonar após responder, fica um snapshot sem plano. Isso é o histórico dela (D-64); o plano guarda `hair_profile_id`, então a proveniência de cada plano continua exata. |
| BR3 | **Histórico nunca é reescrito** (D-69). Execuções e check-ins do plano antigo permanecem ligados aos cuidados antigos. Supersede muda `status`, nada mais. |
| BR4 | **Nenhuma regra capilar nova.** Os engines `candidate` são invocados com entrada nova; o gate de PUBLIC RELEASE não se move. |
| BR5 | **Total vitalício conta só execução efetiva** (`voided_at is null`), atravessando planos — mesma definição de "concluído" da SPEC-005, aplicada sem o recorte do plano. |

## 8. Data Model Impact

**Nenhum.** Sem migration, tabela, coluna, índice, policy, grant ou RPC. pgTAP permanece em **161 asserções**.

A única leitura nova é uma **contagem** em `care_executions` — tabela que a usuária já lê sob RLS desde a SPEC-005, com `count: 'exact', head: true`, sem trazer linha nenhuma.

### 8.1 Necessity review

| Item | Requisito atual que exige? | Decisão |
| --- | --- | --- |
| Coluna `superseded_by_plan_id` | Nenhum — já removida na SPEC-004 e nada aqui a pede | **REMOVE** (segue removida) |
| Tabela/entidade "reassessment" | Nenhum — reavaliar **é** um perfil novo + um plano novo, ambos já modelados | **REMOVE** |
| RPC nova | Nenhum — `create_plan_tx` já faz supersede atômico | **REMOVE** |
| Tela nova de perguntas | Nenhum — o `OnboardingScreen` já é exatamente isso | **REMOVE**: reusado |
| Leitura dos planos superseded em detalhe | Nenhum — o total vitalício resolve a perda de vista | **DEFER** |
| Cooldown / limite | Nenhum — rate limit da Edge já existe (T07) | **DEFER** |

## 9. API / Contracts

Nenhum contrato de rede novo. `generate-plan` já lê o snapshot mais recente sozinho, então **nada muda no servidor**.

No core, `buildProgress` ganha o segundo argumento:

```ts
buildProgress(view: TodayView, lifetimeDone: number): Progress   // Progress ganha `lifetimeDone`
```

e `CareBoard` ganha `lifetimeDoneCount`, preenchido pela contagem descrita em §8.

## 10. Authorization

Sem mudança. A contagem nova é `SELECT` sob a policy que já existe (`user_id = auth.uid()`); a criação do plano continua sendo exclusividade de `create_plan_tx` via Edge Function com `service_role`. Cliente adulterado não ganha nada: pedir `generate-plan` já era permitido, e o servidor lê o perfil dela por conta própria.

## 11. Security Considerations

| Item | Situação |
| --- | --- |
| RLS / grants / DEFINER | **Sem mudança**; guardrails seguem em zero |
| Atomicidade | Garantida por `create_plan_tx` (advisory lock por usuária + subtransação) — não por código de cliente |
| Idempotência | `clientRequestId` reusado no retry: resposta perdida não cria segundo plano nem supersede espúrio |
| Trust boundary | O cliente **não** envia perfil nem conteúdo de plano; a Edge lê o snapshot sob a JWT dela |
| Cliente modificado | Pode disparar `generate-plan` repetidamente → rate limit T07; e cada chamada só afeta os próprios dados |
| PII | Nenhuma nova |
| Dependência nova | **Nenhuma** |

## 12. Privacy Considerations

Nenhum dado novo. Um snapshot a mais em `hair_profiles`, do mesmo tipo já coletado na SPEC-002, apagado no cascade da exclusão de conta.

## 13. Analytics Events

**DEFER** → SPEC-011 (D-65).

## 14. UX Notes (sem design visual)

```
Sua conta
  Reavaliar meu cabelo
  "Responda as perguntas de novo para receber um cronograma novo.
   O cronograma atual será substituído; o que você já registrou continua salvo."
  [ Reavaliar ]  [ Agora não ]

→ (mesmas perguntas do onboarding)
→ Preview do cronograma novo
     ⚠ "Confirmar substitui seu cronograma atual. Seu histórico continua salvo."
     [ Confirmar ]  [ Cancelar ]
→ volta para os cuidados, já no plano novo
```

- Reusa `OnboardingScreen` e `PlanScreen` sem duplicar tela nem rota.
- O preview **é** a confirmação: ela vê o que vai receber antes de trocar (US2).
- "o que você já registrou continua salvo" aparece nos dois pontos, porque é a dúvida real.

## 15. Edge Cases

| ID | Caso | Comportamento |
| --- | --- | --- |
| EC1 | Desiste depois de responder | Plano atual intacto; fica um snapshot sem plano (BR2) |
| EC2 | Perde a conexão na confirmação | Retry com a mesma chave: um plano só (FR8) |
| EC3 | Reavalia duas vezes seguidas | Cada confirmação supersede a anterior; a cadeia de planos fica no histórico |
| EC4 | Reavalia com cuidados atrasados no plano antigo | Eles ficam no plano antigo; o cronograma novo começa limpo. Nada é apagado (BR3) |
| EC5 | Execução anulada no plano antigo | Não conta no vitalício (BR5) |
| EC6 | Primeiro plano da vida (sem reavaliação) | `lifetimeDone === done` → a linha do vitalício **não** aparece (FR7) |
| EC7 | Reavalia sem nunca ter concluído nada | Vitalício 0; linha não aparece |
| EC8 | Rate limit da Edge estoura | Erro recuperável, plano atual intacto |

## 16. Failure Modes

| Modo | Tratamento |
| --- | --- |
| Falha ao salvar o perfil | Mensagem do `OnboardingScreen`; nada foi trocado |
| Falha ao gerar | Mensagem do `PlanScreen`; **plano atual intacto** — o supersede só ocorre dentro da transação que cria o novo |
| Falha na contagem vitalícia | A leitura do board falha por inteiro e a tela oferece retry (comportamento da SPEC-005) — melhor que exibir um total silenciosamente errado |

## 17. Acceptance Criteria

| ID | Critério |
| --- | --- |
| AC1 | A conta oferece reavaliar, com o aviso de substituição e de histórico preservado |
| AC2 | Aceitar mostra as mesmas perguntas do onboarding |
| AC3 | Salvar cria snapshot novo e leva ao preview do cronograma novo |
| AC4 | O preview avisa que confirmar substitui o plano atual |
| AC5 | Confirmar chama `generate-plan` **uma** vez e volta para os cuidados |
| AC6 | Cancelar em qualquer ponto volta sem chamar `generate-plan` |
| AC7 | `buildProgress` expõe `lifetimeDone` |
| AC8 | O resumo mostra o total vitalício **apenas** quando é maior que o do plano atual |
| AC9 | Zero mudança em `supabase/**` e em `pnpm-lock.yaml`; pgTAP segue em 161 |
| AC10 | `pnpm verify` verde; `dep-cruise` e `check:boundaries` sem violação |
| AC11 | Docs sincronizadas: DOMAIN-MAP, índice de SPECs, SPEC-009 §8.2 (OQ-2 resolvida) |

## 18. Testing Strategy

| Camada | O que |
| --- | --- |
| Core (Vitest) | AC7 e BR5: `lifetimeDone` propagado; independente do recorte do plano |
| UI (RNTL) | AC1–AC6, AC8: fluxo completo, cancelamento em cada ponto, linha do vitalício condicional |
| Guardrails | `dep-cruise`, `check:boundaries` |

Sem pgTAP: não há SQL. A atomicidade do supersede já é coberta pelo teste 030 da SPEC-004 — reprovar aqui seria duplicar cobertura da mesma transação.

## 19. Dependencies

SPEC-002, SPEC-004, SPEC-005, SPEC-009 (todas `Implemented`). **Nenhuma dependência externa nova.**

## 20. Implementation Plan

1. `feat(progress): carry the lifetime total across plans` — core + adapter + testes.
2. `feat(plan): reassess from the account screen` — fluxo + testes RNTL.
3. `docs(spec-014): sync domain map and evidence`.

## 21. Migration Plan

Nenhuma.

## 22. Rollback Plan

Reverter o merge. Planos já superseded permanecem superseded — o que é o estado correto, já que os planos que os substituíram existem. Nada a desfazer.

## 23. Open Questions

### BLOCKING

**Nenhuma.** Reavaliação está no escopo aprovado do MVP (PRODUCT-BRIEF §9.11); a máquina de servidor já existe; **nenhuma regra capilar nova é criada** — os engines V1 `candidate` são invocados, não alterados, então **D-26 não é acionada e o gate de PUBLIC RELEASE não se move**.

### IMPORTANT

| ID | Questão | Premissa |
| --- | --- | --- |
| OQ-1 | Perfil órfão quando ela desiste | BR2: é o histórico dela, e a proveniência de cada plano segue exata via `hair_profile_id`. Preferível a derrubar o plano antes da confirmação |
| OQ-2 | Total vitalício em vez de navegação por planos passados | §8.1: resolve a perda de vista com uma contagem; navegar planos é tela nova sem demanda |

### CAN DEFER

| ID | Questão | Premissa |
| --- | --- | --- |
| OQ-3 | Intent `reassessment_due` | Agora **possível**; precisa da regra de "quando lembrar", que é decisão de produto própria |
| OQ-4 | "O que mudou" entre avaliações | Seria inferência sobre o cabelo — D-26 |

## 24. Change Log

| Versão | Data | Mudança |
| --- | --- | --- |
| v0.1 | 2026-08-28 | Criada e aprovada sob §0.2 (D-77). Necessity review: zero impacto em banco, nenhuma RPC, nenhuma tela nova — reusa onboarding e preview. Resolve SPEC-009 OQ-2. Zero BLOCKING. |
| v0.2 | 2026-08-28 | **IMPLEMENTED.** Evidência em §25. |

## 25. Implementation evidence

### 25.1 Arquivos

| Arquivo | Papel |
| --- | --- |
| `apps/mobile/src/app/index.tsx` | Reavaliação como **modo** (`profile` → `preview`), não rota nova |
| `apps/mobile/src/features/account/AccountScreen.tsx` | Entrada, com o aviso do que é substituído e do que é preservado |
| `apps/mobile/src/features/plan/PlanScreen.tsx` | `onCancel` opcional: a presença dele é o que faz a tela dizer que está substituindo |
| `packages/core/src/progress/domain/progress.ts` | `Progress.lifetimeDone` |
| `packages/core/src/care-tracking/application/ports.ts` | `CareBoard.lifetimeDoneCount` |
| `apps/mobile/src/infrastructure/supabase/care-tracking-adapter.ts` | Contagem com `head: true` — o número, nenhuma linha |
| `apps/mobile/src/features/care/ProgressSummary.tsx` | "Desde o início…", só quando acrescenta informação |
| `apps/mobile/__tests__/reassessment.test.tsx` | 8 testes de fluxo |

**Zero** alteração em `supabase/**` e em `pnpm-lock.yaml`; pgTAP segue em **161 asserções**.

### 25.2 Validação executada

`pnpm verify` **exit 0** — core **13 arquivos / 141 testes** · mobile **12 suítes / 91 testes** · dep-cruise **117 módulos, 0 violações** · boundaries 8/8 · docs-links 38/38.

### 25.3 Achados da auditoria `improve`

| Severidade | Achado | Correção |
| --- | --- | --- |
| IMPORTANT | A barreira de AC9 da SPEC-009 (proíbe porcentagem/score/tendência/claim de saúde) **nunca exercitava a linha nova**: ela só renderiza quando o vitalício supera o do plano, e nenhum estado do teste satisfazia isso. Uma guarda que pula o texto mais recente não é guarda | Estado adicionado com `lifetimeDone > done` |
| IMPORTANT | O fixture de `HairProfileSnapshot` usava `id` em vez de `hairProfileId` | Corrigido — pego pelo `typecheck` do app |
| IMPORTANT | `exactOptionalPropertyTypes`: passar `undefined` explícito para `onReassess` é erro de tipo | Prop passada por spread condicional |
| IMPORTANT | **Reportado, não corrigido:** `packages/core/tsconfig.json` exclui `*.test.ts` do typecheck. Descobri isso porque minha própria chamada de `buildProgress` com **aridade errada** passou no typecheck e nos testes, afirmando silenciosamente sobre `undefined` | Ver §25.4 |
| OPTIONAL | Perfil órfão quando ela desiste após responder | Não alterado — BR2: é o histórico dela, e a proveniência de cada plano segue exata |

### 25.4 Guardrail reportado (fatia própria)

`packages/core/tsconfig.json` tem `"exclude": ["src/**/*.test.ts"]` **e** `"types": []`. O resultado é que **testes do core não são type-checked**: um teste pode chamar uma API alterada com a assinatura errada, passar, e afirmar sobre `undefined` — exatamente o que aconteceu comigo aqui. Os testes do app **são** checados, e foi o `typecheck` do app que pegou os outros dois achados.

**Não corrigido nesta fatia** porque a correção não é remover o `exclude`: `"types": []` é uma escolha deliberada de isolamento do pacote puro (o build usa `emitDeclarationOnly`), e injetar `vitest/globals` ali enfraqueceria essa fronteira. O caminho certo é um `tsconfig.test.json` separado, ligado ao script `typecheck` — **mudança de configuração compartilhada, portanto fatia própria**, mesmo tratamento dado ao guardrail de `search_path`.
