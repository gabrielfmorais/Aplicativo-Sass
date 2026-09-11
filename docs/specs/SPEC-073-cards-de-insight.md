# SPEC-073 — Cards de insight compartilháveis (`P25`)

- **Status:** DONE
- **Bounded context:** Sharing (`P25`) — lê Insights (`P2`/`P8`)
- **Autorizada por:** o dono, 2026-09-11, respondendo à pergunta que a SPEC-072 deixou aberta:
  **"um card pode nomear um produto?"** → **pode**.
- **Gate:** ⛔ nenhum novo. O conteúdo já é Premium (`advanced_insights`); o **ato de compartilhar
  continua Free** (D-103).

---

## 1. Context

O `F45` (SPEC-044) fez a fundação — `conquista → preview → ela decide → share nativo` — e o `F46`
(SPEC-045/068) acrescentou **momentos, não outro caminho**. A Hair Intelligence (`P2`, SPEC-047) e os
padrões (`P8`, SPEC-050) existem e são lidos na tela *"Seus padrões"*.

O `P25` estava `DEFERRED BY DEPENDENCY` com a dependência escrita: *"depende de `F45` + Hair
Intelligence"*. **As duas existem.** É o mesmo destravamento que aconteceu com o `P8`.

## 2. Problem

O que ela descobre sobre a própria rotina é a coisa mais interessante que a Huna produz, e é a única
que **não** tem como sair da tela. Um marco de consistência vira card; *"Máscara da feira esteve em 4
dos 5 cuidados que você avaliou bem"* não.

## 3. A decisão que o dono tomou, e o que ela NÃO autoriza

✅ **Um card pode nomear o produto.**

⛔ **Isso não afrouxa nada mais.** Continua valendo, com barreira de teste:

- **observação, nunca causa** — o card conta co-ocorrência nos registros dela; *"funciona"*,
  *"melhora"*, *"ideal"* e *"recomendo"* não existem em caminho de código nenhum (D-26/D-70);
- **nenhuma comissão, nenhum link, nenhuma loja** — nomear o produto é dizer o que ela usou, não
  levar a lugar nenhum (D-104: a confiança vale mais que a comissão, e aqui não há comissão);
- **o preview continua sendo o consentimento** (SPEC-044 BR2), e o **padrão continua privado** —
  nome e avatar desligados.

## 4. A decisão mais difícil: **o card vai em CONTAGEM, sem denominador**

Na tela, a observação **precisa** do denominador: *"em 4 **dos 5** cuidados que você avaliou bem"* é
o que impede a repetição de parecer maior do que é (SPEC-047). No card, ele sai.

⚠️ **Os dois lados têm objeção real, e a escolha é pelo pior erro:**

- **Com denominador:** *"4 de 5"* convida a calcular **80%**, e num feed de outra pessoa isso lê como
  *"esse produto funciona 80% das vezes"* — a leitura causal sobre um **produto capilar**, em
  público, que é exatamente o risco que esta SPEC existe para não criar.
- **Sem denominador:** *"4 cuidados que avaliei bem"* é uma **contagem**, não uma taxa. Perde
  precisão; **não pode ser lida como rendimento**.

⭐ **E há precedente medido:** a SPEC-045 já recusou denominador no card de ciclo pelo mesmo motivo
— *"'10 de 14' convida a calcular 86%"*. Manter a coerência com aquela recusa é mais importante que
manter a simetria com a tela.

## 5. Non-Goals

- ⛔ **A marca do check-in (`noticed`) não vira card.** *"Frizz — 4 cuidados"* num feed lê como
  queixa, e a SPEC-051 misturou valências **de propósito** contando com o contexto da tela (a nota de
  1 a 5 ao lado) — contexto que o card não tem. Barreira de teste.
- ⛔ **Nenhum ranking, nenhuma ordem de mérito** (`P7`): a lista sai na ordem que o core já produz.
- ⛔ **Nenhum caminho novo de share** (SPEC-044 G5): a tela de preview é a mesma.
- ⛔ **Nenhuma porcentagem, nenhuma média, nenhuma nota.**

## 6. Functional Requirements

- **FR1** — `insightMoments(view)` devolve um `ShareMoment` por observação e por padrão, **exceto**
  `noticed`.
- **FR2** — o **assunto vai no `headline`**, não no `value`. ⚠️ Medido: o `value` é o herói
  auto-dimensionado com **piso de 96px**, o que comporta ~16 caracteres na largura útil — *"Máscara
  da feira"* cabe raspando, e um nome de catálogo não cabe. O `headline` é 40px e comporta ~29.
