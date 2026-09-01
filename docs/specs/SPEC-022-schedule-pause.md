# SPEC-022 — Pausa: parar sem perder nada, e voltar sem culpa

| Campo | Valor |
|---|---|
| ID | SPEC-022 |
| Status | **DONE** (agente, §0.2/§0.4 — aguarda ratificação humana). OQ2 resolvida pelo dono (D-98); jornada validada no DEV real a 390×844 em 2026-09-01. |
| Owner | (humano) — projetopaporeto.erp@gmail.com |
| Bounded Context | **Schedule / Planning** (DOMAIN-MAP §3.4), lido por Care Tracking, Notifications e Progress |
| Related ADRs | ADR-001, ADR-008 (datas), ADR-007 |
| Related SPECs | SPEC-004 (o plano), SPEC-005 (transições e atraso derivado), SPEC-008 (lembretes), SPEC-009 (progresso), SPEC-020 (o motivo costuma ser um evento) |
| Fase | MASTER PRODUCT BACKLOG — **F22** |
| Criado | 2026-09-01 |

## 1. Context

O Blueprint §5 é direto: *"Viagem, doença, gravidez, cabelo em proteção, uma semana impossível. Hoje a única saída é pular cuidado por cuidado, e o app acumula atrasos que a fazem sentir que falhou — quando ela apenas viveu."*

**Pausar é Free por decisão de produto**, e o Blueprint diz por quê: *"cobrar por parar é cobrar pela vida dela."*

## 2. Problem

O produto hoje tem exatamente uma resposta para "não vou conseguir": pular, um a um. Quem some por duas semanas volta para uma tela de atrasados que lê como cobrança — e o D-28 (nada se move sozinho), que está certo no dia a dia, é justamente o que transforma uma ausência em avalanche.

## 3. Goals

- G1 — Ela para o cronograma **sem perder nada**.
- G2 — Enquanto pausado, **nada atrasa** e **nenhum lembrete toca**.
- G3 — Ela retoma sabendo **antes** o que vai acontecer com os cuidados do período.
- G4 — O período pausado **não conta contra ela** em nenhum número que ela veja.

## 4. Non-Goals

- **NG1 — Não pausa sozinho e não retoma sozinho.**
- **NG2 — Não apaga nada.** Histórico é intocável (D-69).
- **NG3 — A volta não é uma avalanche de atrasados.** Isso seria punir a pausa, e o Blueprint proíbe com todas as letras.
- **NG4 — Não é Premium.** Nem agora, nem depois.
- **NG5 — Não substitui a reavaliação.** Pausar não regenera plano.

## 5. User Stories

- Como usuária que vai viajar duas semanas, quero parar o cronograma e voltar sem uma tela de cobrança.
- Como usuária com o cabelo em tranças por um mês, quero pausar sem perder o que já registrei.
- Como usuária retomando, quero saber **antes de confirmar** o que acontece com os cuidados que ficaram para trás.

## 6. Functional Requirements

- FR1 — Ela pausa o cronograma ativo, a partir da conta e a partir da Hoje.
- FR2 — Enquanto pausado: **nenhum cuidado é derivado como atrasado**, e **nenhum lembrete é agendado**.
- FR3 — A Hoje diz, em palavra, que o cronograma está pausado — e desde quando.
- FR4 — Ela retoma quando quiser, e o app **mostra antes** o que vai acontecer com os cuidados do período pausado.
- FR5 — Ao retomar, os cuidados que caíram dentro da pausa **andam para frente** junto com o resto do que sobrou, preservando o ritmo. Nada é apagado; o histórico registra o movimento como qualquer reagendamento (SPEC-005).
- FR6 — O período pausado não entra em nenhuma contagem que ela veja (SPEC-009/SPEC-021).
- FR7 — Pausar pode, opcionalmente, registrar um evento `care_pause` (SPEC-020) — a ligação que o Blueprint pede, sem duplicar a lista de eventos.

## 7. Business Rules

