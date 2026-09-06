# SPEC-050 — Padrões de combinação (`P8`, primeira fatia)

| Campo | Valor |
|---|---|
| ID | SPEC-050 |
| Status | Implemented |
| Owner | dono do produto |
| Bounded Context | **Insights** (`packages/core/src/insights`) — Premium |
| Related SPECs | **SPEC-047** (`P2`, a camada que esta estende) · SPEC-024 (produtos e técnicas) · SPEC-048 (finalização) · SPEC-006 (check-in) · SPEC-049 (`P6`) |
| Related ADRs / Decisões | **D-26/D-70** (nada afirma sobre cabelo) · **D-83** (premium é adição) · D-102 (a finalização entra na correlação) · §0.4 §3.1 (IA por último) · D-47/D-48 (necessidade) |
| Capability | `P8` — **COMMITTED**, primeira fatia |
| Criado | 2026-09-05 |

---

## 1. Context

> `P8` — **Padrões produto × técnica × resultado.** Depende de `P6` + `F25` + check-ins. **D-102
> acrescenta a finalização à quádrupla:** tratamento + produto + **finalização** + resultado
> percebido. — MASTER PRODUCT BACKLOG

**A dependência ficou satisfeita em 2026-09-05.** `P6` (SPEC-049), `F25` (SPEC-024), check-ins
(SPEC-006) e a **finalização** (SPEC-048) existem, e a SPEC-047 já lê os quatro no mesmo fato.

⚠️ **Isto é uma extensão da SPEC-047, não uma capability nova.** Mesma superfície (*"Seus padrões"*),
mesmo gate (`advanced_insights`), mesma porta (`InsightsPort`), mesmo tipo (`InsightFact`).
**Zero migration e zero mudança de adapter** — e isso não é economia, é consequência: a fatia de
registro do `F38` e as três fatias da SPEC-047 já trouxeram tudo o que este cálculo precisa.

**O que a SPEC-047 ainda não respondia:** ela conta **uma dimensão de cada vez**. *"Máscara da feira
esteve em 4 dos 5"* e *"Plopping — você finalizou assim em 3 dos 5"* são dois fatos soltos; que os
dois **andaram juntos** e como aqueles cuidados foram avaliados é outra coisa, e é a que se aproxima
de *"o que funciona comigo"*.

## 2. Goals

- **G1** Ela vê **poucos padrões realmente informativos** entre o que usou, como fez e como
  finalizou — com o resultado que ela mesma registrou.
- **G2** Toda afirmação continua **rastreável** e **contada**, nunca inferida.
- **G3** Sem evidência, a Huna **diz que ainda está conhecendo as combinações dela**.

## 3. Non-Goals

- **NG1** ⛔ **Nenhuma causalidade.** *"Apareceram juntos em 5 cuidados, e em 4 deles você avaliou
  bem"* é contagem. ⛔ *"Máscara X funciona melhor com Fitagem"*, ⛔ *"Plopping melhorou seu cabelo"*
  e ⛔ *"essa combinação é ideal para você"* são alegação capilar (D-26/D-70).
- **NG2** ⛔ **Nenhum ranking de produto**, nenhuma ordem de mérito, nenhuma nota. Isso é `P7`, e
  esta fatia **não atravessa** `P7`.
- **NG3** ⛔ **Nenhuma porcentagem, nenhuma taxa exibida.** Contagem — a mesma disciplina de toda a
  camada.
- **NG4** ⛔ **Nenhum trio.** Só pares.
- **NG5** ⛔ **Couro cabeludo fica fora desta versão** (SPEC-047 OQ4): produto, técnica e finalização
  são **coisas que ela fez**; o couro é um **estado que ela observou**, e cruzá-lo com a avaliação lê
  como causa.
- **NG6** ⛔ **Nenhuma tela estatística.** *"Não quero uma tela cheia de combinações"* — decisão do
  dono, e é ela que justifica o teto de §5 BR6.
- **NG7** ⛔ Nenhuma migration, nenhuma escrita, nenhuma IA, nenhum dado novo pedido a ela.

## 4. Functional Requirements

- **FR1** `buildPatterns` é puro e recebe **os mesmos fatos** da SPEC-047.
- **FR2** Um **padrão** é um par de duas coisas que ela registrou **no mesmo cuidado**, de **tipos
  diferentes**: `produto × técnica`, `produto × finalização`, `técnica × finalização`.
