# SPEC-069 — A Jornada, em resumo, na Hoje

| Campo | Valor |
|---|---|
| ID | SPEC-069 |
| Status | Approved (prioridade visual definida pelo dono em 2026-09-09) |
| Owner | dono do produto |
| Bounded Context | Care Tracking (Hoje) + Journey — **apresentação apenas** |
| Related ADRs | ADR-001, **D-103** |
| Related SPECs | SPEC-043 (a Jornada), SPEC-059 (a progressão), SPEC-055 (portas se parecem com portas), SPEC-026 (a home) |
| Direção | `docs/design/UI-INTELLIGENCE.md` |
| Criado / Atualizado | 2026-09-09 / 2026-09-09 |

## 1. Problem — o que o dono viu

> *"Ela está ocupando espaço demais para entregar pouca informação e parece um bloco/botão solto na
> home."*

**Medido no código:** a entrada da Jornada na Hoje era **um botão** — `label="Sua jornada"`,
`variant="secondary"`, `size="sm"` — e **nada mais**. Ele gastava uma linha da home para dizer
**zero** sobre a jornada dela: nem nível, nem pontos, nem sequência. Um controle que não informa e
não é a ação principal da tela é exatamente o que lê como *botão solto*.

⚠️ **E ele vinha ANTES das sugestões**, disputando posição com o que é acionável hoje.

## 2. Goals

- **G1** Um **resumo compacto**: nível, pontos, sequência e a porta.
- **G2** A home passa a priorizar, nesta ordem: **data/semana · cuidado do dia (ou o estado de não
  haver um) · sugestões · resumo da Jornada**.
- **G3** ⛔ Não competir com o cuidado do dia, e não virar uma seção expandida.

## 3. Non-Goals

- **NG1** ⛔ **Nenhuma regra de gamificação nova** (D-103): todo número vem do `JourneyView` que a
  rota já carrega para a celebração e para os momentos compartilháveis.
- **NG2** ⛔ **A Jornada continua com superfície própria** (D-103). A barra de progressão, os marcos e
  o histórico ficam **na tela dela** — resumo não é a tela em miniatura.
- **NG3** ⛔ **Nenhuma cobrança**: sem *"faltam X para o próximo nível"*, sem contagem regressiva, sem
  *"não perca sua sequência"*. A entrada nasceu quieta (SPEC-043) e continua.
- **NG4** ⛔ **Nada sobre o cabelo dela** (D-103/D-26): a Jornada mede **consistência com o plano**.
- **NG5** Nenhuma dependência, leitura, porta, migration ou token novo.

## 4. Functional Requirements

- **FR1** Cartão com: rótulo *Sua jornada* · `Nível N · Nome` · pontos · sequência · CTA *Ver jornada*.
- **FR2** A sequência **só aparece quando existe** (`streak > 0`).
- **FR3** O resumo entra **depois** das sugestões.
- **FR4** Sem `JourneyView` (carregando ou falhou), o cartão **continua sendo porta** e não mostra
  número nenhum.
- **FR5** O CTA é uma porta do tamanho do que diz — ⛔ não ocupa a linha (SPEC-055).

## 5. Business Rules

- **BR1** Os números vêm da **mesma view** que a celebração e o `F46` leem. ⛔ Nada é recalculado: a
  home e a tela da Jornada não podem discordar sobre a mesma conquista (SPEC-044 BR4).
- **BR2** ⛔ *"0 cuidados em sequência"* não é informação — é uma **falta apontada na home**.
- **BR3** Pausada, a sequência **congela** (SPEC-022) e continua sendo verdade: continua aparecendo.
- **BR4** ⛔ `toNext` existe na view e **não** entra aqui: é progressão, e progressão é da tela dela.

## 6. Data Model / API / Authorization / Privacy

**Nenhum impacto.** Zero leitura nova: a rota já carrega `journey.view`; a Hoje passou a recebê-la.

## 7. Edge Cases

- **EC1** Jornada carregando ou com falha: só o rótulo e a porta (FR4) — e a porta **importa**,
  porque a tela da Jornada é quem tem o estado de erro com nova tentativa.
- **EC2** `streak === 0`: sem a linha de sequência.
- **EC3** `points === 1` / `streak === 1`: singular.
- **EC4** Outro dia selecionado na faixa da semana: a home inteira passa a ser sobre aquele dia, e o
  resumo não aparece — comportamento herdado, inalterado.

## 8. Acceptance Criteria

- **AC1** O resumo mostra nível, pontos e sequência, e a porta.
- **AC2** Sem sequência, a linha não existe — teste.
- **AC3** Sem view, o cartão continua sendo porta e não inventa números — teste.
- **AC4** Nenhum texto cobra o próximo nível nem afirma nada sobre o cabelo — teste.
- **AC5** A ordem da home é a do dono, **medida** a 390px no DEV real.

## 8.1 Evidência — medido a 390px no DEV real

| Bloco | Topo |
|---|---|
| Data e semana | **108** |
| Cuidado do dia (*"Nenhum cuidado hoje."*) | **296** |
| Sugestões para você | **468** |
| **Sua jornada** (resumo) | **669** |
| *Ver jornada* | 760 |

Exatamente a prioridade que o dono pediu. Conteúdo real da usuária de desenvolvimento:
`Nível 3 · Constante · 270 pontos · 3 cuidados em sequência`. Console limpo.

⚠️ **Uma ressalva honesta sobre "menos altura":** o cartão é **mais alto que o botão** que ele
substitui — um botão são ~44pt, o resumo são ~150. O que encolheu foi a **razão entre espaço e
informação**: a mesma região passou de **zero** fato para **três**, e desceu para depois do que é
acionável hoje. Reduzir mais só seria possível tirando o CTA e tornando o cartão inteiro tocável —
⛔ recusado, porque afordância invisível lê como ausente, que é a lição medida da SPEC-055.

⚠️ **Um defeito do próprio diff, achado na auditoria:** a primeira versão só renderizava o cartão
**quando a view existia**. Enquanto a jornada carregava a entrada **piscava**, e se a leitura
**falhasse** ela perdia o único caminho até a tela da Jornada — que é justamente quem tem o estado de
erro com nova tentativa. Agora o cartão é porta sempre, e os números aparecem quando existem.

## 9. O que só se prova em iPhone nativo

⛔ Dynamic Type e sensação de toque (gate **G7**). O 390px prova ordem, hierarquia e truncamento.

## 10. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-09 | Criada. A entrada da Jornada era **um botão que dizia zero** sobre a jornada dela e vinha **antes** das sugestões; virou resumo compacto (nível · pontos · sequência · porta) depois do que é acionável hoje. ⚠️ A auditoria achou que sem a view o cartão sumia — e com ele o único caminho até a tela que tem o estado de erro | agente |
