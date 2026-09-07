# SPEC-038 — O motor de cronograma por necessidade (F36)

| Campo | Valor |
|---|---|
| ID | SPEC-038 |
| Status | **Fatias 1 e 2 DONE** — quarto tipo validado no DEV real; motor v2 pronto e testado. **A versão corrente segue v1 por OQ2** (gate do dono; a OQ4 que bloqueava foi fechada pela SPEC-046). **Auditado de ponta a ponta em §21.** |
| Owner | dono do produto |
| Bounded Context | Schedule (`packages/core/src/schedule`) + Content + design tokens |
| Related ADRs | **ADR-001 §2** (versão liberada é imutável), **ADR-007 A1** (registro de regras), D-26, D-67, D-102 |
| Related SPECs | SPEC-004 (o motor v1), SPEC-007 (guias), SPEC-017 ("por que este cronograma"), SPEC-037 (a avaliação ampliada) |
| Capability | `F36` motor de cronograma por necessidade + **Restauração** como quarto tipo |
| Criado / Atualizado | 2026-09-03 / 2026-09-07 |

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

## 21. Auditoria vertical do motor (2026-09-07) — diagnóstico → perfil → engine → cronograma

Pedida pelo dono: *"quero saber de forma objetiva se Reconstrução e Restauração estão realmente
sendo usadas para montar o cronograma e COMO. Não presuma que está correto apenas porque os tipos
existem no código."* O que segue é **medição do output**, não leitura de código. A matriz é o produto
cartesiano das respostas que o motor lê — **307.200 perfis** (6 padrões × 5 frequências × 16
conjuntos de química × 4 usos de calor × 32 conjuntos de queixas × 5 objetivos) — e a barreira
executável mora em `packages/core/src/schedule/schedule-matrix.test.ts`, sobre 57.600 deles (as 16
químicas colapsam em três, porque as engines só leem se a lista está vazia ou não).

### 21.1 Quantos cronogramas a Huna sabe montar

| | v1 (corrente) | v2 (pronta, desligada) |
|---|---|---|
| cronogramas **distintos** para 307.200 perfis distintos | **12** | **19** |
| composições distintas por tamanho de ciclo | 3 | 7–8 |
| proporção hidratação:nutrição | **sempre meio a meio** | depende da ênfase |

⚠️ **A personalização do v1 é a cadência, mais uma vaga.** A frequência de lavagem decide se o ciclo
tem 4, 8 ou 12 cuidados; a ênfase decide **qual eixo abre**; e a reconstrução decide **se uma** das
vagas troca de tipo. Nada mais varia. Aumentar isso não é trabalho de engenharia: é afirmar *"este
perfil deve receber tal proporção"*, que é regra capilar e precisa de revisor (D-26/D-70).

### 21.2 Reconstrução — quem recebe, e não há rigidez

**Não existe regra fixa nem fallback que a force.** Ela entra por dois dos três sinais {química ·
calor alto · dano}, e os dois lados existem, medidos sobre a matriz: **81,9%** dos perfis do espaço
recebem exatamente **uma**, **18,1%** recebem **zero**, e **nunca** duas. O que faz a fatia parecer
grande não é o motor: é que `damage` já é verdadeiro por **dois dos cinco objetivos** ou pela queixa
`breakage`, então a condição se satisfaz com facilidade — e isso é a **régua do domínio** (worksheet
§4), não um acidente de implementação. No v2 a contagem vira quantidade: 27,9% zero · 45,8% uma ·
26,3% duas. **Posição:** no v1 a reconstrução cai sempre na primeira vaga a partir do dia 14.

### 21.3 Restauração — existe, e nenhuma usuária real pode recebê-la

