# SPEC-007 — Content v1: como fazer cada cuidado

| Campo | Valor |
| --- | --- |
| ID | SPEC-007 |
| Status | **Approved** (v0.2, 2026-08-28 — **D-72**, sob `CLAUDE.md` §0.2). Implementação autorizada (LEVEL 2). |
| Owner | @gabrielfmorais (humano) |
| Bounded Context | Content (Supporting) — DOMAIN-MAP §3.8 |
| Related ADRs | ADR-001 (camadas) · ADR-006 (fronteiras) · ADR-007 **A1** (governança de conteúdo de domínio — D-26/D-67) · ADR-004 (por que **não** há tabela nesta fatia, §8) |
| Related SPECs | SPEC-004 (define `CareTypeCode`) · SPEC-005 (entrega a tela Hoje onde o conteúdo aparece) · SPEC-006 (Check-ins) · SPEC-009 (Progress) · SPEC-010 (`premium_content`) · SPEC-011 (analytics) |
| Decisões vinculantes | **D-26** (engenharia nunca inventa regra/conteúdo capilar de produção) · **D-67** (precedente `candidate`: implementável em dev/internal beta, PUBLIC RELEASE exige `validated`) · **D-69** (não criar segunda fonte de verdade) · D-47/D-48 (regra de necessidade) · D-25 (sem gamificação) |
| Decisões resolvidas nesta SPEC | **D-70** (autoria: conteúdo V1 nasce `candidate`, aplicando o precedente D-67, e entra em OQ-REL) · **D-71** (conteúdo no bundle, sem tabelas, com gatilho nomeado) · **D-72** (SPEC approved) — todas sob §0.2, registradas em DECISION-REGISTER **B6** |
| Fase do roadmap | 5 — Care Tracking + Content v1 (fecha a Fase 5; SPEC-005 entregou a outra metade) |
| Labels | `ui`, `content` — **sem** `db`, **sem** `security` (nenhuma tabela, policy, grant ou RPC nova) |
| Criado / Atualizado | 2026-08-28 / 2026-08-28 |

> **Escopo desta fatia:** responder, na tela onde a usuária já age, a pergunta que hoje fica sem resposta — **"como eu faço isso?"**. Nada de catálogo comercial, produtos, marcas, CMS, admin, premium, analytics ou IA.
>
> **Regra de necessidade (Ponytail/YAGNI, D-47/D-48):** cada tipo, arquivo, tabela e abstração abaixo existe porque um fluxo **desta** fatia exige. O que não exige está em §4 ou §8 como REMOVE/DEFER, **com o gatilho nomeado para reabrir**.

---

## 1. Context

A SPEC-004 gera o plano. A SPEC-005 tornou o plano acionável: a usuária abre o app e vê `Hidratação · seg, 01/09` com os botões `Fiz hoje / Reagendar / Pular`.

O PRODUCT-BRIEF §9.5 define a tela "Hoje" como **"cuidado do dia, o porquê, como fazer (conteúdo contextual)"**. Entregamos o *cuidado do dia*. O *como fazer* não existe — e o próprio código registra a lacuna:

```ts
// apps/mobile/src/features/plan/copy.ts
// The full content per care type belongs to SPEC-007.
export const CARE_TYPE_LABEL: Record<CareTypeCode, string> = { hydration: 'Hidratação', … };
```

Hoje o app diz **o quê** e **quando**, nunca **como**. Para o público descrito no PRODUCT-BRIEF §2 — "cronograma capilar exige entendimento técnico que a maioria não tem nem quer ter" — a palavra "Reconstrução" sozinha é exatamente o problema que o produto se propôs a resolver, não a solução.

## 2. Problem

Três consequências concretas da lacuna:

1. **O botão principal não é acionável.** `Fiz hoje` pressupõe que a usuária saiba o que fazer. Quem não sabe não clica — ou clica sem ter feito, e o histórico passa a mentir. A qualidade de todo dado de execução da SPEC-005 depende disto.
2. **O valor percebido é o de um calendário.** Um app que só nomeia e agenda é substituível por um lembrete do celular. O diferencial prometido (P05 personalização percebida, P06 baixa carga cognitiva) mora na explicação, não no agendamento.
3. **A usuária sai do app para procurar a resposta** — TikTok, Instagram, creators — que é exatamente a fonte não-estratégica que o PRODUCT-BRIEF §2 identifica como o problema. Cada cuidado sem instrução é uma saída do produto.

