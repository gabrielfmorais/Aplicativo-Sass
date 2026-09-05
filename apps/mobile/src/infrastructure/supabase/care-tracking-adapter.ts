import type {
  CareBoard,
  CareExecution,
  CareTrackingPort,
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
const EXECUTION_COLUMNS = 'id, scheduled_care_id, executed_at, executed_on, voided_at';
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
  scheduled_care_id: string;
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

const toExecution = (r: ExecutionRow): CareExecution => ({
  id: r.id,
  scheduledCareId: r.scheduled_care_id,
  executedAt: r.executed_at,
  executedOn: r.executed_on,
  voidedAt: r.voided_at,
});

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

      const { data: careRows, error: caresError } = await client
        .from('scheduled_cares')
        .select(CARE_COLUMNS)
        .eq('plan_id', plan.id)
        .order('planned_date', { ascending: true })
        .order('id', { ascending: true });
      if (caresError) throw fail('care.board_read_failed', caresError);
      const cares = (careRows ?? []).map((r) => toCare(r as CareRow));

      // Bounded by the plan's own cares: an execution from a superseded plan is not this board's.
      const careIds = cares.map((c) => c.id);
      let executions: CareExecution[] = [];
      if (careIds.length > 0) {
        const { data: executionRows, error: executionsError } = await client
          .from('care_executions')
          .select(EXECUTION_COLUMNS)
          .in('scheduled_care_id', careIds);
        if (executionsError) throw fail('care.board_read_failed', executionsError);
        executions = (executionRows ?? []).map((r) => toExecution(r as ExecutionRow));
      }

      // Bounded by this board's executions, for the same reason the executions are bounded by the
      // plan's cares: a check-in from a superseded plan is not this board's.
      const executionIds = executions.map((e) => e.id);
      let checkIns: CheckIn[] = [];
      /** SPEC-051 — as marcações de resultado, uma linha por marcação. */
      let checkInMarks: { checkInId: string; mark: CheckInMark }[] = [];
      if (executionIds.length > 0) {
        const { data: checkInRows, error: checkInsError } = await client
          .from('checkins')
          .select(CHECKIN_COLUMNS)
          .in('care_execution_id', executionIds);
        if (checkInsError) throw fail('care.board_read_failed', checkInsError);
        checkIns = (checkInRows ?? []).map((r) => toCheckIn(r as CheckInRow));

        /**
         * SPEC-051 (`P13`) — o que ela notou, para as marcações não sumirem no reload.
         *
         * ⚠️ **Escopo pelos check-ins deste board**, não por `user_id`: uma marcação de um plano
         * substituído não é deste board, exatamente como os check-ins e os registros do Wash Day.
         */
        if (checkIns.length > 0) {
          const { data: markRows, error: marksError } = await client
            .from('checkin_marks')
            .select('checkin_id, mark')
            .in(
              'checkin_id',
              checkIns.map((c) => c.id),
            );
          if (marksError) throw fail('care.board_read_failed', marksError);
          checkInMarks = ((markRows ?? []) as { checkin_id: string; mark: CheckInMark }[]).map((r) => ({
            checkInId: r.checkin_id,
            mark: r.mark,
          }));
        }
      }

      /**
       * SPEC-024 FR7 — quais dessas execuções já têm um registro. Só os ids: a Hoje diz que o
       * registro existe, e nunca precisou saber o que tem dentro. Mesmo escopo dos check-ins, pela
       * mesma razão — um registro de um plano substituído não é deste board.
       */
      let washDayExecutionIds: string[] = [];
      /**
       * SPEC-039 FR5 — as etapas de finalização já respondidas, para a pergunta não voltar depois
       * do reload. Só as respondidas: uma execução ausente daqui é "ainda não disse", que não é
       * `skipped` (BR1).
       */
      let careFinishes: {
        careExecutionId: string;
        status: FinishStatus;
        technique: FinishTechnique | null;
      }[] = [];
      if (executionIds.length > 0) {
        const { data: washDayRows, error: washDaysError } = await client
          .from('wash_days')
          .select('id, care_execution_id')
          .in('care_execution_id', executionIds);
        if (washDaysError) throw fail('care.board_read_failed', washDaysError);
        const hubs = (washDayRows ?? []) as { id: string; care_execution_id: string }[];
        washDayExecutionIds = hubs.map((r) => r.care_execution_id);

        if (hubs.length > 0) {
          const { data: finishRows, error: finishError } = await client
            .from('wash_day_finish')
            .select('wash_day_id, finish_status, finish_technique')
            .in(
              'wash_day_id',
              hubs.map((r) => r.id),
            );
          if (finishError) throw fail('care.board_read_failed', finishError);
          const executionOfHub = new Map(hubs.map((r) => [r.id, r.care_execution_id]));
          careFinishes = (finishRows ?? []).flatMap((row) => {
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
        }
      }

      /**
       * SPEC-022 — a pausa aberta, se houver. **Escopada ao plano ativo de propósito:** uma pausa
       * cujo plano foi substituído por uma reavaliação já não pausa nada, e mostrá-la faria a Hoje
       * dizer "pausado" sobre um cronograma novo em folha (EC5).
       */
      const { data: pauseRow, error: pauseError } = await client
        .from('plan_pauses')
        .select('paused_on')
        .eq('plan_id', plan.id)
        .is('resumed_on', null)
        .maybeSingle();
      if (pauseError) throw fail('care.board_read_failed', pauseError);

      // Across every plan, not just this one (SPEC-014): `head: true` asks for the count and no
      // rows, so this stays one cheap round trip regardless of how long she has been using the app.
      const { count, error: countError } = await client
        .from('care_executions')
        .select('id', { count: 'exact', head: true })
        .is('voided_at', null);
      if (countError) throw fail('care.board_read_failed', countError);

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
