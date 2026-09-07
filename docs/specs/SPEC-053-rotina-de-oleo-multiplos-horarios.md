# SPEC-053 — A rotina de óleo com vários horários no mesmo dia (evolução do F39)

| Campo | Valor |
|---|---|
| ID | SPEC-053 |
| Status | **Draft** |
| Owner | dono do produto |
| Bounded Context | Care Tracking (`packages/core/src/oil-routine`) + Notifications |
| Related ADRs | **ADR-008** (dia civil e fuso), **ADR-009** (política de volume de notificações), ADR-001 §2, D-26/D-70, D-74 |
| Related SPECs | **SPEC-040** (o F39, que esta evolui), SPEC-008 (lembretes), SPEC-022 (pausa), SPEC-023 (o precedente de "sem RPC") |
| Fase do roadmap | MASTER PRODUCT BACKLOG — `F39`, evolução pedida pelo dono em 2026-09-07 |
| Criado / Atualizado | 2026-09-07 / 2026-09-07 |

## 1. Context

A SPEC-040 entregou a rotina de óleo: um **intervalo em dias** que ela escolhe, `feito`/`adiar`, e
**um** lembrete por ocorrência, no horário global de lembrete do app.

O dono pediu a evolução, com a fonte de verdade transcrita:

> *"Depois evolua a rotina para permitir múltiplos horários no MESMO DIA. Exemplo: segunda: 12:00,
> 17:00, 23:00. Se a usuária quiser 1 horário, pode. Se quiser 3, pode. Se quiser 10, pode. Ela
> escolhe: dias; quantos horários; horário de cada ocorrência; editar; remover; ativar/desativar.
> Cada horário pode ter seu lembrete individual. A Huna NÃO recomenda a frequência. Ela apenas
> registra e lembra a rotina escolhida pela própria usuária."*

E as proibições, também transcritas:

> *"Não criar: teto arbitrário baixo; pontos por quantidade; elogio por aplicar mais vezes;
> inferência de que mais óleo é melhor."*

## 2. Problem

Hoje a rotina só sabe dizer **em que dia**. Quem passa óleo de manhã e à noite tem uma rotina que o
app conhece pela metade: ele lembra uma vez, no horário que serve para tudo, e o segundo momento
não existe para ele. **Uma rotina que o app conhece pela metade é uma que ele ajuda a manter pela
metade** — e o `F39` inteiro existe porque *"uma rotina que o app não conhece é uma que ele não
ajuda a manter"*.

## 3. Goals

- G1 — Ela cadastra **quantos horários quiser** no dia, edita, remove e liga/desliga cada um.
- G2 — Cada horário pode ter **lembrete próprio**, no horário dele — não no horário global do app.
- G3 — O que ela já configurou **continua funcionando sem ela fazer nada** (uma rotina sem horários
  é a rotina de hoje).
- G4 — Nada aqui recomenda, elogia, pontua ou sugere frequência.

## 4. Non-Goals

- NG1 — ⛔ **Não se recomenda frequência, horário, quantidade, ordem ou produto.** *"De quantas em
  quantas horas passar óleo"* é conteúdo capilar substantivo ⇒ **gate D-26/D-70**. A lista de
  horários é calendário dela, como o `wash_frequency` do perfil.
- NG2 — ⛔ **Não entra na Jornada.** Nenhum ponto, marco, sequência ou celebração por número de
  aplicações — seria literalmente *"recompensa por fazer mais"*, o que a **D-103** proíbe e o que a
  SPEC-052 já teve de consertar em duas superfícies.
- NG3 — ⛔ **Nenhum texto compara quem passa mais com quem passa menos**, e nenhum estado da tela
  trata "mais horários" como melhor. Barreira de teste.
- NG4 — **Não entra no cronograma** (herdado da SPEC-040 NG1): o plano é saída de motor versionado.
- NG5 — **Não se cria infraestrutura de notificação paralela.** O `NotificationIntent` da SPEC-008 é
  o caminho, e esta SPEC o estende — não o duplica.
- NG6 — **Não se muda o vocabulário de eventos.** `done` e `postponed` continuam sendo os dois.

## 5. User Stories

- Como usuária que passa óleo de manhã e à noite, quero **dois lembretes no mesmo dia**, cada um na
  hora certa, para não depender de lembrar sozinha.
- Como usuária que mudou de rotina, quero **editar e remover** um horário sem desligar tudo.
- Como usuária que viaja, quero **desligar um horário** sem perder a configuração dele.

## 6. Functional Requirements

- FR1 — A rotina passa a ter uma **lista de horários** (`HH:MM`, o horário civil dela). Zero, um ou
  muitos.
