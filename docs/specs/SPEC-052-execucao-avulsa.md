# SPEC-052 — A execução avulsa: o que ela fez fora do cronograma

| Campo | Valor |
| --- | --- |
| ID | SPEC-052 |
| Status | **Implemented** (2026-09-06) — aprovada pelo dono na mesma conversa, com a fonte de verdade transcrita em §1.1 |
| Owner | @gabrielfmorais (humano) |
| Bounded Context | Care Tracking (Core) — DOMAIN-MAP §3.5 |
| Related ADRs | ADR-001 (camadas), ADR-004 (Supabase/RLS/RPC), ADR-008 (dia civil da usuária) |
| Related SPECs | **SPEC-005** (§8 adiou a execução ad hoc) · **SPEC-006** (adiou o check-in avulso *"quando aquela voltar"*) · **SPEC-024 OQ4** (adiou o Wash Day avulso *"quando execução ad hoc existir"*) · SPEC-009 (Progresso) · SPEC-019 (ciclo) · SPEC-039/048 (finalização) · SPEC-043 (Jornada) · SPEC-047/049/050/051 (Insights) |
| Decisões vinculantes | **D-69** (0 ou 1 execução efetiva **por cuidado planejado**; desfazer em 15 min) · **D-28** (nunca deslocar o cronograma) · **D-103** (⛔ nenhum incentivo a fazer mais cuidados) · **D-25** (sem streak artificial) · **D-26/D-70** (não inventar regra capilar) · D-47/D-48 (necessidade) |
| Fase do roadmap | MASTER PRODUCT BACKLOG — `F25` (entry point *"registro avulso"* do Blueprint §9) |
| Labels | `db`, `security` |
| Criado / Atualizado | 2026-09-06 / 2026-09-06 |

---

## 1. Context

> **Entry points.** A partir do cuidado do dia (o caminho natural: ela acabou de fazer); **e um registro
> avulso, porque a vida real não pede licença ao cronograma.** — Blueprint §9 (`F25`)

⚠️ **Isto não é capability nova. É a última metade de uma que foi entregue pela metade**, e três SPECs
registraram por escrito que ela ficou de fora, cada uma apontando para a seguinte:

| SPEC | o que ela disse |
|---|---|
| **SPEC-005 §8** | *"Execução avulsa (`scheduled_care_id NULL`) — DOMAIN-MAP §3.5 a permite, mas nenhum fluxo desta fatia a exige. DEFER."* |
| **SPEC-006** | *"Check-in avulso, sem execução — execução avulsa continua DEFER desde a SPEC-005; **quando aquela voltar**."* |
| **SPEC-024 OQ4** | *"registro avulso […] hoje `care_executions.scheduled_care_id` não é anulável. **Entra quando execução ad hoc existir**."* |

**E a arquitetura já a autorizou**, desde antes da SPEC-005 — DOMAIN-MAP §3.5:

> *"Execução sem agendamento (ad hoc) é permitida (`scheduled_care_id NULL`, `care_type` obrigatório)."*

**O gatilho que as três nomearam — *"um fluxo que exija"* — chegou.** `P2` (SPEC-047), `P6` (SPEC-049),
`P8` (SPEC-050) e `P13` (SPEC-051) existem, e os quatro leem **uma fatia** do que ela faz.

### 1.1 Fonte de verdade (dono, 2026-09-06)

Transcrita porque é ela, e não esta SPEC, que decide os limites:

- não é uma nova categoria de produto;
- é a concretização da execução ad hoc já prevista no DOMAIN-MAP e nas SPECs anteriores;
- `scheduled_care_id` passa a poder ser `NULL`;
- quando `scheduled_care_id` for `NULL`, `care_type` continua obrigatório;
- execução avulsa **não altera nem reescreve o cronograma**;
- **não conta como aderência**;
- **não gera pontos, streak artificial ou recompensa por fazer mais cuidados**;
- **não aparece como cuidado planejado na Hoje**;
- deve alimentar histórico, produtos usados, Wash Day, finalização, check-in, `checkin_marks`,
  Smart Shelf e Hair Intelligence **normalmente**;
