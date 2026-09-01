# SPEC-019 — Visão de ciclo: as quatro semanas dela, depois de começarem

| Campo | Valor |
|---|---|
| ID | SPEC-019 |
| Status | **Draft** |
| Owner | (humano) — projetopaporeto.erp@gmail.com |
| Bounded Context | **Care Tracking** (subdomínio *calendar projection*, DOMAIN-MAP §3.5) |
| Related ADRs | ADR-001 (UI não contém regra), ADR-008 (datas e fuso) |
| Related SPECs | SPEC-004 (o plano), SPEC-005 (execuções e transições), SPEC-009 (Progresso), SPEC-014/D-82 (fim de ciclo), SPEC-016 (design system) |
| Fase | MASTER PRODUCT BACKLOG — **F20**, fechando o item `IN PROGRESS` |
| Criado | 2026-09-01 |

## 1. Context

O MASTER PRODUCT BLUEPRINT §3 descreve `F20` assim: *"Ver o desenho das quatro semanas dela e, ao fim delas, entender o que aconteceu — antes de decidir o próximo ciclo."* Duas partes existem: a **faixa da semana corrente** na Hoje (SPEC-016 fatia 2) e o **preview agrupado por semana** (SPEC-016 fatia 3). Falta a do meio, e é a que dá nome ao item.

Esta SPEC cobre **só** a visão de ciclo. O resumo de fim de ciclo é `F29` e tem SPEC própria.

## 2. Problem

Ela vê o **dia** e, uma única vez, as **quatro semanas** — no preview, antes de confirmar. Depois que o plano é criado, o ciclo desaparece: a Hoje mostra sete dias, "Próximos" mostra uma lista cronológica e o histórico mostra o que passou, mas **nenhuma tela mostra a forma do mês**.

Três consequências concretas:

| Momento | Hoje | Deveria |
|---|---|---|
| No meio do ciclo | "em que semana eu estou?" não tem resposta na tela | a semana corrente marcada entre as quatro |
| Olhando para trás | o que aconteceu na semana 1 exige rolar a lista de histórico | as quatro semanas com o que aconteceu em cada uma |
| Fim do ciclo (D-82) | a oferta de novo ciclo chega sem que ela tenha visto o ciclo que termina | decidir com o mês à vista |

## 3. Goals

- G1 — Do cronograma ativo, ela vê as **quatro semanas** e o que aconteceu em cada uma.
- G2 — Cada cuidado aparece com seu **estado em palavra**: feito, pulado, reagendado, atrasado ou por vir (SPEC-016 FR3).
- G3 — A semana corrente é **reconhecível** sem procurar.
- G4 — Sem dado novo: nenhuma tabela, coluna, RPC ou Edge Function.

## 4. Non-Goals

- **NG1 — Não é o resumo de ciclo (`F29`).** Nada de contagens de fechamento, fração do ciclo, nem oferta do próximo — isso é uma capability própria, e misturá-las aqui adiantaria decisões que dependem de dados de ciclo suficientes.
- **NG2 — Não pontua o ciclo.** Sem nota, sem score, sem percentual, sem barra de "aderência". Blueprint §3 é explícito, e SPEC-009 já pagou esse preço uma vez.
- **NG3 — Não compara com outras pessoas.** Nem "usuárias parecidas", nem média.
- **NG4 — Não sugere mudar o cronograma.** Isso é `P4` (ajuste adaptativo), é Premium e depende de inteligência que ainda não existe.
- **NG5 — Não transita cuidado a partir daqui.** Concluir, pular e reagendar continuam onde estão (SPEC-005). *Ver OQ2.*
- **NG6 — Nenhuma dependência nova** (SPEC-016 NG3 continua).

## 5. User Stories

- Como usuária no meio do ciclo, quero ver as quatro semanas para saber onde estou.
- Como usuária que faltou a alguns cuidados, quero olhar para trás sem me sentir avaliada.
- Como usuária chegando ao fim do ciclo, quero ver o mês antes de decidir o próximo.

## 6. Functional Requirements

- FR1 — A partir da Hoje existe **uma** entrada para a visão de ciclo, e dela se volta para a Hoje.
- FR2 — A visão mostra as **quatro semanas do plano ativo**, na ordem, cada uma com os cuidados planejados para ela.
- FR3 — Cada cuidado mostra o **tipo** (palavra + a marca semântica que a Hoje já usa), a **data** e o **estado em palavra**.
- FR4 — A **semana corrente** é marcada. Se o dia de hoje cair fora das quatro semanas do plano, nenhuma é marcada — e a tela não mente dizendo que ela está em alguma.
- FR5 — Cuidado **reagendado** aparece na semana em que foi planejado **e** na semana para onde foi, sem parecer dois cuidados: o histórico não é reescrito (D-69).
- FR6 — Tudo compõe dos tokens e das primitivas de `apps/mobile/src/design/` (SPEC-016 FR2/AC1).
- FR7 — Estados de carregando, erro com nova tentativa e "ainda não há nada" são explícitos (SPEC-016 FR4).