- **FR3** O padrão só existe a partir de `MIN_PATTERN_CARES` (**3**) cuidados **avaliados** em que os
  dois apareceram juntos.
- **FR4** A frase carrega **duas contagens**: em quantos cuidados avaliados os dois apareceram
  juntos, e em quantos **desses** ela avaliou bem.
- **FR5** No máximo `MAX_PATTERNS` (**3**) padrões na tela.
- **FR6** Sem padrão nenhum, o texto é **"A Huna ainda está conhecendo suas combinações"**.
- **FR7** Seção própria dentro de *"Seus padrões"*, atrás do mesmo `advanced_insights`.

## 5. Business Rules

- **BR1 — só fato canônico.** Nada é inferido, estimado, ponderado ou suavizado. As duas contagens
  saem dos registros dela.
- **BR2 — o denominador do padrão é o cuidado AVALIADO em que os dois apareceram**, não o total de
  cuidados avaliados. É a única forma de a segunda contagem significar alguma coisa.
- **BR3 — ⚠️ qualquer par de duas coisas DISTINTAS, desde a OQ1 (2026-09-06).** A versão anterior
  exigia **tipos diferentes**, e por uma razão só: produto com produto já era o `combo` da SPEC-049,
  com outra frase e outro denominador, e repeti-lo aqui seria a mesma coisa dita duas vezes na mesma
  tela. **A OQ1 recolheu o `combo` para cá**, e com isso a razão acabou — manter a restrição passaria
  a ser arbitrário: não há por que dois produtos poderem andar juntos e duas técnicas não. **Uma
  regra: dois itens distintos.** Nada mais foi afrouxado (BR2, BR4–BR9 valem igual, e o teto de 3
  agora vale também para o par de produtos, que como `combo` **não tinha teto nenhum**).
- **BR4 — ⛔ `other` e `unknown` nunca são membros de um padrão** (SPEC-047 §14). ⚠️ **Mas os
  cuidados que os carregam continuam contando**: um cuidado com finalização `other` que tenha a
  Máscara e o Difusor entra inteiro no padrão *"Máscara + Difusor"*. Excluí-los encolheria o
  denominador e **inflaria** o padrão.
- **BR5 — o par que nunca aparece separado é descartado.** Se os dois membros apareceram exatamente
  nos mesmos cuidados, o padrão não diz nada que o membro sozinho não dissesse. É a **mesma regra**
  da SPEC-047 §15.1, com o denominador desta fatia — uma regra, dois lugares.
- **BR6 — o teto de 3 é guarda de EXIBIÇÃO, e está dito.** Não é significância estatística e não
  finge ser: é a decisão do dono de que *"poucos padrões realmente informativos"* vale mais que
  cobertura. A mesma natureza declarada de `MIN_RATED_CARES` e `MIN_CHECKINS_FOR_AVERAGE`.
- **BR6b — ⚠️ a lista não gasta as três vagas na mesma FORMA de par (OQ1).** Escolhe o mais forte de
  cada forma (`produto × produto`, `produto × técnica`, `produto × finalização`, …) e só então
  completa por contagem. ⚠️ **Medida, não intuída:** com o par de produtos disputando o mesmo teto,
  200 rotinas simuladas de 12 cuidados avaliados mostraram que **quem marca produto mais do que
  técnica** — o caso comum, porque produto é um vidro na prateleira e técnica é uma lista para
  lembrar — via **63% dos cartões virarem produto × produto**, e **45 rotinas em 200 não mostravam
  nenhum par de tipos diferentes**; marcando as duas coisas parecido, 44% e 14 em 200. Com a regra:
  **0 em 200**, nos três cenários. ⚠️ **Isso esvaziaria o que o `P8` acrescenta** — o par de produtos
  a SPEC-049 já dava, e os dois exemplos aprovados pelo dono são cruzados. ⚠️ **É seleção, não
  ordenação:** a lista final continua saindo por contagem (BR7), dentro de cada forma o escolhido é
  o mais forte, nenhuma proporção é olhada, e a regra é **simétrica** — protege a forma em minoria,
  seja ela qual for.
- **BR7 — ⚠️ a ordem é por CONTAGEM ABSOLUTA, nunca por proporção.** Ordenar por *"qual proporção
  foi melhor avaliada"* é construir um ranking — `P7` entrando pela porta dos fundos, e com uma
  amostra de três. Ordena por quantos cuidados bem avaliados, depois pelo tamanho da amostra, e
  desempata pelo nome, para a ordem não depender do banco.