Nada disto exige tabela, rede ou infraestrutura nova. Exige texto certo, no lugar certo, sem sair da tela.

## 3. Goals

- G1 — Em cada cuidado da tela Hoje, a usuária consegue abrir **"Como fazer"** e obter: o que aquele cuidado faz no cabelo, os passos em ordem, a duração aproximada e os erros comuns.
- G2 — A informação é **instantânea e offline**: sem carregamento, sem falha de rede, sem estado vazio (§8, §16).
- G3 — O conteúdo é **governado** (D-26): cada texto declara `validationStatus` e `rationaleSource`, e conteúdo não-`validated` não vai a PUBLIC RELEASE.
- G4 — **Zero superfície nova de segurança**: nenhuma tabela, policy, grant, RPC ou Edge Function.
- G5 — A Fase 5 do roadmap fecha; o item 5 do escopo do MVP (PRODUCT-BRIEF §9) fica parcialmente entregue ("como fazer"; "o porquê" em §4/DEFER-3).

## 4. Non-Goals

Explicitamente **fora**, sem exceção nesta fatia:

| Fora | Por quê | Onde volta |
| --- | --- | --- |
| Tabelas `care_types` / `content_articles` | Nenhum consumidor desta fatia precisa de conteúdo editável em runtime (§8) | Gatilho nomeado em §8.2 |
| CMS, admin, editor de conteúdo | ADR-003: admin é pós-MVP | pós-MVP |
| `is_premium` / gating de conteúdo | Monetização é Fase 9 | SPEC-010 |
| Catálogo de produtos, marcas, recomendação comercial | PRODUCT-BRIEF §9 non-goal explícito | fora do MVP |
| Vídeo, imagem, ilustração, design final | Fatia é funcional, não visual | design |
| Markdown/HTML renderer | Conteúdo é estruturado, renderiza com `<Text>` (§9.2) — evita dependência e superfície de injeção | não volta |
| "O porquê" deste cuidado no plano | Requer persistir evidence codes ou re-executar um engine que pode não ser mais a versão do plano (§8.3) | DEFER-3 |
| Analytics (`care_viewed`, `content_opened`) | Precedente D-65: adapter e consentimento são Fase 10 | SPEC-011 |
| Multi-idioma | PRODUCT-BRIEF §9 non-goal (pt-BR apenas) | fora do MVP |
| IA generativa de conteúdo | PRODUCT-BRIEF §9 non-goal; e colidiria frontalmente com D-26 | fora do MVP |
| Conteúdo em telas que não a Hoje (preview do plano, conta) | Sem necessidade demonstrada; a usuária age na Hoje | quando houver |

## 5. User Stories

- **US1** — Como usuária que nunca fez cronograma capilar, quero abrir "Como fazer" no cuidado de hoje e ver os passos, para conseguir executá-lo sem sair do app.
- **US2** — Como usuária, quero saber quanto tempo o cuidado leva **antes** de começar, para decidir se faço agora ou reagendo.
- **US3** — Como usuária, quero saber os erros comuns, para não desperdiçar o cuidado (P05).
- **US4** — Como usuária sem internet no banheiro, quero que a instrução esteja disponível de qualquer forma.
- **US5** — Como revisora de domínio (humana), quero ver todo o conteúdo V1 num único arquivo versionado, com o status de validação declarado, para aprovar ou corrigir num único passe.

## 6. Functional Requirements

