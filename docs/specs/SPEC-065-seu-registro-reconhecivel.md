# SPEC-065 — "Seu registro": ela reconhece o vidro na hora de marcar

| Campo | Valor |
|---|---|
| ID | SPEC-065 |
| Status | Approved (frente escolhida pelo agente pelo critério de maior valor de produto, §0.3/§0.4) |
| Owner | dono do produto |
| Bounded Context | Care Tracking (Wash Day) — **apresentação apenas** |
| Related ADRs | ADR-001, ADR-007 A1 / D-26 / D-70 |
| Related SPECs | SPEC-024 (o registro), SPEC-025 (couro), SPEC-039/048 (finalização), SPEC-054/057/058 (o catálogo), SPEC-063 (a mesma identidade, no cuidado) |
| Direção | `docs/design/UI-INTELLIGENCE.md` |
| Criado / Atualizado | 2026-09-09 / 2026-09-09 |

## 1. Por que esta, agora

A North Star é **REGISTRAR → ENTENDER → IDENTIFICAR PADRÕES → COMPARAR → ADAPTAR → RECOMENDAR**, e
as três últimas estão atrás do D-26. Das que sobram, **REGISTRAR é a primeira e é a que alimenta
todas as outras**: `P2`, `P6`, `P8` e `P13` leem exatamente o que esta tela grava. Uma tela de
registro difícil não produz uma camada de inteligência pobre — produz uma camada **vazia**.

E é a mesma queixa que o dono fez sobre a prateleira dentro do cuidado — *"uma lista seca de nomes"*
— só que aqui ela custa mais: no cuidado ela **lê**; aqui ela precisa **reconhecer para tocar**.

## 2. Problem — medido a 390px no DEV real

Prateleira real da usuária de desenvolvimento, sete produtos, tela **Seu registro** da Hidratação:

| O que se vê | Medida |
|---|---|
| Chips que ocupam a linha inteira sozinhos | **4 de 7** |
| Linhas gastas pelos sete produtos | 5 |
| Fotos exibidas, com ~90% de cobertura no catálogo | **0** |
| Nome truncado pela marca | *"Wella Professionals · Invigo Nutri-Enrich Dee…"* |

⚠️ **O chip parou de funcionar quando o catálogo chegou, e isso é medição, não gosto.** A grade de
pílulas existe para rótulo curto: *"truns"*, *"oleo"* e *"Máscara da feira"* ainda cabem três numa
linha. Nome de catálogo não cabe nenhum — então a "grade" já virou **uma lista vertical de pílulas de
larguras desiguais**, com o custo do chip e nenhum benefício dele.

⚠️ **E o truncamento é o mesmo defeito que a SPEC-063 mediu e corrigiu no painel do cuidado**, ainda
vivo aqui: `marca · nome` num texto só, com a marca comendo o nome. Lá a consequência era ler errado;
aqui é **tocar errado**.

## 3. Goals

- G1 — Ela **reconhece o vidro** antes de tocar: foto (ou monograma), nome dela inteiro, marca e
  categoria.
- G2 — O nome dela nunca é comido pela marca (a regra da SPEC-054, aplicada onde ela escolhe).
- G3 — Marcar continua custando **um toque**, e nada vira obrigatório.
- G4 — Alvo de toque confortável no iPhone.

## 4. Non-Goals

- NG1 — ⛔ **Nenhuma sugestão, pré-seleção, destaque ou reordenação por uso.** §5.
- NG2 — ⛔ Não agrupar, reclassificar nem reordenar as catorze técnicas. §6.
- NG3 — ⛔ Nenhuma afirmação de adequação, eficácia ou indicação (D-26/D-70) — a barreira da
  SPEC-063 vale igual aqui.
- NG4 — Nenhuma escrita nova, nenhum campo novo, nenhuma pergunta nova. `submitCheckIn` e o hub do
  Wash Day não mudam de forma.
