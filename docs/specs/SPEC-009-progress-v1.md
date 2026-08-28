# SPEC-009 — Progress v1: o que ela já fez, sem inventar nada

| Campo | Valor |
| --- | --- |
| ID | SPEC-009 |
| Status | **Implemented** (v0.2, 2026-08-28 — aprovada por **D-76**, sob `CLAUDE.md` §0.2). Evidência em §25. |
| Owner | @gabrielfmorais (humano) |
| Bounded Context | Progress (Supporting) — DOMAIN-MAP §3.6 |
| Related ADRs | ADR-001 (camadas) · ADR-006 (fronteiras) · ADR-008 (time) |
| Related SPECs | SPEC-005 (execuções) · SPEC-006 (check-ins) · SPEC-004 (plano) · SPEC-010 (insights premium) · SPEC-014 (reavaliação) |
| Decisões vinculantes | **D-26** (não inventar afirmação capilar) · **D-25** (sem streaks) · **D-69** (concluído é derivado) · D-47/D-48 (necessidade) · D-65 (analytics DEFER) |
| Decisões desta SPEC | **D-76** (escopo: 3 fatos derivados, sem persistência, sem tendência) — DECISION-REGISTER **B9** |
| Fase do roadmap | 8 — Progress v1 |
| Labels | `ui` — **sem** `db`, **sem** `security` (zero impacto em banco) |
| Criado / Atualizado | 2026-08-28 / 2026-08-28 |

> **Escopo:** transformar fatos que já existem em informação que ela entende. Nada de score, tendência, gráfico, streak ou qualquer número que não seja aritmética direta sobre o que ela mesma registrou.

---

## 1. Context

O app acumula fatos desde a SPEC-005: cuidados planejados, executados, pulados, reagendados e — desde a SPEC-006 — como ela avaliou cada um. Nada disso volta para ela em forma de resumo. A tela Hoje mostra o presente; ninguém mostra o **acumulado**.

DOMAIN-MAP §3.6 já fixa a forma: cálculo em `core/progress` a partir de Care Tracking, **nada persistido além do que já existe** — sem tabela de estatística desnormalizada.

## 2. Problem

Progresso é a parte mais fácil de fazer errado, e o erro é sempre o mesmo: inventar precisão.

Três armadilhas concretas:

1. **Falsa precisão.** "Você melhorou 23%" a partir de seis respostas de 1 a 5 é ruído apresentado como medida.
2. **Claim causal.** Ligar cuidado a resultado capilar é exatamente o que D-26 proíbe — e aqui seria pior que nas regras do engine, porque viria embrulhado num número.
3. **Número que mente por recorte.** Contar "cuidados concluídos" sem dizer de qual período faz o número despencar quando ela gera um plano novo.

Tudo que esta fatia mostra precisa ser **aritmética direta sobre fato registrado**, com o recorte dito em voz alta.

## 3. Goals

- G1 — Ela vê, num relance, **quantos cuidados já passaram e quantos ela fez**.
- G2 — Ela vê **como tem avaliado** os cuidados, quando já respondeu o suficiente para não ser uma leitura ao acaso.
- G3 — **Zero persistência nova**: tudo derivado de dados que a tela já carrega.
- G4 — Nenhum número apresentado sem o recorte a que se refere.
- G5 — Útil com poucos dados, honesto com nenhum.

## 4. Non-Goals