- undo/void preserva as mesmas regras das execuções normais;
- registros anulados continuam excluídos das agregações;
- **não criar tabela paralela** se a arquitetura atual já suporta pela própria `care_executions`;
- **não duplicar fluxo** de check-in/produtos/finalização.

---

## 2. Problem

**Todo fato que a Huna conhece pendura num cuidado que o plano propôs.** Medido no schema:

```sql
care_executions.scheduled_care_id  uuid NOT NULL   -- 20260830000000_care_tracking.sql:44
wash_days.care_execution_id        uuid NOT NULL   -- 20260908000000_wash_days.sql:33
```

A primeira linha é o corte. A lavagem de domingo, o tratamento que ela decidiu fazer, o dia em que
usou a máscara nova sem consultar o app — **nada disso tem por onde entrar**, e por consequência
nada disso existe para o Wash Day, para a Prateleira, para a Smart Shelf nem para a Hair
Intelligence.

**Medido no DEV real (2026-09-06):**

```
cuidados planejados .......... 136
executados (não anulados) ....  14
  com check-in (resultado) ...   6
```

A camada de inteligência inteira enxerga **6 fatos**, e todos eles nasceram de um cuidado que o
motor propôs. Para quem lava 2–3× por semana com um plano de 8–12 cuidados/mês, o que fica de fora
pode ser **a maior parte do cuidado real dela**.

⚠️ **E a resposta certa não é insistir.** O próprio código já recusou o caminho fácil: *"um convite
quando não há registro seria cobrança, que AC8 proíbe"* (`TodayScreen`, SPEC-024). O que falta não é
lembrete — é **endereço** para o que ela já fez.

---

## 3. Goals

- **G1** `care_executions` aceita uma execução **sem cuidado planejado**, com `care_type_code`
  obrigatório, pelas mesmas RPC/RLS/idempotência das execuções de plano.
- **G2** A execução avulsa alimenta **exatamente os mesmos** consumidores: Wash Day (produtos,
  técnicas, finalização), check-in, `checkin_marks`, Smart Shelf e Hair Intelligence — **sem uma
  linha de fluxo duplicada**.
- **G3** Ela **não** toca cronograma, aderência, Progresso, ciclo, Jornada, pontos ou sequência.
- **G4** Um caminho simples e discreto para registrar, em **linguagem natural**, que **não cobra** e
  **não recompensa**.
- **G5** `void_execution` vale igual, e o anulado sai das agregações igual.

---

## 4. Non-Goals

- **NG1 — ⛔ Nenhuma tabela nova.** A arquitetura já suporta pela própria `care_executions` (§1.1).
- **NG2 — ⛔ Nenhuma segunda tela de registro.** Produtos, técnicas, finalização, check-in e marcas
  entram pelos componentes que já existem, sobre o mesmo `CareItem`.
- **NG3 — ⛔ Não vira cuidado planejado.** Nada é inserido em `scheduled_cares`; o cronograma não
  ganha, não perde e não desloca nada (D-28).
- **NG4 — ⛔ Nenhuma gamificação.** Zero ponto, zero marco, zero sequência — D-103, e §7 BR5 é a
  barreira executável disso.
- **NG5 — ⛔ Nenhuma cobrança.** A superfície não pergunta se ela esqueceu, não conta quantos dias
  faz, não sugere registrar mais.
- **NG6 — ⛔ Nenhum tipo de cuidado novo.** O vocabulário é o `CARE_TYPE_CODES` já aprovado
  (D-67/SPEC-038). Inventar tipo é D-26.
- **NG7 — ⛔ Nada de data escolhida por ela nesta fatia.** O dia é o **dia civil dela**, calculado no
  servidor (ADR-008), como em toda execução. Registrar retroativamente é OQ1.
- **NG8 — ⛔ Não atravessa** OQ5 (SPEC-047), D-26/D-70, D-32, engine v2, `F32`/`T2`.

---

## 5. User Stories

- **US1** Como usuária, quero contar que fiz um cuidado fora do cronograma, para que o que eu faço de
  verdade conte no que o app aprende sobre mim.