| pergunta | resposta medida |
|---|---|
| existe no domínio? | **sim** — `CARE_TYPE_CODES`, CHECK das duas tabelas, cor, rótulo, guia |
| existe no diagnóstico? | **não** — `AssessmentOutput` só tem `emphasis` e `includeReconstruction` |
| existe no motor v1? | **não** — zero em 307.200 perfis, com barreira de teste |
| existe no motor v2? | **sim** — 26,3% do espaço, teto de uma por ciclo |
| qual motor a usuária real recebe? | **v1** — `CURRENT_SCHEDULE_VERSION` |
| algum plano real pode conter restauração? | **não pelo caminho normal** |

No DEV real, medido: **20 planos, 19 gravados `engine=v1` e 1 `engine=v2`** — o do experimento da
§19.1, hoje `superseded`. É o **único** lugar do banco onde existe um cuidado de restauração.

⚠️ **E uma consequência do mecanismo que ninguém decidiu, agora medida e fixada em teste:** num ciclo
de **quatro vagas** (lava uma vez por semana ou menos) o peso 1 da restauração vira `0,4` e o
arredondamento a zera. Quem tem **todos** os sinais de dano e lava pouco recebe reconstrução e nunca
restauração — não porque uma regra diga isso, mas porque não sobra vaga.

### 21.4 Quais respostas do diagnóstico realmente alteram o cronograma

Invariância medida exaustivamente: para cada campo, em que fração dos perfis trocar **só aquela
resposta** muda o cronograma produzido.

| resposta | v1 | v2 | classificação |
|---|---|---|---|
| `wash_frequency` | **100%** | 100% | COLETADO + CONSUMIDO |
| `primary_goal` | **100%** | 100% | COLETADO + CONSUMIDO |
| `chemical_treatments` | 50% | 75% | COLETADO + CONSUMIDO (só *"tem ou não tem"*) |
| `current_concerns` | 40% | 55% | COLETADO + CONSUMIDO |
| `heat_usage` | 33% | 92% | COLETADO + CONSUMIDO |
| `hair_pattern` | **0%** | <1% | CONSUMIDO PELA AVALIAÇÃO, **inerte no v1** |
| `strand_thickness` | **nunca** | nunca | **COLETADO + NÃO CONSUMIDO** — sem veto e sem consumidor desde a SPEC-002 |
| `scalp_tendency` | **nunca** | nunca | **COLETADO + NÃO CONSUMIDO** — idem (o vocabulário é reusado pelo `F31`, o valor do perfil não) |
| `perceived_porosity` | **nunca** | nunca | **COLETADO + NÃO CONSUMIDO POR DECISÃO** (OQ1, D-26) |
| `routine_availability` | **nunca** | nunca | **COLETADO + NÃO CONSUMIDO POR VETO DO DONO** (OQ1) |

**Quatro das dez perguntas do onboarding não influenciam nada.** Duas por decisão registrada e com
barreira de teste; **duas — espessura do fio e couro cabeludo — simplesmente nunca tiveram
consumidor**, e isso não estava escrito em lugar nenhum até esta auditoria. ⛔ **Nenhuma foi
removida**: dizer que espessura *deve* mudar frequência é exatamente a afirmação que a D-26 reserva
ao revisor. O que muda é que o custo agora está registrado, em vez de invisível.

### 21.5 O defeito que a medição achou, e que foi corrigido

A avaliação tem uma regra de prioridade 3 — *"padrão com curvatura puxa para hidratação"* — que o
**v1 não consegue expressar**, porque a ênfase só escolhe qual eixo abre o ciclo e `hydration` e
`balanced` abrem os dois por hidratação. Mesmo assim o *"Por que este cronograma?"* exibia
**"Cabelos com curvatura costumam pedir mais hidratação."** — em **960** perfis da matriz, e nos
**960** o cronograma produzido é **idêntico** ao de um cabelo liso com as mesmas outras respostas.

