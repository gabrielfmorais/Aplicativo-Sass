# SPEC-055 — A Hoje com alma: afordância, hierarquia e a cor do cuidado

| Campo | Valor |
|---|---|
| ID | SPEC-055 |
| Status | **IMPLEMENTED** (2026-09-07) — validada a 390px no DEV real, com captura antes e depois (§12) |
| Owner | dono do produto |
| Bounded Context | UI (`apps/mobile/src/design`, `src/features/care`, `src/features/shelf`) |
| Related ADRs | D-80 (web é ambiente de validação), D-101, D-26/D-70 |
| Related SPECs | SPEC-016 (o design system), SPEC-026/027/035 (as rodadas visuais anteriores), SPEC-041 (`F48`), SPEC-054 (a miniatura) |
| Fase do roadmap | Auditoria visual pedida pelo dono em 2026-09-07 |
| Criado / Atualizado | 2026-09-07 / 2026-09-07 |

## 1. Context

O dono olhou o produto e disse:

> *"A Huna ainda está funcionalmente boa, mas visualmente sem alma. Quero mais identidade
> vinho/ameixa, hierarquia, estados ativos claros e refinamento premium, especialmente Hoje, cards do
> cuidado, ações 'Como fazer / Meus produtos / Reagendar / Pular' e Minha Prateleira."*

⚠️ **A paleta não é o problema — ela já existe e é boa.** Vinho, ameixa, berry, roxo, os quatro tons
de cuidado e as superfícies suaves foram medidos na SPEC-026 e continuam lá. O problema é **onde eles
não chegam**.

## 2. Problem — o que a medição mostrou

⚠️ **O app usa a variante INVISÍVEL de botão mais do que qualquer outra.** Contado no repositório:

```
variant="ghost"      46 usos     ← fundo transparente, sem borda, texto cinza
variant="secondary"  30 usos
```

E **13 dos 46 estão na Hoje**. `ghost` é `backgroundColor: 'transparent'` com `tone: 'muted'`: uma
ação pintada assim **não tem corpo**. Ela não é discreta — ela é **ausente**.

O efeito, olhando a tela real a 390px:

- **A** — ⚠️ **As quatro ações que o dono nomeou são texto cinza solto**, num bloco sem contorno.
  No cartão de foco elas ficam sobre `brandTint`: **cinza sobre tinta lê como desabilitado**. A
  usuária não tem como saber que são tocáveis a não ser tocando.
- **B** — ⚠️ **A cor do tipo de cuidado é um ponto de 8px.** Os tokens prometem, por escrito, que
  *"a cor é uma segunda forma de ler o plano"*; na prática **três cuidados de tipos diferentes são
  três retângulos brancos idênticos**, e a única diferença é uma bolinha.
- **C** — **`Fiz hoje` nos próximos é `secondary` pequeno, colado à esquerda**: a ação principal do
  cartão parece a menos importante dele.
- **D** — **"Sua jornada" é uma linha cinza solta** entre o cartão de foco e "Próximos". Sem cartão,
  sem contorno, sem seta: parece um rótulo esquecido, não uma porta.
- **E** — ⚠️ **Regressão da SPEC-054, e é minha:** a miniatura de produto reserva um quadrado cinza
  quando não há imagem. Com o catálogo vazio — **o estado permanente até a ingestão** — a Prateleira
  ganhou três caixas em branco que leem como **imagem quebrada**. Um espaço reservado que nunca
  preenche é pior que nenhum.

## 3. Goals

- G1 — **Toda ação tem corpo.** Uma coisa tocável se parece com uma coisa tocável.
- G2 — **O tipo do cuidado se lê pela cor do cartão**, não por uma bolinha.
- G3 — **Uma hierarquia por cartão:** uma ação principal, ações de apoio, e a saída mais quieta.
- G4 — A Prateleira para de mostrar um lugar de foto que não vai ser preenchido.
- G5 — **Zero dependência nova e zero primitiva nova sem consumidor** (SPEC-016 AC3).

## 4. Non-Goals

- NG1 — ⛔ **Não é uma nova identidade.** A paleta da SPEC-026 fica como está; o que muda é onde ela
  aparece. Cor nova aqui seria resolver o sintoma errado.
- NG2 — ⛔ **Não se troca `ghost` nos 46 lugares.** O raio de alcance seria o app inteiro numa
  rodada. Esta fatia arruma **as superfícies que o dono nomeou** e deixa a regra escrita (§7 BR3).
- NG3 — ⛔ **Nenhum texto muda de sentido.** É afordância e hierarquia, não copy — e nada aqui passa
  perto de conteúdo capilar (D-26/D-70).
- NG4 — ⛔ **Nenhuma cor de cuidado vira cor de ação.** Ameixa continua sendo a única ação
  (SPEC-026 FR16); as cores de cuidado **informam**, e agora informam melhor.
- NG5 — **Sem ícones novos.** Os quatro da barra são um conjunto medido (SPEC-035); acrescentar
  ícone às ações do cartão é outra rodada, com outro custo.

## 5. Functional Requirements

- FR1 — **`Como fazer`, `Meus produtos` e `Reagendar` passam a ter contorno** (`variant="secondary"`).
  Elas são ações de apoio: têm corpo, e não competem com a principal.
- FR2 — ⚠️ **`Pular` continua sem contorno, e agora isso SIGNIFICA alguma coisa.** Quando tudo é
  invisível, invisível não comunica nada; ao lado de irmãs com corpo, a mais quieta lê como **a
  saída**. É a única das quatro que desfaz um compromisso.
- FR3 — **`Fiz hoje` é `primary` em todo cartão acionável**, não só no de foco. É a ação principal
  do cartão, e era a que menos parecia.