- NG5 — Nenhuma dependência, migration, RPC, policy ou token novo.

## 5. ⛔ A recusa que protege o dado, e é a decisão central desta SPEC

O painel do cuidado (SPEC-063) mostra *"Você usou na última Hidratação"*, e seria fácil trazer isso
para cá: pré-marcar aqueles produtos, ou pô-los no topo, "para poupar toques dela".

⛔ **Não entra, e o motivo não é o D-26 — é integridade de dado.** Esta tela é a **fonte** de tudo o
que a camada de inteligência lê. Um produto pré-marcado que ela não desmarcou vira um fato que ela
nunca afirmou, e esse fato volta depois como *"esteve em 4 dos 6 cuidados que você avaliou bem"* —
uma repetição que o **app** criou, lida por ela como descoberta sobre a própria rotina.

⚠️ **Reordenar por uso tem a mesma forma, mais suave:** pôr no topo o que ela costuma marcar aumenta
a chance de ela marcar de novo, e a camada que aprende com isso passa a aprender com a própria
sugestão. **A ordem continua sendo a da prateleira** (`created_at desc`, a mesma da aba Prateleira),
que é fato dela e não opinião do app.

## 6. ⛔ E o que NÃO se toca nesta rodada

As catorze técnicas de *"Como você fez"* são uma parede de chips, e a tentação é agrupá-las.
⛔ **Não.** Seis delas são movimentos de finalização, e a SPEC-039 §8 tem **três travas executáveis**
contra reclassificar esse vocabulário (D-102): agrupar por afinidade é reclassificar com outro nome,
e reescreveria o registro que já é dela. Rótulo curto e sem identidade é exatamente o caso em que o
chip funciona — ele fica.

## 7. Functional Requirements

- FR1 — Os produtos da prateleira viram **linhas selecionáveis**: `ProductMark` (foto ou monograma),
  o **nome dela** na primeira linha, marca e categoria na segunda (`ProductCaption`).
- FR2 — Marcar e desmarcar continuam sendo **um toque na linha inteira**.
- FR3 — O estado marcado é visível por **cor e por marca de seleção**, não só por borda.
- FR4 — Nome longo trunca; ⛔ nunca transborda nem empurra a marca de seleção para fora.
- FR5 — Couro cabeludo, técnicas e finalização continuam em `Chip`, sem mudança.
- FR6 — A linha inteira tem alvo de toque ≥ 44pt (SPEC-060 fatia 2).
- FR7 — Cadastrar um produto novo daqui continua funcionando e continua chegando **já marcado**
  (SPEC-024).
- FR8 — A prateleira vazia continua sendo **convite**, não beco.

## 8. Business Rules

- BR1 — A ordem é a que a porta devolve. ⛔ Nenhuma ordenação por uso, mérito ou frequência (§5).
- BR2 — ⛔ Nenhum produto começa marcado (§5).
- BR3 — A identidade do produto sai de **um lugar só** (`ProductIdentity`), como na prateleira e no
  cuidado — três cópias discordariam na primeira renomeação (a lição do `FINISH_TECHNIQUE_LABEL`).
- BR4 — O nome dela lidera; marca e categoria descem (SPEC-054 / SPEC-063).

## 9. Data Model / API / Authorization / Privacy

**Nenhum impacto.** Zero migration, zero RPC, zero policy, zero coluna, zero leitura nova. Cada
marcação continua sendo a escrita própria da SPEC-024, que volta atrás sozinha quando falha.

## 10. Edge Cases

- EC1 — Produto manual sem catálogo: monograma, sem marca, categoria presente.
- EC2 — Produto de catálogo sem foto (≈10%): mesmo monograma, marca presente.
- EC3 — Nome muito longo: trunca em uma linha, e a marca de seleção continua no lugar.
- EC4 — Prateleira vazia: o convite de sempre (FR8).
- EC5 — Escrita de marcação falha: a linha volta ao estado anterior e a tela nomeia qual falhou
  (comportamento da SPEC-024, preservado).
