# SPEC-038 — O motor de cronograma por necessidade (F36)

| Campo | Valor |
|---|---|
| ID | SPEC-038 |
| Status | **Fatias 1 e 2 DONE** — quarto tipo validado no DEV real; motor v2 pronto e testado. **A versão corrente segue v1 por OQ4** (deriva medida em §19.1) |
| Owner | dono do produto |
| Bounded Context | Schedule (`packages/core/src/schedule`) + Content + design tokens |
| Related ADRs | **ADR-001 §2** (versão liberada é imutável), **ADR-007 A1** (registro de regras), D-26, D-67, D-102 |
| Related SPECs | SPEC-004 (o motor v1), SPEC-007 (guias), SPEC-017 ("por que este cronograma"), SPEC-037 (a avaliação ampliada) |
| Capability | `F36` motor de cronograma por necessidade + **Restauração** como quarto tipo |
| Criado / Atualizado | 2026-09-03 / 2026-09-03 |

## 1. Context

O motor v1 monta o ciclo por **sequência fixa**: alterna hidratação e nutrição, e substitui **um**
cuidado por reconstrução no primeiro dia a partir do 14º, quando a reconstrução se aplica. O perfil
decide *qual eixo abre* e *quantas sessões por semana*, mas não decide **quanto de cada tipo**.

A D-102 pediu o contrário: *"não quero uma sequência fixa igual para todas; a frequência deve
depender do perfil e da necessidade"*, com **Restauração** entrando como quarto tipo quando fizer
sentido.

## 2. O que é engenharia e o que é domínio — a linha desta SPEC

⚠️ **Todo número de frequência é conteúdo capilar.** "De quanto em quanto tempo este cabelo precisa
de reconstrução" é exatamente a pergunta que a D-26 reserva a um revisor de domínio.

O que a engenharia pode fazer, e faz aqui: **o mecanismo**. Uma versão nova de motor, um modelo de
necessidade por tipo, uma distribuição determinística, e cada heurística registrada como regra
nomeada com `rule_id`, `version`, `inputs`, `output` e `rationale_source`.

**As regras nascem `candidate`** por instrução explícita do dono nesta sessão, e continuam
**bloqueadas para PUBLIC RELEASE** até `validated`. *(O padrão do CLAUDE.md §2 para regra inventada
por agente é `draft`; `candidate` aqui é decisão do dono e não afrouxa o gate — só `validated`
libera release. A procedência fica registrada para o revisor saber o que está lendo.)*

## 3. Goals

- G1 — A **quantidade** de cada tipo de cuidado no ciclo depende do perfil, não de uma sequência fixa.
- G2 — **Restauração** existe como quarto tipo e pode entrar no cronograma.
- G3 — O motor v1 continua **intacto e reproduzível**: planos históricos não mudam de significado.
- G4 — Toda heurística nova é uma regra registrada e rastreável.

## 4. Non-Goals

- NG1 — ⚠️ **Não** se lê `routine_availability` nem se cruza com `durationMin`. "Este cuidado cabe no
  seu tempo" é recomendação capilar e está **explicitamente vetada sem sign-off** (instrução do dono).
- NG2 — ⚠️ **Não** se lê `perceived_porosity`. A regra que traduz porosidade percebida em frequência é
  a alegação capilar mais substantiva do conjunto, e a engenharia **não a inventa**. O dado está
  coletado (SPEC-037) e espera revisor. Ver OQ1.
- NG3 — **Não** se afirma o que a Restauração faz no fio. O texto do guia é procedural, `candidate`, e
  não compara mecanismos com a reconstrução.
- NG4 — **Não** se edita o motor v1. Comportamento novo = versão nova (ADR-001 §2).
- NG5 — **Não** se funde finalização em `WASH_DAY_TECHNIQUES` (`F37`; a barreira entra com ele).
- NG6 — **Não** se reescreve plano ativo. Regra nova gera **novo ciclo**, nunca reescrita (D-69).

## 5. Functional Requirements

### Fatia 1 — o vocabulário (implementada)

- FR1 — `restoration` entra em `CARE_TYPE_CODES`, no CHECK de `scheduled_cares` e `care_executions`,
  no `careColor`, no `CARE_TYPE_LABEL` e nos guias.
- FR2 — A migration é **aditiva por construção**: um CHECK que aceita mais não invalida linha alguma.
- FR3 — ⚠️ **O v1 continua produzindo três tipos.** Barreira de teste: se ele emitir `restoration`,
  reprova.