| ID | Requisito |
| --- | --- |
| FR1 | Existe exatamente um **guia** por `CareTypeCode` (`hydration`, `nutrition`, `reconstruction`), garantido em **tempo de compilação** por `Record<CareTypeCode, CareGuide>`. |
| FR2 | Cada guia contém: `whatItIs` (1 frase), `steps` (3–6, ordenados), `durationMin` (inteiro > 0), `commonMistakes` (2–3). |
| FR3 | Cada guia declara `validationStatus` (`DomainRuleValidationStatus`, reutilizado do core) e `rationaleSource` (texto ≥ 10 caracteres). |
| FR4 | Na tela Hoje, todo cuidado **acionável** (`planned` ou `overdue`) oferece o controle `Como fazer`, que expande/recolhe o guia in-place. |
| FR5 | O guia expandido mostra: duração aproximada, `whatItIs`, `steps` numerados e `commonMistakes`. |
| FR6 | Abrir/fechar o guia **nunca** dispara escrita, nem altera `busyId`, nem interfere numa transição em andamento (FR-neg: o guia é leitura pura). |
| FR7 | Um cuidado já resolvido (`done` / `skipped` / `rescheduled`) **não** oferece o controle: a instrução deixou de ser acionável e a linha permanece compacta. |
| FR8 | O conteúdo é carregado do bundle da aplicação: disponível offline, sem estado de carregamento e sem falha possível (§16). |

## 7. Business Rules

| ID | Regra |
| --- | --- |
| BR1 | **Conteúdo não é regra de domínio executável.** Nenhum guia influencia assessment, cronograma, datas ou transições. Alterar um texto **nunca** altera o plano de ninguém. |
| BR2 | **D-26 aplica-se ao texto.** Conteúdo instrucional capilar escrito pela engenharia nasce `candidate` com `rationaleSource` = "hipótese de engenharia — requer revisão especializada". Só `validated` pode compor um PUBLIC RELEASE. |
| BR3 | O conteúdo é **descritivo, nunca prescritivo-clínico**: sem marca, sem produto, sem dosagem química, sem promessa de resultado, sem linguagem de diagnóstico ou tratamento médico (mesma restrição de D-26 já aplicada ao copy da avaliação). |
| BR4 | **Uma fonte de verdade** (D-69): `CARE_TYPE_LABEL` (UI, rótulo do código do engine) e `CareGuide` (conteúdo do contexto Content) não se duplicam — o rótulo continua onde está, o guia não o repete. |
| BR5 | O conjunto de `CareTypeCode` é propriedade da SPEC-004. Esta SPEC **consome**, nunca estende. Um novo care type quebra o build até ganhar guia — o que é o comportamento desejado. |

## 8. Data Model Impact

### 8.1 Impacto: **nenhum**

Nenhuma migration. Nenhuma tabela, coluna, índice, policy, grant, trigger ou RPC. `docs/architecture/DATA-MODEL.md` ganha apenas uma nota em §3.9/§3.10 registrando o adiamento e o gatilho.

### 8.2 Necessity review — por que **não** existem `care_types` e `content_articles` nesta fatia

O DATA-MODEL §3.9/§3.10 e o DOMAIN-MAP §3.8 preveem as duas tabelas. Aplicando D-47/D-48 (precedente direto: `diagnostic_results` foi **removido** pela necessity review da SPEC-004 §9, DATA-MODEL §3.4):

| O que a tabela compraria | Existe consumidor nesta fatia? |
| --- | --- |
| Editar conteúdo sem release do app | **Não** — não há CMS nem admin (ADR-003, pós-MVP). Trocar o seed também exige deploy. |
| `is_premium` / entitlement | **Não** — monetização é Fase 9 (SPEC-010). |
| `status` draft/published, `version` | **Não** — não há editor nem fluxo editorial; a revisão de domínio acontece no diff do repositório (US5). |
| FK `scheduled_cares.care_type_code → care_types.code` | **Não** — o conjunto já é garantido por `CHECK` no banco *e* por união de tipos no TypeScript. Uma FK para uma tabela seed de 3 linhas imutáveis não adiciona invariante. |

O que a tabela **custaria** hoje: migration + RLS + policies + grants + entrada na allowlist + pgTAP + port + adapter + estados de loading/erro/vazio/retry na tela — para servir 3 textos estáticos. E pioraria a UX: uma leitura de rede no caminho de "como faço isso agora", falha possível dentro do banheiro sem sinal.

**Decisão proposta:** conteúdo V1 vive no bundle, em `packages/core/src/content/`. **Gatilho nomeado para criar as tabelas** — o primeiro que ocorrer:
1. o conteúdo precisar mudar sem release do app; **ou**
2. gating premium de conteúdo entrar em escopo (SPEC-010); **ou**
3. existir um editor/admin de conteúdo; **ou**
4. um segundo idioma entrar em escopo.