- BR1 — **Atraso pressupõe compromisso vigente.** Pausado, não há compromisso, então não há atraso — a derivação de `overdue` passa a conhecer o estado do plano.
- BR2 — O estado pausado é **real, não simulado**: lembretes, progresso e atraso têm de enxergar a mesma diferença, ou duas partes do app discordarão sobre o mesmo plano.
- BR3 — Retomar **move** cuidados, e por isso exige confirmação explícita dela (D-28: nada se move sozinho; aqui ela manda mover, e vê o quê antes).
- BR4 — Pausar e retomar são registrados; o histórico da pausa não é apagado.
- BR5 — Nada aqui inventa regra capilar (D-26). Pausar é decisão de rotina, não recomendação.

## 8. Data Model Impact

**Resolvido (OQ1): tabela `public.plan_pauses`.**

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid not null, FK `auth.users` cascade | |
| `plan_id` | uuid not null | FK composta `(plan_id, user_id)` → `hair_plans`: uma pausa nunca carrega dono diferente do plano |
| `paused_on` / `resumed_on` | date / date null | dias civis dela; **`resumed_on` nulo é o que "pausado" significa** — não existe coluna de estado |
| `created_at` | timestamptz not null | |

Índice único parcial em `(user_id) where resumed_on is null`: **uma pausa aberta por usuária**, o que faz "pausar de novo" ser um no-op em vez de um estado impossível.

**Deslocar altera `planned_date` no lugar, e isso não é reescrever histórico.** Só se movem cuidados `planned`, sem execução efetiva, a partir do dia da pausa: um cuidado futuro sem execução é uma **intenção**, não um fato. `care_executions` não é tocada. É deliberadamente diferente de `reschedule_care`, que cria linha nova porque ali **ela** moveu um cuidado específico e a intenção original quer dizer algo; aqui o tempo inteiro parou, e N linhas fantasma seriam ruído, não verdade. O movimento fica registrado nas duas datas da pausa. *(Decisão do agente sob D-97: técnica, reversível, e a alternativa é objetivamente pior em ruído sem ganhar nenhuma garantia.)*

*Registro das formas consideradas:*

- **(a) `plan_pauses`**, tabela append-only com `plan_id`, `paused_on`, `resumed_on`. O plano fica pausado enquanto houver linha sem `resumed_on`. Aditiva, preserva o histórico de pausas de graça, e não toca `hair_plans`.
- **(b) `hair_plans.paused_at`**, uma coluna. Menor, mas guarda **uma** pausa e apaga a anterior a cada nova — perde exatamente o histórico que BR4 pede.

*Assunção adotada:* **(a)**.

## 9. API / Contracts

**Duas RPCs `SECURITY DEFINER`**, pela mesma razão de SPEC-020: o dia civil é do servidor, e **retomar move linhas transacionalmente** — meia retomada é um cronograma inconsistente. `CareBoard` ganha o estado da pausa; `buildTodayView` e `buildNotificationIntents` passam a recebê-lo (fatia 2).

```sql
pause_plan(p_timezone text) returns uuid
resume_plan(p_timezone text, p_commit boolean default false)
  returns table (action text, shift_days integer, care_count integer)
```

**`p_commit` é o que faz FR4 caber sem duplicar regra.** A alternativa seria a tela calcular a previsão por conta própria — e aí a regra de deslocamento existiria em SQL **e** em TypeScript, divergindo na primeira vez que qualquer um dos dois mudasse. Com o `dry run` há **uma** implementação: a tela pergunta, mostra a resposta, e confirma chamando a mesma função. `action` é `shifted` · `new_cycle` · `not_paused`.

**O limite do ciclo, concretamente:** se o último cuidado ainda planejado, deslocado, passar de `starts_on + 27`, o deslocamento não cabe e a volta oferece um ciclo novo. Nada a deslocar cai no mesmo caminho — um ciclo sem intenção restante já acabou.

## 10. Authorization

`SELECT` da própria pausa; escrita só pelas RPCs, com `user_id` de `auth.uid()`. Sem `DELETE`.

## 11. Security Considerations

Tabela nova com RLS `enable`+`force`; duas DEFINER allowlistadas com `search_path` fixo; `resume_plan` opera **só** sobre o plano ativo dela e é idempotente por natureza (retomar um plano não pausado é no-op, não erro). Cliente adulterado não pausa plano alheio nem move cuidado de outra pessoa.

## 12. Privacy Considerations

Nenhum dado novo além das duas datas. O **motivo** da pausa, se ela quiser dar, é um evento da SPEC-020 — lista fechada, sem texto livre.