- FR2 — Ela **acrescenta, edita, remove** e **liga/desliga o lembrete** de cada horário.
- FR3 — ⚠️ **Cada horário liga é um lembrete no horário DELE**, e não no horário global de lembrete
  (SPEC-008). Um horário com o lembrete desligado **continua na rotina** e continua podendo ser
  registrado — ele só não toca.
- FR4 — **Sem nenhum horário cadastrado, a rotina se comporta exatamente como hoje**: um lembrete na
  data de vencimento, no horário global. É o que faz a evolução não pedir nada de quem já usava.
- FR5 — O registro (`feito`/`adiar`) pode nomear **qual horário** — *"passei o das 12:00"* —, e o
  histórico guarda isso.
- FR6 — ⚠️ **A cadência continua sendo por DIA.** Marcar um horário como feito **não** empurra a
  próxima data; a data avança pela regra de sempre (BR1 da SPEC-040: `último feito + intervalo`).
- FR7 — Horário duplicado é recusado — o mesmo `HH:MM` duas vezes não são dois lembretes.
- FR8 — Desligar a rotina inteira remove os horários junto; o **histórico continua** (SPEC-040 BR5).
- FR9 — ⚠️ **Os lembretes passam a ser projetados para as próximas ocorrências**, e não só para a
  primeira. A SPEC-040 emitia **um** lembrete, na data de vencimento — decisão certa quando havia um
  horário e nenhuma configuração dela por trás. Com horários que **ela cadastrou um a um**, dar só o
  dia de hoje deixaria quem não abre o app amanhã sem os lembretes que pediu. **Projetar a agenda
  que ela mesma configurou não é supor comportamento** — é a capability. O que continua valendo: uma
  ocorrência **vencida** cabe **hoje**, nunca um lembrete por dia de atraso (SPEC-040, intocado).

## 7. Business Rules

- BR1 — ⚠️ **O dia é a unidade da ocorrência; o horário é quando lembrar e o que registrar.** Uma
  ocorrência vencida continua sendo *"o dia X"*, e não *"o dia X às 12:00"*. Fazer o contrário criaria
  **N cadências independentes** que dessincronizam na primeira vez que ela pula uma: quem faz o das
  12:00 e esquece o das 17:00 passaria a ter duas séries andando em datas diferentes, e a tela teria
  de explicar isso. **É a decisão que segura o desenho inteiro.**
- BR2 — **Adiar continua empurrando o dia**, não o horário. *"Hoje não"* é sobre o dia.
- BR3 — Herdadas e intocadas da SPEC-040: a próxima data deriva do **último feito**; adiamentos
  anteriores ao último feito não contam; **pausada, nada toca** (SPEC-022).
- BR4 — ⚠️ **Nenhum limite de produto na quantidade de horários.** O único limite é **técnico e
  declarado** (BR5), e ele nunca recusa um horário: ele encurta o **horizonte** de agendamento.
- BR5 — ⚠️ **O horizonte de lembretes do óleo se adapta ao orçamento da plataforma.** O iOS mantém no
  máximo **64** notificações locais pendentes (ADR-009). Com um teto fixo de dias, dez horários
  estourariam esse número e o sistema descartaria **em silêncio** — o pior desfecho. Então o número
  de dias agendados **encolhe conforme a quantidade de horários ligados**, e a reconciliação a cada
  abertura repõe o resto. **Ela escolhe quantos horários; o app escolhe quantos dias cabem.**
- BR6 — ⚠️ **Os lembretes de óleo não entram no teto diário de 2** (SPEC-008 FR6). O teto existe para
  o que o **app** decide cutucar; estes são **alarmes que ela programou um a um**. Aplicá-lo aqui
  significaria descartar em silêncio o segundo horário que ela pediu.
- BR7 — Nenhum texto de lembrete diz o que o óleo faz (herdado, SPEC-040 NG2/NG3).

## 8. Data Model Impact

Ver `docs/architecture/DATA-MODEL.md`. **Uma tabela nova, aditiva, e nenhuma coluna removida.**

```
oil_routine_times
  id                uuid pk
  user_id           uuid not null → oil_routines(user_id) on delete cascade
  time_local        time not null            -- o horário civil dela, HH:MM
  reminder_enabled  boolean not null default true
  created_at, updated_at
  unique (user_id, time_local)               -- FR7: o mesmo horário não é dois lembretes
```

⚠️ **A FK aponta para `oil_routines`, não para `auth.users`** — horário sem rotina é configuração que
não descreve nada, e `record_oil_event` já recusa evento sem rotina. Desligar a rotina leva os
horários junto (FR8) e **não** leva o histórico.

