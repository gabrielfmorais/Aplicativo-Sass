# SPEC-062 — "Como fazer": o primeiro piloto da UI Intelligence

| Campo | Valor |
|---|---|
| ID | SPEC-062 |
| Status | Approved (o dono escolheu esta área como **piloto obrigatório** da UI Intelligence, 2026-09-09) |
| Owner | dono do produto |
| Bounded Context | Content (DOMAIN-MAP §3.8) — **apresentação apenas** |
| Related ADRs | ADR-001 (camadas), ADR-007 A1 / D-26 / D-70 (governança de conteúdo capilar) |
| Related SPECs | SPEC-007 (o conteúdo dos guias), SPEC-031 (a biblioteca), SPEC-016 (design system), SPEC-055 (afordância), SPEC-060/061 (iPhone-first) |
| Direção | `docs/design/UI-INTELLIGENCE.md` |
| Criado / Atualizado | 2026-09-09 / 2026-09-09 |

## 1. Context

A UI Intelligence estabeleceu a cadeia de decisão visual permanente. O dono escolheu **"Como fazer"**
como a primeira área a atravessá-la inteira — não por ser a mais quebrada, mas por ser onde o produto
**ensina**, e onde parecer barato custa confiança.

## 2. Problem — medido na tela real, não deduzido

Aberto a 390px no DEV, o guia da Hidratação mostra o defeito inteiro numa tela: **tudo é o mesmo
texto**. Objetivo, passos e erros comuns saem no mesmo tamanho, no mesmo peso e quase na mesma cor.

- **A duração é texto cinza claro** no canto (`~20 min`), do mesmo peso de um rodapé.
- **O objetivo do cuidado** — a frase que responde *"por que eu faria isso?"* — tem exatamente o
  mesmo tratamento do passo 3.
- **Os passos não são passos.** `1.` e `2.` são caracteres no meio do parágrafo; o olho não tem onde
  pousar, e um procedimento que não se escaneia não é um procedimento, é um texto sobre um.
- **"Erros comuns" é um `caption` cinza** seguido de bullets no mesmo tom — lê como *mais passos*,
  que é o oposto do que ele é.
- ⚠️ **A cor do cuidado some no guia.** A `careColor` identifica o tipo em toda a Hoje e no ciclo, e
  o guia inteiro é acinzentado: a única cor é um ponto de 8px na linha que o abre.
- **Nenhum estado ativo.** Com o painel aberto, "Como fazer" continua idêntico a quando está fechado
  — a informação existe só no `accessibilityState`, invisível para quem enxerga.

## 3. Goals

- G1 — O guia se **escaneia**: dá para achar o passo 4 sem ler os passos 1 a 3.
- G2 — Cada bloco diz o que é **pela forma**, antes de ser lido: duração, objetivo, passos, cuidado.
- G3 — O guia pertence ao **tipo de cuidado** dele, pela cor que o resto do app já usa.
- G4 — Um painel aberto **parece aberto**.
- G5 — Sofisticado, feminino, moderno. ⛔ Nunca infantil, nunca template.

## 4. Non-Goals

- NG1 — ⛔ **Nenhuma palavra do conteúdo capilar muda.** Nem um passo, nem um erro comum, nem a
  duração, nem a ordem. `CARE_GUIDES_V1` **não é tocado**, e o status `candidate` e o gate
  D-26/D-70/OQ-REL seguem exatamente como estão. Esta é uma entrega de **apresentação**.
- NG2 — Nenhuma dependência nova, nenhum token de cor novo, nenhum número de espaçamento novo.
- NG3 — Nada de ícone decorativo. Ícone só onde acrescenta clareza que a palavra não dá.
- NG4 — Não mexer no cronograma, no motor, na lógica de domínio nem em nenhuma regra clínica.
- NG5 — Não criar um segundo design system: só `tokens.ts` e `primitives.tsx`.

## 5. Functional Requirements

- FR1 — **A duração vira um chip**, tingido com a cor do tipo de cuidado, no topo do guia.
- FR2 — **O objetivo é o primeiro bloco e lidera** — corpo mais forte que o dos passos, separado
  deles.
- FR3 — **Cada passo ganha um marcador numerado circular**, preenchido com o tom claro do cuidado e
  o número na cor dele, alinhado ao texto do passo.
- FR4 — **"Erros comuns" vira um bloco de atenção próprio**: superfície tingida, título próprio,
  separado dos passos por forma e não só por espaço.
- FR5 — **`Button` ganha estado `active`**, pintado com a família ameixa (fundo `accentSoft`, borda
  `accent`, texto `accent`) — o mesmo vocabulário de "escolhido" que o `Chip` já usa. Consumido de
  imediato por **Como fazer**, **Meus produtos** e **Reagendar** no cartão da Hoje.
- FR6 — A abertura do guia usa o `Reveal` que já existe, portanto **atrás de `useReduceMotion()`**.

## 6. Business Rules

