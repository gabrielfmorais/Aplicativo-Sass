import type { LocalDate, OilRoutinePort, OilRoutineView } from '@app/core';
import { buildOilRoutineView } from '@app/core';
import { useCallback, useEffect, useState } from 'react';

import { reasonOf } from '@/shared/failure-detail';

const EMPTY: OilRoutineView = {
  state: 'none',
  everyDays: null,
  dueOn: null,
  daysLate: 0,
  lastDoneOn: null,
  doneCount: 0,
};

/**
 * SPEC-040 (F39) — a rotina de óleo, carregada uma vez e lida por duas telas.
 *
 * **Uma fonte, dois consumidores.** A Hoje mostra a ocorrência quando ela vence; Cuidados guarda o
 * intervalo, a última vez e o desligar. Carregar em cada tela faria as duas discordarem sobre a
 * mesma rotina no intervalo entre um toque e o outro.
 *
 * **Falha em silêncio, de propósito.** Se a leitura não voltar, a rotina simplesmente não aparece —
 * como a sugestão da prateleira (SPEC-026). Um erro em tela cheia por causa de uma capability
 * opcional transformaria uma indisponibilidade em bloqueio do loop diário, e a Hoje tem trabalho
 * mais importante a fazer.
 */
export const useOilRoutine = (
  oil: OilRoutinePort,
  today: LocalDate,
  timeZone: () => string,
  newEventId: () => string,
) => {
  const [view, setView] = useState<OilRoutineView>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /**
   * A chave de idempotência daquela intenção. Guardada até o servidor confirmar: um retry depois de
   * uma resposta perdida tem de repetir a **mesma** chave, senão vira um segundo evento (FR4/EC3).
   */
  const [keys] = useState(() => new Map<string, string>());

  const load = useCallback(() => {
    let active = true;
    Promise.all([oil.getRoutine(), oil.listEvents()])
      .then(([routine, events]) => {
        if (!active) return;
        setView(buildOilRoutineView({ routine, events, today }));
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFailure(reasonOf(error));
        setView(EMPTY);
      });
    return () => {
      active = false;
    };
  }, [oil, today]);
  useEffect(() => load(), [load]);

  const run = (key: string, write: () => Promise<unknown>) => {
    if (busy) return; // um toque por vez, e a trava de toque duplo
    setBusy(true);
    setFailure(null);
    void write()
      .then(() => keys.delete(key))
      .catch((error: unknown) => setFailure(reasonOf(error)))
      .finally(() => {
        setBusy(false);
        load();
      });
  };

  const record = (kind: 'done' | 'postponed') => {
    const key = `oil:${kind}`;
    const clientEventId = keys.get(key) ?? newEventId();
    keys.set(key, clientEventId);
    run(key, () => oil.recordEvent({ kind, clientEventId, timeZone: timeZone() }));
  };

  return {
    view,
    busy,
    failure,
    reload: load,
    choose: (everyDays: number) => run('oil:set', () => oil.setRoutine({ everyDays, timeZone: timeZone() })),
    turnOff: () => run('oil:clear', () => oil.clearRoutine()),
    markDone: () => record('done'),
    postpone: () => record('postponed'),
  };
};