| Fora | Por quê | Onde volta |
| --- | --- | --- |
| Score de saúde capilar, "% de melhora", claim causal | D-26 e §6 do pedido humano: seria diagnóstico embrulhado em número | nunca nesta forma |
| Tendência / comparação entre períodos | Com ≤ 28 dias e poucos check-ins, a diferença entre duas metades é ruído. Apresentar isso como evolução é a falsa precisão que a fatia existe para evitar | quando houver volume real que torne o recorte significativo (dado de beta) |
| Gráficos, biblioteca de charts | Três fatos em texto não precisam de eixo; uma dependência de charts para isso é infraestrutura de BI numa tela de resumo | quando houver série temporal que exija forma visual |
| Streaks, badges, ranking, gamificação | **D-25** (DEFER) e §10 do pedido humano | se e quando D-25 for reaberta |
| Tabela de estatísticas / view / materialized view | DOMAIN-MAP §3.6: nada persistido. Seria segunda fonte de verdade para um fato já derivável (D-69) | quando derivar ficar caro de verdade |
| ~~Progresso através de planos superseded~~ | **RESOLVIDO na SPEC-014**: reavaliação passou a criar planos superseded — o gatilho documentado disparou —, então o resumo ganhou o total vitalício de execuções efetivas | SPEC-014 FR7 |
| Insights avançados | São premium (DOMAIN-MAP §3.6) | SPEC-010 |
| Analytics | Precedente D-65 | SPEC-011 |
| Tela própria / rota nova | Ela já está na Hoje todo dia; tirá-la de lá para ver um resumo de três linhas reduz a chance de ver | se o resumo crescer |

## 5. User Stories

- **US1** — Como usuária no meio do plano, quero saber quantos cuidados já passaram e quantos eu fiz, para saber se estou acompanhando.
- **US2** — Como usuária que responde os check-ins, quero ver como tenho avaliado, sem que o app conclua nada por mim.
- **US3** — Como usuária que acabou de começar, quero uma tela honesta em vez de um zero que parece fracasso.
- **US4** — Como usuária, **não** quero que o app diga que meu cabelo melhorou X%.

## 6. Functional Requirements

| ID | Requisito |
| --- | --- |
| FR1 | O resumo mostra **quantos cuidados já foram decididos** (feito, pulado ou atrasado) e **quantos foram concluídos**, como fração exata ("3 de 5"), nunca como porcentagem. O texto diz "até aqui", não "que já passaram": um cuidado concluído **adiantado** foi decidido sem que o dia tenha passado. |
| FR2 | Se houver cuidados pulados, mostra quantos. Se não houver, **não** mostra a linha. |
| FR3 | Mostra quantos check-ins ela registrou. |
| FR4 | Mostra a **média** das próprias avaliações **apenas** a partir de `MIN_CHECKINS_FOR_AVERAGE` respostas; abaixo disso, só a contagem. |
| FR5 | Todo texto diz o recorte: **este plano**. |
| FR6 | Sem cuidado passado ainda, mostra estado vazio explicando que o resumo aparece conforme ela registra. |
| FR7 | O resumo é **derivado** do mesmo `TodayView` que a tela já usa — nenhuma leitura nova, nenhum estado próprio. |

## 7. Business Rules

| ID | Regra |
| --- | --- |
| BR1 | **"Já passou"** = cuidado com desfecho `done`, `skipped` ou `overdue`. Cuidado `planned` ainda por vir **não** entra: julgar o futuro como falha seria mentira. |
| BR2 | **Reagendado nunca é contado** — nem como feito, nem como falha. A linha que o substituiu é que conta. Contar os dois seria double counting do mesmo cuidado. |
| BR3 | **Execução anulada não conta** (D-12): o cuidado volta a ser não concluído, e o check-in preso àquela execução também sai do resumo (BR4). |
| BR4 | Só entram check-ins ligados a uma **execução efetiva**. Derivar do `CareItem.checkIn` garante isso por construção, em vez de por filtro paralelo. |
| BR5 | **Nenhum número inferido.** Tudo é contagem ou média aritmética do que ela registrou. Nada de score, projeção, causalidade ou comparação entre períodos. |
| BR6 | A média é **auto-relato**, e o texto diz isso. Não é medida do cabelo; é o que ela respondeu. |
| BR7 | Recorte é sempre **o plano ativo**, dito na tela (G4). |

## 8. Data Model Impact

