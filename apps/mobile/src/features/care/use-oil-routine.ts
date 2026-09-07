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
  times: [],
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
  /** A frase que ela lê. `failure` é o detalhe técnico, só sob `__DEV__`. */
  const [message, setMessage] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  /**
   * A chave de idempotência daquela intenção. Guardada até o servidor confirmar: um retry depois de
   * uma resposta perdida tem de repetir a **mesma** chave, senão vira um segundo evento (FR4/EC3).
   */
  const [keys] = useState(() => new Map<string, string>());

  const load = useCallback(() => {
    let active = true;
    /**
     * SPEC-053 — os horários entram na **mesma** leitura, e não numa segunda depois.
     *
     * Uma leitura à parte faria a tela existir por um instante com a rotina certa e a lista de
     * horários vazia — e "vazia" é um estado com significado (é a rotina da SPEC-040), então piscar
     * nele seria mostrar uma coisa falsa antes da verdadeira.
     */
    Promise.all([oil.getRoutine(), oil.listEvents(), oil.listTimes()])
      .then(([routine, events, times]) => {
        if (!active) return;
        setView(buildOilRoutineView({ routine, events, today, times }));
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

  const run = (key: string, write: () => Promise<unknown>, onFail = 'Não foi possível salvar agora.') => {
    if (busy) return; // um toque por vez, e a trava de toque duplo
    setBusy(true);
    setFailure(null);
    setMessage(null);
    void write()
      .then(() => keys.delete(key))
      .catch((error: unknown) => {
        /**
         * ⚠️ **Uma escrita que falha em silêncio é pior que uma que falha.**
         *
         * A leitura desta rotina falha calada de propósito (SPEC-040): sem ela, a rotina apenas não
         * aparece, e um erro em tela cheia por uma capability opcional bloquearia o loop diário. Uma
         * **escrita** é outra coisa — ela tocou, nada mudou, e sem uma frase ela não tem como saber
         * se o app ignorou o toque ou se a rede caiu. É o padrão da SPEC-024: a que falha volta
         * atrás sozinha **dizendo qual foi**.
         *
         * ⚠️ Isto valia para `escolher`, `desligar`, `feito` e `adiar` desde a SPEC-040 — o
         * `failure` era calculado e **nenhuma tela o lia**. A SPEC-053 multiplicou a superfície por
         * quatro, e a auditoria achou a lacuna antes de ela crescer.
         */
        setMessage(onFail);
        setFailure(reasonOf(error));
      })
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
    message,
    failure,
    reload: load,
    choose: (everyDays: number) => run('oil:set', () => oil.setRoutine({ everyDays, timeZone: timeZone() })),
    turnOff: () => run('oil:clear', () => oil.clearRoutine()),
    markDone: () => record('done'),
    postpone: () => record('postponed'),

    /**
     * SPEC-053 — cada mudança é uma escrita própria, **sem botão de salvar** (o padrão da SPEC-024).
     * A que falha volta atrás sozinha dizendo qual foi, e as outras não são arrastadas junto.
     */
    addTime: (at: string) =>
      run(`oil:time:add:${at}`, () => oil.addTime({ at }), `Não foi possível adicionar o horário ${at}.`),
    updateTime: (id: string, at: string) =>
      run(`oil:time:${id}`, () => oil.updateTime({ id, at }), `Não foi possível mudar o horário para ${at}.`),
    setTimeReminder: (id: string, enabled: boolean) =>
      run(
        `oil:time:${id}:reminder`,
        () => oil.setTimeReminder({ id, enabled }),
        'Não foi possível mudar o lembrete desse horário.',
      ),
    removeTime: (id: string) =>
      run(`oil:time:${id}:remove`, () => oil.removeTime({ id }), 'Não foi possível remover esse horário.'),
  };
};