- FR4 — **O cartão do cuidado ganha uma faixa da cor do tipo** na borda esquerda. Três cuidados
  diferentes passam a se distinguir **antes de a pessoa ler**.
- FR5 — **"Sua jornada" ganha corpo** (`secondary`): é uma porta para outra tela, e portas se
  parecem com portas.
- FR6 — **A miniatura de produto só ocupa espaço quando existe imagem.** Sem catálogo, a linha da
  Prateleira volta a ser exatamente a de antes da SPEC-054.
- FR7 — Todo alvo continua com no mínimo `HIT_TARGET`, e nenhum contraste cai (§8).

## 6. UX Notes

- A faixa de cor é **4px na borda esquerda** do cartão, no `careColor[tipo].fg`. É **forma, não
  texto** — não carrega leitura, então não há requisito de contraste sobre ela; e é a mesma cor que
  a bolinha já usava, agora com tamanho suficiente para ser vista de relance.
- O cartão de foco mantém o fundo `brandTint` e a borda de acento; a faixa de cuidado entra **por
  cima** disso, na esquerda. As duas coisas dizem coisas diferentes: a tinta diz *"é o de hoje"*, a
  faixa diz *"é hidratação"*.
- ⚠️ **Nada vira mais alto.** A afordância vem de contorno, não de padding: um cartão que ficasse
  20% mais alto para caber botões maiores trocaria um problema por outro (a rolagem de duas telas
  que a SPEC-026 já mediu uma vez).

## 7. Business Rules

- BR1 — **Ameixa é ação, e só ela** (SPEC-026 FR16, herdada e intocada).
- BR2 — **A cor do cuidado informa, nunca decora**: ela aparece onde diz *qual cuidado é*, e em
  lugar nenhum onde diga *o que fazer*.
- BR3 — ⚠️ **A regra que fica escrita para as próximas telas:** `ghost` é para a ação que **deve**
  ser a mais quieta da tela — a saída, o cancelar, o desfazer. **Não é o padrão de "ação
  secundária"**; esse é `secondary`. Foi usá-lo como padrão que deixou 46 ações sem corpo.

## 8. Acceptance Criteria

- AC1 — As três ações de apoio têm contorno visível; `Pular` não. **Teste.**
- AC2 — `Fiz hoje` é `primary` em cartão de foco **e** de lista. **Teste.**
- AC3 — O cartão carrega a cor do tipo, e tipos diferentes carregam cores diferentes. **Teste.**
- AC4 — Sem imagem, **nenhum** espaço de miniatura é renderizado. **Teste.**
- AC5 — Contraste: nenhum par novo abaixo de AA; a faixa é forma e não carrega texto. **Teste de
  paleta**, que já percorre `careColor`.
- AC6 — **Validação a 390px no DEV real** (D-90), com captura antes e depois.

## 9. Testing Strategy

RNTL para a variante de cada ação e para a ausência da miniatura; o teste de contraste que já existe
cobre a paleta; e a comparação visual a 390px, que é o que reprova ou aprova uma rodada como esta.

## 10. Open Questions

- **OQ1 — CAN DEFER — as outras 30 `ghost` do app.** A regra está escrita (BR3), e as telas que o
  dono não nomeou entram quando forem olhadas. ⛔ Trocar as 46 numa rodada seria mexer no app inteiro
  sem ninguém ter olhado o resultado — exatamente o que as rodadas visuais anteriores evitaram.
- **OQ2 — CAN DEFER — ícone nas ações do cartão.** Os quatro ícones da barra são um conjunto medido
  (SPEC-035); um quinto e um sexto exigem a mesma medição de massa óptica, e isso é uma rodada
  própria.

## 12. O que a comparação a 390px mostrou

**Antes** — três cuidados de tipos diferentes: **três retângulos brancos idênticos**, com uma bolinha
de 8px como única diferença. Quatro rótulos cinza flutuando num bloco sem contorno, e `Fiz hoje`
como um botão pequeno de contorno colado à esquerda. *"Sua jornada"* como uma linha de texto solta.

**Depois** — cada cartão carrega **a faixa da própria cor** (âmbar · teal · violeta), a ação
principal é **ameixa cheia**, as três de apoio têm corpo, e `Pular` é a única sem — que é o que a
torna legível como **a saída**. A Prateleira perdeu as três caixas cinza e ganhou um botão com
forma de botão.

### 12.1 Uma decisão que EU quase tomei errado

⚠️ **Com a faixa no cartão, o ponto de 8px ao lado do título vira redundante** — mesma cor, mesmo
significado, a 23px de distância. O impulso foi removê-lo, e teria sido um erro.

O `CareTypeMark` existe para manter **a palavra e o tom juntos**, e o argumento está escrito nele:
*"o usuário que não separa teal de âmbar ainda lê 'Hidratação' e 'Nutrição'"*. Tirar o ponto do lado
do rótulo deixaria a cor só na borda do cartão — **longe da palavra que ela qualifica** —, e trocaria
uma redundância leve por uma perda de acessibilidade. Ele também é o **único** canal de cor na
Progresso, que não tem faixa.

**O ponto fica.** A redundância é o preço de manter o par palavra+tom, e é um preço barato.

## 11. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-07 | v0.1 — a partir da auditoria visual pedida pelo dono, com as telas reais capturadas a 390px. | agente |
| 2026-09-07 | v0.2 — **IMPLEMENTADA e validada a 390px**, com captura antes e depois (§12). A medição que abriu a rodada: `ghost` era a variante **mais usada do app** (46 × 30), com 13 na Hoje. Consertada de quebra uma **regressão da SPEC-054** — a miniatura reservava um quadrado cinza que, com o catálogo vazio, lia como imagem quebrada. | agente |
