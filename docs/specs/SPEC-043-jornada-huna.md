# SPEC-043 — A Jornada Huna (F40 · F41 · F42)

| Campo | Valor |
|---|---|
| ID | SPEC-043 |
| Status | Em implementação |
| Owner | dono do produto |
| Bounded Context | Journey (`packages/core/src/journey`) + banco (`journey_points`) + tela própria |
| Related ADRs | ADR-001 §2 (versão liberada é imutável), ADR-007 A1 (registro de regras), ADR-008, D-28, D-83, **D-103** |
| Related SPECs | SPEC-005 (o fato), SPEC-006 (check-in), SPEC-022 (pausa), SPEC-024 (registro), **SPEC-009/019/021 (as recusas de pontuar)** |
| Capability | `F40` pontos e níveis · `F41` sequência · `F42` marcos |
| Criado / Atualizado | 2026-09-03 / 2026-09-03 |

## 1. Context

> A Huna recompensa **consistência com o plano**, não **quantidade de tratamentos**. — D-103

A Jornada diz *"minha consistência na jornada"*. Ela **não** diz *"quão saudável ou bonito está meu
cabelo"* — essa segunda frase seria avaliação capilar, precisaria de revisor (D-26), e o produto já
a recusou três vezes.

## 2. A tensão com as recusas, e como ela se resolve

O produto **recusa pontuar** em SPEC-009, SPEC-019 e SPEC-021, com **barreira de teste viva** na aba
Progresso que reprova `score`, `nota`, `pontuação`, `aderência`, `desempenho` e qualquer `\d+%`. Uma
camada de pontos parece contradizer isso frontalmente. **Não contradiz:**

- **O que foi recusado é pontuar o CABELO e o CICLO** — dar nota ao resultado dela, dizer "você
  cumpriu 83%". Continua proibido, e as barreiras continuam de pé.
- **O que a Jornada mede é a ADERÊNCIA AO PLANO** — objeto diferente, verificável, que não afirma
  nada sobre cabelo.

⚠️ **Consequência de arquitetura, e é dura: a Jornada tem superfície própria.** Não é widget da
Progresso nem do ciclo. **Quem implementar deve encontrar as barreiras da Progresso verdes e
intocadas no fim** — e elas estão.

## 3. Goals

- **G1** Ela vê que está mantendo a própria rotina, e quer manter.
- **G2** Pontos, nível, sequência e marcos derivam de **fato canônico**, sem segunda verdade.
- **G3** O ponto é **fato datado**: mudar a régua **não** reescreve o passado.
- **G4** Idempotência **pelo id do fato**.
- **G5** Superfície própria; a Progresso continua sem nota.

## 4. Non-Goals

- **NG1** ⛔ Nenhum incentivo a **lavar mais**, fazer **mais reconstruções**, aplicar **mais produto**,
  repetir cuidado ou agir **fora do plano** por pontos.
- **NG2** ⛔ **Sequência diária.** Num plano de 4 a 12 cuidados por mês, um streak por dia só se
  cumpre lavando mais.
- **NG3** ⛔ Nenhuma nota no cabelo dela **por outro nome**.
- **NG4** ⛔ **Nenhum multiplicador Premium.** FREE participa integralmente (D-83 + D-103).
- **NG5** ⛔ Copiar interface ou identidade de Duolingo, Strava, Finch ou Fabulous — os benchmarks são
  **conceituais**.
- **NG6** Nenhuma cobrança: sem "não perca sua sequência", sem meta, sem vermelho.

## 5. Functional Requirements

- **FR1** `journey_points` guarda o ponto como fato datado, com `fact_kind` + `fact_id` e a
  `rules_version` que o concedeu. ⚠️ **`fact_id` é o CUIDADO PLANEJADO** (`scheduled_cares.id`), nas
  três espécies — nunca a linha de execução (ver BR7).
- **FR2** O cliente tem **apenas `SELECT`**. Sem `INSERT` ele não forja; sem `UPDATE`/`DELETE` ele não
  reescreve.
- **FR3** `award_journey_points(tz)` concede o que ainda não foi concedido, lendo os fatos dela.
  **Nem os pontos nem o fato são parâmetro.**
- **FR4** `buildJourneyView` deriva pontos, nível, sequência e marcos — **somando o concedido**, nunca
  recalculando.
- **FR5** A sequência conta **cuidados planejados atendidos**, em ordem de data. Dia sem cuidado
  planejado não quebra nada.
- **FR6** Pausa **congela** a sequência, **na derivação** (SPEC-022 BR1).
- **FR7** Tela própria, com entrada quieta na Hoje.

## 6. Business Rules

- **BR1** Deriva de fato canônico; nunca uma segunda verdade. A sequência sai de `buildTodayView` — a
  mesma leitura da Hoje e do ciclo.
- **BR2** O teto é **o plano**: cada ponto é por cuidado planejado, por check-in daquele cuidado ou
  pelo registro daquele cuidado. Fazer além do plano não gera fato planejado, e portanto não paga.
- **BR3** Régua **versionada** (`rules/v1`), imutável depois de liberada (ADR-001 §2).
- **BR4** `rescheduled` **não quebra e não conta** — ela moveu o compromisso, não faltou a ele.
  `skipped` **quebra**: pular é decidir não fazer.