A migração é **aditiva** e barata: `CareGuide` já é o formato de leitura, então a tabela entra por trás de um port sem mexer na tela.

### 8.3 DEFER-3 — "o porquê" na tela Hoje

O PRODUCT-BRIEF §9.5 pede também "o porquê". Os `evidenceCodes` da SPEC-004 **não são persistidos** (`hair_plans` não tem coluna de evidência — DATA-MODEL §3.5, remoções da necessity review). Mostrá-los na Hoje exigiria:

- persistir evidência em `hair_plans` (mudança de schema numa tabela que a SPEC-004 fechou), **ou**
- reexecutar `assessV1` no cliente a partir do `hair_profile_id` — o que produz resultado **errado** quando o plano foi criado por uma versão anterior do engine (`assessment_algorithm_version` existe justamente para registrar isso).

A evidência **já é mostrada uma vez**, na confirmação do plano (SPEC-004, `PlanScreen`). Repeti-la diariamente vale menos que o "como fazer" e traz uma armadilha de correção. **DEFER.** Gatilho: quando a evidência for persistida no plano (candidato natural: SPEC-014 Reassessment, que já mexe em supersessão de planos).

## 9. API / Contracts

Nenhum contrato de rede, RPC, Edge Function ou evento. Somente tipos internos.

### 9.1 Core — `packages/core/src/content/`

```ts
// domain/care-guide.ts
import { z } from 'zod';
// ADR-006 / regra 'core-context-isolation': outro contexto entra SÓ pelo index público.
import { DomainRuleValidationStatus } from '../../shared/index.ts';
import { CARE_TYPE_CODES, type CareTypeCode } from '../../schedule/index.ts';

export const CareGuideSchema = z.object({
  careTypeCode: z.enum(CARE_TYPE_CODES),
  whatItIs: z.string().min(10),
  steps: z.array(z.string().min(3)).min(3).max(6),
  durationMin: z.number().int().positive(),
  commonMistakes: z.array(z.string().min(3)).min(2).max(3),
  /** Governança D-26/ADR-007 A1 — reutiliza o enum já existente para regras. */
  validationStatus: DomainRuleValidationStatus,
  /** Conteúdo escrito pela engenharia DEVE declarar "hipótese de engenharia — requer revisão especializada". */
  rationaleSource: z.string().min(10),
}).strict();

export type CareGuide = z.infer<typeof CareGuideSchema>;

// v1/guides.ts — Record garante exaustividade em tempo de compilação (FR1/BR5)
export const CARE_GUIDES: Record<CareTypeCode, CareGuide> = { /* … */ };
```

`packages/core/src/content/index.ts` passa a exportar os dois; `packages/core/src/index.ts` ganha `export * from './content/index.ts';` (a linha já está prevista pelo stub do contexto).

**Não existe** `assertProductionGuides`: seria uma função sem chamador (o mesmo se aplica a `assertProductionRules`, que já existe e ainda não tem consumidor de produção). A garantia desta fatia é um **teste** (§18), não código de produção especulativo.

### 9.2 UI — `apps/mobile/src/features/care/`

Um componente `CareGuidePanel` (apresentação pura, sem estado próprio além do toggle já existente no `CareRow`) que renderiza o guia com `<Text>`/`<View>`. **Sem** renderer de markdown: o conteúdo é estruturado, o texto é constante do bundle e nada vindo do usuário ou do servidor é renderizado.

## 10. Authorization

Nada a autorizar. O conteúdo:
- não é dado da usuária;
- não é lido do banco;
- é idêntico para todas as usuárias;
- não depende de sessão, entitlement ou papel.

Nenhuma tabela nova ⇒ nenhuma policy, grant ou entrada em `supabase/security/allowlists.sql`. As garantias de RLS existentes (SPEC-001/002/004/005) permanecem **intocadas** — a suíte pgTAP de 115 asserções não muda e continua sendo o gate.

## 11. Security Considerations

Checklist SECURITY-BASELINE §13:

