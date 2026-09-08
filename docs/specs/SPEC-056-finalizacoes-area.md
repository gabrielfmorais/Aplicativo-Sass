# SPEC-056 — Finalizações: um lugar em Cuidados (F38, fatia shell)

| Campo | Valor |
|---|---|
| ID | SPEC-056 |
| Status | Implemented |
| Owner | dono do produto |
| Bounded Context | **Care tracking** (`packages/core/src/care-tracking`) + UI em Cuidados |
| Related ADRs | ADR-001, **D-26/D-70** (o gate que esta fatia contorna sem atravessar), **D-83** (Free) |
| Related SPECs | **SPEC-048** (qual finalização — o registro), SPEC-039 (a etapa), SPEC-049 (Smart Shelf, o mesmo formato), SPEC-024 (Wash Day) |
| Capability | `F38` — **COMMITTED**, IN PROGRESS (registro DONE em SPEC-048) |
| Fase do roadmap | MASTER PRODUCT BACKLOG — F38 |
| Criado / Atualizado | 2026-09-08 / 2026-09-08 |

## 1. Context

O `F37` (SPEC-039) entregou a **etapa** de finalização e o `F38`/SPEC-048 entregou **qual** finalização
ela fez — um vocabulário aprovado (`candidate`) de oito valores. O que faltava, do Blueprint §22, é a
**área própria dentro de Cuidados**: um lugar onde as finalizações **existem** para ela, com nome e com o
que ela já registrou.

## 2. Problem

As finalizações só aparecem **dentro do registro de um cuidado** (a tela "Seu registro"). Não há lugar
onde ela veja **quais finalizações existem** nem **o que ela já fez** ao longo do tempo. O Blueprint §22
pede a área; a maior parte dela — *"recomendadas para você"*, *"como fazer"* passo a passo, indicação por
perfil — é **conteúdo capilar substantivo, atrás do gate D-26/D-70**. Esta fatia entrega **só o que não
atravessa o gate**: descoberta dos nomes + a história pessoal dela.

## 3. Goals

- **G1** Uma entrada **Finalizações** em Cuidados, e uma área própria por trás dela.
- **G2** A **lista do vocabulário já aprovado** (SPEC-048), visível como catálogo.
- **G3** O **histórico dela**: quantas vezes registrou cada finalização — fato, reusando o dado canônico.
- **G4** Útil **por si só**, sem parecer incompleta porque o resto está gated.

## 4. Non-Goals — a fronteira D-26/D-70

- **NG1** ⛔ Nada de *"melhor para o seu cabelo"*, indicação por curvatura/perfil, efeito prometido.
- **NG2** ⛔ Nenhum **ranking** de finalização — a lista sai na ordem do vocabulário, **nunca** por
  contagem. Ordenar por "quantas vezes" seria o `P7` entrando pela porta dos fundos.
- **NG3** ⛔ Nenhum **"como fazer"** com passo a passo capilar substantivo.
- **NG4** ⛔ Nenhuma tabela, coluna, RPC ou migration — a área **lê** o que a SPEC-048 já grava.
- **NG5** ⛔ Nenhum campo novo de conteúdo por finalização (apresentação, descrição) — é `F38` gated.

## 5. Functional Requirements

- **FR1** Card **Finalizações** em `CareTabScreen`, no padrão dos outros (diz o que é, depois oferece).
- **FR2** A área abre empilhada sobre Cuidados e volta para ela.
- **FR3** Lista das finalizações **nomeadas** (as seis: `fitagem_tradicional`, `fitagem_estruturada`,
  `dedoliss`, `rake_and_shake`, `plopping`, `twist_out`), na ordem do vocabulário.
- **FR4** Cada uma mostra **quantas vezes** ela a registrou — `0` inclusive, dito em palavra.
- **FR5** Estados **carregando** e **erro + tentar de novo**; **não há estado vazio de tela** — mesmo com
  zero registros, os seis nomes são a descoberta (G4).

## 6. Business Rules

- **BR1** `other` e `unknown` **não** entram no catálogo: são saídas de registro (*"fiz fora da lista"* /
  *"não sei o nome"*), não finalizações que se descobre pelo nome. É a mesma exclusão que SPEC-047/050
  fazem ao nunca torná-las observação. Um registro `other`/`unknown` simplesmente não conta para nenhum
  nome — não some do banco, só não tem entrada de catálogo.
- **BR2** Conta só finalização com a **etapa em `done`** e uma **técnica nomeada** — é o fato *"ela fez
  esta finalização"*.
- **BR3** A lista é **sempre as seis, na ordem do vocabulário**. Contagem é fato por item, jamais critério
  de ordem (NG2).
- **BR4** **Free.** É o dado dela e o vocabulário que ela já vê ao registrar — sem `advanced_insights`,
  sem gate de entitlement (D-83).

## 7. Data Model Impact

**Nenhum.** Lê `public.wash_day_finish` (SPEC-039/048), sob a policy `select_own` que já existe. O
cliente já tem `SELECT`. Zero migration.

## 8. Edge Cases

- **EC1** Zero registros: a lista mostra as seis com *"Você ainda não registrou"*. Não é erro nem vazio.
- **EC2** Registros só de `other`/`unknown`: contam como zero para os nomes (BR1) — a lista fica igual à
  de quem não registrou nada, e é correto: ela não registrou nenhuma **nomeada**.
- **EC3** Leitura falha: card de erro com *Tentar novamente*, nunca uma lista que finge zero.

## 9. Acceptance Criteria

- **AC1** No DEV real a 390px: Cuidados → Finalizações → a área abre, as seis aparecem na ordem do
  vocabulário, e a contagem bate com o histórico dela.
- **AC2** Barreira de teste: nenhum texto da área afirma efeito capilar, "melhor", ranking ou "como
  fazer" (D-26/D-70).
- **AC3** `buildFinishCatalog` sempre devolve as seis nomeadas, em ordem fixa, ignorando `other`/`unknown`.

## 10. Open Questions

- **OQ1 (BLOQUEADA por D-26/D-70)** *Recomendadas para você*, apresentação/descrição por finalização,
  *como fazer* passo a passo, indicação por perfil, ranking — a maior parte do `F38`. Espera sign-off de
  domínio. A arquitetura (área, navegação, catálogo, histórico) fica pronta para recebê-las.
- **OQ2 (CAN DEFER)** Ligar cada finalização ao seu histórico de execuções (data, cuidado, produtos da
  finalização — `F48`) e ao check-in seguinte. Esta fatia entrega a contagem; o detalhe por ocorrência é
  a próxima.

## 11. Change Log

| Data | Mudança |
|---|---|
| 2026-09-08 | SPEC criada e implementada — a fatia shell do `F38`: entrada em Cuidados, catálogo das seis finalizações nomeadas e a contagem por finalização, reusando `wash_day_finish`. Zero migration. O conteúdo capilar substantivo do `F38` segue atrás de D-26/D-70. |