- **BR8 — cuidado sem check-in não entra**, nem no denominador nem no numerador: ele não diz nada
  sobre resultado (SPEC-047 BR1).
- **BR9 — execução anulada fica de fora.** Ela desfez aquilo (herdado da SPEC-047 BR4).

## 6. A frase

| | |
|---|---|
| **subject** | `Máscara da feira + Plopping` |
| **detail** | `apareceram juntos em 5 cuidados que você avaliou, e em 4 deles você avaliou bem` |

⚠️ **Por que esta frase e não a do exemplo, palavra por palavra.** O dono escreveu *"…4 de 5
receberam avaliações altas"*; a camada inteira já diz **"que você avaliou bem"** para o mesmo
limiar (`feel >= 4`). Duas palavras para o mesmo conceito na mesma tela é como um vocabulário se
parte, e *"alta"* soa mais como nota do que *"você avaliou bem"* — que devolve a avaliação a quem a
deu. **O conteúdo é exatamente o aprovado**; só o vocabulário é o da casa.

⚠️ **"e em 4 deles", não "4 de 5".** A forma `N de M` convida a calcular a porcentagem — é a razão
registrada pela qual a SPEC-045 recusou *"10 de 14"* no card de ciclo. Aqui os dois números
aparecem, porque a rastreabilidade exige, mas a frase os separa em vez de os oferecer como fração.

## 7. Data Model Impact

**Nenhum.** Sem tabela, sem coluna, sem migration, **sem mudança no adapter**.

## 8. Edge Cases

- **EC1** Menos de `MIN_RATED_CARES` avaliados: nem chega a calcular (herdado da SPEC-047).
- **EC2** Nenhum par atinge `MIN_PATTERN_CARES`: *"A Huna ainda está conhecendo suas combinações"*.
- **EC3** ⚠️ **Padrões sem observação de item.** Um par pode alcançar 3 cuidados **avaliados**
  enquanto nenhum item isolado alcança 3 cuidados **bem avaliados** — os denominadores são
  diferentes. A tela precisa **mostrar a seção mesmo assim**; a condição de "não há nada a mostrar"
  passa a olhar as duas listas.
- **EC4** Todos os pares empatados: a ordem é determinística pelo nome.
- **EC5** Um cuidado com o mesmo produto marcado duas vezes conta **uma** (herdado de `countByCare`).

## 9. Acceptance Criteria

- **AC1** No DEV real a 390px, com Premium: o estado com padrão **e** o estado sem padrão.
- **AC2** Nenhuma frase causal, nenhuma promessa, nenhum passo a passo — barreira de teste no core
  **e** na tela.
- **AC3** `other` e `unknown` nunca aparecem como membro; os cuidados que os carregam continuam no
  denominador — barreira de teste.
- **AC4** Nenhum trio, nenhum par do mesmo tipo — barreira de teste.
- **AC5** A ordem não depende da proporção — barreira de teste.
- **AC6** No máximo 3 cartões de padrão.

## 10. ⚠️ A recusa que a auditoria encontrou

Um par que apareceu em vários cuidados e em **nenhum** deles ela avaliou bem produziria o cartão:

> *"apareceram juntos em 4 cuidados que você avaliou, e em **0** deles você avaliou bem"*

Isso **não é observação, é acusação**. A leitura inevitável é *"essa combinação não funciona"* — o
**espelho exato** de *"essa combinação é ideal para você"*, e igualmente uma alegação capilar
(D-26/D-70). A direção negativa — o que evitar — é `P18`, atrás do próprio gate.

**`MIN_PATTERN_WELL_RATED = 1`.** ⚠️ **O corte é só no zero:** *"…e em 1 dele você avaliou bem"*
continua aparecendo, com o número honesto. Esconder isso seria escolher a versão bonita do histórico
dela, que é a outra forma de mentir.

**Segundo ajuste da auditoria:** o estado vazio dizia *"cuidados suficientes"* sem dizer quantos.
A lição da SPEC-047 fatia 3 é que o silêncio precisa **nomear o que falta** — passou a dizer
*"em pelo menos 3 cuidados que você avaliou"*.

## 11. Evidência