### 8.1 **Nenhum.**

Sem migration, sem tabela, sem coluna, sem view, sem RPC, sem policy, sem grant, sem dependência. A suíte pgTAP permanece em **161 asserções**, intocada.

### 8.2 Necessity review

| Item | Requisito atual que exige? | Decisão |
| --- | --- | --- |
| Tabela de estatísticas / agregado | Nenhum — três contagens sobre ≤ 28 linhas já carregadas | **REMOVE**. DOMAIN-MAP §3.6 já dizia isso; seria segunda fonte de verdade (D-69) |
| View / materialized view | Nenhum — o cálculo é O(n) sobre dados em memória | **REMOVE** |
| RPC ou Edge Function | Nenhum — nada a proteger que a RLS já não proteja | **REMOVE** |
| Leitura nova (planos superseded) | Nenhum — não existe usuário com plano superseded, e o recorte é dito na tela | **DEFER**. Gatilho: existir plano superseded **e** o total acumulado importar |
| Biblioteca de gráficos | Nenhum — são três frases | **REMOVE** |
| Evento de analytics | Nenhum consumidor (D-65) | **DEFER** → SPEC-011 |

**O que sobra:** uma função pura e um bloco de texto na tela que já existe.

## 9. API / Contracts

Nenhum contrato de rede. Uma função pura em `packages/core/src/progress/`:

```ts
export const MIN_CHECKINS_FOR_AVERAGE = 3;

export type Progress = {
  readonly elapsed: number;   // done + skipped + overdue (BR1)
  readonly done: number;
  readonly skipped: number;
  readonly overdue: number;
  readonly checkInCount: number;
  /** Média das próprias respostas, uma casa decimal. `null` abaixo do mínimo (FR4). */
  readonly averageFeel: number | null;
};

export const buildProgress = (view: TodayView): Progress;
```

Recebe o `TodayView` — o mesmo read model que a tela já derivou — em vez de linhas cruas. Isso não é conveniência: é o que **impede o desfecho de ser calculado duas vezes com regras diferentes** (D-69). Reagendado, anulado e check-in órfão já foram resolvidos lá.

## 10. Authorization

Nada a autorizar: nenhuma tabela nova, nenhuma leitura nova. Os dados já chegam pela RLS da SPEC-005/006. Um cliente adulterado só consegue mentir para si mesmo — o resumo não é escrito, não é enviado e nada no servidor depende dele.

## 11. Security Considerations

| Item | Situação |
| --- | --- |
| RLS / grants / DEFINER | **Sem mudança**; guardrails seguem em zero |
| Trust boundary | Nenhuma escrita, nenhum parâmetro novo |
| Cliente modificado | Só afeta o que ele mesmo exibe |
| PII | Nenhuma nova. Números derivados de dados que ela já vê |
| Dependência nova | **Nenhuma** |

## 12. Privacy Considerations

Zero. Nenhum dado novo é lido, escrito, transmitido ou derivado para fora da tela.

## 13. Analytics Events

**DEFER** → SPEC-011 (D-65).

## 14. UX Notes (sem design visual)

Bloco compacto na `TodayScreen`, **depois** das seções acionáveis e **antes** do histórico — ela resolve o dia primeiro, depois vê o acumulado, e o resumo antecede naturalmente o detalhe.

```
Seu progresso
  Neste plano, você concluiu 3 de 5 cuidados até aqui.
  Pulou 1.
  Você avaliou 4 cuidados · média 4,0 de 5 (sua avaliação).

  (sem dados)
  Seu plano começou agora. O resumo aparece conforme você registra os cuidados.

  (poucos check-ins)
  Você avaliou 2 cuidados.
```

- Três informações no máximo. Sem gráfico, sem porcentagem, sem seta de tendência.
- "sua avaliação" separa **auto-relato** de qualquer inferência (BR6).
- Texto puro: sem loading, sem erro, sem retry próprios — deriva do board que a tela já carregou (FR7).

