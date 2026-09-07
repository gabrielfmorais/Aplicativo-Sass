# SPEC-046 — O contrato de versão do motor (SPEC-038 OQ4)

| Campo | Valor |
|---|---|
| ID | SPEC-046 |
| Status | **DONE** — os três casos medidos contra a Edge Function deployada. **OQ3 fechada em 2026-09-07 (§13):** a avaliação também vai fixada; ⚠️ falta o **redeploy** para essa metade entrar em vigor. |
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

- **OQ1** ✅ **Fechada.** Os três casos foram medidos contra a função deployada (§12). ⚠️ Lição que
  vale registrar: o deploy sai da **`main`**, então a primeira tentativa validou a função **antiga**
  e "reprovou" um contrato que estava certo — a mesma armadilha que a SPEC-038 já tinha registrado.
  Medir contra o ambiente **antes** de acreditar no verde é o que a separou de um falso negativo.
- **OQ2 (herdada, gate do dono)** Quando ligar a v2.
- **OQ3** ✅ **RESOLVIDA em 2026-09-07 (§13), e as duas metades tiveram destinos diferentes — de
  propósito.**

  ⚠️ **A metade do PERFIL era a deriva de verdade, e foi fechada.** A função lia sempre a avaliação
  **mais recente**, enquanto o preview foi construído a partir de **uma** avaliação específica.
  Reavaliar num segundo aparelho, ou confirmar numa aba aberta há mais tempo, bastava para ela
  **confirmar um cronograma e receber outro** — a mesma quebra do SPEC-004 AC3 que o contrato de
  versão já tinha eliminado pelo outro lado. Agora o cliente manda `hairProfileId` junto com
  `scheduleVersion`, saindo **do mesmo rascunho** (`draft.plan.hairProfileId`), e o servidor lê
  **aquela** avaliação. Ausente = comportamento de sempre; malformado = **400 antes de qualquer
  escrita**; id que não é dela = **409**, porque a leitura é feita com a JWT dela sob RLS e
  simplesmente não volta. E como `hair_profiles` é imutável e append-only (D-62/D-64), fixar o id
  **fixa o conteúdo**: a linha apontada não pode ter mudado no intervalo.

  ⛔ **A metade do ENTITLEMENT foi resolvida por RECUSA, e a recusa é de segurança.** Deixar o
  cliente fixar *"eu previ com preferências aplicadas"* seria deixá-lo **conceder a si mesmo** a
  capability premium — e a SPEC-015 FR3 põe essa decisão no servidor exatamente para impedir isso.
  O que sobra dessa borda é limitado **por construção, com barreira de teste**: preferências mexem
  **só em datas** e nunca nos tipos, na quantidade ou na cadência (`placement.test.ts`). Ou seja,
  virar premium — ou deixar de ser — entre o preview e a confirmação pode mudar **em que dias** os
  cuidados caem, e nunca **quais cuidados são**; e sobre o direito dela a resposta do servidor é,
  por definição, a correta. ⚠️ **Registrado como decisão, não como pendência:** não existe conserto
  que não seja abrir um buraco maior.

  ⚠️ **Falta o deploy para a metade do perfil entrar em vigor.** O cliente já manda o campo e o
  contrato degrada com elegância — a função deployada **ignora um campo que não conhece**, medido ao
  vivo (`generate-plan → 200`, plano criado normalmente). Até o redeploy, o comportamento é o de
  hoje: a avaliação mais recente. **Deploy é ação §4** (Actions → `deploy-dev-functions`).

## 11. Change Log

| Data | Mudança |
|---|---|
| 2026-09-04 | SPEC criada e implementada. Contrato de versão sem migration e sem ligar a v2. |

## 12. Evidência

### 12.1 Contra a função DEPLOYADA — os três casos (2026-09-04)

| caso | resultado medido | leitura |
|---|---|---|
| **sem versão** (app antigo) | **200**, plano gravado `v1` | vale a corrente do servidor — comportamento de sempre |
| **conhecida `v1`** | **200**, ativo `v1` | honrada |
| **conhecida `v2`** | **200**, ativo **`v2`** | ⚠️ **o servidor honrou o que ela previu** — a prova de que não é coincidência de deploy |
| **desconhecida `v99`** | **400 `unsupported_schedule_version`** · planos **17 → 17** | recusou **antes de escrever**: nada foi criado |
| **tipo errado** (número) | **400** | sem coerção |

Ao final, o DEV foi devolvido a um plano `v1`. **`CURRENT_SCHEDULE_VERSION` continua `v1`** e a v2
**não** foi ligada (barreira de teste).