## 7. Business Rules

- BR1 — A UI não decide nada (ADR-001). O agrupamento por semana e a derivação de estado vivem em `packages/core`.
- BR2 — **Feito, atrasado e semana corrente são derivados**, nunca armazenados (D-69). Não existe coluna de estado.
- BR3 — O dia civil vem do fuso do aparelho, injetado (ADR-008). Nada aqui lê o relógio direto.
- BR4 — **Reagendar não é falha e pular é resultado válido**, não erro. Nenhuma palavra, cor ou ícone pode dizer o contrário (Blueprint §3).
- BR5 — Nenhum texto novo com orientação capilar substantiva (D-26/D-70). Esta tela conta o que ela registrou; não interpreta cabelo.
- BR6 — Nenhuma afirmação factual que os dados não sustentem (SPEC-009 herdada).

## 8. Data Model Impact

**Nenhum.** `hair_plans`, `scheduled_cares` e `care_executions` já contêm tudo (`docs/architecture/DATA-MODEL.md` §3.4–§3.6). Nenhuma tabela, coluna, índice ou constraint. É a definição de projeção de leitura da DOMAIN-MAP §3.5.

## 9. API / Contracts

**Nenhum contrato novo.** O `CareBoard` que a Hoje já carrega (`CareTrackingPort.getBoard()`) traz plano, cuidados e execuções. A visão de ciclo é uma **função pura nova em `packages/core`** sobre esses mesmos dados — nenhum port muda, nenhuma leitura nova é feita.

`TODO` — a assinatura exata (`buildCycleView(...)`) fica para a implementação; o que esta SPEC fixa é que ela é **pura**, recebe o "hoje" como input e não conhece React nem Supabase.

## 10. Authorization

**Nada muda.** A leitura já é a da Hoje, sob as policies de `hair_plans`/`scheduled_cares`/`care_executions` da SPEC-004/SPEC-005. Nenhum grant novo, nenhum `SECURITY DEFINER`, nenhuma RPC.

## 11. Security Considerations

Checklist de `docs/security/SECURITY-BASELINE.md` §13:

- Tabela/coluna nova + RLS: **N/A**.
- Grants: **inalterados**.
- `SECURITY DEFINER`: **nenhum**.
- Entrada externa validada: **N/A** — nenhuma escrita, nenhum parâmetro do cliente.
- Autorização server-side: **inalterada**; a tela não pode ver mais do que a RLS já entrega.
- PII em log/analytics/crash: **nenhuma** (não há analytics, D-31).
- Segredo: **nenhum**.
- Cliente adulterado: não alcança dado alheio — a leitura é a mesma da Hoje, e a RLS decide.

## 12. Privacy Considerations

Nenhum dado novo é coletado, exibido fora do aparelho dela ou emitido. A tela mostra a ela o que ela mesma registrou.

## 13. Analytics Events

**Nenhum** (D-31).

## 14. UX Notes (sem design visual)

- **Uma ideia por tela** (SPEC-018 G4): esta é "o desenho do meu mês".
- A semana corrente é a âncora — a tela deve abrir com ela à vista, não no topo do ciclo.
- Estado sempre em **palavra**, cor só como reforço (SPEC-016).
- Uma semana sem nada registrado não é um vazio culpado: diz o que estava planejado e o que ficou por fazer, sem adjetivo.

`TODO` — a composição concreta (cartões por semana como no preview, ou uma faixa por semana) fica para a implementação, dentro do design system existente.

## 15. Edge Cases

- EC1 — Plano recém-criado, nada registrado: as quatro semanas aparecem inteiras "por vir".
- EC2 — Hoje fora da janela do plano (plano vencido e ainda ativo): nenhuma semana marcada como corrente (FR4).
- EC3 — Cuidado reagendado para dentro do mesmo ciclo: aparece nos dois lugares, com a relação legível (FR5).
- EC4 — Cuidado reagendado para **fora** das quatro semanas: a origem mostra que foi reagendada; o destino não cabe na visão. `TODO` — como dizer isso sem inventar uma quinta semana.
- EC5 — Execução **ad hoc** (sem `scheduled_care_id`, SPEC-005): não pertence a nenhuma linha planejada. `TODO` — mostrar na semana do dia em que aconteceu, ou omitir da visão de ciclo.
- EC6 — Execução anulada (`voided_at`): o cuidado volta a "por vir"/"atrasado" conforme a data (D-12).
- EC7 — Tela pequena (320pt) e fonte grande do sistema: rola, não trunca.
- EC8 — Muitos cuidados numa semana (rotina de lavagem alta): a semana cresce; nada é escondido atrás de um "ver mais" que esconda ação.

## 16. Failure Modes