- **US2** Como usuária, quero registrar nele os mesmos produtos, técnica, finalização e check-in que
  registro num cuidado do plano, sem aprender uma segunda tela.
- **US3** Como usuária, quero desfazer um registro avulso que fiz por engano, do mesmo jeito.
- **US4** Como usuária, **não** quero que isso me cobre nem me premie por lavar mais.

---

## 6. Functional Requirements

- **FR1** A RPC `record_ad_hoc_care(p_care_type_code, p_client_execution_id, p_timezone)` cria uma
  `care_executions` com `scheduled_care_id = NULL`, `user_id = auth.uid()` e
  `executed_on = care_local_today(tz)`.
- **FR2** É **idempotente por `client_execution_id`**, com a mesma cláusula de replay concorrente do
  `complete_care` — mesma chave devolve o mesmo id e **não** cria um segundo fato.
- **FR3** `care_type_code` fora de `CARE_TYPE_CODES` é recusado pelo `CHECK` que já existe (`23514`).
- **FR4** ⚠️ **`buildAdHocHistory` — e NÃO `buildTodayView`.** A tela mistura as avulsas ao histórico
  do plano; o `TodayView` continua sendo **o cronograma e nada além**. A primeira versão as punha
  dentro dele e duas barreiras falharam na hora, porque `buildProgress` e `buildCycleView` **reusam**
  `buildTodayView` (SPEC-019) — a avulsa vazava direto para a aderência e para o resumo de ciclo. Um
  filtro em cada consumidor consertaria **os dois que existem hoje**; a função à parte protege
  também o que ainda não existe. Ela devolve uma **lista**, nunca um `TodayView`, pela mesma razão.
- **FR5** O cartão do histórico de uma execução avulsa é **o mesmo componente** do cuidado concluído:
  finalização, check-in, marcas, *"Contar esse cuidado"* e *"Meus produtos"*, sem ramo novo.
- **FR6** A entrada fica na **Hoje**, imediatamente acima da seção *Histórico* (§14), e abre a
  escolha do tipo.
- **FR7** `void_execution` aceita a execução avulsa nas mesmas condições (dona, não anulada, dentro
  de 15 min) e o `on delete cascade`/`voided_at` se comporta igual.
- **FR8** `InsightFact` passa a incluir as execuções avulsas **não anuladas**; as anuladas continuam
  fora, pelo filtro que já existe.

---

## 7. Business Rules

- **BR1 — o dia é do servidor.** `executed_on` vem de `care_local_today(p_timezone)`, nunca do
  cliente — a mesma razão medida na SPEC-020/SPEC-040: deixar o cliente mandar a data faria a
  verdade do histórico depender de um relógio que ele controla.
- **BR2 — ⚠️ o teto de "0 ou 1 execução efetiva" é POR CUIDADO PLANEJADO, e continua sendo.** O
  índice único parcial é sobre `scheduled_care_id`; com `NULL` ele naturalmente não se aplica, e é
  **certo** que não se aplique: dois cuidados avulsos no mesmo dia são dois fatos diferentes. O teto
  que protege o plano continua intacto porque a chave dele nunca é nula.
- **BR3 — a aderência é do plano, e o avulso não está nele.** `Progress`, o ciclo e a Hoje derivam de
  `scheduled_cares`; uma execução sem cuidado planejado **não aparece** em nenhuma das três contagens.
  Isto não é um filtro novo: é consequência de por onde elas iteram, e ganha barreira de teste.
- **BR4 — ⚠️ o avulso NÃO paga ponto, e a razão é estrutural.** `journey_points` chaveia o fato no
  **cuidado planejado** (SPEC-043, migration `20260916000000`); um avulso não tem um, logo não há o
  que conceder. **A barreira é a chave, não uma trava a mais** — exatamente como na correção medida
  daquela SPEC. Barreira de teste explícita mesmo assim, porque é a proibição que abre a D-103.
- **BR5 — nem sequência, nem marco.** `caresAttended`, a sequência e os marcos derivam do plano
  ativo. Uma execução avulsa não os move — barreira de teste, nos dois sentidos.