## 13. Analytics Events

**Nenhum** (D-31).

## 14. UX Notes (sem design visual)

- A Hoje pausada é **calma**, não vazia: diz que está pausado, desde quando, e oferece retomar.
- A confirmação de retomada mostra **o que vai acontecer**, em frase, antes do botão.
- Nenhuma palavra de cobrança em nenhum dos dois momentos.

## 15. Edge Cases

- EC1 — Pausar sem plano ativo: a ação não existe.
- EC2 — Retomar um plano que não está pausado: no-op.
- EC3 — Pausa que ultrapassa o fim do ciclo: retomar oferece o próximo ciclo, não um plano vencido ressuscitado.
- EC4 — Cuidado já concluído dentro da pausa (ela fez mesmo pausada): a execução vale; nada a mover.
- EC5 — Reavaliar durante a pausa: o plano novo nasce ativo, e a pausa termina com o plano que a tinha.
- EC6 — Duas pausas seguidas: a segunda só começa depois de a primeira terminar.
- EC7 — Lembretes já agendados no aparelho quando ela pausa: reconciliados para nenhum (SPEC-008 FR8).

## 16. Failure Modes

- `resume_plan` falha no meio ⇒ transação inteira reverte; nunca meio cronograma movido.
- Reconciliação de lembretes falha ⇒ a pausa vale mesmo assim, e a próxima reconciliação corrige (SPEC-008 é best-effort por decisão).

## 17. Acceptance Criteria

- AC1 — Pausado, nenhum cuidado é atrasado e nenhum lembrete é agendado — verificado no core, não na tela.
- AC2 — A Hoje diz que está pausado, e desde quando.
- AC3 — Retomar mostra o que vai acontecer **antes** de confirmar.
- AC4 — Retomar move os cuidados que ficaram, preservando o ritmo, sem apagar nada.
- AC5 — O período pausado não aparece em nenhuma contagem.
- AC6 — Um cliente adulterado não pausa nem retoma plano alheio (pgTAP).
- AC7 — `resume_plan` é atômica: ou move tudo, ou nada.
- AC8 — Nenhuma palavra de cobrança em nenhuma tela — barreira de teste.
- AC9 — `pnpm verify` verde, pgTAP verde no CI, **validação visual a 390px**.

## 18. Testing Strategy

Vitest para a derivação com plano pausado (atraso e lembretes) · pgTAP para posse, isolamento, atomicidade e idempotência · RNTL para a Hoje pausada, a confirmação de retomada e a barreira de AC8.

## 19. Dependencies

**Nenhuma nova.** Depende da SPEC-020 apenas para o FR7 opcional.

## 20. Implementation Plan

1. Banco: `plan_pauses`, as duas RPCs, allowlist, pgTAP. ← **esta fatia**
2. Core: o estado da pausa em `CareBoard`, e a derivação de atraso e de lembretes conhecendo-o. ← **esta fatia**
3. App: Hoje pausada, pausar pela conta e pela Hoje, confirmação de retomada. ← **esta fatia**
4. Validação a 390px e fechamento do `F22`.

**Três fatias, não uma:** a etapa 2 muda comportamento **já validado** em quatro módulos (atraso, lembretes, progresso, resumo de ciclo), e misturá-la com o banco numa PR só torna a revisão impossível.

## 21. Migration Plan

Aditiva. **Aplicar no DEV é ação do dono** (runbook `DEV-DATABASE-PROVISION` §5).

## 22. Rollback Plan

Reverter a PR e derrubar tabela e funções. O estado pausado deixa de existir; nenhum cuidado foi apagado em momento nenhum.

## 23. Open Questions