| Item | Situação |
| --- | --- |
| RLS em toda tabela | N/A — nenhuma tabela nova; nenhuma existente é tocada |
| `service_role` | Não usado |
| `SECURITY DEFINER` | Nenhuma função nova |
| Validação de input externo | N/A — não há input externo; o conteúdo é constante do bundle validada por zod em teste |
| Injeção / XSS | Superfície **eliminada por construção**: sem markdown/HTML renderer, sem `dangerouslySetInnerHTML`, sem string interpolada de fonte remota (§9.2) |
| Segredos | Nenhum |
| Cliente modificado | Um cliente adulterado pode alterar o **texto que ele mesmo lê**. Isso não concede privilégio, não altera plano, não altera execução e não afeta outra usuária: o conteúdo não é dado, é apresentação. Nenhuma decisão do servidor depende dele. |
| Dependência nova | **Nenhuma** (`zod` já é dependência do core) |

## 12. Privacy Considerations

Zero impacto LGPD: nenhum dado pessoal é lido, escrito, transmitido ou derivado. Nada é logado. A matriz de dados pessoais (DATA-MODEL §4) não muda.

## 13. Analytics Events

**DEFER** — precedente D-65/SPEC-002 e SPEC-005: o adapter e o consentimento são da Fase 10 (SPEC-011). O evento `content_opened` (e `care_viewed` para H2) entra lá, junto com a base legal (D-32). Emitir para um no-op agora seria código sem consumidor.

## 14. UX Notes (sem design visual)

Reaproveita integralmente a estrutura da `TodayScreen` (SPEC-005 §14) — nenhuma rota nova, nenhum modal, nenhuma navegação.

```
Atrasados
  Hidratação                          seg, 01/09 · atrasada há 1 dia
  [ Fiz hoje ] [ Reagendar ] [ Pular ] [ Como fazer ]
  ┌ (expandido) ─────────────────────────────────────
  │ ~20 min
  │ Devolve água ao fio e melhora o toque no dia a dia.
  │ 1. …   2. …   3. …
  │ Evite: …
  └──────────────────────────────────────────────────

Hoje
  Nutrição                                 sex, 05/09
  [ Fiz hoje ] [ Reagendar ] [ Pular ] [ Como fazer ]

Histórico
  Hidratação   sex, 29/08   Feito          ← sem "Como fazer" (FR7)
```

- O toggle segue o padrão já existente de `Reagendar` (`useState` local no `CareRow`), acessível por `accessibilityRole="button"`, alvo ≥ 44 pt, estado comunicado por `accessibilityState={{ expanded }}`.
- Abrir o guia **não** desabilita as ações e não é bloqueado por `busyId` (FR6) — é leitura.
- Vários guias podem ficar abertos ao mesmo tempo; não há acordeão exclusivo (menos estado, menos surpresa).

## 15. Edge Cases

| ID | Caso | Comportamento |
| --- | --- | --- |
| EC1 | Care type sem guia | **Impossível por construção** (`Record<CareTypeCode, CareGuide>` não compila). Em runtime, se o servidor devolvesse um código desconhecido (hoje impedido pelo `CHECK` do banco), a linha renderiza normalmente **sem** o controle "Como fazer" — nunca quebra a tela. |
| EC2 | Guia aberto e o cuidado é concluído/pulado/reagendado | A linha re-renderiza no estado resolvido e o guia desaparece junto com as ações (FR7). Nenhum estado órfão. |
| EC3 | Guia aberto durante uma ação em andamento (`busyId`) | Continua aberto e legível; a leitura nunca é bloqueada pela escrita (FR6). |
| EC4 | Board recarregado (`onChanged`) com um guia aberto | O `CareRow` é chaveado por `item.id`; o cuidado que continua na lista mantém o guia aberto. Um cuidado que saiu leva seu estado embora. |
| EC5 | App reaberto | Guias começam recolhidos. Persistir "qual guia estava aberto" é estado sem valor — DEFER sem gatilho. |
| EC6 | Sem internet | Guia funciona **integralmente** (G2). É a diferença central em relação à alternativa com tabela (§8.2). |
| EC7 | Fonte grande / acessibilidade | Texto flui em `ScrollView`; nenhuma altura fixa; `steps` é lista real, não texto com quebras manuais. |

## 16. Failure Modes