⚠️ **Um defeito que só a medição contra o ambiente encontrou:** a resposta **nunca** trazia
`scheduleVersion`. As policies de `hair_plans` são `for all to postgres` (para o `SECURITY
DEFINER`) e `select` para `authenticated` — **não há policy para `service_role`**, e a tabela é
FORCE RLS, então a releitura pela service role voltava **vazia em silêncio**. Passou a ser lida com a
JWT **dela**, que enxerga o próprio plano por `hair_plans_select_own` — sem afrouxar policy nenhuma.
O campo aparece no próximo deploy; **os três casos acima não dependem dele**.

### 12.2 Antes do deploy (mantido como registro)

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
| 2026-09-07 | v0.2 — **OQ3 resolvida (§13)**, e as duas metades tiveram destinos diferentes. **Perfil:** o cliente passa a mandar `hairProfileId` junto com `scheduleVersion`, saindo do mesmo rascunho, e o servidor gera com **aquela** avaliação — ausente é o comportamento de sempre, malformado é 400 antes de escrever, id alheio é 409 porque a leitura sob RLS não devolve nada. **Entitlement:** ⛔ **recusado por segurança** — deixar o cliente fixá-lo seria deixá-lo conceder a si mesmo a capability premium (SPEC-015 FR3); o que sobra é placement-only, com barreira de teste provando que preferências nunca mudam tipos, quantidade ou cadência. ⚠️ Falta o **redeploy** para a metade do perfil entrar em vigor; a compatibilidade foi medida ao vivo (`generate-plan → 200` com o campo novo ignorado pela função antiga). |

## 13. A segunda metade do contrato — a avaliação que ela viu (OQ3, 2026-09-07)

O contrato de versão fechou *"com que motor"*. Faltava *"a partir de quais respostas"*, e a lacuna
tinha a mesma forma: o preview usa **uma** avaliação, e a Edge Function lia sempre a **mais recente**.

**A borda é real e não precisa de má fé para acontecer:** reavaliar num segundo aparelho, deixar uma
aba aberta e confirmar depois, ou abandonar uma reavaliação no meio e voltar ao preview antigo
(SPEC-014 G3 — o perfil novo fica salvo mesmo sem confirmar). Em todos, ela **confirma um cronograma
e recebe outro**.

### 13.1 O contrato

| o cliente manda | o servidor faz | por quê |
|---|---|---|
| nada | usa a avaliação **mais recente** | app antigo não conhece o campo; é o comportamento de sempre |
| um uuid | usa **aquela**, lida com a JWT dela | ela recebe o plano da avaliação que viu |
| lixo | **400** antes de qualquer escrita | um id malformado não vira "tanto faz" |
| id que não é dela | **409 `hair_profile_not_found`** | a leitura sob RLS não devolve nada, e a resposta também não |

⚠️ **Mandar um id não concede nada.** A leitura acontece com a **JWT dela**, então um id alheio não
volta — a resposta é um código de erro, nunca os dados de outra pessoa. E `hair_profiles` é imutável
e append-only (D-62/D-64): **fixar o id fixa o conteúdo**.

⚠️ **O id sai do rascunho** (`draft.plan.hairProfileId`), como a versão. Ler o perfil corrente na
hora de confirmar reintroduziria a deriva pelo outro lado — é a mesma disciplina que a SPEC-038
aprendeu quando escolha e despacho moravam em módulos diferentes.

### 13.2 O que foi RECUSADO, e é o mais importante desta fatia

⛔ **O entitlement não pode ser fixado pelo cliente.** *"Eu previ com preferências aplicadas"* vindo
do app seria o app **concedendo a si mesmo** a capability premium, e a SPEC-015 FR3 põe essa decisão
no servidor exatamente por isso. Um cliente adulterado ganharia placement premium mandando um
booleano.

**E o que sobra dessa borda é pequeno por construção, com barreira de teste:** preferências mexem
**só em datas**, nunca nos tipos, na quantidade ou na cadência (`placement.test.ts`). Virar premium —
ou deixar de ser — entre o preview e a confirmação muda **em que dias** os cuidados caem, e nunca
**quais cuidados são**. Sobre o direito dela, a resposta do servidor é por definição a correta.

### 13.3 O que falta, e é gate

⚠️ **A metade do perfil só entra em vigor no redeploy da Edge Function.** O contrato degrada com
elegância e isso foi **medido ao vivo**: a função deployada **ignora o campo que não conhece** e
respondeu `200`, criando o plano normalmente com o cronograma esperado. Até o redeploy, o
comportamento é o de hoje. **Deploy é ação §4** — Actions → `deploy-dev-functions`.