- **FR3** — o `value` é a **contagem** (curta, sempre cabe) e o `valueLabel` diz, na **primeira
  pessoa**, de que contagem se trata.
- **FR4** — o assunto é truncado para caber, como `MAX_SHARE_NAME` já faz com o nome dela.
- **FR5** — a entrada é a tela *"Seus padrões"*, que já é Premium e já existe.

## 7. Business Rules

- **BR1 — primeira pessoa.** *"cuidados que **avaliei** bem"*, nunca *"você avaliou"*. O card sai da
  mão dela para quem não é ela — a SPEC-045 mediu esse defeito nos marcos e pagou por ele.
- **BR2 — nenhum número é recalculado** (SPEC-044 BR4): a contagem vem da mesma `InsightsView` que a
  tela mostrou.
- **BR3 — `Observation` ganha `count`.** A frase da tela vem pronta e é **segunda pessoa**; o card
  precisa da **contagem crua** para escrever a dele. Derivar por texto seria fazer a apresentação
  depender de parsing de português.
- **BR4 — o padrão usa `wellRated` como contagem**, não `cares`: é a metade que a frase da tela
  também destaca, e usar `cares` faria o card contar co-ocorrência sem resultado.

## 8. Data Model / Authorization / Privacy

**Zero migration, zero backend, zero rede.** `ShareCardContent` continua sem `userId`, sem id de fato
e sem e-mail — a assinatura é a barreira (SPEC-044 BR1). O gate premium é o da tela de origem.

## 9. Edge Cases

- **EC1** — sem dados suficientes (`enoughData: false`): nenhum momento, e a tela não oferece.
- **EC2** — só observações `noticed`: nenhum momento (NG).
- **EC3** — assunto longo: truncado com reticências.
- **EC4** — contagem 1: *"1 cuidado que avaliei bem"*, no singular.

## 10. Acceptance Criteria

- **AC1** — a tela *"Seus padrões"* oferece compartilhar quando há observação compartilhável.
- **AC2** — nenhum texto de card afirma efeito, recomendação, ranking, porcentagem ou denominador
  (barreira de teste).
- **AC3** — nenhuma marca de check-in vira card (barreira de teste).
- **AC4** — validado a 390px no DEV real com Premium.

## 10.1 Evidência — medido a 390px no DEV real (2026-09-11)

Com Premium concedido e o histórico real da usuária de desenvolvimento (7 cuidados avaliados).

**A tela "Seus padrões"** mostra as observações e, no fim, a oferta discreta *"Compartilhar um
achado"*. **O card, lido do SVG renderizado:**

```
HUNA
MÁSCARA DA FEIRA
4
cuidados que avaliei bem
o que se repete na minha rotina
```

E o segundo, escolhido no seletor: `SECOU NATURALMENTE · 3 · cuidados que avaliei bem`.

**Confere com cada barreira:**

| regra | no card |
|---|---|
| nomear o produto (autorizado pelo dono) | **MÁSCARA DA FEIRA** |
| sem denominador (§4) | *"4"*, nunca *"4 de 6"* — a tela diz *"4 dos 6"* |
| primeira pessoa (BR1) | *"avaliei"*, nunca *"você avaliou"* |
| sem verbo de efeito | nada além de contagem |
| padrão privado (SPEC-044 BR6) | nome e marca **desligados** |

⭐ **O seletor abre no achado de onde ela veio:** `Máscara da feira · Secou naturalmente · Minha
jornada · Primeiro cuidado · 5 cuidados · 10 cuidados · 3 seguidos` — os momentos de insight vêm
primeiro, então a tela não precisa saber de onde ela veio (SPEC-045 G5 intacta).

**Console limpo**, sem transbordo horizontal.

⚠️ **O que a validação NÃO prova, e está coberto por teste:** a **exclusão da marca de check-in**
(EC2). As três marcas do DEV têm contagem 1, abaixo do `MIN_OCCURRENCES` de 3 da SPEC-047, então
**nenhuma observação `noticed` existe para ser excluída**. É a mesma honestidade que a SPEC-050
registrou sobre o teto que nunca foi exercido no DEV.

⚠️ **E o DEV ficou exatamente como estava** — conferido depois: 7 linhas de finalização, 2 técnicas
nomeadas, 3 marcas, 20 execuções vivas. ⭐ **A lição da SPEC-072 foi aplicada:** uma tentativa de
semear marcas para exercer a EC2 foi **recusada pela RLS** (4× `403`, `user_id` indefinido) e
**nada foi escrito** — e, em vez de insistir, a lacuna virou registro.

## 11. Change Log

- 2026-09-11 — criada depois de o dono autorizar nomear o produto no card.
