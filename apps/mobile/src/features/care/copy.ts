import type { CareOutcome } from '@app/core';

/**
 * O estado de um cuidado **em palavra**, no feminino porque acompanha o tipo ("Hidratação: feita").
 *
 * Cor nunca é o único portador de estado (SPEC-016), então este mapa é o que a tela realmente diz —
 * e existe num lugar só para que a faixa da semana e a visão de ciclo não passem a chamar a mesma
 * coisa por nomes diferentes.
 *
 * **"Pulada" e "reagendada" não são falhas** (SPEC-019 BR4): são desfechos que ela escolheu. Nenhuma
 * palavra aqui pode sugerir o contrário, e é por isso que não há "perdida", "faltou" nem "não fez".
 */
export const OUTCOME_LABEL: Record<CareOutcome, string> = {
  planned: 'planejada',
  overdue: 'atrasada',
  done: 'feita',
  skipped: 'pulada',
  rescheduled: 'reagendada',
};