## 15. Edge Cases

| ID | Caso | Comportamento |
| --- | --- | --- |
| EC1 | Plano recém-criado, nada passou | Estado vazio (FR6); nenhuma fração "0 de 0" |
| EC2 | Cuidado reagendado | Não conta de nenhum lado; a linha substituta conta (BR2) |
| EC3 | Execução anulada | Volta a contar como não concluída; o check-in dela sai do resumo (BR3/BR4) |
| EC4 | Cuidado de hoje ainda não feito | Não é "já passou" — só vira atrasado amanhã (BR1) |
| EC5 | 1 ou 2 check-ins | Mostra a contagem, **não** a média (FR4) |
| EC6 | Todos os check-ins com a mesma nota | Média exata, sem comentário sobre estabilidade |
| EC7 | Plano inteiro concluído | "fez 12 de 12"; nenhuma celebração inventada (sem gamificação) |
| EC8 | Nenhum plano ativo | O bloco não é renderizado — a tela nem existe nesse estado |
| EC9 | Todos pulados | "fez 0 de 5. Pulou 5." — honesto, sem julgamento |

## 16. Failure Modes

Nenhum próprio. Sem rede, sem escrita, sem estado. Falha de leitura do board já é tratada pela SPEC-005; sem board, não há bloco.

Divisão por zero é impossível por construção: a fração só é renderizada quando `elapsed > 0`, e a média só quando `checkInCount >= MIN_CHECKINS_FOR_AVERAGE` (ambos ≥ 1).

## 17. Acceptance Criteria

| ID | Critério |
| --- | --- |
| AC1 | `elapsed` = `done + skipped + overdue`; cuidado `planned` futuro não entra |
| AC2 | Cuidado reagendado não é contado em nenhuma categoria (BR2) |
| AC3 | Execução anulada devolve o cuidado a não concluído e remove o check-in dela do resumo |
| AC4 | `averageFeel` é `null` abaixo de `MIN_CHECKINS_FOR_AVERAGE` e a média exata a partir dele |
| AC5 | `averageFeel` tem no máximo uma casa decimal |
| AC6 | Sem cuidado passado, a UI mostra o estado vazio e **nenhuma** fração |
| AC7 | A linha de pulados só aparece quando há pulados |
| AC8 | A UI diz "neste plano" e rotula a média como auto-relato |
| AC9 | Nenhuma porcentagem, score ou palavra de tendência/melhora aparece na tela — verificado por teste |
| AC10 | Zero mudança em `supabase/**` e em `pnpm-lock.yaml`; pgTAP segue em 161 |
| AC11 | `pnpm verify` verde; `dep-cruise` e `check:boundaries` sem violação |
| AC12 | Docs sincronizadas: DOMAIN-MAP §3.6, README do contexto, índice de SPECs |

## 18. Testing Strategy

| Camada | O que |
| --- | --- |
| Core (Vitest) | AC1–AC5 e EC1–EC9: contagens, reagendado fora, anulada fora, mínimo da média, arredondamento |
| UI (RNTL) | AC6–AC9: estado vazio, fração, pulados condicional, rótulo de auto-relato, **ausência** de porcentagem/score/tendência |
| Guardrails | `dep-cruise`, `check:boundaries` |

Sem pgTAP: não há SQL. Sem golden: não há engine versionado — isto é aritmética, não regra de domínio.

## 19. Dependencies

Depende de SPEC-005 e SPEC-006 (`Implemented`). **Nenhuma dependência externa nova.** Não bloqueia ninguém.

## 20. Implementation Plan

1. `feat(progress): derive the plan summary from the board` — core + testes.
2. `feat(care): "Seu progresso" on the Today screen` — UI + testes RNTL.
3. `docs(spec-009): sync domain map, context README and evidence`.

## 21. Migration Plan

Nenhuma.