- EC6 — Prateleira grande: a lista rola. ⚠️ Com nome de catálogo, o chip **já** gastava uma linha por
  produto (§2), então a linha não é mais alta — é a mesma altura carregando foto e nome inteiro.

## 11. Acceptance Criteria

- AC1 — Cada produto oferecido mostra foto ou monograma, nome inteiro dela e marca/categoria.
- AC2 — Nenhum produto começa marcado, e a ordem é a da porta (teste).
- AC3 — Um toque marca; outro desmarca; a escrita é a mesma de antes (teste).
- AC4 — Nenhum texto da tela cai na lista proibida de adequação (teste).
- AC5 — Alvo de toque ≥ 44pt (teste).
- AC6 — Validado a 390px no DEV real, marcando e desmarcando com reload, console limpo.

## 12. O que só se prova em iPhone nativo

⛔ Carregamento de imagem em rede móvel, Dynamic Type e sensação de toque (gate G7). O 390px prova
hierarquia, truncamento, fallback e o fluxo de marcação.

## 12.1 Evidência — o que foi medido

⚠️ **Um achado da auditoria, e ele é do mesmo tipo que a SPEC-064 acabou de corrigir.** A primeira
versão de `ProductPickRow` tinha um prop `disabled` e um estilo de "marcação em voo" — e **nenhum
consumidor passa `disabled`**, porque a marcação aqui é **otimista**: a tela muda na hora e volta
atrás sozinha se a escrita falhar (SPEC-024 §16). Era estado especulativo, que a AC3 da SPEC-016
chama de bug por escrito (*"primitiva sem consumidor real"*). Removido, com a razão registrada no
lugar dele para não voltar por distração.

⚠️ **Um teste guardava a apresentação antiga**, exatamente como na SPEC-063: ele afirmava
`'Wella · Invigo Nutri-Enrich'` num texto só — a concatenação que **truncava o nome dela**. Reescrito
para afirmar a **intenção** da SPEC-054 (a marca acompanha, não substitui), que com o nome sozinho na
primeira linha fica mais verdadeira, não menos.

✅ **Validado a 390px no DEV real, console limpo, com a prateleira real de sete produtos:**

| O que foi medido | Resultado |
|---|---|
| Fotos reais do catálogo exibidas | 3 (Wella, L'Oréal, Wella) |
| Monogramas onde não há foto | 4 (`C` · `T` · `O` · `M`) |
| Altura de cada linha | **62pt** (piso do iOS: 44) |
| Nome comido pela marca | **nenhum** |
| Produtos marcados ao abrir | **0** |

**Jornada inteira:** marcar *"Máscara da feira"* → a linha fica em ameixa, com o nome em negrito e a
marca de seleção → sair por *"Pronto"* → voltar por *"Ver o que contei"* → **continua marcada** →
desmarcar → sair e voltar → **continua desmarcada**. O histórico do DEV ficou como estava.

⚠️ **E a medição confirmou o caveat da SPEC-051 OQ4:** `aria-checked` volta `null` para as sete
linhas no preview web — o `react-native-web` 0.21 descarta o `accessibilityState` legado. **Não é
defeito do produto** (a API é a suportada no iOS/Android), e é exatamente por isso que a FR3 exige um
canal **visível**: a 390px o estado se afere pela cor e pela marca de seleção, não por ARIA.

## 13. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-09 | Auditoria: `disabled` sem consumidor removido (marcação é otimista e volta atrás sozinha); teste que guardava a concatenação antiga reescrito para a intenção | agente |
| 2026-09-09 | Criada. ⚠️ A medição a 390px mostrou que o chip já tinha parado de funcionar (4 de 7 ocupando a linha inteira), e a recusa central é de **integridade de dado**: nada é pré-marcado nem reordenado por uso, porque esta tela é a fonte do que a camada de inteligência lê | agente |
