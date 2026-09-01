# SPEC-021 — Resumo de ciclo: o mês contado por ela mesma

| Campo | Valor |
|---|---|
| ID | SPEC-021 |
| Status | **IMPLEMENTADA** (agente, §0.2/§0.4 — capability COMMITTED do MASTER PRODUCT SCOPE; aguarda ratificação humana). Validada a 390px no DEV real. |
| Owner | (humano) — projetopaporeto.erp@gmail.com |
| Bounded Context | **Progress** (DOMAIN-MAP §3.6), lido na visão de ciclo |
| Related ADRs | ADR-001 (UI não contém regra), ADR-006 (isolamento entre contextos), ADR-008 (datas) |
| Related SPECs | SPEC-019 (a visão de ciclo, que isto completa), SPEC-009 (Progress v1), SPEC-014/D-82 (o próximo ciclo), SPEC-005 (o que ela registrou) |
| Fase | MASTER PRODUCT BACKLOG — **F29** |
| Criado | 2026-09-01 |

## 1. Context

A SPEC-019 entregou a forma do mês e disse, em NG1, que o resumo ficava de fora: *"depende de dados de ciclo suficientes"*. Os dados existem desde a SPEC-005; o que faltava era a **visão de ciclo** onde o resumo pertence. Ela chegou, e o Blueprint §3 fecha assim: *"Ao fim do ciclo, o resumo conta o mês em números que ela mesma produziu, e oferece o próximo."*

## 2. Problem

Ela chega ao fim de quatro semanas e o produto não fecha nada. A Hoje diz *"Seu cronograma chegou ao fim"* e oferece o próximo — sem nunca dizer o que aconteceu no que terminou. O `ProgressSummary` (SPEC-009) tem os números, mas vive no meio da rolagem da Hoje, entre cuidados e histórico, onde ninguém lê um mês.

| Momento | Hoje | Deveria |
|---|---|---|
| Fim do ciclo | oferta do próximo, sem retrospecto | o mês fechado, e então a oferta |
| Meio do ciclo | números soltos no meio da Hoje | o mesmo mês, na tela que fala de mês |

## 3. Goals

- G1 — Na visão de ciclo, ela vê **o que aconteceu neste ciclo**, em contagens que ela mesma produziu.
- G2 — Ao fim do ciclo, o resumo **fecha** o mês e leva à oferta do próximo, que já existe (D-82).
- G3 — Nenhum dado novo, nenhuma segunda contagem: os mesmos números do `Progress`.

## 4. Non-Goals

- **NG1 — Não pontua.** Sem nota, score, percentual, barra de aderência ou "você cumpriu X%". Herdado de SPEC-009 e SPEC-019, e a razão é a mesma: um percentual sobre uma amostra desta não significa nada, e lido como avaliação faz dano.
- **NG2 — Não compara.** Nem com outras pessoas, nem com ciclos anteriores. Comparar entre ciclos é `P12`, é Premium, e exige mais de um ciclo fechado.
- **NG3 — Não sugere mudar o cronograma** (`P4`).
- **NG4 — Não interpreta.** Nenhuma frase sobre o que os números significam para o cabelo dela — isso é conteúdo capilar substantivo (D-26/D-70).
- **NG5 — Não parabeniza nem cobra.** "Parabéns" e "você faltou" são as duas faces do mesmo erro: transformar registro em julgamento.
- **NG6 — Nenhuma tabela, coluna, RPC ou dependência nova.**

## 5. User Stories

- Como usuária no fim do ciclo, quero ver o que fiz nestas quatro semanas antes de decidir o próximo.
- Como usuária que pulou vários cuidados, quero ler isso sem me sentir avaliada.
- Como usuária de um ciclo recém-criado, quero entender que o resumo aparece conforme eu registro.

## 6. Functional Requirements

- FR1 — A visão de ciclo mostra um resumo **deste ciclo**: quantos cuidados ele tem, quantos ela concluiu, quantos pulou, quantos ainda estão em aberto e quantos ela avaliou.
- FR2 — Tudo é **contagem**. Nenhum percentual, nenhuma média sobre amostra pequena — a média das avaliações só aparece com o mínimo que a SPEC-009 já fixou.
- FR3 — Com o ciclo **em andamento**, o resumo diz que ainda está acontecendo; **terminado**, diz que terminou e leva à oferta do próximo.
- FR4 — Ciclo sem nada registrado: o resumo diz que aparece conforme ela registra, como a tela de Progresso já faz.
- FR5 — Reagendado **não conta** como cuidado à parte: a linha que o substituiu é a que vale (SPEC-009 BR2).

## 7. Business Rules

- BR1 — Os números vêm do **mesmo** read model do `Progress` (`buildProgress`). Uma segunda contagem sobre os mesmos desfechos divergiria da primeira no dia em que qualquer regra mudasse.
- BR2 — Pular é desfecho válido e reagendar não é falha (SPEC-019 BR4). Nenhuma palavra, cor ou ícone diz o contrário.
- BR3 — Nada é inferido, projetado ou comparado entre períodos (SPEC-009 BR5 herdada).
- BR4 — "Terminado" é **derivado**, nunca armazenado (D-69), e tem **duas** entradas: a data de fim **ou** não ter sobrado nada. A segunda existe porque a Hoje já trata "não sobrou nada" como fim e oferece o próximo (D-82) — marcar só pela data faria as duas telas discordarem sobre o mesmo fato no mesmo dia.

