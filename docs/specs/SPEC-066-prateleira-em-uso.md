# SPEC-066 — "Sua prateleira, em uso": o vidro, a contagem e a última vez

| Campo | Valor |
|---|---|
| ID | SPEC-066 |
| Status | Approved (frente escolhida pelo agente pelo critério de maior valor de produto, §0.3/§0.4) |
| Owner | dono do produto |
| Bounded Context | Insights (Premium) — leitura; **e um campo novo no fato**, sem migration |
| Related ADRs | ADR-001, ADR-008 (dia civil), ADR-007 A1 / D-26 / D-70 |
| Related SPECs | SPEC-049 (a tela), SPEC-047 (a camada), SPEC-063/065 (a mesma identidade), SPEC-054/057/058 (o catálogo) |
| Direção | `docs/design/UI-INTELLIGENCE.md` |
| Criado / Atualizado | 2026-09-09 / 2026-09-09 |

## 1. Context

O Blueprint §10 abre a Smart Shelf com uma frase concreta:

> *"Ela tem doze produtos no banheiro e não sabe quais está usando."*

A SPEC-049 respondeu **quantas vezes** cada um apareceu. Faltam duas coisas para a frase ficar
respondida: **qual vidro é** (a tela é uma lista de nomes, sem foto, sem marca, sem categoria — a
mesma queixa que o dono fez sobre a prateleira dentro do cuidado) e **quando foi a última vez**, que
é a metade da pergunta que a contagem não responde: *"em 4 de 6 registros"* não distingue o produto
que ela usou ontem do que ela largou em julho.

## 2. ⚠️ A auditoria de fronteira, feita antes de escrever

**"Última vez em" é recência — e recência aparece no roadmap como `P17`, que está `DEFERRED`.**
Auditado: ⛔ o `P17` é **padrão de longo prazo** (*"precisa de meses de histórico"*), e um padrão é
uma afirmação sobre uma **série**. Isto aqui é **a data de um registro**, o mesmo tipo de fato que o
cartão de óleo já mostra desde a SPEC-040 (*"última vez em qui, 03/09"*).

⛔ **E ela não ordena nada.** A ordem continua sendo a contagem (SPEC-049), porque ordenar por
recência seria escolher um critério de importância — e o critério de importância é o `P7`.

## 3. Goals

- G1 — Ela **reconhece o vidro** nesta tela como reconhece na prateleira e no cuidado.
- G2 — Ela sabe **quando** usou cada um pela última vez.
- G3 — *"Ainda sem registro"* deixa de ser uma fileira de etiquetas e vira produto.

## 4. Non-Goals

- NG1 — ⛔ Nenhuma média, nota, score ou ordem de mérito (a recusa da SPEC-049 continua inteira: é o
  `P7`).
- NG2 — ⛔ Nenhuma sugestão de descartar, trocar, comprar ou *"faz tempo que você não usa"* — isso é
  `P18`, e *"faz tempo"* é conselho com cara de fato.
- NG3 — ⛔ Nenhuma afirmação de eficácia, indicação ou adequação (D-26/D-70).
- NG4 — ⛔ Nada de padrão temporal, tendência, série ou frequência ao longo do tempo — isso é `P17`.
- NG5 — Zero migration, zero RPC, zero policy, zero dependência.

## 5. Functional Requirements

- FR1 — Cada produto usado mostra **foto ou monograma, nome dela, marca e categoria**, pelo mesmo
  componente das outras superfícies (`ProductIdentity`).
- FR2 — Cada produto usado mostra **a data do registro mais recente em que ele apareceu**, com o
  formato de dia civil que o app já usa.
- FR3 — *"Ainda sem registro"* passa a listar produtos com a mesma identidade, em vez de `Tag` de
  nome cru.
- FR4 — A contagem e o denominador não mudam de texto nem de regra.
- FR5 — Nome longo trunca; ⛔ nunca transborda.

## 6. Business Rules

- BR1 — A data sai do **dia civil da execução** (`executed_on`, ADR-008), lido como números puros —
  ⛔ nunca por `Date` com fuso, que traria o fuso do aparelho para dentro de um dado que já não tem.