| Modo | Existe? | Tratamento |
| --- | --- | --- |
| Loading | **Não** | Leitura síncrona do bundle. |
| Erro de rede / retry | **Não** | Não há rede envolvida. |
| Estado vazio | **Não** | Exaustividade garantida no compilador (FR1). |
| Conflito / staleness | **Não** | Conteúdo não tem versão por usuária. |
| Idempotência | **N/A** | Não há escrita. |
| Crash por dado ausente | Mitigado | EC1: ausência degrada para "sem o controle", nunca para exceção. |

> Esta linha de "não existe" é o argumento central de §8.2: a alternativa com tabela **cria** cada um destes modos de falha em troca de flexibilidade que ninguém consome hoje.

## 17. Acceptance Criteria

| ID | Critério |
| --- | --- |
| AC1 | Existe um `CareGuide` para cada um dos 3 `CareTypeCode`; remover um quebra o `typecheck`. |
| AC2 | Todo guia satisfaz `CareGuideSchema` (validado em teste, incl. limites de `steps` e `commonMistakes`). |
| AC3 | Todo guia declara `validationStatus` ∈ {`candidate`, `validated`} e `rationaleSource` não-vazio; guia escrito pela engenharia declara explicitamente "hipótese de engenharia — requer revisão especializada". |
| AC4 | Nenhum guia menciona marca, produto comercial ou dosagem química (BR3), verificado por teste com lista de termos proibidos. |
| AC5 | Na tela Hoje, um cuidado `planned` mostra o controle "Como fazer"; ao acioná-lo, aparecem duração, `whatItIs`, todos os `steps` e todos os `commonMistakes`. |
| AC6 | Acionar novamente recolhe o guia. |
| AC7 | Um cuidado `done`, `skipped` ou `rescheduled` **não** mostra o controle (FR7). |
| AC8 | Abrir/fechar o guia não chama nenhum método de `CareTrackingPort` (verificado com port mockado — FR6). |
| AC9 | Com uma transição em andamento (`busyId` setado), o guia continua abrindo e fechando (FR6/EC3). |
| AC10 | `packages/core` continua sem importar React, Expo, `@supabase/*` ou Deno APIs; `pnpm dep-cruise` e `pnpm check:boundaries` verdes. |
| AC11 | Nenhuma migration, nenhuma alteração em `supabase/`, nenhuma dependência nova: `git diff --stat` não toca `supabase/` nem `pnpm-lock.yaml`. |
| AC12 | A suíte pgTAP permanece em 115 asserções, verde e inalterada. |
| AC13 | `pnpm verify` verde (lint, typecheck, test, dep-cruise, boundaries, docs-links, expo export). |
| AC14 | DATA-MODEL §3.9/§3.10, DOMAIN-MAP §3.8, `packages/core/src/content/README.md` e o índice de SPECs refletem o estado real após a implementação. |

## 18. Testing Strategy

| Camada | O que |
| --- | --- |
| Core (Vitest) | `CareGuideSchema` aceita os 3 guias reais; rejeita `steps` fora de 3–6 e `commonMistakes` fora de 2–3; **governança**: todo guia tem `validationStatus`/`rationaleSource` (AC3) e nenhum viola BR3 (AC4). Exaustividade do `Record` é garantida pelo `typecheck`, não por teste redundante. |
| UI (RNTL) | Cuidado `planned` expõe "Como fazer" (AC5); toggle abre e fecha (AC6); resolvido não expõe (AC7); abrir não chama o port (AC8); abre com `busyId` ativo (AC9). Estende `apps/mobile/__tests__/today-screen.test.tsx` — sem arquivo novo se couber lá. |
| Guardrails | `dep-cruise` + `check:boundaries` já cobrem AC10; `supabase-test` continua provando AC12 sem alteração. |

Sem E2E (jornada não crítica, CLAUDE.md §7). Sem golden fixtures: não há engine.

## 19. Dependencies

- **Bloqueia:** nada. É folha.
- **Depende de:** SPEC-004 (`CareTypeCode`), SPEC-005 (`TodayScreen`, `CareItem.outcome`) — ambas `Implemented` e mergeadas.
- **Dependências externas novas:** **nenhuma**.
- **Não depende** do gate de PUBLIC RELEASE (OQ-REL) para ser implementada; **contribui** para ele (§23 OQ-1).

## 20. Implementation Plan

Uma branch, quatro commits:

