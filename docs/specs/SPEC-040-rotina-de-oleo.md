# SPEC-040 — A rotina de óleo (F39)

| Campo | Valor |
|---|---|
| ID | SPEC-040 |
| Status | **DONE** — validada no DEV real a 390px em 2026-09-03 |
| Owner | dono do produto |
| Bounded Context | Oil Routine (`packages/core/src/oil-routine`) + Notifications + Hoje/Cuidados |
| Related ADRs | ADR-008 (dia civil e tz), ADR-009 (id determinístico de intent), D-22, D-26/D-70, D-28, D-47/D-48 |
| Related SPECs | SPEC-005 (execução), SPEC-008 (lembretes), SPEC-020 (RPC de registro), SPEC-023 (prateleira) |
| Capability | `F39` rotina de óleo capilar |
| Criado / Atualizado | 2026-09-03 / 2026-09-03 |

## 1. Context

> *"Lembrar do óleo. Simples assim."* — Blueprint §23

Óleo hoje só existe **escondido dentro de Nutrição**, como um valor de categoria da prateleira e uma
técnica de pré-lavagem. Para muita gente ele é uma rotina **paralela** — nas pontas, entre lavagens,
com frequência própria — e uma rotina que o app não conhece é uma rotina que ele não ajuda a manter.

**O cronograma não serve para isso.** Ele é um ciclo de quatro semanas gerado por um motor
versionado a partir do perfil (SPEC-004/SPEC-038); enfiar o óleo lá dentro faria uma escolha dela
virar saída de engine, e mudaria o significado de "cuidado planejado". A rotina de óleo é dela, tem
frequência que ela escolhe, e não pertence ao plano.

## 2. A linha do D-26

| | o quê | gate |
|---|---|---|
| **Esta SPEC** | a rotina **existe**: de quantos em quantos dias, lembrar, marcar feito, adiar, e o histórico | nenhum |
| **Fora dela** | **com que frequência ela deveria** passar óleo, **onde**, **como**, **qual** óleo, **por quê** | **D-26/D-70** |

A frequência é **um intervalo de calendário que ela escolhe**, como `wash_frequency` no perfil — não
uma recomendação. Nenhuma opção é marcada como recomendada, ideal ou melhor, e **nenhum texto desta
SPEC diz o que o óleo faz no cabelo**. Isso é conteúdo capilar substantivo, e é o gate.

## 3. Goals

- **G1** A rotina existe como fato dela: intervalo próprio, escolhido por ela, desligável.
- **G2** No dia, o app **lembra** — e a Hoje mostra, com **Feito** e **Adiar**.
- **G3** **Adiar é primeira classe**, não fracasso (D-28): mostra o estado e pede ação; nada se move
  sozinho.
- **G4** O óleo entra no histórico dela como fato datado.
- **G5** Um quinto intent no `NotificationScheduler`, com o opt-in duplo, o teto diário, o horizonte
  e o id determinístico que já existem (SPEC-008) — **sem** o domínio conhecer Expo Notifications.

## 4. Non-Goals

- **NG1** Não entra no cronograma, não vira `scheduled_care` e não é gerada por motor.
- **NG2** Nenhuma recomendação de frequência, de momento, de forma de uso ou de produto ⇒ D-26/D-70.
- **NG3** Nenhuma promessa de resultado, nenhuma pontuação, nenhuma cobrança por ter adiado.
- **NG4** Nenhum vínculo com um produto ainda — é a integração futura com a Prateleira (`F26`/`F48`),
  e o óleo lembrado será **o dela**, nunca um inventado.
- **NG5** Não notificar sem opt-in, e não passar do teto diário (SPEC-008 BR1/FR6).
- **NG6** Uma rotina, não várias. Duas rotinas de óleo não têm consumidor hoje (D-47/D-48).

## 5. Functional Requirements

- **FR1** `public.oil_routines` guarda **uma** rotina por usuária: `every_days` e `started_on`.
- **FR2** Ela escolhe o intervalo entre opções neutras, muda quando quiser e **desliga** quando
  quiser. Desligar apaga a rotina; **o histórico fica**.
- **FR2.1** ⚠️ **A rotina diária é oferecida** (decisão do dono, 2026-09-03): `1` abre a lista. O
  banco sempre aceitou (`between 1 and 60`) e a derivação nunca soube o que é uma semana — mas a
  lista começava no 2, e **uma capability que aceita um valor no schema e o esconde da tela não tem
  aquele valor**. Feito hoje com intervalo diário, a próxima é **amanhã**.