`oil_events` ganha **`routine_time_id uuid null`** (FR5): `null` é *"registrei o dia"*, que é todo o
histórico anterior e continua sendo uma resposta legítima. ⚠️ **`on delete set null`** — remover um
horário não pode apagar um fato que aconteceu.

## 9. API / Contracts

⚠️ **Sem RPC para os horários, e é o precedente da SPEC-023 aplicado com o mesmo teste.** `oil_routines`
e `oil_events` exigem RPC porque guardam invariante de servidor: o **dia civil** depende do fuso dela
(ADR-008) e a idempotência é do servidor. Um **horário do dia** não tem nenhum dos dois — é um `time`
que ela escolhe, sem relógio do servidor envolvido —, e a duplicidade cai num índice único, como o
produto repetido da Prateleira. Criar RPC aqui seria cerimônia sem invariante para proteger.

`OilRoutinePort` ganha `listTimes`, `addTime`, `updateTime`, `removeTime`, `setTimeReminder`.

`buildOilRoutineView` ganha `times` na saída; `buildNotificationIntents` passa a receber os horários
ligados e emite um intent por `(data, horário)`, com id `oil_due:<data>:<HH:MM>`.

## 10. Authorization

RLS ON + FORCE. `select/insert/update/delete` para `authenticated` **só na própria linha**
(`user_id = auth.uid()` em `using` **e** `with check`). A FK composta não é necessária: a tabela tem
o `user_id` diretamente e a policy o compara com `auth.uid()`.

## 11. Security Considerations

Checklist de `docs/security/SECURITY-BASELINE.md` §13:

- **Trust boundary** — o único valor do cliente é um `time` e um booleano; forma validada por zod no
  cliente **e** pelo tipo `time` no servidor. Nenhuma data, nenhum id de outra pessoa.
- **Cliente adulterado** — pode criar horários **para si mesma** e nada além: `with check` amarra o
  `user_id`, e a FK amarra à rotina dela. Nenhum privilégio novo, nenhum `SECURITY DEFINER` novo,
  nenhuma entrada na allowlist.
- **Isolamento** — probe hostil obrigatório nas quatro operações com `user_id` forjado (§18).
- **PII** — um horário não é dado de saúde e não descreve o cabelo dela; o texto do lembrete continua
  sendo catálogo fixo, sem nada que ela digitou (SPEC-008 BR4).

## 12. Privacy Considerations

Nenhum dado novo sensível. O lembrete na tela de bloqueio continua dizendo apenas *"Você programou o
óleo para hoje"* — nunca o horário como conteúdo, nunca uma afirmação capilar.

## 13. Analytics Events

Nenhum. Não há provider (D-31).

## 14. UX Notes (sem design visual)

- A lista de horários mora no cartão da rotina, em **Cuidados** — onde o intervalo já mora.
- **Escolher a hora sem dependência nova:** dois seletores (hora e minuto) construídos com as
  primitivas que já existem. ⚠️ Um picker nativo **não renderiza no preview web**, que é hoje o único
  jeito de olhar o produto (D-80/D-101) — foi assim que a `@shopify/react-native-skia` foi reprovada.
- ⛔ **Nenhum horário vem sugerido, pré-marcado ou ordenado por mérito.** A tela não tem opinião sobre
  quantas vezes por dia.
- ⛔ **Nenhuma contagem em tom de placar.** *"3 horários"* é uma lista; *"você passou óleo 12 vezes
  este mês!"* seria elogio por quantidade.

## 15. Edge Cases

- EC1 — **Zero horários** — a rotina de hoje, sem mudança nenhuma (FR4).
- EC2 — **Horário repetido** — recusado pelo índice único, traduzido na fronteira como *"você já tem
  esse horário"*, nunca como erro do banco (o padrão da SPEC-023).
- EC3 — **Todos os lembretes desligados** — a rotina continua existindo, aparecendo e sendo
  registrável; o app só não toca.
- EC4 — **Pausa** — nada toca, incluindo todos os horários (SPEC-022, herdado e intocado).
- EC5 — **Muitos horários** — nenhum é recusado; o horizonte encolhe (BR5), e a reconciliação repõe.
- EC6 — **Remover um horário que tem histórico** — o horário some, o evento fica com
  `routine_time_id = null`. O passado não se reescreve (D-69).
- EC7 — **Desligar a rotina** — horários vão junto, histórico fica (FR8).
- EC8 — **Fuso** — o `time` é civil e não tem fuso; quem o converte em instante é o agendador, com o
  fuso dela, como já faz com o horário global.

## 16. Failure Modes