## 8. Data Model Impact

**Nenhum.** Duas contagens novas — `planned` e `total` — entram no tipo `Progress`, que já é derivado do `TodayView`. Nenhuma linha, coluna ou índice.

## 9. API / Contracts

**Nenhum port muda.** `Progress` ganha dois campos derivados no mesmo laço que já existe:

```ts
readonly planned: number; // ainda por vir — o futuro, que não é falha nem acerto
readonly total: number;   // elapsed + planned; reagendado continua fora (BR5)
```

## 10. Authorization

**Nada muda.** Nenhuma leitura nova.

## 11. Security Considerations

N/A em todos os itens do checklist: sem tabela, sem grant, sem `SECURITY DEFINER`, sem entrada externa, sem PII nova, sem segredo. A tela não pode ver mais do que a RLS já entrega à Hoje.

## 12. Privacy Considerations

Nenhum dado novo. A tela mostra a ela o que ela mesma registrou.

## 13. Analytics Events

**Nenhum** (D-31).

## 14. UX Notes (sem design visual)

- O resumo é **uma frase por fato**, no mesmo registro do `ProgressSummary`: sujeito, verbo, número.
- No fim do ciclo ele **abre** a tela; em andamento, fecha.
- Sem ícone de troféu, sem cor de alerta, sem adjetivo.

## 15. Edge Cases

- EC1 — Ciclo recém-criado: nada elapsed, e o resumo diz isso sem parecer vazio por falha.
- EC2 — Tudo pulado: as contagens dizem o que houve, sem uma palavra de reprovação.
- EC3 — Zero avaliações: a linha de avaliação some, em vez de mostrar "0 avaliados".
- EC4 — Uma ou duas avaliações: contagem sim, média não (SPEC-009 FR4).
- EC5 — Ciclo terminado com cuidados ainda em aberto: contam como em aberto, não como erro.
- EC6 — Tela pequena e fonte grande: rola.

## 16. Failure Modes

Nenhum novo: o resumo é derivado do board que a tela já carregou, e a falha de leitura já é tratada na rota.

## 17. Acceptance Criteria

- AC1 — O resumo aparece na visão de ciclo com as contagens deste ciclo.
- AC2 — Ciclo terminado: o resumo diz que terminou e a oferta do próximo é alcançável dali.
- AC3 — Ciclo sem nada registrado: diz que aparece conforme ela registra.
- AC4 — **Nenhum percentual, score, nota, tendência, comparação, elogio ou cobrança** — barreira de teste com amostras que precisam casar.
- AC5 — As contagens são as mesmas do `Progress` — verificado por teste, não por leitura.
- AC6 — Nenhum literal de cor/espaçamento fora de `design/`; `package.json` e `supabase/` inalterados.
- AC7 — `pnpm verify` verde.
- AC8 — **Validação visual real a 390px.**

## 18. Testing Strategy

- **Vitest**: `planned` e `total` no `buildProgress`, incluindo o caso de reagendado (que não entra em nenhum dos dois).
- **RNTL**: resumo em andamento, resumo no fim, ciclo vazio, zero avaliações, e a barreira de AC4.

## 19. Dependencies

**Nenhuma nova.**

## 20. Implementation Plan

Fatia única: dois campos no `Progress`, o resumo na visão de ciclo, testes, validação a 390px, `F29` → DONE.

## 21. Migration Plan

**N/A.**

## 22. Rollback Plan

Reverter a PR.

## 23. Open Questions

- **OQ1 — CAN DEFER — o resumo também na Hoje, no fim do ciclo.** A Hoje já diz "Seu cronograma chegou ao fim" e oferece o próximo; levar o resumo para lá evitaria uma navegação. *Assunção:* a visão de ciclo é o lugar do mês, e a Hoje leva até ela. *Gatilho:* observar que ninguém abre o ciclo no fim.
- **OQ2 — CAN DEFER — ciclos anteriores.** Ver o resumo de um ciclo já substituído é valor real e é `P12`/`P16`. *Assunção:* só o ciclo ativo, como na SPEC-019 OQ5.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-01 | v0.2 — **implementada.** `planned` e `total` no `Progress`, no laço que já existia — nenhuma segunda contagem. `CycleSummary` na visão de ciclo: abre a tela quando o ciclo fechou, fecha quando está em andamento. **Achado da auditoria:** o fim do ciclo tem duas entradas, não uma — a data **ou** não ter sobrado nada; só a data faria a Hoje dizer "chegou ao fim" enquanto o ciclo dizia "como está indo". | agente (§0.2/§0.4) |
| 2026-09-01 | v0.1 — Draft criada para o **F29**, destravado pela SPEC-019, que o havia declarado fora de escopo (NG1). Zero banco, zero contrato: os números são os do `Progress`, e reusá-los em vez de recontá-los é a decisão que evita duas verdades sobre o mesmo mês. | agente |
