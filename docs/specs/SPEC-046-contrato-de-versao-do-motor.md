# SPEC-046 — O contrato de versão do motor (SPEC-038 OQ4)

| Campo | Valor |
|---|---|
| ID | SPEC-046 |
| Status | Implemented (servidor **aguardando deploy** no DEV) |
| Owner | dono do produto |
| Bounded Context | Schedule (`packages/core/src/schedule`) + Edge Function `generate-plan` |
| Related ADRs | **ADR-001 §2** (versão liberada é imutável), ADR-007 A1, D-26/D-70 |
| Related SPECs | **SPEC-038 (OQ4)**, SPEC-004 (AC3, o caminho único), SPEC-017 (evidência por versão), SPEC-015 |
| Capability | Destrava o `F36` — **não liga a v2** |
| Criado / Atualizado | 2026-09-04 / 2026-09-04 |

## 1. Context

A SPEC-038 entregou o motor v2 e **não o ligou**, porque a medição no DEV mostrou a deriva:

```
preview do cliente (v2):  HID NUT HID REC NUT REC HID RES
plano gravado (v1):       HID NUT HID NUT REC NUT HID NUT     ← engine=v1
```

⚠️ **E em produção isso não é transitório: é estrutural.** O app é **binário de loja** e a Edge
Function versiona à parte, então uma usuária com app antigo sempre poderá **prever um cronograma e
receber outro** — a quebra do **SPEC-004 AC3**, que existe justamente para que preview e plano
gravado sejam o mesmo objeto.

## 2. Problem

`buildPlan` é o caminho único, mas **cada lado roda o seu próprio bundle**. Sem um contrato, a
versão usada no preview é uma coincidência de deploy.

## 3. Goals

- **G1** O cliente informa **com que versão previu**.
- **G2** O servidor **valida contra a allowlist** antes de persistir.
- **G3** Preview e plano gravado **nunca divergem em silêncio por causa da VERSÃO DO MOTOR**.
  ⚠️ **O escopo é esse, e dizer mais seria mentir:** o servidor relê o perfil e decide a camada
  premium na hora de gerar, então uma reavaliação ou uma mudança de entitlement **entre o preview e
  a confirmação** ainda produz um plano diferente do previsto. Isso é **anterior a esta SPEC** e é,
  discutivelmente, o comportamento certo (o servidor usa a verdade corrente, nunca a que o cliente
  afirma). Fica registrado como **OQ3** em vez de escondido atrás de uma promessa larga demais.
- **G4** Apps antigos continuam funcionando, sem alteração.
- **G5** Planos históricos e a versão já gravada ficam **intactos**.

## 4. Non-Goals

- **NG1** ⛔ **Não liga a v2.** `CURRENT_SCHEDULE_VERSION` continua `v1` — a troca é **OQ2**, gate do
  dono, com barreira de teste nesta SPEC.
- **NG2** ⛔ Não altera o motor corrente, nem as regras de nenhuma versão.
- **NG3** ⛔ Nenhuma migration: `schedule_algorithm_version` já existe e já é gravada.
- **NG4** ⛔ Não resolve o gate D-26/D-70 — as regras da v2 seguem `candidate`.

## 5. Functional Requirements

- **FR1** `PlanDraft.scheduleVersion` — o rascunho **nomeia a versão que ele mesmo usou**.
- **FR2** `HairPlanPort.generate` aceita `scheduleVersion?`.
- **FR3** `generate-plan` resolve a versão por `resolveScheduleVersion`, **antes de qualquer
  escrita**.
- **FR4** A resposta devolve a versão efetivamente gravada.

## 6. Business Rules — a tabela que define o contrato

| o cliente manda | o servidor faz | por quê |
|---|---|---|
| **nada** | usa a corrente **dele** | app antigo não conhece o campo; é o comportamento de sempre |
| **versão conhecida** | **usa aquela** | ela recebe o que previu, mesmo que o servidor já ande à frente |
| **versão desconhecida** | **recusa (400)** | app mais novo que o servidor: recusar é honesto |

- **BR1** ⚠️ **Recusar é a decisão difícil, e é a certa.** Cair na versão corrente "para não falhar"
  era o caminho tentador — e é exatamente a divergência silenciosa que o contrato elimina. A recusa
  acontece **antes** de escrever, então não sobra plano pela metade.
- **BR2** ⚠️ **A allowlist é a MESMA tabela de despacho do `buildPlan`** (`isKnownScheduleVersion`),
  nunca uma cópia — duas listas divergiriam no dia em que uma versão entrasse só numa delas.
  Barreira de teste que compara as duas em toda entrada.