- **BR5** O cuidado **de hoje** ainda não feito **não quebra** — tratá-lo como falha antes de o dia
  acabar seria cobrar o que ainda pode acontecer (D-28).
- **BR6** Nenhum nome de nível ou marco fala do cabelo dela — com barreira de teste.
- **BR7** ⚠️ **O fato que paga é o CUIDADO PLANEJADO, não a execução.** `void_execution` é *soft
  delete*, e refazer o cuidado cria uma execução **com id novo**: chavado pela execução, o par único
  lia isso como outro fato. **Medido no DEV real:** concluir → desfazer → concluir pagou 10 pontos
  **duas vezes** pelo mesmo cuidado (135 → 145 → 155), em laço sem fim e **sem cliente adulterado** —
  só os botões da Hoje. `checkins` e `wash_days` tinham o mesmo furo, os dois sendo únicos por
  `care_execution_id`. Chavando pelo cuidado planejado, a `unique` que já existia faz o teto valer
  sozinha. Barreira em pgTAP.

## 7. Dados e autorização

```sql
create table public.journey_points (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fact_kind text not null check (fact_kind in ('care_execution', 'checkin', 'wash_day')),
  fact_id uuid not null,
  points smallint not null check (points between 1 and 100),
  rules_version text not null,
  awarded_on date not null,
  created_at timestamptz not null default now(),
  constraint journey_points_fact_unique unique (user_id, fact_kind, fact_id)
);
```

**Grant:** só `select` para `authenticated`. Concessão por `award_journey_points`, `SECURITY
DEFINER`, `search_path` fixo, `auth.uid()` validado.

**Por que guardar, em vez de derivar tudo.** Derivar seria mais barato hoje e **falsificaria o
passado amanhã**: no dia da v2, todo ponto já concedido seria recalculado com a régua nova. É o
critério (C) do §0.2 — caro e perigoso de corrigir depois. **E continua havendo uma verdade só:** a
linha aponta para o fato canônico que a originou, e é esse par que garante a idempotência.

## 8. Edge Cases

- **EC1** Sem plano ativo: a Jornada não aparece, e não inventa número nenhum.
- **EC2** Retry, reload ou dois aparelhos: `on conflict do nothing` — um fato, um ponto.
- **EC3** Execução **anulada** depois de pontuada: o ponto **fica**. Ela fez aquilo naquele dia; o
  desfazer corrige o cronograma, não a história da consistência. (Anular por engano é raro e a janela
  é de 15 minutos — reverter pontos abriria uma porta para reescrever o passado, que é justamente o
  que esta SPEC fecha.)
- **EC4** Régua nova (v2): vale para o que vier depois. O passado continua sendo o que foi.
- **EC5** Pausa: sequência congelada, e a tela diz **guardada**, nunca perdida.
- **EC6** **Cuidado feito adiantado conta na sequência.** A Hoje deixa ela antecipar um cuidado do
  plano; filtrar a sequência só por data já vencida descartava exatamente esses. Achado no DEV real:
  cinco cuidados atendidos exibiam sequência **1**, e a subcontagem só se corrigia quando o
  calendário alcançasse cada um. Um cuidado **futuro e não feito** continua fora — não soma e não
  quebra.
- **EC7** **Plano substituído não apaga a história.** `caresAttended` e os marcos derivam de
  `journey_points` (cumulativo), não do board — que é o **plano ativo e só ele**. Derivando do board,
  reavaliar (que o próprio produto oferece depois de um `hair_event`) zerava os marcos dela, e os
  marcos de **10** e **25** cuidados eram inalcançáveis por construção num ciclo de 8 a 12. A
  **sequência** continua sendo do plano ativo, e isso é deliberado: um plano novo é um plano novo, e
  os dois marcos de sequência (3 e 7) cabem dentro de um ciclo.

## 9. Acceptance Criteria

- **AC1** No DEV real a 390px: concluir um cuidado → abrir a Jornada → pontos, nível e sequência
  coerentes → reload → persistidos.
- **AC2** Chamar a concessão duas vezes não muda nada (medido no banco).
- **AC3** Cliente sem `INSERT`/`UPDATE`/`DELETE` — pgTAP.
- **AC4** **As barreiras da Progresso continuam verdes e intocadas.**
- **AC5** Nenhum texto da Jornada fala do cabelo dela nem cobra — com barreira de teste.

## 10. Open Questions

- **OQ1** Celebração no momento (microinteração) fica para a próxima fatia: sem ela a capability já é
  verdadeira, e com ela mal-feita ela vira ruído.
- **OQ2** `F43` desafios e `F44` ranking dependem da Community — `DEFERRED BY DEPENDENCY`.
- **OQ3** Compartilhar um marco é o `F45`, e ele é INEGOCIÁVEL — mas é outra SPEC.

## 11. Change Log

| Data | Mudança |
|---|---|
| 2026-09-03 | SPEC criada. Aderência ao plano, com superfície própria e ponto como fato datado. |
| 2026-09-04 | Validação no DEV real a 390px. Quatro defeitos corrigidos: hook condicional derrubando a tela autenticada (e `react-hooks/rules-of-hooks` adotada como guardrail); `caresAttended` derivado do board (EC7); cuidado adiantado fora da sequência (EC6); e **o ponto chavado pela execução, que pagava o mesmo cuidado planejado várias vezes** (BR7). |