- **BR6 — anulada é anulada.** `voided_at is not null` já exclui de tudo (`isEffective`, `InsightFact`,
  Wash Day). A execução avulsa não abre exceção nenhuma.
- **BR7 — posse nas duas pontas.** `user_id` vem de `auth.uid()` dentro do `SECURITY DEFINER`; o
  cliente não tem `INSERT` em `care_executions` e não passa a ter.
- **BR8 — ⛔ nenhum tipo novo.** `care_type_code` continua preso ao `CHECK` de `CARE_TYPE_CODES`.
- **BR9 — o rótulo do tipo é o que a tela já usa.** Nada de vocabulário paralelo.

**Onde vivem:** BR2–BR6 em `packages/core/src/care-tracking/domain/care-tracking.ts` e
`packages/core/src/journey/`; BR1/BR7/BR8 no banco.

---

## 8. Data Model Impact

**Uma coluna, e nada mais.** Atualizar `docs/architecture/DATA-MODEL.md`.

```sql
alter table public.care_executions
  alter column scheduled_care_id drop not null;
```

- **`care_type_code` continua `not null`** e continua com o `CHECK` — é ele que carrega a identidade
  do cuidado quando não há linha de plano.
- **`care_executions_care_owner_fk`** é composta em `(scheduled_care_id, user_id)`. Em `MATCH SIMPLE`
  (o padrão), uma linha com `scheduled_care_id NULL` **não é verificada** — que é o comportamento
  desejado, e não um furo: não há a que apontar.
- **O índice único parcial de "0 ou 1 execução efetiva"** é sobre `scheduled_care_id`; `NULL` não
  colide com `NULL` em índice único, e o parcial já filtra por `voided_at is null`. **Nada a mudar** —
  verificar no DEV, não assumir.
- **`wash_days`, `checkins`, `checkin_marks`, `wash_day_finish`, `wash_day_products`,
  `wash_day_techniques`, `wash_day_scalp`** penduram na **execução**, não no plano: **zero mudança**.
- **Dados existentes:** nenhum. `drop not null` é compatível para trás — toda linha atual continua
  válida, e um app antigo nunca produz `NULL` porque só chama `complete_care`.

---

## 9. API / Contracts

```
record_ad_hoc_care(p_care_type_code text, p_client_execution_id uuid, p_timezone text) → uuid
```

- `SECURITY DEFINER`, `set search_path = public, pg_temp`, `user_id := care_current_user()`.
- **Erros:** `22023` chave ou timezone ausente · `23514` tipo fora do `CHECK` · replay devolve o id
  existente com `200`.
- **Idempotência:** `unique (user_id, client_execution_id)`, com o mesmo `exception when
  unique_violation` do `complete_care` para o retry concorrente.
- `revoke ... from public, anon` · `grant execute ... to authenticated`.
- **Allowlist:** declarar em `supabase/security/allowlists.sql`
  (`tests.security_definer_allowlist`), senão o pgTAP de funções não aprovadas falha.

**Porta do core:** `CareTrackingPort.recordAdHocCare({ careTypeCode, clientExecutionId })`.

---

## 10. Authorization