- `pnpm verify` verde — core **386**, mobile **441**, e os nove checks.
- **390px no DEV real, com Premium, nos DOIS estados, zero problema de console:**
  - **com padrão** (histórico semeado pelos caminhos do app e depois desfeito):
    *"Máscara da feira + Plopping — apareceram juntos em 4 cuidados que você avaliou, e em 4 deles
    você avaliou bem"* e *"Máscara da feira + Secou naturalmente — … em 3 … em 3 deles"*, **duas**
    combinações, abaixo do teto.
  - **sem padrão** (o histórico real dela): *"A Huna ainda está conhecendo suas combinações"*, e
    nenhum cartão inventado. ⚠️ E o motivo foi o certo: com a marcação semeada removida, o par
    *"Máscara + Secou naturalmente"* caiu para **2** cuidados e a amostra mínima o barrou.
- **Barreiras verificadas nos dois sentidos:** removida a recusa do zero bem avaliado, o teste falha
  (1 failed | 385 passed).
- ⚠️ **O que a validação NÃO provou:** o teto de 3 nunca foi exercido no DEV real — o histórico dela
  produz duas combinações. Está coberto por teste, não por medição.

## 12. Open Questions

- **OQ1** ✅ **Fechada em 2026-09-06 pelo dono**, com a diretriz: *"simplificar a experiência para a
  usuária, evitando várias seções de insights, mas sem destruir a distinção conceitual/dados por
  baixo."*

  **Decisão: o par de produtos deixou de ser observação e virou `Pattern`.** O `combo` da SPEC-049
  saiu de `observations`, e a tela passou a ter **uma** seção de par.

  ⚠️ **O que estava errado não era haver três seções — era haver duas para a MESMA ideia.** *"O que
  se repete"* misturava item isolado com par de produtos (*"apareceram juntos em 3 dos 5 cuidados que
  você avaliou bem"*) enquanto *"Suas combinações"* tinha os pares de tipos diferentes (*"apareceram
  juntos em 5 cuidados que você avaliou, e em 4 deles você avaliou bem"*): **duas frases, dois
  denominadores e dois lugares para o mesmo conceito**, sem nada na tela explicando a diferença.

  **Agora cada seção responde a uma pergunta, e a regra é legível sem instrução:**

  | Seção | Pergunta | Denominador |
  |---|---|---|
  | O que você tem notado | o que ela **observou** | cuidados que você avaliou |
  | O que se repete | **uma** coisa que ela fez | cuidados que você avaliou **bem** |
  | Suas combinações | **duas** coisas juntas | cuidados em que as duas apareceram |

  ⚠️ **Simplificou de verdade, e dá para contar:** o `combo` **não tinha teto** — cinco produtos
  produziam até dez cartões, e a regra do par redundante (§15.1) foi escrita justamente porque isso
  foi medido. Agora todo par disputa **um único `MAX_PATTERNS = 3`**, que é literalmente a instrução
  do dono de *"poucos padrões realmente informativos"*.

  ⚠️ **E a distinção de dado ficou intacta**, que era a outra metade do pedido: fundir as duas listas
  numa só poria *"esteve em 4 dos 5 cuidados que você avaliou bem"* ao lado de *"apareceram juntos em
  5 cuidados que você avaliou"* — números parecidos com significados diferentes. Isso seria
  simplificar a tela **mentindo sobre o dado**, e foi recusado.

  ⚠️ **Efeito colateral aceito, e é ganho:** o par de produtos passou a ser contado sobre **todos** os
  cuidados avaliados e a mostrar **as duas contagens** — mais informação do que a frase anterior
  carregava —, e passa pelas mesmas guardas de todo padrão (amostra mínima, corte do zero bem
  avaliado, descarte do redundante, ordem por contagem absoluta).

  ⚠️ **A auditoria mediu um custo e ele foi corrigido, não aceito:** o par de produtos passou a
  disputar o mesmo teto de três, e com isso quase esvaziou o cruzamento que **é** o `P8` — daí a
  **BR6b**, com os números acima.

  **Barreiras nos dois sentidos, verificadas:** restaurada a proibição do par do mesmo tipo, **7
  testes de core falham**; feitos os pares aparecerem também em *"O que se repete"*, **3 testes de
  tela falham**; removida a regra de variedade, **1 teste de core falha**.
- **OQ2 (CAN DEFER)** Couro cabeludo (SPEC-047 OQ4).
- **OQ3 (CAN DEFER)** Recência: um padrão de seis meses atrás pesa igual a um de semana passada.
  Precisa de `executedOn` de volta em `InsightFact` (removido por falta de consumidor, SPEC-047
  §15.2) e de uma decisão sobre janela.
