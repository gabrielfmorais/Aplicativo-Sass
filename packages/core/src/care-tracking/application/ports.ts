import type { Product } from '../../hair-profile/index.ts';
import type { CareTypeCode, ScheduledCare } from '../../schedule/index.ts';
import type { CareExecution, CheckIn } from '../domain/care-tracking.ts';
import type {
  FinishStatus,
  FinishTechnique,
  ScalpFeel,
  WashDayRecord,
  WashDayTechnique,
} from '../domain/wash-day.ts';

/** Everything the daily screen needs, in one read: the active plan, its cares and their executions. */
/**
 * SPEC-022 — o que a retomada faz, decidido pelo servidor (D-98).
 *
 * `shifted`: o que sobrou anda `shiftDays` dias, preservando os intervalos que o engine calculou.
 * `new_cycle`: o deslocamento não cabe no ciclo — a volta oferece montar o próximo.
 * `not_paused`: não havia pausa aberta. No-op, não erro.
 */
export type ResumeOutcome = {
  readonly action: 'shifted' | 'new_cycle' | 'not_paused';
  readonly shiftDays: number;
  readonly careCount: number;
};

export type CareBoard = {
  readonly planId: string;
  readonly startsOn: string;
  /**
   * SPEC-017 — o snapshot de perfil que **gerou** este plano, não o perfil de hoje.
   *
   * A diferença não é acadêmica: reavaliar e desistir no meio deixa um perfil novo salvo e o plano
   * antigo ativo (SPEC-014 G3). Explicar o cronograma a partir do perfil corrente descreveria, com
   * toda a confiança, um plano que ela não tem.
   */
  readonly hairProfileId: string;
  /**
   * As versões de engine registradas no plano. Existem para a explicação poder se **calar** quando
   * não puder ser reproduzida: uma engine futura leria o mesmo snapshot de outro jeito, e uma
   * explicação plausível e errada é pior que nenhuma (SPEC-017 FR4).
   *
   * São **duas** porque a evidência que ela leu no preview também é de duas: a avaliação diz o que
   * ela quer e tem, o cronograma diz como isso virou frequência.
   */
  readonly assessmentAlgorithmVersion: string;
  readonly scheduleAlgorithmVersion: string;
  /**
   * SPEC-022 — o dia em que ela parou, ou `null` quando o cronograma está andando.
   *
   * **É o estado inteiro.** Não existe coluna "pausado": uma pausa é uma linha com `resumed_on`
   * nulo, e o board carrega a data porque `buildTodayView` precisa dela para decidir que nada
   * atrasou — atraso pressupõe compromisso vigente (BR1).
   */
  readonly pausedOn: string | null;
  readonly cares: readonly ScheduledCare[];
  readonly executions: readonly CareExecution[];
  /** Check-ins for those executions (SPEC-006); empty until the user answers one. */
  readonly checkIns: readonly CheckIn[];
  /**
   * SPEC-024 FR7 — as execuções que **têm** um registro de Wash Day. Só os ids: a Hoje precisa
   * dizer que o registro existe, e nunca precisou saber o que tem dentro.
   *
   * Vem no board pela mesma razão que os check-ins vêm: é a mesma tela, a mesma leitura e o mesmo
   * escopo — as execuções deste plano. Um segundo estado carregável na tela para uma frase seria
   * mais código e mais um jeito de a tela mentir enquanto carrega.
   */
  readonly washDayExecutionIds: readonly string[];
  /**
   * SPEC-039 FR2/FR5 — a etapa de finalização, por execução, para as que ela já respondeu.
   *
   * **Vem no board porque a pergunta não pode voltar.** A Hoje pergunta a finalização no cartão do
   * cuidado concluído; sem o estado carregado junto com o resto, o reload mostraria a pergunta de
   * novo, como se ela nunca tivesse respondido — o app esquecendo o que ela disse.
   *
   * Só as respondidas aparecem: uma execução ausente daqui é "ainda não disse", que é diferente de
   * `skipped` (BR1). É a mesma distinção do `F35`, e ela mora na forma do dado, não num comentário.
   */
  readonly careFinishes: readonly {
    readonly careExecutionId: string;
    readonly status: FinishStatus;
    /** SPEC-048 (F38) — qual finalização, ou `null` para "ainda não disse qual". */
    readonly technique: FinishTechnique | null;
  }[];
  /**
   * Effective executions across ALL her plans, superseded included (SPEC-014). Counted rather than
   * fetched: the summary needs the number, never the rows.
   */
  readonly lifetimeDoneCount: number;
};

/**
 * Implemented by apps/mobile infrastructure (SPEC-005 §9).
 *
 * Reads go straight to the tables under RLS; every write goes through a `SECURITY DEFINER` RPC,
 * because the client holds no write privilege on either table (§10). The user is never a parameter:
 * the server takes it from `auth.uid()`.
 */