- Sem entitlement: **registrar é Free** (Blueprint §9 — *"cobrar pelo registro seca a fonte que o
  Premium bebe"*).
- O cliente continua com **apenas `SELECT`** em `care_executions`. A escrita é só pela RPC.
- `SECURITY DEFINER` justificado: o dia civil e a posse são invariantes de servidor (ADR-008), e é o
  mesmo desenho de `complete_care`.
- RLS de `care_executions` inalterada; policy positiva e negativa já existem e passam a cobrir a
  linha avulsa pelo mesmo `user_id`.

---

## 11. Security Considerations

Checklist SECURITY-BASELINE §13:

- [x] RLS ON, sem policy nova · [x] `SECURITY DEFINER` com `search_path` fixo e `auth.uid()` validado
- [x] Entrada validada por zod no cliente **e** por `CHECK` no servidor
- [x] Sem PII nova · [x] Sem `service_role` no app · [x] Sem grant novo em tabela
- **T-ids:** cliente adulterado tentando **forjar execução de outra usuária** — recusado porque
  `user_id` nunca vem do parâmetro; e tentando **`INSERT` direto** em `care_executions` — `42501`.
  Os dois com pgTAP.
- Rate limit: nenhum novo; a idempotência por chave já absorve o duplo toque.

---

## 12. Privacy Considerations

Nenhum dado pessoal novo: é o mesmo fato que já existe para o cuidado planejado, sem a linha de
plano. Vocabulário fechado (`CARE_TYPE_CODES`), **sem texto livre** — a mesma razão da SPEC-024.
Exclusão de conta continua pelo `on delete cascade` de `auth.users`.

---

## 13. Analytics Events

Nenhum. O provider não existe (D-31).

---

## 14. UX Notes

### 14.1 Onde mora — decidido depois de auditar as superfícies

| superfície | por que não |
|---|---|
| **Cuidados ("Sua rotina")** | Seria coerente com *"Meu cabelo mudou"*, mas o registro **aparece na Hoje**: a porta ficaria numa aba e o resultado na outra. |
| **Cartão de foco da Hoje** | A SPEC-016 fatia 2 dá à tela **uma única ação primária**; uma segunda competiria com ela. |
| **Sugestões** | Sugestão deriva de fato dela; isto é uma porta permanente, não uma sugestão. |

✅ **Na Hoje, imediatamente acima da seção *Histórico*.** É onde o registro **vai aparecer**, fica
abaixo da dobra (não é prompt), e é uma porta só — a SPEC-026/027 recusa duas portas para o mesmo
destino.

### 14.2 A linguagem

- Convite: **"Fez um cuidado fora do cronograma?"** — pergunta, não instrução.
- Ação: **"Registrar um cuidado"**.
- ⛔ **Nada de** *"você ainda não registrou"*, contagem de dias, elogio ou incentivo (NG5, D-103).

### 14.3 O fluxo

1. Toca em *Registrar um cuidado* → escolhe o **tipo** (os chips de `CARE_TYPE_CODES`, com o
   vocabulário e as cores que a tela já usa).
2. Confirma → a execução nasce e o cartão aparece **no Histórico**, já oferecendo finalização,
   check-in, marcas, *Contar esse cuidado* e *Meus produtos* — **os mesmos componentes** (NG2).
3. Desfazer: o mesmo botão, a mesma janela de 15 minutos.

**Estados:** escrita em voo bloqueia como qualquer outra · falha nomeia o que falhou e não prende ·
sem plano ativo a porta **não existe** (não há tela onde pendurar).

**Acessibilidade:** os chips reusam o `Chip` (`role="radio"`), e ⚠️ **a validação a 390px afere o
estado pelo rótulo em ameixa, não por ARIA** — `react-native-web` 0.21 descarta `accessibilityState`
(SPEC-051 OQ4).

---

## 15. Edge Cases

- **EC1** Duplo toque: mesma `client_execution_id`, um fato, id repetido.
- **EC2** Duas escritas em paralelo: `unique_violation` capturada, uma linha.
- **EC3** Dois avulsos no mesmo dia: **permitido** — são dois fatos (BR2).
- **EC4** Avulso e cuidado planejado no mesmo dia: convivem; a aderência só olha o planejado (BR3).
- **EC5** Plano pausado: a porta **continua** — pausa é do cronograma, e registrar o que ela fez não
  é cumprir cronograma. ⚠️ E continua não tocando aderência nem lembrete (SPEC-022).
- **EC6** Anular o avulso: some da tela e das agregações; o Wash Day cai junto pelo cascade
  (⚠️ mas `void_execution` é **soft delete**, então na prática o registro sobrevive à linha anulada —
  a imprecisão herdada registrada na SPEC-039 OQ4, que esta SPEC **não** resolve).
- **EC7** Reavaliar/trocar de plano: o avulso não pertence a plano nenhum, então **sobrevive** —
  e continua contando na Hair Intelligence, que é vitalícia.
- **EC8** Timezone ausente: `22023`, nada criado.

---

## 16. Failure Modes

Falha de rede na criação: nada é criado, a tela diz que não deu e oferece tentar de novo; o retry
usa **a mesma chave**, então não há risco de dois. Falha de leitura: a Hoje já tem o caminho de erro
com nova tentativa. Nenhuma mensagem expõe detalhe interno.

---

## 17. Acceptance Criteria

- **AC1** Uma execução avulsa **não paga ponto** — Jornada idêntica antes e depois (teste + DEV real).
- **AC2** **Não altera aderência** — `Progress` e o ciclo idênticos.
- **AC3** **Não aparece como planejada** — ausente de `overdue`/`today`/`upcoming`.
- **AC4** **Aparece no histórico**, com o cartão completo.
- **AC5** **Alimenta `InsightFact`** — produto/técnica/finalização/marca registrados nela contam.
- **AC6** **Anulada não entra** em nenhuma agregação.
- **AC7** Cliente adulterado **não forja execução de outra usuária** (`42501`) nem `INSERT` direto.
- **AC8** `care_type_code` inválido é **recusado** (`23514`).
- **AC9** Os fluxos de **execução planejada continuam intactos** — toda a suíte anterior verde, sem
  assertion enfraquecida.
- **AC10** Validada a **390px no DEV real**: registrar → aparece no histórico → produto/finalização/
  check-in/marca → **reload** → persistido → desfazer → some.
- **AC11** Nenhuma frase cobra ou premia — barreira de teste na tela.

---

## 18. Testing Strategy

**Ordem exigida pelo dono: barreiras primeiro.**

- **Core (unit):** `buildTodayView` arquivando em `history` · aderência e ciclo invariantes ·
  Jornada invariante (BR4/BR5) · `InsightFact` com e sem avulso · anulada fora.
- **pgTAP** (`supabase/tests/security/`): tipo inválido `23514` · `user_id` forjado `42501` ·
  `INSERT` direto `42501` · idempotência por chave · duas em paralelo → uma linha · `void_execution`
  nas mesmas condições · **o índice único do plano continua barrando a segunda execução planejada**.
- **RNTL:** a porta existe/não existe · o cartão do histórico é o mesmo · linguagem sem cobrança.
- **DEV real a 390px:** AC10, com estado restaurado ao fim.
- **Barreiras nos dois sentidos:** cada uma verificada com o defeito injetado.

---

## 19. Dependencies

Nenhuma dependência npm nova. Nenhum serviço externo. **Depende de o dono aplicar a migration no
DEV** (§4 de `CLAUDE.md`) — é o único gate desta SPEC.

---

## 20. Implementation Plan

1. Barreiras de core que devem falhar hoje (aderência/Jornada/insights invariantes).
2. Migration (`drop not null` + RPC + allowlist) e pgTAP.
3. **⛔ HUMAN GATE — o dono aplica a migration no DEV.**
4. Domínio: `AdHocExecution` no board, `buildTodayView`, `InsightFact`.
5. Adapters: `recordAdHocCare`, leitura das execuções sem plano.
6. UI: a porta na Hoje, a escolha do tipo, o cartão no histórico.
7. Validação a 390px no DEV real.
8. `improve` → BLOCKER/IMPORTANT → PR → CI → merge.

---

## 21. Migration Plan

Duas migrations, **nesta ordem**:

1. `20260919000000_ad_hoc_care_execution.sql` — a coluna anulável e a RPC.
2. `20260919000001_journey_points_ignore_ad_hoc.sql` — ⚠️ **obrigatória, não opcional**: sem ela, um
   único registro avulso faz `award_journey_points` lançar `23502` e **para a Jornada inteira**
   (§22.1). Ela nasceu de medir o DEV depois da primeira, e é o motivo de a fatia ter tido **dois**
   gates de aplicação em vez de um.

Compatível para trás nas duas: app antigo só chama `complete_care` e nunca produz `NULL`. Sem
backfill — nenhuma avulsa chegou a virar ponto, porque a função nunca completou.

## 22. Rollback Plan

Código: reverter a PR. Migration: `drop function record_ad_hoc_care`; ⚠️ **restaurar o `not null`
só é possível se não houver linha avulsa** — com linhas, o rollback é remover a porta e a RPC,
deixando a coluna anulável (inócua). Registrado no cabeçalho da migration.

---

## 22.1 ⚠️ O BLOCKER que só o DEV real encontrou

**A execução avulsa quebrava a Jornada inteira.**

`award_journey_points` grava `fact_id = e.scheduled_care_id` nos **três** blocos — foi assim que a
SPEC-043 consertou o pagamento duplo, ancorando o ponto no **cuidado planejado**. Com a coluna
anulável, uma avulsa faz esse `select` produzir `fact_id = NULL`, e a coluna é `not null`. Medido
contra o DEV depois de registrar **um** cuidado avulso:

```
400  23502  "Failing row contains (…, care_execution, null, 10, v1, 2026-09-06, …)"
```

⚠️ **O estrago não é o ponto que falta: é a função inteira que passa a lançar.** Um único registro
avulso fazia ela **parar de ganhar pontos pelos cuidados do PLANO** também — `useJourney` cai no
`catch`, a tela mostra o estado de falha, e nada diria por quê.

⚠️ **E nenhum teste via, o que é o achado dentro do achado.** O pgTAP desta SPEC perguntava *"quantos
pontos apontam para uma avulsa?"* e recebia **zero** — verdade, porque a função **abortava antes de
inserir qualquer coisa**. **Uma asserção que passa quando o sistema falha é pior que nenhuma.** Ela
passou a exigir que a função **conclua** (`lives_ok`) e que os cuidados planejados **continuem sendo
pagos** com a avulsa presente — sem essa segunda, *"zero ponto de avulsa"* seguiria compatível com
*"zero ponto nenhum"*.

**Correção:** `and e.scheduled_care_id is not null` nos três blocos, em
`supabase/migrations/20260919000001_journey_points_ignore_ad_hoc.sql`. A regra passa a estar dita —
**só o cuidado planejado paga** — em vez de acontecer por acidente.

⚠️ **Auditados os demais consumidores de `scheduled_care_id` no banco, e nenhum outro quebra:**
`care_lock_actionable` e as duas subconsultas de `plan_pauses` comparam `= sc.id`, e `NULL` nunca
iguala — a avulsa é invisível para elas, que é o comportamento correto.

## 23. Open Questions

- **OQ1 (CAN DEFER) — registrar em data passada.** *"Lavei anteontem e esqueci de contar."* Fora
  desta fatia: o dia civil do servidor é a garantia que a SPEC-020/040 pagou caro para ter, e abrir
  data escolhida pede regra de janela e de conflito. *Assunção:* hoje, e só hoje.
- **OQ2 (CAN DEFER) — óleo como tipo de avulso.** A rotina de óleo (`F39`) tem os próprios eventos e
  **não é um dos quatro tipos**. *Assunção:* fora; o óleo continua no `F39`.
- **OQ3 (CAN DEFER) — SPEC-039 OQ4 herdada.** `void_execution` é soft delete, então o `on delete
  cascade` **não** dispara ao desfazer. Atravessa SPEC-024/025/039 e continua fora de escopo.
- **OQ4 (CAN DEFER) — o avulso vira card compartilhável?** `F46` deriva de conquista; um avulso não é
  conquista. *Assunção:* não.

---

## 23.1 Evidência

**Barreiras, e uma delas achou o defeito antes de o código existir.** A primeira versão punha a
avulsa no `history` do próprio `TodayView`; **dois testes falharam na hora**, porque `buildProgress`
e `buildCycleView` **reusam** `buildTodayView` (SPEC-019) e a avulsa vazava para a aderência e para
o resumo de ciclo. `buildAdHocHistory` mantém o `TodayView` sendo o cronograma e nada além.

**Barreiras verificadas nos dois sentidos** (defeito injetado ⇒ teste falha): avulsa marcada como
`planned` → 1 teste de core; rótulo *"Fora do cronograma"* removido → 1 de tela; a tela deixando de
pedir as avulsas → 1 de tela; `care_type_code` fora do `select` → 1 de adapter.

**Barreira de tipo, não de teste:** `CareExecution` é união discriminada — *"avulsa sem
`care_type_code`"* **não compila**.

### Probe hostil contra o DEV real — 15/15

| | |
|---|---|
| **AC8** tipo fora do `CHECK` | `400 · 23514` |
| **AC7** `INSERT` direto em `care_executions` | `403 · 42501` |
| **FR2** mesma chave duas vezes | mesmo id, **uma** linha |
| **EC2** duas escritas **em paralelo** | mesmo id, **uma** linha |
| **BR1** `executed_on` | dia civil do **servidor** |
| cronograma | **136 → 136** cuidados planejados |
| **AC1** pontos | **205 → 205**, zero apontando para avulsa |
| **AC9** teto do plano | nenhum cuidado planejado com mais de uma execução efetiva |
| **FR7** desfazer | `204`, mesma janela |

### 390px no DEV real

**Registrar → histórico → reload → desfazer**, com login de volta depois do reload (⚠️ a sessão do
preview é **em memória**, D-85 — a primeira rodada mediu a tela de entrada e "reprovou" uma
persistência que estava certa):

- a porta lê *"Fez um cuidado fora do cronograma?" · "Registrar um cuidado"*, em cartão discreto,
  **abaixo da dobra e imediatamente acima do Histórico**;
- escolher o tipo grava, e o cartão aparece como **"Reconstrução · Fora do cronograma · dom, 06/09"**,
  já oferecendo *"Você finalizou?"*, *"Como ficou?"*, *"Ver o que contei"* — **os mesmos componentes**;
- **AC3** medido no texto da tela: nada de *"Fora do cronograma"* antes da seção *Histórico*;
- **FR7**: *Desfazer* remove o cartão (3 → 2);
- **NG5**: nenhuma cobrança, contagem de dias, elogio ou convite a fazer mais.

### AC5/AC6 — Hair Intelligence, medida nos dois estados

- respondido o check-in da avulsa, *"Seus padrões"* passou de **"Com base em 6"** para
  **"Com base em 7 cuidados que você avaliou"** — e *"esteve em 4 dos 7 que você avaliou bem"*;
- **anulada a avulsa, voltou a 6.** ⚠️ E a medição corrigiu uma leitura minha: a primeira passagem
  marcou `6 → 6` porque o driver leu a tela **ainda montada**; numa sessão nova o número é 7.

### O conserto, medido no DEV com uma avulsa VIVA (depois da migration `20260919000001`)

| | |
|---|---|
| `award_journey_points` | **200** — era `400 · 23502` |
| pontos | **205 → 205**, zero apontando para avulsa |
| ⚠️ **controle positivo** | **14 cuidados do plano continuam pagos** com a avulsa presente |
| `lifetimeDoneCount` com o filtro | **14 → 14** |
| ⚠️ **e sem o filtro** | **14 → 15** — a prova de que é o filtro que segura |
| cronograma | **136 → 136** |

**A 390px, com a avulsa viva, zero problema de console:** a **Jornada carrega** (*"Nível 3 · Constante · 205 pontos"*) — era exatamente esta tela que morria; a **Progresso diz "14 cuidados"**, não 15; **nenhum cartão de avulsa oferece *Compartilhar*** e o do plano continua oferecendo (controle positivo, 1 na tela); reload persistiu; *Desfazer* removeu (1 → 0).

**Estado do DEV ao fim:** 14 execuções vivas, 205 pontos, base 6 — o de antes. Resíduo: duas
execuções avulsas **anuladas** e um check-in preso a uma delas (append-only, invisível a toda
agregação).

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-06 | Criada. Concretiza a execução ad hoc do DOMAIN-MAP §3.5, adiada por SPEC-005 §8, SPEC-006 e SPEC-024 OQ4. | agente |
| 2026-09-06 | ✅ **DONE.** Conserto validado no DEV com avulsa viva: Jornada em 200, 14 cuidados do plano ainda pagos, vitalícia 14 (15 sem o filtro), Compartilhar ausente na avulsa. | agente |
| 2026-09-06 | **BLOCKER medido no DEV real (§22.1):** a avulsa fazia `award_journey_points` lançar `23502` e parava a Jornada inteira. Migration `20260919000001`, e a asserção de pgTAP que passava com o sistema quebrado foi refeita. | agente |