## 22. Rollback Plan

Reverter o merge. Nada persistido, nada a desfazer.

## 23. Open Questions

### BLOCKING

**Nenhuma.** Tudo é aritmética sobre fato registrado; nenhuma afirmação capilar é feita, então **D-26 não é acionada**.

### IMPORTANT

| ID | Questão | Premissa |
| --- | --- | --- |
| OQ-1 | Sem tendência/comparação entre períodos | §4: com ≤ 28 dias e poucos check-ins a diferença é ruído. Reabrir com dado de beta |
| ~~OQ-2~~ | Recorte no plano ativo, não vitalício | **RESOLVIDA — SPEC-014.** O gatilho ("existir plano superseded") disparou junto com a reavaliação, e o total vitalício entrou na mesma fatia que criou o problema |
| OQ-3 | `MIN_CHECKINS_FOR_AVERAGE = 3` | Guarda de exibição contra ler uma resposta como padrão — **não** é afirmação estatística, e está documentada como tal |

## 24. Change Log

| Versão | Data | Mudança |
| --- | --- | --- |
| v0.1 | 2026-08-28 | Criada e aprovada sob §0.2 (D-76). Necessity review: zero impacto em banco, sem gráficos, sem tendência, sem streak, sem tela nova. Zero BLOCKING. |
| v0.2 | 2026-08-28 | **IMPLEMENTED.** Evidência em §25. |

## 25. Implementation evidence

### 25.1 Arquivos

| Arquivo | Papel |
| --- | --- |
| `packages/core/src/progress/domain/progress.ts` | `buildProgress(view)` puro + `MIN_CHECKINS_FOR_AVERAGE` |
| `packages/core/src/progress/progress.test.ts` | 14 testes: contagens, reagendado, anulada, mínimo da média, arredondamento, extremos |
| `apps/mobile/src/features/care/ProgressSummary.tsx` | Três frases, sem gráfico e sem porcentagem |
| `apps/mobile/__tests__/progress-summary.test.tsx` | Estados + a barreira de AC9 |
| `apps/mobile/src/features/care/TodayScreen.tsx` | Bloco entre as ações e o histórico |

**Zero** alteração em `supabase/**` e em `pnpm-lock.yaml`; pgTAP segue em **161 asserções**.

### 25.2 Validação executada

`pnpm verify` **exit 0** — core **13 arquivos / 139 testes** · mobile **11 suítes / 80 testes** · dep-cruise 0 violações · boundaries 8/8.

### 25.3 Achados da auditoria `improve`

| Severidade | Achado | Correção |
| --- | --- | --- |
| IMPORTANT | Copy enganosa: "cuidados **que já passaram**" é falso para um cuidado concluído **adiantado** — ele foi decidido, mas o dia não passou. A aritmética estava certa; a frase não | "concluiu X de Y cuidados **até aqui**" |
| IMPORTANT | O helper do teste de AC9 devolvia `''` quando `screen.root` era falso: um render quebrado faria **todas** as asserções "não contém X" passarem por vazio | O helper agora afirma que o bloco realmente renderizou antes de devolver o texto |
| IMPORTANT | `buildProgress` rodava a cada render, fora do `useMemo` que já existia para o `view` | Movido para um `useMemo` derivado de `view` |
| OPTIONAL | Recorte no plano ativo faz o acumulado "reiniciar" quando um plano é gerado de novo | Não alterado — o recorte é dito na tela ("Neste plano"), então o número não mente; gatilho para reabrir em §8.2 |

### 25.4 Verificações de segurança de produto

Sem porcentagem · sem score · sem palavra de tendência/melhora/saúde · sem claim causal — **quatro padrões proibidos, cada um com uma amostra que precisa casar**, para que a barreira falhe alto se alguém reintroduzir. Média rotulada como "sua avaliação" (auto-relato) e retida abaixo de 3 respostas. Divisão por zero impossível por construção.