- **FR3** `public.oil_events` guarda o que aconteceu: `done` ou `postponed`, com o dia civil.
- **FR4** O dia civil e a idempotência são **invariantes de servidor** (o mesmo raciocínio da
  SPEC-020): escrita só por RPC `SECURITY DEFINER`, `user_id` de `auth.uid()`, cliente só com
  `SELECT`.
- **FR5** `buildOilRoutineView` deriva, puro: a próxima data, o estado (`upcoming` · `due_today` ·
  `overdue`), há quantos dias venceu, e quando foi a última vez.
- **FR6** A Hoje mostra a rotina **quando vence ou está vencida**, com **Feito** e **Adiar**.
- **FR7** Cuidados tem o endereço da rotina: ligar, trocar o intervalo, desligar, e ver a última vez.
- **FR8** Um intent `oil_due`, com a mesma disciplina dos outros quatro.

## 6. Business Rules

- **BR1** A próxima data deriva do **último feito** + intervalo; sem nenhum feito, de `started_on`.
- **BR2** **Adiar empurra um dia**, e só a ocorrência corrente: um adiamento anterior ao último feito
  não conta. Adiar **não** é falha e não aparece como tal.
- **BR3** Nada se move sozinho (D-28). Vencida, ela continua vencida até ela agir.
- **BR4** Nenhum rótulo desta SPEC afirma o que o óleo faz. "Passei óleo" descreve o que ela fez.
- **BR5** A rotina desligada não lembra e não aparece na Hoje. O histórico continua.
- **BR6** Nenhuma opção de intervalo é apresentada como recomendada (NG2) — o diário inclusive:
  "todo dia" é **escolha dela**, nunca sugestão da Huna.
- **BR7** **Nenhuma frequência é privilegiada no código.** A regra é `último feito + intervalo`, e
  sete não tem nada de especial ali — "1x por semana" é só um rótulo em português, como "todo dia".
  Há teste percorrendo a lista inteira e conferindo que cada opção anda exatamente o próprio número.

## 7. Dados e autorização

```sql
create table public.oil_routines (
  user_id uuid primary key references auth.users (id) on delete cascade,
  every_days smallint not null check (every_days between 1 and 60),
  started_on date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.oil_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('done', 'postponed')),
  happened_on date not null,
  client_event_id uuid not null,
  created_at timestamptz not null default now(),
  constraint oil_events_client_unique unique (user_id, client_event_id)
);
```

**Grants.** `select` nas duas para `authenticated`; `delete` em `oil_routines` (desligar é dela).
Escrita por RPC: `set_oil_routine(p_every_days, p_timezone)` e
`record_oil_event(p_kind, p_client_event_id, p_timezone)`, ambas `SECURITY DEFINER` com
`search_path` fixo e `auth.uid()` validado.

**Por que RPC e não `insert` direto** — o mesmo motivo medido na SPEC-020: o **dia civil** depende do
fuso dela (ADR-008), e `current_date` no servidor é UTC. Deixar o cliente mandar a data faria a
verdade do histórico depender de um relógio que ele controla. A idempotência (`client_event_id`) é
invariante de servidor pela mesma razão que em `complete_care`.

**`started_on` não reseta ao trocar o intervalo.** Ela começou quando começou; trocar a frequência
muda a próxima data (que deriva do último feito), não a história.

## 8. Edge Cases

- **EC1** Ela liga a rotina hoje: a primeira ocorrência é **hoje** (`started_on = hoje`), e não daqui
  a `every_days` — a rotina começa quando ela diz que começou.
- **EC2** Ela some por três semanas: a rotina fica **vencida**, com o número de dias, e nada se
  acumula em fila (D-28/BR3). Um "Feito" resolve a ocorrência corrente.
- **EC3** Retry depois de resposta perdida: o `client_event_id` devolve o mesmo evento (FR4).
- **EC4** Ela desliga e liga de novo: rotina nova, histórico velho intacto (FR2/BR5).
- **EC5** Cronograma pausado (SPEC-022): a rotina **continua contando** e a Hoje segue mostrando —
  ela não é o cronograma. ⚠️ **Mas o lembrete se cala.** "Pausada, nada toca" é garantia já validada
  da SPEC-022, e um intent novo que passasse por cima dela a enfraqueceria; pausa é ela dizendo *não
  me cobre esta semana*, e o aparelho não sabe distinguir qual cobrança ela quis suspender. A
  decisão é deliberada e está testada nos dois sentidos.
