import type { CareItem, TodayView } from '@app/core';

import { CARE_TYPE_LABEL, formatPlannedDate } from '@/features/plan/copy';

/**
 * SPEC-026 fatia 3 (FR12–FR15) — "Sugestões para você", e o que ela **não** pode ser.
 *
 * ⚠️ **Toda sugestão é um fato dela, nunca uma afirmação sobre cabelo** (BR2/NG4/AC5). *"Sua
 * prateleira está vazia"* é algo que ela pode conferir; *"seu cabelo precisa de mais hidratação"* é
 * regra de domínio e exige sign-off (D-26/D-70). A distância entre as duas frases é uma palavra, e
 * é a distância entre uma capability Free e um gate.
 *
 * **Nem cobrança.** Nada aqui conta o que ela deixou de fazer, pontua, compara ou insiste: uma
 * sugestão dispensada some, e o app não volta a pedir na mesma sessão (FR15). O produto oferece; a
 * decisão é dela — a mesma regra que o `F23` já segue.
 *
 * **Nem IA.** Isto é uma função pura sobre estado, e é assim que fica: a IA é a última capability
 * do roadmap, e infraestrutura antecipada dela é proibida (§0.4/NG7).
 *
 * Vive no app e não em `packages/core` pela mesma razão que a faixa da semana: não decide nada sobre
 * cuidado. Todo julgamento que ela lê — feito, atrasado, pulado — já foi feito por `buildTodayView`,
 * e o que sobra aqui é escolher o que **oferecer**, que é decisão de apresentação.
 */

export type SuggestionKey = 'wash_day' | 'shelf_empty';

export type Suggestion = {
  readonly key: SuggestionKey;
  /** O fato, na primeira pessoa dela. Curto o bastante para ser lido sem esforço. */
  readonly text: string;
  readonly action: string;
  /** Só para `wash_day`: a execução que o atalho abre. */
  readonly careExecutionId?: string;
  readonly careTitle?: string;
};

/**
 * O máximo que aparece de uma vez (OQ4). Duas: uma tela com uma pilha de sugestões deixa de ser uma
 * oferta e vira uma lista de pendências, que é exatamente o que esta seção não pode ser.
 */
export const MAX_SUGGESTIONS = 2;

export const buildSuggestions = (input: {
  view: TodayView;
  /** As execuções que **têm** registro de Wash Day (SPEC-024 FR7). */
  washDayExecutionIds: readonly string[];
  /**
   * Quantos produtos ativos ela tem, ou `null` quando ainda não se sabe.
   *
   * `null` **não** é zero: uma leitura que não voltou não pode virar "sua prateleira está vazia",
   * que é uma afirmação sobre ela feita a partir de nada.
   */
  productCount: number | null;
  dismissed: readonly SuggestionKey[];
}): readonly Suggestion[] => {
  const { view, washDayExecutionIds, productCount, dismissed } = input;
  const out: Suggestion[] = [];

  /**
   * Um cuidado que ela fez e sobre o qual não contou nada. O mais recente só — oferecer três de uma
   * vez transformaria a oferta em cobrança, e o registro antigo continua alcançável pelo histórico.
   *
   * `history` vem do mais recente para o mais antigo em `buildTodayView`; o `find` respeita isso.
   */
  const unrecorded: CareItem | undefined = view.history.find(
    (item) =>
      item.outcome === 'done' && item.execution !== null && !washDayExecutionIds.includes(item.execution.id),
  );
  if (unrecorded?.execution) {
    out.push({
      key: 'wash_day',
      text: `Você fez ${CARE_TYPE_LABEL[unrecorded.careTypeCode].toLowerCase()} em ${formatPlannedDate(unrecorded.plannedDate)} e ainda não contou o que usou.`,
      /**
       * **"Contar", e não "Contar esse cuidado".** O cartão do histórico já usa o rótulo longo, e
       * ter os dois na mesma tela seria a mesma ação dita duas vezes, do mesmo jeito. O texto acima
       * já diz de qual cuidado se trata — o botão não precisa repeti-lo.
       */
      action: 'Contar',
      careExecutionId: unrecorded.execution.id,
      careTitle: CARE_TYPE_LABEL[unrecorded.careTypeCode],
    });
  }

  if (productCount === 0) {
    out.push({
      key: 'shelf_empty',
      // O porquê é a razão da prateleira existir, e não uma promessa sobre o cabelo dela.
      text: 'Sua prateleira está vazia. Cadastrar o que você tem em casa serve para o app não sugerir o que você não tem.',
      action: 'Ver minha prateleira',
    });
  }

  return out.filter((s) => !dismissed.includes(s.key)).slice(0, MAX_SUGGESTIONS);
};
