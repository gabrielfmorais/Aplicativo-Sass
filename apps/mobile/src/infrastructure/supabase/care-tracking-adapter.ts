import type {
  CareBoard,
  CareExecution,
  CareTrackingPort,
  CareTypeCode,
  CheckIn,
  CheckInMark,
  FinishStatus,
  FinishTechnique,
  ResumeOutcome,
  ScheduledCare,
  ScheduledCareStatus,
} from '@app/core';
import { ConflictError, InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';

// SPEC-017: a origem do plano vem no mesmo `select` — explicar o cronograma não vale uma viagem
// extra ao servidor, e a coluna já existia para reprodutibilidade.
type ResumeRow = { action: ResumeOutcome['action']; shift_days: number; care_count: number };

const PLAN_COLUMNS =
  'id, starts_on, hair_profile_id, assessment_algorithm_version, schedule_algorithm_version';
const CARE_COLUMNS = 'id, care_type_code, planned_date, status, rescheduled_to_id';
// SPEC-052 — `care_type_code` entra porque a execução **avulsa** não tem cuidado planejado de onde
// tirar o tipo. Ele sempre existiu na tabela; passou a ter consumidor.
const EXECUTION_COLUMNS = 'id, scheduled_care_id, care_type_code, executed_at, executed_on, voided_at';
const CHECKIN_COLUMNS = 'id, care_execution_id, overall_feel';

/**
 * A transition the server refused because the care is no longer in the state the screen assumed:
 * already resolved, or an undo past its window. The screen reloads and shows the real state instead
 * of insisting on an error (SPEC-005 §16).
 */
const CONFLICT_CODES = new Set(['23514', 'P0002']);

const fail = (code: string, e: { message: string; code?: string }): Error =>
  e.code && CONFLICT_CODES.has(e.code)
    ? new ConflictError(code, e.message)
    : new InfrastructureError(code, e.message);

type CareRow = {
  id: string;
  care_type_code: string;
  planned_date: string;
  status: string;
  rescheduled_to_id: string | null;
};
type ExecutionRow = {
  id: string;
  scheduled_care_id: string | null;
  care_type_code: string;
  executed_at: string;
  executed_on: string;
  voided_at: string | null;
};
type CheckInRow = { id: string; care_execution_id: string; overall_feel: number };

const toCare = (r: CareRow): ScheduledCare => ({
  id: r.id,
  careTypeCode: r.care_type_code as ScheduledCare['careTypeCode'],
  plannedDate: r.planned_date,
  status: r.status as ScheduledCareStatus,
  rescheduledToId: r.rescheduled_to_id,
});

const toCheckIn = (r: CheckInRow): CheckIn => ({
  id: r.id,
  careExecutionId: r.care_execution_id,
  overallFeel: r.overall_feel,
});

const toExecution = (r: ExecutionRow): CareExecution => {
  const comum = {
    id: r.id,
    executedAt: r.executed_at,
    executedOn: r.executed_on,
    voidedAt: r.voided_at,
  };
  /**
   * SPEC-052 — ⚠️ **o mapeamento respeita a união do domínio**, e não é preciosismo de tipo: sem
   * cuidado planejado, `careTypeCode` é a **única** fonte do tipo, e o tipo do domínio torna
   * impossível escrever uma avulsa sem ele.
   */
  return r.scheduled_care_id === null
    ? { ...comum, scheduledCareId: null, careTypeCode: r.care_type_code as CareTypeCode }
    : { ...comum, scheduledCareId: r.scheduled_care_id };
};

/**
 * SPEC-005 §9/§10 — reads go straight to the tables under RLS (SELECT is the only privilege the
 * client has); every write goes through a `SECURITY DEFINER` RPC. The user is never sent: the
 * server takes it from `auth.uid()`, so nothing here can be pointed at somebody else's data.
 */
/**
 * ⚠️ **`userId` entrou com a SPEC-051, e só por causa dela.** Tudo o mais aqui é leitura por RLS ou
 * escrita por RPC — nenhum desses caminhos precisa saber quem ela é, porque o servidor sabe. A
 * marcação do check-in é a primeira escrita **direta** desta porta, e a policy compara o `user_id`
 * do corpo com `auth.uid()`: forjá-lo é `42501`, não uma linha alheia.
 */
export const createCareTrackingAdapter = (client: SupabaseClient, userId: () => string): CareTrackingPort => {
  const call = async (fn: string, args: Record<string, unknown>, code: string): Promise<void> => {
    const { error } = await client.rpc(fn, args);
    if (error) throw fail(code, error);
  };

  return {
    async getBoard(): Promise<CareBoard | null> {
      const { data: planRow, error: planError } = await client
        .from('hair_plans')
        .select(PLAN_COLUMNS)
        .eq('status', 'active')
        .maybeSingle();
      if (planError) throw fail('care.board_read_failed', planError);
      if (!planRow) return null;
      const plan = planRow as {
        id: string;
        starts_on: string;
        hair_profile_id: string;
        assessment_algorithm_version: string;
        schedule_algorithm_version: string;
      };

      /**
       * ⚠️ **NÍVEL 2 — as quatro leituras que dependem só do plano, e vão juntas.**
       *
       * A leitura do board é a da tela **mais carregada do app** e tinha **dez viagens à rede em
       * série** — medido pela auditoria `--full`. O grafo de dependências real permite **cinco
       * níveis**, e é o que está escrito aqui. Nada foi afrouxado: cada recorte continua exatamente
       * o que era, só deixou de esperar por quem não precisava esperar.
       *
       * ⚠️ **A contagem vitalícia entra AQUI e não junto do plano**, embora não dependa dele: subindo
       * um nível ela passaria a rodar também para quem **não tem plano ativo** — o `return null`
       * acima —, e seria uma consulta jogada fora em quem está no onboarding.
       */
      const [caresRes, pauseRes, avulsasRes, countRes] = await Promise.all([
        client
          .from('scheduled_cares')
          .select(CARE_COLUMNS)
          .eq('plan_id', plan.id)
          .order('planned_date', { ascending: true })
          .order('id', { ascending: true }),
        /**
         * SPEC-022 — a pausa aberta, se houver. **Escopada ao plano ativo de propósito:** uma pausa
         * cujo plano foi substituído por uma reavaliação já não pausa nada, e mostrá-la faria a Hoje
         * dizer "pausado" sobre um cronograma novo em folha (EC5).
         */
        client
          .from('plan_pauses')
          .select('paused_on')
          .eq('plan_id', plan.id)
          .is('resumed_on', null)
          .maybeSingle(),
        /**
         * SPEC-052 — as execuções **avulsas** deste ciclo. Não pertencem a plano nenhum, então o
         * recorte honesto é a **janela do plano ativo**, do `starts_on` em diante. ⚠️ O que fica de
         * fora não se perde: uma avulsa de ciclo anterior segue no histórico vitalício e na Hair
         * Intelligence, exatamente como os cuidados do plano anterior, que também não aparecem aqui.
         */
        client
          .from('care_executions')
          .select(EXECUTION_COLUMNS)
          .is('scheduled_care_id', null)
          .gte('executed_on', plan.starts_on)
          .order('executed_on', { ascending: false }),
        /**
         * Across every plan, not just this one (SPEC-014): `head: true` asks for the count and no
         * rows, so this stays one cheap round trip regardless of how long she has been using the app.
         *
         * ⚠️ **SPEC-052 — `scheduled_care_id not null`, e a auditoria achou isto.** Esta contagem é o
         * *"você já fez N cuidados"* que sobrevive à troca de plano (SPEC-014 BR5/FR7) — é **aderência
         * ao plano ao longo da vida**, e a fonte de verdade diz que a avulsa **não conta como
         * aderência**. Sem o filtro, registrar um cuidado fora do cronograma inflava o número na
         * Progresso, que é a superfície onde a comparação com o plano acontece.
         */
        client
          .from('care_executions')
          .select('id', { count: 'exact', head: true })
          .not('scheduled_care_id', 'is', null)
          .is('voided_at', null),
      ]);
      for (const r of [caresRes, pauseRes, avulsasRes, countRes])
        if (r.error) throw fail('care.board_read_failed', r.error);
      const cares = (caresRes.data ?? []).map((r) => toCare(r as CareRow));
      const careIds = cares.map((c) => c.id);
      const pauseRow = pauseRes.data as { paused_on: string } | null;
      const count = countRes.count;

      /**
       * ⚠️ **NÍVEL 3 — as execuções do PLANO, e só elas esperam pelos cuidados.**
       *
       * Limitadas pelos cuidados do plano, e têm de ser: uma execução de um plano substituído não é
       * deste board. É essa dependência — e nenhuma outra — que impede os cinco níveis de virar
       * quatro; trocá-la por uma janela de data admitiria a execução do plano velho.
       */
      const planejadas =
        careIds.length > 0
          ? await client.from('care_executions').select(EXECUTION_COLUMNS).in('scheduled_care_id', careIds)
          : null;
      if (planejadas?.error) throw fail('care.board_read_failed', planejadas.error);
      const executions: CareExecution[] = [...(planejadas?.data ?? []), ...(avulsasRes.data ?? [])].map((r) =>
        toExecution(r as ExecutionRow),
      );

      /**
       * ⚠️ **NÍVEL 4 — check-ins e registros de Wash Day, os dois sobre as mesmas execuções.**
       *
       * Limitados pelas execuções deste board, pela mesma razão que elas são limitadas pelos
       * cuidados do plano: um check-in ou um registro de um plano substituído não é deste board.
       */
      const executionIds = executions.map((e) => e.id);
      const [checkInsRes, washDaysRes] = await Promise.all([
        executionIds.length > 0
          ? client.from('checkins').select(CHECKIN_COLUMNS).in('care_execution_id', executionIds)
          : null,
        /**
         * SPEC-024 FR7 — quais dessas execuções já têm um registro. Só os ids: a Hoje diz que o
         * registro existe, e nunca precisou saber o que tem dentro.
         */
        executionIds.length > 0
          ? client.from('wash_days').select('id, care_execution_id').in('care_execution_id', executionIds)
          : null,
      ]);
      for (const r of [checkInsRes, washDaysRes]) if (r?.error) throw fail('care.board_read_failed', r.error);
      const checkIns = (checkInsRes?.data ?? []).map((r) => toCheckIn(r as CheckInRow));
      const hubs = (washDaysRes?.data ?? []) as { id: string; care_execution_id: string }[];
      const washDayExecutionIds = hubs.map((r) => r.care_execution_id);

      /**
       * ⚠️ **NÍVEL 5 — o que pendura no que veio do nível 4.**
       *
       * - marcações (SPEC-051): escopadas pelos **check-ins deste board**, não por `user_id` — uma
       *   marcação de um plano substituído não é deste board, como os check-ins e os registros.
       * - finalização (SPEC-039 FR5): só as **respondidas**, para a pergunta não voltar depois do
       *   reload. Uma execução ausente daqui é *"ainda não disse"*, que não é `skipped` (BR1).
       */
      const [marksRes, finishRes] = await Promise.all([
        checkIns.length > 0
          ? client
              .from('checkin_marks')
              .select('checkin_id, mark')
              .in(
                'checkin_id',
                checkIns.map((c) => c.id),
              )
          : null,
        hubs.length > 0
          ? client
              .from('wash_day_finish')
              .select('wash_day_id, finish_status, finish_technique')
              .in(
                'wash_day_id',
                hubs.map((r) => r.id),
              )
          : null,
      ]);
      for (const r of [marksRes, finishRes]) if (r?.error) throw fail('care.board_read_failed', r.error);

      const checkInMarks = ((marksRes?.data ?? []) as { checkin_id: string; mark: CheckInMark }[]).map(
        (r) => ({ checkInId: r.checkin_id, mark: r.mark }),
      );

      const executionOfHub = new Map(hubs.map((r) => [r.id, r.care_execution_id]));
      const careFinishes = (finishRes?.data ?? []).flatMap((row) => {
        const { wash_day_id, finish_status, finish_technique } = row as {
          wash_day_id: string;
          finish_status: FinishStatus;
          finish_technique: FinishTechnique | null;
        };
        const careExecutionId = executionOfHub.get(wash_day_id);
        return careExecutionId
          ? [{ careExecutionId, status: finish_status, technique: finish_technique ?? null }]
          : [];
      });

      return {
        planId: plan.id,
        startsOn: plan.starts_on,
        hairProfileId: plan.hair_profile_id,
        assessmentAlgorithmVersion: plan.assessment_algorithm_version,
        scheduleAlgorithmVersion: plan.schedule_algorithm_version,
        pausedOn: (pauseRow as { paused_on: string } | null)?.paused_on ?? null,
        cares,
        executions,
        checkIns,
        checkInMarks,
        washDayExecutionIds,
        careFinishes,
        lifetimeDoneCount: count ?? 0,
      };
    },

    complete: ({ scheduledCareId, clientExecutionId, timeZone }) =>
      call(
        'complete_care',
        {
          p_scheduled_care_id: scheduledCareId,
          p_client_execution_id: clientExecutionId,
          p_timezone: timeZone,
        },
        'care.complete_failed',
      ),

    /**
     * SPEC-052 — o cuidado que ela fez sem o plano ter pedido. **Mesma porta, mesma disciplina de
     * chave**: o retry depois de uma resposta perdida cai no mesmo fato.
     */
    recordAdHocCare: ({ careTypeCode, clientExecutionId, timeZone }) =>
      call(
        'record_ad_hoc_care',
        {
          p_care_type_code: careTypeCode,
          p_client_execution_id: clientExecutionId,
          p_timezone: timeZone,
        },
        'care.record_ad_hoc_failed',
      ),
    skip: (scheduledCareId) =>
      call('skip_care', { p_scheduled_care_id: scheduledCareId }, 'care.skip_failed'),

    reschedule: ({ scheduledCareId, newDate, timeZone }) =>
      call(
        'reschedule_care',
        { p_scheduled_care_id: scheduledCareId, p_new_date: newDate, p_timezone: timeZone },
        'care.reschedule_failed',
      ),

    undo: (executionId) => call('void_execution', { p_execution_id: executionId }, 'care.undo_failed'),

    pause: (timeZone) => call('pause_plan', { p_timezone: timeZone }, 'care.pause_failed'),

    /**
     * SPEC-022 — a mesma função responde "o que aconteceria" e "faça". `commit: false` é previsão:
     * o servidor calcula e devolve sem escrever nada, para a tela poder dizer antes de confirmar
     * sem que a regra de deslocamento passe a existir também em TypeScript.
     */
    async resume({ timeZone, commit }): Promise<ResumeOutcome> {
      const { data, error } = await client.rpc('resume_plan', {
        p_timezone: timeZone,
        p_commit: commit,
      });
      if (error) throw fail('care.resume_failed', error);
      // `returns table` chega como array de uma linha; sem linha, não havia pausa aberta.
      const row = (data as ResumeRow[] | null)?.[0];
      return {
        action: row?.action ?? 'not_paused',
        shiftDays: row?.shift_days ?? 0,
        careCount: row?.care_count ?? 0,
      };
    },

    submitCheckIn: ({ careExecutionId, overallFeel, clientCheckinId }) =>
      call(
        'submit_checkin',
        {
          p_care_execution_id: careExecutionId,
          p_overall_feel: overallFeel,
          p_client_checkin_id: clientCheckinId,
        },
        'care.checkin_failed',
      ),

    /**
     * SPEC-051 (`P13`) — marca ou desmarca o que ela notou.
     *
     * ⚠️ **Escrita direta, sem RPC** (SPEC-051 §7): a linha não guarda invariante de servidor — nem
     * dia civil, nem idempotência de transação. É o mesmo raciocínio do `F26`/`F25`, e a posse é
     * validada nas **duas** pontas pelo banco: a policy olha o dono da linha, a FK composta olha o
     * dono do check-in.
     *
     * ⚠️ **`user_id` vai no corpo porque a policy o compara com `auth.uid()`** — forjá-lo é
     * `42501`, não uma linha alheia.
     */
    async markCheckIn({ checkInId, mark, used }): Promise<void> {
      if (used) {
        const { error } = await client
          .from('checkin_marks')
          .insert({ checkin_id: checkInId, mark, user_id: userId() });
        if (error) throw fail('care.checkin_mark_failed', error);
        return;
      }
      const { error } = await client
        .from('checkin_marks')
        .delete()
        .eq('checkin_id', checkInId)
        .eq('mark', mark);
      if (error) throw fail('care.checkin_mark_failed', error);
    },
  };
};