- Escrita falha → a linha volta ao estado anterior e a tela **nomeia qual horário** falhou (o padrão
  da SPEC-024: sem botão de salvar, cada mudança é uma escrita própria).
- Leitura falha → a rotina aparece sem a lista, em vez de a tela inteira quebrar (o silêncio
  deliberado da SPEC-040, agora com a lição do 401 da SPEC-046 §22.1 atrás dele).
- Permissão de notificação revogada → nada é agendado, e a tela não afirma que está ligado
  (SPEC-008 FR2, herdado).

## 17. Acceptance Criteria

- AC1 — Acrescentar, editar, remover e ligar/desligar um horário, persistidos e conferidos no reload.
- AC2 — Dez horários são aceitos sem recusa. **Teste.**
- AC3 — Um intent por `(data, horário ligado)`, **cada um no horário dele**. **Teste.**
- AC4 — Horário com lembrete desligado **não** gera intent, e **continua** na rotina. **Teste.**
- AC5 — O total de notificações pendentes **nunca passa do orçamento da plataforma**, para 1, 3 e 10
  horários. **Teste** — é a BR5 executável.
- AC6 — Pausada, zero intents, com qualquer número de horários. **Teste.**
- AC7 — Sem horários, o comportamento é **byte a byte** o de hoje. **Teste de regressão.**
- AC8 — Marcar um horário como feito **não** muda a próxima data. **Teste** — é a BR1.
- AC9 — Nenhum texto da tela ou do lembrete elogia, pontua ou compara quantidade. **Teste de
  linguagem**, com amostras que precisam casar.
- AC10 — Probe hostil: as quatro operações com `user_id` forjado devolvem `42501`. **pgTAP.**
- AC11 — **Validação a 390px no DEV real** (D-90): cadastrar dois horários → reload → editar um →
  desligar o lembrete do outro → remover → reload.

## 18. Testing Strategy

Core: `buildOilRoutineView` com horários; `buildNotificationIntents` com 1/3/10 horários, pausa,
lembretes desligados, e o orçamento da plataforma. RNTL para a tela. pgTAP para RLS e o índice
único. Probe hostil real no DEV.

## 19. Dependencies

Nenhuma nova. ⚠️ **Nenhuma dependência de picker** (NG do §14).

## 20. Implementation Plan

1. Migration (aditiva) → **HUMAN GATE de aplicação no DEV**.
2. Testes e barreiras primeiro.
3. Domínio (`oil-routine`) e intents (`notifications`).
4. Adapter e porta.
5. Tela.
6. Validação a 390px, pgTAP, probe hostil.
7. `improve`, correção, PR.

## 21. Migration Plan

Uma migration aditiva: tabela nova, uma coluna anulável em `oil_events`, policies e grants. **Não
invalida nenhuma linha existente** — uma rotina sem horários é o estado de todas elas hoje.

## 22. Rollback Plan

`drop table public.oil_routine_times;` e `alter table public.oil_events drop column routine_time_id;`
— sem dado de produção (o release não aconteceu). O código degrada para o comportamento da SPEC-040.

## 23. Open Questions

- **OQ1 — IMPORTANT — "dias" é o intervalo, ou é dia da semana?** A fonte de verdade diz *"ela
  escolhe: dias"* e o exemplo nomeia **segunda-feira**, o que admite duas leituras: (a) o intervalo
  em dias que já existe (`de 2 em 2 dias`), ou (b) uma seleção de dias da semana (`segunda e
  quinta`). *Assunção adotada:* **(a)**, porque é o que a SPEC-040 já entregou e validou, porque
  preserva `feito`/`adiar` e a regra *"a próxima deriva do último feito"* — que a (b) quebraria —, e
  porque o pedido central desta SPEC é **múltiplos horários no mesmo dia**, que as duas leituras
  compartilham. ⚠️ **A (b) é uma capability a mais, não uma correção desta**: ela pede um terceiro
  modelo de cadência ao lado do intervalo, e a decisão de ter os dois é do dono.
- **OQ2 — CAN DEFER — registro por horário na tela.** O dado suporta (`routine_time_id`), e a tela
  desta fatia registra o **dia**. Marcar *"passei o das 12:00"* separadamente é uma superfície a
  mais; entra quando houver evidência de que ela quer o detalhe.
- **OQ3 — CAN DEFER — QA nativo.** O agendamento real e a folha do SO **não existem no preview web**
  (mesma família de `toDataURL` e do share). O que se valida aqui é o cálculo dos intents, a
  persistência e a tela; **o disparo no horário certo só se exerce em build nativo**, que segue
  DEFERRED por constraint do dono.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-07 | v0.1 — rascunho a partir da fonte de verdade do dono. | agente |