- BR1 — ⚠️ **Apresentação não pode acrescentar afirmação.** O bloco de atenção destaca o que o texto
  já diz; ⛔ ele não pode introduzir urgência, risco ou consequência que o conteúdo não afirma. É a
  fronteira exata do D-70: o gate segue o **conteúdo**, e realçá-lo não o altera.
- BR2 — A cor do guia é **sempre** `careColor[guide.careTypeCode]`. ⛔ Nunca uma cor escolhida à mão:
  um tipo tem uma cor só, em todo o app.
- BR3 — O bloco de atenção usa a família `danger`, e **não** um tom de cuidado: âmbar é a Nutrição, e
  um aviso em âmbar dentro de um guia de Hidratação leria como referência a outro cuidado.
- BR4 — `active` é canal **visual**; a semântica para leitor de tela continua sendo `expanded`, que
  já existia. ⛔ Não trocar um pelo outro: `selected` diria à tecnologia assistiva que o botão é uma
  opção escolhida, e ele não é — ele abre um painel.

## 7. Data Model / API / Authorization / Privacy

**Nenhum impacto em nenhum dos quatro.** Zero migration, zero RPC, zero policy, zero leitura nova,
zero dado pessoal. O guia é constante do bundle (SPEC-007 §16): sem rede, funciona offline, e não há
estado de carregamento, erro ou retry a projetar.

## 8. Edge Cases

- EC1 — Guia com 3 passos e com 6: o ritmo tem de aguentar os dois extremos do schema.
- EC2 — Passo longo, que quebra em três linhas: o número fica alinhado ao **topo** do texto, não
  centralizado, senão ele flutua no meio do parágrafo.
- EC3 — Redução de movimento ligada: sem animação, e o conteúdo aparece igual.
- EC4 — Guia dentro do cartão da Hoje (com duração) e dentro da biblioteca (sem duração, porque a
  linha que abre já a diz — SPEC-031).
- EC5 — Os quatro tipos, inclusive Restauração, que tem a cor mais recente (SPEC-038).

## 9. Acceptance Criteria

- AC1 — `CARE_GUIDES_V1` byte a byte inalterado, com teste que falha se o conteúdo mudar.
- AC2 — A cor do guia é a do tipo, para os quatro tipos.
- AC3 — Nenhum literal de cor e nenhum número solto de espaçamento no arquivo (SPEC-016 FR2).
- AC4 — `Button active` pinta a família ameixa e mantém `expanded` como canal de acessibilidade.
- AC5 — Validado a 390px no DEV real, nos quatro tipos, console limpo.

## 10. Testing Strategy

RNTL sobre o painel (marcadores numerados presentes e na ordem; bloco de atenção presente; cor por
tipo), um teste de imutabilidade do conteúdo (AC1) e um do `Button active` (AC4). O resto do app
segue verde: nenhum contrato muda.

## 11. O que só se prova em iPhone nativo

⛔ Motion real (curva e cadência sob o compositor do iOS), Dynamic Type nas fontes do sistema, e a
sensação de toque. O preview a 390px prova **layout, hierarquia, cor e fluxo** — e é isso que ele
prova, nada além (gate G7).

## 11.1 Evidência — o que foi medido

**Contraste, para cada superfície nova, e agora com barreira de teste** (a SPEC-035 mediu 1,03:1
numa pastilha que "existia" no código-fonte e não na tela):

| Par | Razão |
|---|---|
| texto do botão aberto sobre a tinta ameixa | **7,56** |
| título "Erros comuns" sobre o blush | **5,48** |
| corpo do erro sobre o blush | **12,61** |
| marcador numerado, o menor dos quatro tipos | **4,92** |

**O estado aberto, medido no navegador real** e não inferido: o botão do painel aberto é
`rgb(246,233,239)` com borda `rgb(122,47,82)`; os outros quatro são brancos com a borda cinza —
**exatamente um** ativo, e é o do painel que está aberto.

**Validado a 390px no DEV real, console limpo**, nos dois lugares onde o guia vive: a biblioteca em
Cuidados (sem chip, SPEC-031) e o cartão da Hoje (com chip). O passo de três linhas confirmou a EC2 —
o marcador fica no topo do parágrafo, não no meio dele.

## 11.2 O que a auditoria achou

⚠️ **`mistakeDot` usava `space.xs + 2`.** Os tokens dizem por escrito que as telas *"nunca inventam
um número no meio"* do ritmo de 4, e somar 2 a um token inventa exatamente isso. São dois pixels — e
é assim que a deriva começa. Corrigido para `space.xs`.

⚠️ **Dois testes guardavam a apresentação antiga, não o conteúdo.** Exigiam `"1. " + passo` e
`"• " + erro` — strings que só existiam porque o prefixo estava colado no texto. Passaram a afirmar
o **texto do passo** e o **marcador** separadamente, o que é mais forte: verifica o conteúdo (que não
pode mudar) e a numeração (que é o que devolve o escaneio).

## 12. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-09 | Criada como o piloto obrigatório da UI Intelligence, por escolha do dono | agente |