- A leitura do board falha ⇒ erro explícito com nova tentativa, como a Hoje já faz. Nunca uma tela vazia que parece um ciclo sem cuidados.
- Não há escrita, então não há falha parcial, idempotência nem concorrência a tratar.

## 17. Acceptance Criteria

- AC1 — Da Hoje se chega à visão de ciclo e se volta.
- AC2 — As quatro semanas aparecem com os cuidados de cada uma, na ordem do plano.
- AC3 — Cada cuidado mostra tipo, data e estado **em palavra**.
- AC4 — A semana corrente é marcada; com o dia fora da janela, **nenhuma** é.
- AC5 — Reagendado aparece nas duas semanas sem virar dois cuidados.
- AC6 — Nenhum score, percentual, nota, tendência ou comparação — verificado por barreira de teste, como em SPEC-009.
- AC7 — Nenhum literal de cor ou espaçamento fora de `design/`.
- AC8 — Nenhuma mudança em `supabase/`, em contrato de port ou em `package.json`.
- AC9 — `pnpm verify` verde.
- AC10 — **Validação visual real em viewport mobile (390px)** — testes automatizados não bastam (regra herdada de SPEC-018 AC7 e de D-90).

## 18. Testing Strategy

- **Vitest** sobre a função pura: agrupamento em quatro semanas, semana corrente dentro e fora da janela, reagendado nas duas pontas, execução anulada voltando a pendente, ciclo vazio.
- **Golden fixture** de um ciclo com feito + pulado + reagendado + atrasado + por vir, para que a leitura do ciclo não mude sem alguém notar.
- **RNTL**: navegação de ida e volta, estados de carregando/erro/vazio, e a barreira de AC6 com amostras que **precisam** casar (o erro da SPEC-009: âncoras que nunca casavam davam CI verde e proteção nenhuma).
- **pgTAP**: nada a acrescentar — nenhuma SQL muda.

## 19. Dependencies

**Nenhuma nova.** Design system e primitivas existentes.

## 20. Implementation Plan

1. A função pura em `packages/core` + testes e golden.
2. A tela, a navegação a partir da Hoje e os estados.
3. Validação visual a 390px e fechamento do `F20` no MASTER PRODUCT BACKLOG.

Fatia única se a etapa 1 couber confortavelmente; a decisão fica para a implementação.

## 21. Migration Plan

**N/A** — nenhuma SQL.

## 22. Rollback Plan

Reverter a PR. Nada toca banco, contrato ou autorização.

## 23. Open Questions

- **OQ1 — CAN DEFER — a origem do "ciclo".** O plano tem `startsOn` e a janela de 28 dias do engine v1, mas "quatro semanas" é hoje uma convenção do preview (`groupIntoWeeks`), não um conceito do domínio. *Assunção adotada:* reusar exatamente a mesma regra de agrupamento que o preview já usa, para que o ciclo que ela confirmou e o ciclo que ela revisita sejam o mesmo objeto. *Gatilho para reabrir:* uma versão de engine com janela diferente de 28 dias.
- **OQ2 — IMPORTANT — agir a partir da visão de ciclo.** NG5 diz que não se transita cuidado aqui. É a decisão certa para a primeira versão (a Hoje é o lugar da ação, e duplicar transições multiplicaria caminhos de escrita), mas ver um cuidado atrasado e não poder resolvê-lo dali é atrito real. *Assunção:* somente leitura; tocar num cuidado leva de volta à Hoje se ele for acionável. *Gatilho:* observar o atrito de verdade antes de abrir um segundo caminho de escrita.
- **OQ3 — IMPORTANT — EC5, execução ad hoc.** Ela não pertence ao plano; mostrá-la na semana em que aconteceu conta a verdade do mês, omiti-la mantém a visão fiel ao **plano**. *Assunção:* mostrar, marcada como fora do plano — o objetivo declarado no Blueprint é "o que aconteceu", não "o que foi planejado". Decisão pequena e reversível (§0.2).
- **OQ4 — CAN DEFER — EC4, reagendado para fora da janela.** *Assunção:* a origem diz que foi reagendada e para quando, sem tentar desenhar uma quinta semana.
- **OQ5 — CAN DEFER — ciclos anteriores.** Depois de uma reavaliação o plano antigo fica `superseded` e o histórico continua salvo (SPEC-014 FR7). Ver **ciclos passados** é valor real, mas é `F29`/`P12`. *Assunção:* esta SPEC mostra **o ciclo ativo**.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-01 | v0.1 — Draft criada pela skill `spec-create` para fechar o **F20** do MASTER PRODUCT BACKLOG (D-92), seguindo o Blueprint §3 (D-94). Escopo deliberadamente estreito: a visão do ciclo ativo, sem o resumo de fim de ciclo (`F29`) e sem escrita. Cinco Open Questions, nenhuma BLOCKING. | agente |
