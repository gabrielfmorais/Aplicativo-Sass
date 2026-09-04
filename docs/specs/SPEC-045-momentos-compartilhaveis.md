# SPEC-045 — Momentos compartilháveis (F46)

| Campo | Valor |
|---|---|
| ID | SPEC-045 |
| Status | Implemented |
| Owner | dono do produto |
| Bounded Context | **Growth** (`packages/core/src/sharing`) |
| Related ADRs | ADR-001, **D-103**, **D-26/D-70** (nada afirma sobre o cabelo), **D-83** (Free) |
| Related SPECs | **SPEC-044** (a fundação), SPEC-043 (Jornada), SPEC-021 (ciclo), SPEC-005 (execução) |
| Capability | `F46` — **COMMITTED** |
| Fase do roadmap | MASTER PRODUCT BACKLOG — F46, depois do F45 |
| Criado / Atualizado | 2026-09-04 / 2026-09-04 |

## 1. Context

O `F45` entregou **um caminho e um card**. Faltavam os **gatilhos** — e a promessa registrada na
SPEC-044 G5 era que o `F46` acrescentasse **momentos, não outro caminho**.

## 2. Problem

A conquista só era compartilhável de um lugar (a Jornada) e só tinha um assunto. O momento em que
ela mais quer mostrar — **o cuidado que acabou de fazer** — não produzia nada.

## 3. Goals

- **G1** Cada lugar onde a conquista acontece oferece o card **dali mesmo**.
- **G2** **Um caminho só.** A tela de compartilhar não sabe de onde ela veio; o que muda é a lista.
- **G3** Todo momento deriva de **fato já canônico**, sem número novo.

## 4. Non-Goals

- **NG1** ⛔ Nenhuma foto (Antes × Depois, Hair Progress) — dependem de mídia com base legal
  (`F28`/`P24`/D-32) e **nunca entram num card sozinhas**.
- **NG2** ⛔ Nenhum backend novo: sem tabela, sem RPC, sem registrar "ela compartilhou".
- **NG3** ⛔ Nenhuma afirmação sobre o cabelo dela (D-26/D-70).
- **NG4** ⛔ Nenhuma porcentagem, nota, média ou comparação — as recusas de SPEC-009/019/021 valem
  no card exatamente como valem na tela.
- **NG5** ⛔ Nenhuma publicação automática. O preview continua sendo o consentimento (SPEC-044 BR2).

## 5. Functional Requirements

- **FR1** `ShareMoment` é **dado**: cada momento carrega o texto pronto.
- **FR2** Quatro momentos nesta fatia: **jornada**, **marco**, **cuidado concluído**, **ciclo**.
- **FR3** A tela recebe uma **lista**, e o primeiro é o padrão — o momento do lugar de onde ela veio.
- **FR4** O seletor só aparece com **mais de um** momento.
- **FR5** Três entradas: **Hoje** (no cuidado concluído), **Jornada**, **Progresso**.

## 6. Business Rules

- **BR1** Todo momento deriva de view já construída — `JourneyView` e `Progress`. **Nenhum número é
  calculado aqui** (SPEC-044 BR4).
- **BR2** **Só marcos alcançados** viram card. Oferecer um marco que ainda não chegou transformaria a
  lista numa cobrança, e a SPEC-043 é explícita: marco não alcançado é marco que ainda não chegou.
- **BR3** ⚠️ **O card fala na PRIMEIRA pessoa.** O rótulo do marco é escrito para a tela (*"5 cuidados
  do seu plano"*) e fala **com** ela; no card, que sai da mão dela para quem não é ela, *"seu"* passa
  a apontar para o leitor. Barreira de teste sobre **todos** os marcos da régua.
- **BR4** O ciclo vai em **contagem**, sem denominador e **sem a média de como ela se sentiu** — é o
  número mais próximo de uma nota que o produto tem.
- **BR5** O card de cuidado diz **que ela fez**, nunca o que aquilo fez com o cabelo dela.

## 7. Data Model Impact

**Nenhum.** Sem tabela, sem coluna, sem migration.

## 8. Edge Cases

- **EC1** Sem momento nenhum: a tela **convida** em vez de mostrar card vazio — não é erro.
- **EC2** Um momento só: sem seletor, que seria um controle que não decide nada.
- **EC3** A lista muda sob os pés (marco novo alcançado): cai no primeiro em vez de sumir.
- **EC4** Ciclo com zero cuidado atendido: a oferta **não aparece** — card de ciclo com zero não é
  conquista, é cobrança de véspera.

## 9. Acceptance Criteria

- **AC1** No DEV real a 390px: as três entradas abrem, cada uma no **seu** momento.
- **AC2** Nenhum marco chega ao card em segunda pessoa — barreira de teste.
- **AC3** Nenhum momento carrega porcentagem, nota, média ou palavra sobre o cabelo — barreira.
- **AC4** O valor herói **cabe no card** em todos os momentos.

## 10. Open Questions

- **OQ1 (CAN DEFER)** Gatilhos que faltam do `F46`: **Wash Day**, **progresso detalhado** e
  **comparação de ciclos**. Os dois últimos pedem decisão de conteúdo — comparar ciclos é a porta
  mais curta para "melhorou/piorou", que é avaliação capilar (D-26/D-70). O `F46` fica
  **IN PROGRESS** até eles.
- **OQ2 (BLOQUEADA)** Antes × Depois e Hair Progress — mídia com base legal (D-32).

## 11. Change Log

| Data | Mudança |
|---|---|
| 2026-09-04 | SPEC criada e implementada. Quatro momentos, três entradas, um caminho só. |

## 12. Evidência

**Validado a 390px no DEV real**, as três entradas, cada uma abrindo no seu momento:

- **Hoje** → `CUIDADO FEITO · Nutrição · do meu plano, hoje · 8 em sequência`
- **Jornada** → `EM RITMO · 8 · cuidados do meu plano em sequência`
- **Progresso** → `MEU CICLO · 8 · cuidados do meu plano neste ciclo · 12 no total`

**Dois defeitos que só apareceram olhando**, e os dois no mesmo card de marco:

1. **O card falava na segunda pessoa.** O seletor mostrava *"5 cuidados do seu plano"* e o card
   repetia o rótulo — num card que sai para outras pessoas, *"seu"* aponta para quem lê, e a
   conquista passava a ser do leitor. A barreira não é a conversão: é o teste que percorre **todos**
   os marcos da régua e reprova qualquer segunda pessoa que sobreviva.
2. **O valor herói saía cortado.** O rótulo inteiro ia para o slot dimensionado para um número: o
   card mostrava **"5 cuidad"**, cortado na borda. **SVG não reflui texto** — o excesso simplesmente
   sai do quadro, sem aviso. Dois consertos, porque são dois problemas: o marco passou a separar
   número de frase (o mesmo ritmo do card da jornada), e o desenho passou a **ajustar o tamanho ao
   que cabe** — sem isso, um cuidado de nome comprido faria o mesmo.

⚠️ **A limitação da SPEC-044 continua valendo:** `toDataURL` e a folha do sistema não existem no
preview web, então a rasterização e o share só se exercem em build nativo.
