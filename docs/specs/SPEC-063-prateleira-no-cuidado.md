# SPEC-063 — A prateleira dentro do cuidado, como produto de verdade

| Campo | Valor |
|---|---|
| ID | SPEC-063 |
| Status | Approved (frente obrigatória definida pelo dono em 2026-09-09) |
| Owner | dono do produto |
| Bounded Context | Care Tracking + Hair Profile (produtos) — **apresentação** |
| Related ADRs | ADR-001, ADR-007 A1 / D-26 / D-70 |
| Related SPECs | SPEC-041 (`F48`, este painel), SPEC-023 (a prateleira), SPEC-054/057 (o catálogo), SPEC-024 (o registro), SPEC-062 (o piloto da UI Intelligence) |
| Direção | `docs/design/UI-INTELLIGENCE.md` |
| Criado / Atualizado | 2026-09-09 / 2026-09-09 |

## 1. Context

O dono olhou a seção *"Na sua prateleira"* dentro do cuidado e disse o que ela é hoje: **uma lista
seca de nomes**. Ela não deixa claro nada — nem o que ela usou, nem o que ela tem, nem o que é cada
vidro. É a segunda aplicação da UI Intelligence, e desta vez numa área que já existia e cumpria a
função sem cumprir a experiência.

## 2. ⚠️ A auditoria que o dono pediu, e o que ela mudou no pedido

O pedido original dizia *"um produto principal da prateleira **para aquele cuidado**"*, *"outras
opções **compatíveis**"* e o rótulo *"Produto para esta etapa"* — e o próprio dono mandou auditar
antes: *"audite se a classificação atual realmente autoriza essa afirmação"*.

**Ela não autoriza.** As categorias são `shampoo · conditioner · mask · leave_in · oil · styler ·
other`, e o motivo está escrito no próprio vocabulário:

> *"Categoria é organização de prateleira, não afirmação capilar. Nenhum valor diz para que serve ou
> o que faz — 'máscara' é um tipo de vidro no banheiro, não uma promessa. É essa contenção que mantém
> a capability fora do gate de domínio (D-26/D-70), e ela se perde na primeira palavra a mais."*

⚠️ **E o conteúdo confirma:** os guias dizem *"aplique a máscara de hidratação"* **e** *"aplique a
máscara de reconstrução"*. A mesma categoria serve aos quatro tipos. **Nada no sistema associa
produto a etapa** — mapear `mask → Hidratação` seria engenharia inventando a regra capilar que a
D-26 existe para impedir.

⛔ **Consequência direta:** *"para este cuidado"*, *"produto para esta etapa"* e *"opções
compatíveis"* **não entram**. Todas as três afirmam adequação que o sistema não sabe.

## 3. O que o sistema SABE, e é melhor

`washDays.lastUsedFor(careTypeCode)` devolve os produtos que **ela marcou na última vez que fez este
mesmo tipo de cuidado**. É fato dela, registrado por ela, e já existe desde a SPEC-041.

⚠️ **Isso é mais forte que uma regra inventada**, e é a North Star funcionando: o destaque emerge do
**histórico dela**, não de uma tabela que alguém escreveu. Quanto mais ela usa, melhor esse destaque
fica.

## 4. Goals

- G1 — No momento do cuidado, ela reconhece **o vidro**: foto, marca, nome e categoria.
- G2 — O que ela **usou da última vez neste tipo de cuidado** tem destaque próprio.
- G3 — O resto da prateleira deixa de ser lista de nomes e vira linhas legíveis.
- G4 — Produto sem foto (o manual) tem fallback **elegante**, não buraco.
- G5 — Estado vazio bonito e honesto.

## 5. Non-Goals

- NG1 — ⛔ **Nenhum filtro, ordem ou rótulo por adequação ao cuidado.** Sem "compatível", sem "para
  esta etapa", sem "recomendado", sem ranking. A barreira da SPEC-041 continua inteira e ganha teste.
- NG2 — ⛔ Nenhuma afirmação de eficácia, indicação, composição, benefício ou resultado.
- NG3 — Nenhuma escrita: este painel é leitura. Marcar o que usou é a tela de registro (SPEC-024).
- NG4 — Nenhuma dependência nova, nenhum token novo, nenhum segundo design system.
- NG5 — Não mexer no cronograma, no motor, nem em regra de domínio.

## 6. Functional Requirements

- FR1 — **Bloco de destaque** com o que ela usou na última vez deste tipo, rotulado por **fato**:
  *"Você usou na última <Cuidado>"*.
- FR2 — Cada produto em destaque mostra **foto (ou fallback), marca, nome e categoria**.
- FR3 — ⚠️ **Não existe "o principal" escolhido pelo app.** Se ela marcou três produtos, os três são
  fato igual, e os três aparecem no destaque. Eleger um seria inventar uma ordem de mérito que o dado
  não tem — a mesma recusa que mantém a `P7` fora da Smart Shelf.
- FR4 — **O resto da prateleira vira linhas** com foto/fallback, marca · nome e categoria — não mais
  `Tag` de nome cru. Rótulo: *"Outros da sua prateleira"*.
- FR5 — **Fallback sem foto**: um monograma tingido com a letra inicial do nome **dela**. Não é caixa
  reservada vazia — é identidade, e é o que mantém as linhas alinhadas.