- BR2 — A ordem continua sendo **contagem desc, empate por nome** (SPEC-049). ⛔ Recência não ordena.
- BR3 — A contagem continua sendo **por cuidado**, pelo `countByCare` compartilhado — duas telas
  Premium não podem dar números diferentes sobre o mesmo produto.
- BR4 — ⛔ Nenhum texto adjetiva o tempo decorrido.

## 7. Data Model / API / Authorization / Privacy

**Sem migration e sem contrato novo.** `care_executions.executed_on` já existe e **já era ordenado
por ele**; o `select` do adapter tinha deixado a coluna de fora com a razão escrita no código:

> *"`care_type_code` e `executed_on` eram lidos e não consumidos por ninguém… Voltam com o consumidor
> delas (segmentação `P8`, recência `P17`), não antes."*

⚠️ **Esta SPEC é o consumidor previsto.** A coluna volta porque agora alguém a lê — que é exatamente
a regra de necessidade da §0.2 sendo cumprida nas duas direções.

## 8. Edge Cases

- EC1 — Produto usado uma vez: a data é a daquele registro.
- EC2 — Produto arquivado com uso histórico: continua fora desta lista (é a prateleira **ativa**,
  SPEC-023 BR4) — inalterado.
- EC3 — Produto sem foto: monograma, como em toda superfície.
- EC4 — Fora da janela de 60 cuidados: o que a janela não alcança não é contado nem datado, como já
  valia para a contagem.
- EC5 — Prateleira sem nenhum uso: o estado honesto de sempre.

## 9. Acceptance Criteria

- AC1 — Cada produto usado mostra identidade e data do último registro.
- AC2 — A ordem continua sendo por contagem, com teste que falha se a recência ordenar.
- AC3 — Nenhum texto novo cai nas listas proibidas de SPEC-049 (mérito, conselho, tempo adjetivado).
- AC4 — A data é o dia civil, sem conversão de fuso (teste).
- AC5 — Validado a 390px no DEV real com Premium, console limpo.

## 10. O que só se prova em iPhone nativo

⛔ Imagem em rede móvel, Dynamic Type e toque (gate G7).

## 10.1 Evidência — o que foi medido

⚠️ **Uma barreira reclamou, e a resposta certa era atualizá-la, não afrouxá-la.** O teste da SPEC-049
fixa as **chaves exatas** de cada item de `used`, para que `score`/`rating` não entrem sem ninguém
ver. Com o item passando a carregar `product` e `lastUsedOn`, ele falhou — e a tentação é trocar
`toEqual` por "contém", que é como uma barreira morre: ela passaria a aceitar o campo de julgamento
no dia em que alguém o acrescentasse. A lista foi **atualizada**, com o motivo escrito ao lado.

⚠️ **A data é achada por MÁXIMO, não pela ordem de chegada.** Os fatos vêm ordenados por
`executed_on` desc, e usar "o primeiro que aparecer" acoplaria o domínio a uma promessa do adapter —
a mesma classe de defeito que a SPEC-063 mediu no `lastUsedFor`, que pegava o registro mais recente
que **existisse**. Há teste com os fatos fora de ordem, e outro com virada de ano.

✅ **Validado a 390px no DEV real com Premium, console limpo:**

| O que foi medido | Resultado |
|---|---|
| Produto usado, com identidade | *"Máscara da feira · Máscara"*, monograma `M` |
| Contagem | *"em 4 registros de 5"* (inalterada) |
| Última vez | *"última vez em sex, 04/09"* |
| *"Ainda sem registro"* | 6 produtos com **foto real** (Wella, L'Oréal) ou monograma, marca e categoria |
| Console | limpo |

⚠️ **A hierarquia entre as duas listas é deliberada:** o que ela usa fica em **cartão**; o que ainda
não apareceu fica em **linha**. As duas respondem perguntas diferentes, e a que ela veio buscar é a
primeira.

## 11. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-09 | Auditoria: barreira de chaves exatas atualizada em vez de afrouxada; a data é achada por máximo, para não depender da ordem do adapter | agente |
| 2026-09-09 | Criada. ⚠️ A fronteira com o `P17` foi auditada antes de escrever: um padrão é afirmação sobre uma **série**; a data do último registro é **um fato**, do mesmo tipo que o cartão de óleo já mostra — e ⛔ ela não ordena nada | agente |
