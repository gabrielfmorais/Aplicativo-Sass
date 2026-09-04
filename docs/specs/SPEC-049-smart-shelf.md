# SPEC-049 — Smart Shelf: a prateleira contada pelo uso (P6, primeira fatia)

| Campo | Valor |
|---|---|
| ID | SPEC-049 |
| Status | Implemented |
| Owner | dono do produto |
| Bounded Context | **Insights** (`packages/core/src/insights`) — Premium |
| Related ADRs | **D-26/D-70**, **D-83** (premium é adição), D-100 (nada inventado) |
| Related SPECs | SPEC-023 (a prateleira), SPEC-024 (o uso), SPEC-047 (a leitura observacional) |
| Capability | `P6` — primeira fatia |
| Criado / Atualizado | 2026-09-04 / 2026-09-04 |

## 1. Context

> Ela tem doze produtos no banheiro e não sabe quais está usando. Compra mais. — Blueprint §10

O Free já deixa ela cadastrar (`F26`) e marcar o que usou (`F25`). O que faltava era **devolver isso
para ela**: quais desses vidros aparecem nos registros, e quais nunca apareceram.

## 2. Goals

- **G1** Ela vê **quantas vezes** cada produto apareceu nos próprios registros.
- **G2** Ela vê o que está na prateleira e **nunca** apareceu.
- **G3** Nada disso julga produto.

## 3. Non-Goals

- **NG1** ⛔ **Nenhuma média, nota ou ordem de mérito.** Ordenar por "melhor" é o **ranking pessoal**
  (`P7`), outra capability e outra decisão. Aqui a ordem é **quantas vezes**.
- **NG2** ⛔ **Nenhum conselho.** Descartar, trocar ou comprar é `P18`, atrás do próprio gate.
- **NG3** ⛔ Nenhuma afirmação de efeito — *"este produto funciona para você"* é D-26/D-70.
- **NG4** ⛔ Nenhuma migration, nenhuma escrita: leitura pura do que já existe.
- **NG5** ⛔ Nada de catálogo, marca, preço ou imagem — isso é `F32`, e continua COMMITTED e à parte.

## 4. Business Rules

- **BR1** Conta por **cuidado**, não por marcação — a mesma disciplina do `buildInsights`.
- **BR2** O denominador é **registros com produto marcado**, não cuidados atendidos: dizer "de 14"
  quando só 6 têm registro inflaria o denominador e encolheria ela.
- **BR3** A lista é a prateleira **ativa**. Arquivado sai da tela e **continua no histórico**
  (SPEC-023 BR4) — foi para isso que `products` nasceu sem `DELETE`.
- **BR4** ⚠️ **"Ainda sem registro" é fato, não acusação.** Pode ser novo, sazonal, ou simplesmente
  não marcado. A tela diz e para.
- **BR5** **Todo produto está em exatamente um balde** (`used` + `neverUsed` = total, sem
  sobreposição) — com barreira de teste, porque um produto que sumisse dos dois deixaria de ser
  contado sem ninguém notar.
- **BR6** Empate desempata pelo nome: a ordem não pode depender do banco.

## 5. Edge Cases

- **EC1** Prateleira vazia: convite, não erro.
- **EC2** Produtos mas nenhuma marcação: *"A Huna ainda está conhecendo sua rotina"*.
- **EC3** Leitura falha: mensagem honesta e nova tentativa.
- **EC4** Sem a capability: explica o que o premium acrescenta, sem cadeado e sem números.

## 6. Acceptance Criteria

- **AC1** No DEV real a 390px, com Premium.
- **AC2** Nenhuma nota, média, porcentagem ou "melhor" — barreira de teste.
- **AC3** Nenhum conselho de compra/descarte — barreira de teste.

## 7. Open Questions

- **OQ1 (CAN DEFER)** Combinações que aparecem juntas nos melhores registros (Blueprint §10) — é
  leitura de par, e vale uma fatia própria.
- **OQ2 (BLOQUEADA por decisão)** *"A avaliação dela associada a cada produto"* é o **`P7`**: média
  por produto é a forma mais direta de virar ranking, e ranking é outra decisão. Fora desta fatia de
  propósito.

## 8. Change Log

| Data | Mudança |
|---|---|
| 2026-09-04 | SPEC criada e implementada. Contagem de uso e "ainda sem registro", sem julgamento. |

## 9. Evidência

✅ **390px no DEV real, com Premium:**

- *"O que você mais usa — Máscara da feira · em 4 registros de 5"*
- *"Ainda sem registro — oleo · truns"*, com a frase que diz que pode ser novo ou de outra época

⚠️ **Um detalhe que a validação esclareceu:** produtos **arquivados** que têm uso histórico **não**
aparecem na tela, porque a lista é a prateleira ativa (BR3). O uso deles continua no histórico e
continua contando para a SPEC-047 — as duas leituras respondem perguntas diferentes, e é por isso
que `used + neverUsed` fecha com o total **da prateleira ativa**, não com o histórico inteiro.