export interface CareTrackingPort {
  /** The active plan's board, or null when the user has no active plan. */
  getBoard(): Promise<CareBoard | null>;
  /**
   * Records a care as done. Idempotent by `clientExecutionId`: the same key returns the same fact,
   * so a retry after a lost response cannot create a second execution (AC3).
   */
  complete(input: { scheduledCareId: string; clientExecutionId: string; timeZone: string }): Promise<void>;
  skip(scheduledCareId: string): Promise<void>;
  reschedule(input: { scheduledCareId: string; newDate: string; timeZone: string }): Promise<void>;
  /**
   * SPEC-022 — para o cronograma. Idempotente: pausar de novo devolve a pausa que já está aberta.
   */
  pause(timeZone: string): Promise<void>;
  /**
   * Retoma, ou apenas **conta o que aconteceria** (`commit: false`).
   *
   * O Blueprint exige que ela saiba antes de confirmar, e a previsão vem do servidor pela mesma
   * função que executa — uma segunda cópia da regra de deslocamento em TypeScript divergiria da
   * primeira na primeira vez que qualquer uma das duas mudasse.
   */
  resume(input: { timeZone: string; commit: boolean }): Promise<ResumeOutcome>;
  /** Undoes an accidental execution inside the approved window (D-69/D-12). */
  undo(executionId: string): Promise<void>;
  /**
   * Records how the care went (SPEC-006). Idempotent by `clientCheckinId`, and refused by the
   * server if the execution was undone or already has a check-in.
   */
  submitCheckIn(input: {
    careExecutionId: string;
    overallFeel: number;
    clientCheckinId: string;
  }): Promise<void>;
}

/**
 * SPEC-024 §9 — o registro do Wash Day. **Sem RPC:** a `unique (care_execution_id)` torna a criação
 * do hub idempotente sozinha, e nenhum invariante aqui é do servidor — não há dia civil a decidir
 * nem chave de idempotência a guardar (ao contrário de `complete_care` e `record_hair_event`).
 *
 * **Uma marcação por chamada**, e não `setProducts(ids)`. §16 pede que uma escrita que falha não
 * derrube as outras e que a tela diga **qual** falhou: um `set` em lote devolve um erro só e deixa
 * a tela adivinhando o que entrou. O par `(wash_day_id, product_id)` é PK, então marcar duas vezes
 * é uma linha, e desmarcar é remover a linha da junção — ela está corrigindo o que marcou, não
 * apagando histórico (§10).
 *
 * O hub é criado **na primeira marcação**, nunca em `getFor`: abrir a tela e não marcar nada não é
 * um registro.
 */
export interface WashDayPort {
  /** O registro daquela execução. `washDayId` nulo quando ela nunca marcou nada ali. */
  getFor(careExecutionId: string): Promise<WashDayRecord>;
  markProduct(input: { careExecutionId: string; productId: string; used: boolean }): Promise<void>;
  markTechnique(input: {
    careExecutionId: string;
    technique: WashDayTechnique;
    used: boolean;
  }): Promise<void>;
  /**
   * SPEC-025 — define como o couro esteve, ou tira a resposta com `null`.
   *
   * Uma escrita só, e não um par apaga-e-escreve: trocar de resposta cai num `on conflict do
   * update`, então não existe instante em que ela ficou sem resposta porque a segunda metade
   * falhou. `null` remove a linha — um registro sem resposta é um estado válido (EC2).
   */
  setScalpFeel(input: { careExecutionId: string; scalpFeel: ScalpFeel | null }): Promise<void>;
  /**
   * SPEC-039 (F37) — registra a **etapa** de finalização, ou tira a resposta com `null`.
   *
   * Mesma disciplina do couro: uma escrita só (`on conflict do update`), porque um par
   * apaga-e-escreve deixaria um instante sem resposta se a segunda metade falhasse. Idempotente pela
   * PK — o retry depois de uma resposta perdida cai na mesma linha (FR6).
   *
   * ⚠️ **Método próprio, e não `markTechnique('finished')`.** A etapa e a técnica são objetos
   * diferentes (BR3), e a separação começa aqui, no contrato: quem quiser fundi-las mais tarde vai
   * ter de apagar este método, e não só acrescentar um valor a uma lista.
   */
  setFinishStatus(input: { careExecutionId: string; finishStatus: FinishStatus | null }): Promise<void>;
  /**
   * SPEC-048 (F38) — **qual** finalização ela fez, ou `null` para tirar a resposta.
   *
   * ⚠️ **Registro, nunca recomendação:** guarda o que ela informou. Indicação, efeito, passo a passo
   * e ranking seguem bloqueados por D-26/D-70.
   *
   * ⚠️ **Só faz sentido com a etapa em `done`**, e é o banco que garante isso — trocar a etapa para
   * `skipped` limpa a técnica junto, senão a escrita cairia numa combinação que o `CHECK` recusa.
   */
  setFinishTechnique(input: {
    careExecutionId: string;
    finishTechnique: FinishTechnique | null;
  }): Promise<void>;
  /**
   * SPEC-041 (F48) — os produtos que ela usou **da última vez** num cuidado deste tipo.
   *
   * ⚠️ **É um fato dela, não uma recomendação.** A lista sai do registro que ela mesma fez
   * (SPEC-024); o app não escolhe produto por categoria, composição ou indicação — isso seria
   * conteúdo capilar substantivo e cairia no gate D-26/D-70. Vazio quando não há registro anterior,
   * que é o estado normal no começo.
   */
  lastUsedFor(careTypeCode: CareTypeCode): Promise<readonly Product[]>;
}