- FR6 — Nome longo trunca; ⛔ nunca transborda nem empurra a foto para fora.
- FR7 — Estados de `loading`, `error` e vazio continuam existindo e continuam **discretos**: é
  conveniência, não a tela — um erro aqui nunca impede o cuidado.
- FR8 — `CATEGORY_LABEL` passa a ter **um dono só**.

## 7. Business Rules

- BR1 — ⛔ **Nenhum texto desta tela pode afirmar adequação.** Proibidas, com barreira de teste:
  *recomend·*, *ideal*, *indicad·*, *melhor*, *combina*, *compatív·*, *adequad·*, *para este
  cuidado*, *para esta etapa*, *perfeito*.
- BR2 — A ordem do resto da prateleira é a que a porta devolve. ⛔ Nenhuma ordenação por mérito.
- BR3 — O destaque só existe quando há fato: **sem registro anterior, não há destaque** — e ⛔ não se
  inventa um substituto escolhendo um produto qualquer.
- BR4 — Marca vem **junto** do nome, nunca no lugar dele (SPEC-054): o nome é o que ela reconhece.

## 8. Data Model / API / Authorization / Privacy

**Nenhum impacto.** Zero migration, zero RPC, zero policy, zero coluna, zero leitura nova — usa
`lastUsedFor` e `products.list()`, que já existem, sob a RLS que já vale.

## 9. Edge Cases

- EC1 — Nunca fez este cuidado, ou fez e não registrou: sem destaque, só a prateleira (BR3).
- EC2 — Prateleira vazia **e** sem histórico: o convite a cadastrar.
- EC3 — Produto manual, sem catálogo: monograma, marca ausente, categoria presente.
- EC4 — Produto de catálogo sem foto (≈10% do acervo): mesmo monograma, marca presente.
- EC5 — Nome muito longo: trunca em duas linhas no destaque, uma na linha secundária.
- EC6 — Ela marcou 3 produtos na última vez: os três no destaque (FR3).
- EC7 — Produto arquivado que aparece no histórico: continua no destaque (foi usado), e some da
  prateleira ativa — as duas leituras respondem perguntas diferentes (SPEC-049).

## 10. Acceptance Criteria

- AC1 — Nenhum texto da tela cai na lista da BR1, com teste.
- AC2 — O destaque é rotulado pelo fato e nomeia o cuidado.
- AC3 — Sem histórico, não há destaque e nada o substitui.
- AC4 — Produto sem foto rende monograma, e a linha continua alinhada.
- AC5 — `CATEGORY_LABEL` tem uma definição só no repositório.
- AC6 — Validado a 390px no DEV real, com e sem histórico, console limpo.

## 11. ⚠️ A decisão que esta SPEC reverte, e por quê

A SPEC-041 escreveu, sobre o resto da prateleira: *"continua em `Tag`, porque ali a foto viraria uma
parede de miniaturas sobre uma lista que ela só percorre"*.

**A premissa mudou, e é medida.** Aquilo foi escrito quando o catálogo estava **vazio** — uma
miniatura não carregava nada. Hoje o catálogo tem **3.901 produtos com ~90% de foto** (SPEC-057/058),
então a miniatura passou a ser o que faz ela reconhecer o vidro. A decisão cai porque o fato que a
sustentava caiu, e não porque alguém preferiu outra coisa.

## 12. O que só se prova em iPhone nativo

⛔ Carregamento real de imagem em rede móvel, motion e sensação de toque (gate G7). O preview a 390px
prova layout, hierarquia, truncamento e fallback.

## 12.1 Evidência — o que foi medido

⛔ **BLOCKER achado pela validação no DEV real, e ele é anterior a esta SPEC.** `lastUsedFor`
escolhia o registro mais recente que **existisse**, não o mais recente **com produto** — e o registro
é feito por partes: marcar só uma técnica já o cria vazio. Medido na hidratação da usuária de
desenvolvimento:

| Execução | Registro | Produtos |
|---|---|---|
| 2026-09-06 | sim | **0** |
| 2026-09-04 | sim | 1 |
| 2026-09-03 | sim | 1 |

A função pegava o de 09-06 e devolvia nada: o destaque ficava **mudo justamente para quem tem
histórico**. O nome promete o último **uso**, não o último registro. Corrigido, com a regra extraída
como função pura e quatro testes — um deles falha no comportamento antigo.

⚠️ **IMPORTANT, visto a 390px:** a linha era `marca · nome` num texto só, e com marca longa saía
*"Wella Professionals · Invigo N…"* — **a marca truncando o nome**, o oposto do que a SPEC-054
protege. O nome dela passou a liderar sozinho; marca e categoria dividem a segunda linha.

⚠️ **IMPORTANT:** `CATEGORY_LABEL` existia **duas vezes**. Duas cópias discordam na primeira
renomeação — o defeito que a SPEC-048 já pagou com o `FINISH_TECHNIQUE_LABEL`. Agora tem um dono.

**Validado a 390px no DEV real, console limpo:** destaque *"Você usou na última Hidratação"*; o resto
da prateleira com foto real e monograma, nomes inteiros; aba Prateleira e busca do catálogo
consistentes; e o estado **sem** histórico corretamente **sem** destaque.

## 13. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-09 | Criada. ⚠️ A auditoria pedida pelo dono derrubou três rótulos do pedido original: o sistema não sabe adequação, e o destaque passou a ser o fato dela | agente |