1. `feat(content): CareGuide schema and the v1 care guides` — `packages/core/src/content/{domain,v1}`, `index.ts`, export em `packages/core/src/index.ts`, testes de schema e governança.
2. `feat(care): "Como fazer" on the Today screen` — `CareGuidePanel` + toggle no `CareRow`, testes RNTL.
3. `docs(spec-007): sync data model, domain map and context README` — nota de adiamento em DATA-MODEL §3.9/§3.10, DOMAIN-MAP §3.8, README do contexto Content, índice de SPECs.
4. `docs(spec-007): implementation evidence` — §25 (evidência), mesmo padrão de SPEC-004/005.

Estimativa: ~1 dia. É deliberadamente a menor fatia que fecha a Fase 5.

## 21. Migration Plan

Nenhuma. Sem SQL, sem dado a migrar, sem backfill, sem janela.

## 22. Rollback Plan

Reverter o merge. Não há estado persistido, nada a desfazer no banco, nenhum contrato publicado. Risco de rollback: **nulo**.

## 23. Open Questions

### BLOCKING

**Nenhuma em aberto.**

| ID | Questão | Resolução |
| --- | --- | --- |
| ~~OQ-1~~ | Quem escreve o conteúdo V1? D-26 é explícito: engenharia projeta o mecanismo e **nunca inventa regra capilar de produção**. | **RESOLVIDA — D-70** (agente, §0.2). Aplica-se o precedente **D-67** ao texto: a engenharia redige o V1 como `validationStatus: 'candidate'` com `rationaleSource` declarando "hipótese de engenharia — requer revisão especializada", liberado para **dev/internal beta**, e o conteúdo **entra em OQ-REL** — o mesmo sign-off de domínio que já bloqueia o PUBLIC RELEASE das regras V1. **Nenhum gate novo; o gate de PUBLIC RELEASE permanece inalterado.** O conteúdo é procedimental e cosmético e o tempo de pausa **sempre remete à embalagem do produto da usuária**, nunca a um número inventado (BR3, AC4). Se você fornecer os textos, eles nascem `validated` e substituem estes. |

### IMPORTANT

| ID | Questão | Resolução / premissa |
| --- | --- | --- |
| ~~OQ-2~~ | Conteúdo no bundle em vez das tabelas `care_types`/`content_articles` previstas em DATA-MODEL §3.9/§3.10 | **RESOLVIDA — D-71** (agente, §0.2). Adotada a necessity review de §8.2, com precedente direto na SPEC-004 (`diagnostic_results` removido) e **gatilho nomeado** para criar as tabelas. Reversão é aditiva e barata. |
| OQ-3 | "O porquê" na tela Hoje (PRODUCT-BRIEF §9.5) | DEFER-3 (§8.3): a evidência não é persistida e re-derivá-la pode contradizer a versão do engine que gerou o plano. A evidência continua sendo mostrada na confirmação do plano. |

### CAN DEFER

| ID | Questão | Premissa |
| --- | --- | --- |
| OQ-4 | Guia acessível também fora da tela Hoje | Não nesta fatia; sem consumidor. |
| OQ-5 | Lembrar qual guia estava aberto entre sessões | Não (EC5): estado sem valor demonstrado. |
| OQ-6 | Duração do cuidado alimentar o agendamento/notificação | Não. `durationMin` é informativo (BR1). Se a SPEC-008 precisar, ela decide lá. |

## 24. Change Log

| Versão | Data | Mudança |
| --- | --- | --- |
| v0.1 | 2026-08-28 | Draft criado via `spec-create` após a SPEC-005 ser mergeada. Necessity review aplicada: sem tabelas, sem RPC, sem dependência, sem analytics. 1 questão BLOCKING (OQ-1, autoria do conteúdo sob D-26). |
| v0.2 | 2026-08-28 | **APPROVED (D-72)** sob `CLAUDE.md` §0.2. OQ-1 resolvida por **D-70** (conteúdo `candidate`, precedente D-67, entra em OQ-REL) e OQ-2 por **D-71** (bundle, sem tabelas, gatilho nomeado). Escopo, non-goals, data model, segurança e AC **inalterados** em relação ao Draft. Implementação autorizada (LEVEL 2). |