- **OQ1 — IMPORTANT — tabela ou coluna.** Ver §8. *Assunção:* tabela, por BR4.
- **OQ2 — RESOLVIDA (dono, 2026-09-01): opção 1, com o fim do ciclo como limite natural.** Deslocar o restante do plano preservando os intervalos originalmente calculados; quando o deslocamento deixar de caber no ciclo, a volta oferece um ciclo novo. Registro das opções como estavam: O Blueprint fecha as bordas (nada apaga, nada vira avalanche, ela sabe antes) mas **não decide o meio**. Três desenhos cabem nas bordas:
  1. **Deslocar o que sobrou** pelo tamanho da pausa, preservando o ritmo — é o que a assunção de FR5 adota.
  2. **Deslocar só o que caiu dentro da pausa**, deixando o resto onde estava — comprime o cronograma e muda os intervalos entre cuidados, que é justamente o que o engine calculou.
  3. **Oferecer um ciclo novo** em vez de mover — mais simples, mas perde o plano em curso.

  **Isto é comportamento material de produto, não detalhe técnico:** move o cronograma dela, muda os intervalos que o engine escolheu e altera o que "meu plano" significa depois de uma ausência. Por CLAUDE.md §0.1 é decisão humana, e não a tomo por conta própria. *Assunção provisória para a SPEC:* (1).
- **OQ3 — RESOLVIDA por OQ2:** o deslocamento que ultrapassaria as quatro semanas vira oferta de ciclo novo, não uma quinta semana.
- ~~OQ3 original~~ — pausa afeta o fim do ciclo? Se o ciclo termina durante a pausa, EC3 diz que a volta oferece o próximo. Mas deslocar (OQ2.1) pode empurrar cuidados para além do fim do ciclo — e a SPEC-019 não desenha uma quinta semana. *Assunção:* a volta que ultrapassa o ciclo vira oferta de novo ciclo, não deslocamento. **Depende de OQ2.**
- **OQ4 — CAN DEFER — pausa com data de volta marcada.** "Volto em duas semanas" permitiria retomar sozinho — que NG1 proíbe. *Assunção:* sem agendamento; ela retoma quando quiser.

## 24. Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-09-01 | v0.5 — **fatia 3 (telas) implementada e F22 validado no DEV real.** `PauseCard` na Hoje: pausada ela abre a tela — é o que explica por que nada está atrasado, e ler a explicação depois da consequência é ler ao contrário; andando, fica quieta no fim. A previsão vem do **servidor**, pela mesma função que executa, e aparece **antes** do botão (FR4). **Vazio de teste achado na validação:** nenhum caso movia uma data de verdade — todas as pausas abertas "hoje" deslocam zero dias, e o caso do ciclo não desloca por definição, então a linha que soma o deslocamento nunca tinha sido exercitada. Três asserções pgTAP novas, incluindo a de que um cuidado já pulado **não** se move. | agente (§0.2) |
| 2026-09-01 | v0.4 — **fatia 2 (core) implementada.** `CareBoard.pausedOn` — a data é o estado inteiro, porque não existe coluna "pausado". `buildTodayView` recebe a pausa e devolve `planned` onde devolveria `overdue`; `buildNotificationIntents` recebe `paused` e devolve vazio. **G4 caiu de graça:** `buildProgress` conta `overdue`, e pausada não há nenhum — o período pausado não vira número contra ela sem nenhuma regra a mais. A pausa é lida **escopada ao plano ativo**, para que uma reavaliação durante a pausa não deixe a Hoje dizendo "pausado" sobre um cronograma novo. | agente (§0.2) |
| 2026-09-01 | v0.3 — **fatia 1 (banco) implementada.** `plan_pauses` com índice único parcial (uma pausa aberta por usuária), `pause_plan` idempotente e `resume_plan` com `p_commit` — o *dry run* que faz a previsão de FR4 caber **sem** uma segunda cópia da regra de deslocamento em TypeScript. 20 asserções pgTAP. Decidido sob D-97: deslocar altera `planned_date` no lugar, porque cuidado futuro sem execução é intenção, não fato. | agente (§0.2, D-97) |
| 2026-09-01 | v0.2 — **OQ2 e OQ3 resolvidas pelo dono**, com a recomendação do agente: deslocar preservando os intervalos, e o fim do ciclo como limite natural — pausa curta preserva o plano, pausa longa reconhece que o cronograma envelheceu. O limite não é número inventado: é a fronteira que a SPEC-019 já desenhou. **APPROVED**, implementação autorizada. | dono + agente |
| 2026-09-01 | v0.1 — Draft criada para o **F22**, seguindo o Blueprint §5. **Parada deliberadamente antes da implementação:** a OQ2 é BLOCKING e é decisão humana (§0.1) — o que acontece com os cuidados na volta move o cronograma dela e redefine o que "meu plano" significa depois de uma ausência. As bordas o Blueprint fecha; o meio, não. | agente |