Explicação plausível e errada é o que a SPEC-017 FR4 proíbe, e a frase era a única **alegação
capilar causal** do mapa de evidências. O v1 é imutável (ADR-001 §2), então quem estava errado era o
texto: virou **"Você marcou que seu cabelo tem curvatura."**, a forma observacional das outras treze.
Barreira de linguagem em `apps/mobile/__tests__/plan-rationale.test.tsx`, verificada nos dois
sentidos. Junto: `EVIDENCE_LABEL` passou de `Record<string, …>` para `Record<EvidenceCode, …>` — sem
isso, um código sem frase compilava e as duas telas caíam no `?? code`, mostrando o identificador em
snake_case para a usuária.

### 21.6 Preview × plano confirmado

O contrato está inteiro: o preview e a Edge Function chamam o **mesmo** `buildPlan`, o cliente manda
a versão com que previu (`PlanDraft.scheduleVersion`), o servidor a valida contra a allowlist e
**recusa antes de escrever** o que não conhece (SPEC-046). A reavaliação também está certa: cada
confirmação lê o snapshot corrente e gera um plano novo, e a explicação de um plano antigo é
reproduzida **com a engine que o gerou**. ⚠️ **A deriva que sobra é a OQ3 da SPEC-046** e não é de
versão: perfil e entitlement são relidos **no momento de gerar**, então reavaliar entre o preview e a
confirmação ainda muda o plano em relação ao que ela viu.

## 23. Open Questions

- OQ1 — ⚠️ **Quatro entradas do perfil não têm consumidor, e os motivos são diferentes** (medido em
  §21.4). `perceived_porosity` e `routine_availability` foram decisão registrada: as regras que as
  leem são as mais substantivas do conjunto, uma delas com veto explícito do dono, e ambas têm
  barreira de teste. **`strand_thickness` e `scalp_tendency` são outra coisa:** estão coletadas desde
  a SPEC-002, nunca tiveram consumidor e nunca tiveram veto — ninguém decidiu que elas não devem
  contar, só não existe regra que as use. ⛔ **Escrever essa regra é D-26/D-70**, não engenharia.
  Enquanto isso, quatro das dez perguntas do onboarding custam o tempo dela sem mudar nada.
- OQ2 — **Quando trocar `CURRENT_SCHEDULE_VERSION` para v2** é decisão de produto, não técnica: muda
  o cronograma de quem gerar plano novo. Fica como gate do dono.
- OQ3 — **PUBLIC RELEASE bloqueado** (D-26/D-70/OQ-REL) enquanto as regras forem `candidate`.
- OQ4 — ✅ **FECHADA pela SPEC-046 (2026-09-05), e o texto abaixo fica como registro do problema.** O
  contrato existe e foi medido contra a função deployada: o cliente manda a versão com que previu, o
  servidor usa **aquela** quando a conhece e **recusa com 400 antes de qualquer escrita** quando não
  conhece. A troca de `CURRENT_SCHEDULE_VERSION` deixou de depender desta OQ e depende só da **OQ2**,
  que é gate do dono. — Registro original: ⚠️ **BLOQUEIA A TROCA DE VERSÃO, e foi medido (§19.1).** Cliente e Edge Function versionam
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
| 2026-09-07 | v0.3 — **auditoria vertical do motor (§21), a pedido do dono.** Medição do output sobre 307.200 perfis: o v1 monta **12 cronogramas distintos**, o v2 monta 19; a reconstrução não é forçada (18,1% do espaço recebe zero) e a restauração **não é alcançável por nenhuma usuária real** enquanto a corrente for a v1. **Um defeito corrigido:** o *"Por que este cronograma?"* afirmava *"Cabelos com curvatura costumam pedir mais hidratação."* sobre um plano medido como **idêntico** ao de cabelo liso em 960 de 960 perfis — a frase virou observação e ganhou barreira de linguagem. **Quatro entradas do perfil sem consumidor** classificadas em §21.4, duas delas (espessura, couro) sem veto e sem registro anterior — OQ1 ampliada. **OQ4 marcada como fechada** pela SPEC-046. |