- **EC6** Sem rotina, a Hoje não mostra nada e o intent não existe.
- **EC7** ⚠️ **Medido no DEV real, e não previsto quando esta SPEC foi escrita.** Ela adia hoje,
  desliga a rotina e liga de novo **no mesmo dia**: a rotina nova nasce com `started_on = hoje`, e o
  adiamento **continua valendo** — a próxima é amanhã. É o comportamento certo e ficou **fixado em
  teste** em vez de corrigido: ela disse *hoje não*, e religar no mesmo dia não desdiz aquilo; mostrar
  "é hoje" logo depois seria cobrar o que ela acabou de recusar. Não há vazamento do passado — um
  adiamento antigo tem `happenedOn + 1` menor que a data nova e não empurra nada.

## 9. Acceptance Criteria

- **AC1** No DEV real a 390px: ligar a rotina → a Hoje mostra → **Feito** → a próxima data anda o
  intervalo → reload → persistido.
- **AC2** **Adiar** empurra um dia, e a Hoje diz isso sem tratar como falha.
- **AC3** Trocar o intervalo muda a próxima data sem apagar histórico; desligar tira da Hoje e
  **mantém** os eventos.
- **AC4** Dois toques rápidos e um retry produzem **um** evento (medido no banco).
- **AC5** pgTAP: RLS ligada e forçada, grants exatos, cliente sem `INSERT`/`UPDATE` nas duas tabelas,
  `user_id` de `auth.uid()`, isolamento entre usuárias, dia civil pelo fuso. **E medido contra o DEV
  real**, pela porta do app: `INSERT` em `oil_routines` → `42501`; `INSERT` em `oil_events` →
  `42501`; `UPDATE` em `oil_routines` → `42501`; `DELETE` em `oil_events` → `42501`; intervalo
  fora da faixa → `23514`.
- **AC6** O intent `oil_due` respeita opt-in, teto diário, horizonte e id determinístico, e **não
  existe** sem rotina. ⚠️ **A parte da pausa não é observável no preview web** — o adapter de
  notificação é fail-closed ali (D-80). A garantia é de camada de domínio e está testada nos dois
  sentidos no core; e a rotina **não** some da tela quando o cronograma pausa, o que é estrutural:
  `buildOilRoutineView` não recebe `paused` e portanto não pode escondê-la.
- **AC7** Nenhum rótulo afirma o que o óleo faz, e nenhuma frequência é apresentada como recomendada
  — com barreira de teste.
- **AC8** ⚠️ **Diário validado nas três camadas:** domínio (feito hoje → amanhã, adiar, atraso sem
  fila, e cada opção andando o próprio número), banco (`1` aceito; `0` e `61` recusados com
  `23514`) e **DEV real a 390px** — "Todo dia" na lista e `Próxima: sex, 04/09 · última vez em qui,
  03/09`.

## 10. Open Questions

- **OQ1** **Qual** óleo (vínculo com a Prateleira) é `F48`; **como e quando** usar é `F38`/conteúdo,
  atrás do D-26/D-70.
- **OQ2** A rotina não aparece no Progresso nem no ciclo. Ela não é do plano, e misturá-la ao
  progresso do cronograma faria duas coisas diferentes virarem uma métrica só.

## 11. Change Log

| Data | Mudança |
|---|---|
| 2026-09-03 | SPEC criada. A rotina existe; o que o óleo faz continua fora, atrás do gate. |
| 2026-09-03 | **A rotina diária entra na lista** (decisão do dono). O banco e o domínio já aceitavam `1`; a **lista oferecida** começava no 2, e um valor que o schema aceita e a tela esconde não existe para ela. Medido no DEV real: `1` gravado pela tela, `0` e `61` recusados com `23514`, e `Próxima: sex, 04/09 · última vez em qui, 03/09`. |
| 2026-09-03 | Validada no DEV real a 390px: ligar · trocar intervalo · **Adiar** pelo botão (evento gravado com o dia civil dela) · desligar preservando o histórico · religar · a próxima andando o intervalo depois do feito (`qui, 10/09 · última vez em qui, 03/09`). Idempotência medida com **três chamadas da mesma chave, duas em paralelo** → o mesmo id e **uma** linha. Cliente hostil recusado nas quatro pontas. **EC7 descoberta na validação** e fixada em teste. |
