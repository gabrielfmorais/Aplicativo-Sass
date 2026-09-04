import type { CareBoard, JourneyPort, JourneyView, LocalDate } from '@app/core';
import { buildJourneyView, buildTodayView } from '@app/core';
import { useCallback, useEffect, useState } from 'react';

type Loadable = { view: JourneyView | null; loading: boolean };

/**
 * SPEC-043 — a Jornada, carregada uma vez.
 *
 * **Concede e então lê.** `award` é idempotente pelo id do fato, então chamá-lo a cada abertura não
 * repontua nada — e é o que faz a Jornada estar em dia sem trigger, sem job e sem o cliente
 * conseguir forjar coisa alguma (ele não manda pontos, o servidor os deriva).
 *
 * **A sequência sai de `buildTodayView`**, a mesma leitura que a Hoje e o ciclo usam. Recontar aqui
 * seria a segunda verdade que a D-103 proíbe — e a divergência apareceria como a Huna discordando
 * de si mesma sobre o que ela fez.
 *
 * **Falha em silêncio, de propósito:** se a concessão ou a leitura não voltarem, a Jornada
 * simplesmente não aparece. Ela é uma camada de motivação; derrubar o loop diário por causa dela
 * seria trocar o essencial pelo acessório.
 */
export const useJourney = (
  journey: JourneyPort,
  board: CareBoard | null,
  today: LocalDate,
): Loadable & { reload: () => void } => {
  const [state, setState] = useState<Loadable>({ view: null, loading: true });

  const load = useCallback(() => {
    if (!board) {
      setState({ view: null, loading: false });
      return;
    }
    let active = true;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    journey
      .award(timeZone)
      .then(() => journey.list())
      .then((points) => {
        if (!active) return;
        const view = buildTodayView(board.cares, board.executions, today, board.checkIns, board.pausedOn);
        setState({
          view: buildJourneyView({
            points,
            items: [...view.overdue, ...view.today, ...view.upcoming, ...view.history],
            today,
            pausedOn: board.pausedOn,
          }),
          loading: false,
        });
      })
      .catch(() => active && setState({ view: null, loading: false }));
    return () => {
      active = false;
    };
  }, [journey, board, today]);

  useEffect(() => load(), [load]);

  return { ...state, reload: load };
};