- FR4 — `CareColorKey` deixa de ser união escrita à mão e passa a ser `CareTypeCode`: esquecer a cor
  de um tipo novo vira erro de compilação, não um cuidado sem cor.
- FR5 — O teste de contraste **deriva do `careColor`**, então um tipo novo é medido no dia em que
  ganha cor.
- FR6 — Nenhuma cor de cuidado pode ser cor de estado (verde/vermelho) nem repetir outra. **Teste.**

### Fatia 2 — o motor v2

- FR7 — `schedule/engine/v2` é uma versão nova; o v1 permanece byte a byte.
- FR8 — O motor deriva um **peso de necessidade por tipo** e distribui as vagas do ciclo por esse
  peso, em vez de alternar. Perfil sem sinal de dano recebe **zero** reconstruções; perfil com sinais
  fortes recebe mais de uma.
- FR9 — Cuidados fortes (reconstrução, restauração) **não ficam adjacentes** e não abrem o ciclo.
- FR10 — Cada decisão do v2 emite código de evidência **só quando a regra realmente dispara** — é o
  que mantém "Por que este cronograma?" mostrando apenas influência real (SPEC-017 FR4).
- FR11 — O v2 é **puro e determinístico**: `startsOn` é entrada, sem relógio, sem aleatório.
- FR12 — Trocar de versão é uma linha em `CURRENT_SCHEDULE_VERSION`; planos antigos guardam a versão
  que os gerou e continuam reproduzíveis.

## 6. Business Rules

- BR1 — Toda regra de frequência é `candidate` com `rationale_source` de hipótese de engenharia.
- BR2 — Um perfil sem sinal nenhum **não escala intensidade** (herdado do v1, worksheet §10).
- BR3 — O ciclo continua sendo de 28 dias e a cadência semanal continua vindo da frequência de
  lavagem observada — **o app nunca recomenda lavar**.
- BR4 — Evidência só para regra que disparou.

## 7–13. Dados, autorização, segurança

Uma migration aditiva alargando dois CHECKs. Nenhuma tabela, coluna, RPC, policy ou grant novo.
Nenhum dado novo é coletado.

## 15. Edge Cases

- EC1 — **Plano gerado pelo v1.** Continua legível e **reproduzível pela engine que o gerou** (§20);
  a SPEC-017 só se cala quando a versão do plano é desconhecida deste app.
- EC2 — **Perfil sem sinal de dano.** Zero reconstruções e zero restaurações no ciclo.
- EC3 — **Ciclo de 4 vagas** (lavagem 1x/semana) com necessidade alta: as vagas são poucas, então a
  distribuição arredonda — e o cuidado forte não pode ocupar todas.
- EC4 — **Avaliação anterior à SPEC-037** (`null` nas duas entradas novas): irrelevante, porque o v2
  não as lê (NG1/NG2).

## 17. Acceptance Criteria

- AC1 — O quarto tipo existe de ponta a ponta e o v1 não mudou. **Teste** (fatia 1). ✅
- AC2 — Cor do quarto tipo medida e distinta. **Teste.** ✅
- AC3 — O v2 produz quantidades diferentes para perfis diferentes. **Teste, fatia 2.**
- AC4 — O v2 é invariante a `routineAvailability` e `perceivedPorosity`. **Teste, fatia 2** — é a
  barreira do NG1/NG2.
- AC5 — Regras do v2 registradas e `candidate`; `assertProductionRules` **lança**. **Teste.**
- AC6 — Validação a 390px no DEV real (2026-09-03, migration e deploy feitos pelo dono):
  - **Quarto tipo em todas as superfícies:** Cuidados lista quatro guias — Hidratação ~20 · Nutrição
    ~20 · Reconstrução ~25 · **Restauração ~30** — com quatro cores distintas. ✅
  - **v2 exercido:** perfil com os três sinais de dano produziu, no preview real,
    `HID NUT HID REC NUT REC HID RES` — a Restauração aparece, e a evidência nomeia só os sinais
    que existem. ✅
  - **Compatibilidade com plano antigo:** o plano `engine=v1` continua se explicando na Hoje, com a
    evidência reproduzida pela engine que o gerou. ✅
  - **Deriva medida** (§19.1) e a v2 **não foi ligada** por causa dela. ⚠️
- AC7 — Nenhuma regra atravessou o gate D-26/D-70: as **8** regras do v2 são `candidate`, nenhuma
  `validated` existe fora do próprio teste de governança, e o v2 **não lê** porosidade nem
  disponibilidade — menciona as duas só em comentário, e há teste de invariância. ✅