- **BR3** ⚠️ **A versão sai de dentro do rascunho**, não de uma constante lida à parte pela tela.
  Escolha e despacho em módulos diferentes já produziram, uma vez, um plano da versão que ninguém
  tinha escolhido (SPEC-038).
- **BR4** **A adoção segue o app, não o servidor.** Depois que o dono ligar a v2, um app antigo
  continua prevendo e recebendo v1 até ser atualizado — e isso é a **garantia**, não uma limitação.
- **BR5** ⚠️ **O cliente passa a escolher o motor, dentro da allowlist — e isso é troca deliberada,
  não descuido.** Antes, o servidor decidia sozinho; agora um cliente adulterado pode pedir
  **qualquer versão que o produto construiu**, inclusive uma que o dono ainda não tornou padrão.
  **Por que é aceitável:** as versões da allowlist são todas motores legítimos e testados; a escolha
  **não** contorna entitlement nenhum (a camada premium continua decidida no servidor, SPEC-015 FR3)
  e **não** dá acesso a nada pago; e o plano resultante é dela, gerado a partir do **perfil dela lido
  sob RLS** — o cliente nunca envia o perfil. **O que a troca compra** é a única coisa que elimina a
  deriva: ela recebe **o que previu**. **O que a troca custa** está nomeado aqui: a `OQ2` do dono
  governa o **padrão**, não o teto. Uma segunda allowlist "de versões oferecíveis" foi considerada e
  recusada por ora — duas listas divergem (BR2), e o ganho seria contra um risco sem dano concreto.

## 7. Data Model Impact

**Nenhum.** `create_plan_tx` já grava `schedule_algorithm_version` e já é idempotente por
`(user_id, client_request_id)`: um retry devolve o plano existente e **preserva a versão original**.

## 8. Edge Cases

- **EC1** `null` é **ausência**, não versão inválida → cai no padrão.
- **EC2** Tipo errado (número, objeto) → recusa; não há coerção.
- **EC3** Retry com a mesma chave e versão diferente: `create_plan_tx` devolve o plano existente e
  **mantém a versão que ele já tinha** — histórico preservado (G5).
- **EC4** Servidor novo + cliente antigo → padrão do servidor. Cliente novo + servidor antigo → o
  campo extra é ignorado, e o plano sai igual. **Medido nos dois sentidos.**

## 9. Acceptance Criteria

- **AC1** Contrato, fallback, compatibilidade e idempotência cobertos por teste.
- **AC2** `CURRENT_SCHEDULE_VERSION` continua `v1` — com teste.
- **AC3** Validado contra a Edge Function **real** do DEV.

## 10. Open Questions

- **OQ1** ⚠️ **A validação do lado servidor exige deploy** (`deploy-dev-functions`), que é ação do
  dono (§4). Até lá, o DEV roda a função anterior — e é por isso que a recusa de versão desconhecida
  ainda **não** aparece no ambiente.
- **OQ2 (herdada, gate do dono)** Quando ligar a v2.
- **OQ3** ⚠️ **A outra deriva, anterior a esta SPEC e não resolvida aqui:** perfil e entitlement são
  relidos **no momento de gerar**, então reavaliar (ou virar premium) **entre o preview e a
  confirmação** ainda muda o plano em relação ao que ela viu. Não é bug de versão e não se conserta
  com allowlist — exigiria congelar o snapshot do preview e validá-lo no servidor, que é contrato
  novo. Registrado para não passar por resolvido.

## 11. Change Log

| Data | Mudança |
|---|---|
| 2026-09-04 | SPEC criada e implementada. Contrato de versão sem migration e sem ligar a v2. |

## 12. Evidência

**Medido contra a Edge Function real do DEV — que ainda roda a versão ANTERIOR da função**, e é
justamente isso que torna a medição útil:

| caso | resultado | leitura |
|---|---|---|
| cliente novo manda `scheduleVersion` | **200**, plano criado | **app novo × servidor antigo não quebra** |
| mesma `clientRequestId` repetida | **mesmo `planId`**, 1 linha | idempotência intacta |
| `scheduleVersion: 'v99'` | **200, plano criado** | ⚠️ **a divergência silenciosa, ao vivo** — é o que o contrato passa a recusar |

O terceiro caso é a prova do problema: hoje o servidor **aceita e gera assim mesmo**. Depois do
deploy ele deve responder **400 `unsupported_schedule_version`** sem persistir nada.

✅ **App a 390px sem regressão:** carrega, lê o plano e oferece os cuidados normalmente.

⚠️ **Pendente:** os três casos do lado servidor só podem ser medidos **depois do deploy** — ação do
dono, registrada em OQ1.