## 19. Ativação — o que falta, e por que não é do agente

⚠️ **A v2 está pronta e a versão corrente segue sendo a v1.** Não é hesitação: ligar exige duas
ações de ambiente que a governança não dá ao agente.

1. **A migration `20260911000000_care_type_restoration.sql` precisa estar aplicada** no ambiente
   alvo. Sem ela, um plano com Restauração é recusado pelo CHECK de `scheduled_cares`.
2. **A Edge Function `generate-plan` precisa ser redeployada** com este bundle. Sem isso o preview
   do cliente usa a v2 e o plano gravado usa a v1 — **as duas leituras do mesmo cronograma passam a
   discordar**, que é exatamente o que `buildPlan` como caminho único existe para impedir. Deploy é
   ação §4: decisão humana, nunca efeito colateral de merge (o próprio workflow diz isso).

Feitas as duas, ligar é **uma linha** em `build-plan.ts`.

## 19.1 A deriva, medida no DEV real (2026-09-03)

As duas ações de ambiente foram feitas pelo dono — migration aplicada, `deploy-dev-functions`
executado — e a v2 foi **ligada, exercida e revertida**. O que a medição mostrou:

```
preview do cliente (v2):  HID NUT HID REC NUT REC HID RES   ← com Restauração
plano gravado:            HID NUT HID NUT REC NUT HID NUT   ← engine=v1
```

⚠️ **O deploy saiu da `main`, que ainda não tem a v2.** O app roda o bundle local; a Edge Function
roda o bundle deployado. Enquanto os dois não forem a mesma coisa, ela **confirma um cronograma e
recebe outro** — a quebra exata do SPEC-004 AC3.

**Isso não é acidente de ordem: é estrutural em produção.** O app é binário de loja e a Edge
Function versiona à parte; uma usuária com app antigo sempre poderá prever com uma engine e receber
outra. Por isso a v2 **não foi ligada** neste merge, e ligar depende de OQ4.

## 20. Compatibilidade histórica — o que a troca teria quebrado

A SPEC-017 reproduzia a evidência exigindo que o plano fosse da versão **corrente**. Com uma segunda
versão no repositório, isso apagaria a explicação de **todo plano gerado pela v1** — a tela se
calaria corretamente, mas por um motivo evitável.

Corrigido antes de a troca acontecer: `buildPlan` aceita a versão, e a tela reproduz com **a engine
que gerou aquele plano**. Uma versão que o app não conhece continua calando a seção.

## 23. Open Questions

- OQ1 — ⚠️ **`perceived_porosity` e `routine_availability` continuam sem consumidor.** Foi decisão,
  não esquecimento: as regras que os leem são as mais substantivas do conjunto e precisam de revisor
  (D-26). Enquanto isso, o `F35` segue sendo coleta sem retorno visível — o custo está registrado.
- OQ2 — **Quando trocar `CURRENT_SCHEDULE_VERSION` para v2** é decisão de produto, não técnica: muda
  o cronograma de quem gerar plano novo. Fica como gate do dono.
- OQ3 — **PUBLIC RELEASE bloqueado** (D-26/D-70/OQ-REL) enquanto as regras forem `candidate`.
- OQ4 — ⚠️ **BLOQUEIA A TROCA DE VERSÃO, e foi medido (§19.1).** Cliente e Edge Function versionam
  separado, então preview e plano gravado podem discordar — no DEV foi observado, e em produção é
  estrutural, porque o app é binário de loja. Saída provável: o cliente **manda a versão que
  previu** e o servidor a valida contra `isKnownScheduleVersion`, de modo que o que ela confirma
  seja sempre o que ela recebe. É mudança de contrato de servidor: decisão a tomar **antes** de
  ligar a v2, não depois.

## 24. Change Log

| Data | Mudança |
|---|---|
| 2026-09-03 | v0.1 — fatia 1: o quarto tipo no vocabulário, sem tocar no comportamento do v1. |
| 2026-09-03 | v0.2 — fatia 2: motor v2 por necessidade. **Dois defeitos achados ao imprimir o plano e olhar**, não pelos testes: a quota de condicionamento era calculada e ignorada (a ênfase não mudava proporção nenhuma), e a escolha empatada abria pelo eixo errado. Barreira acrescentada. **Um terceiro achado ao ligar a versão:** escolha e despacho estavam em módulos diferentes, e a constante apontou para a v2 enquanto o padrão do `buildPlan` seguia na v1. |
