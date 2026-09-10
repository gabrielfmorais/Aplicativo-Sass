import type { FinishHistoryRecord, WashDayPort } from '@app/core';
import { useCallback, useEffect, useState } from 'react';

import { reasonOf } from '@/shared/failure-detail';

type Loadable = {
  records: readonly FinishHistoryRecord[] | null;
  loading: boolean;
  failed: boolean;
  reason: string | null;
};

/**
 * SPEC-070 (F38, a biblioteca) — os registros de finalização dela, **lidos uma vez**.
 *
 * ⚠️ **Uma leitura, dois consumidores.** A home das Finalizações e a tela de cada técnica saem dos
 * **mesmos** fatos: carregar em cada tela faria as duas discordarem sobre a mesma história — a lista
 * dizendo *"3 vezes"* e o detalhe *"2 vezes"* depois de um registro no meio do caminho. É a mesma
 * decisão que a SPEC-069 tomou entre a Hoje e a Jornada, e a SPEC-040 entre a Hoje e Cuidados.
 *
 * Só leitura, e só dela: `auth.uid()` decide sob RLS, nada é escrito, nada agrega com terceiros.
 */
export const useFinishes = (
  washDays: WashDayPort,
  /**
   * ⚠️ **Só carrega com a área aberta**, como o `useShelfUsage` faz com o gate premium.
   *
   * Sem isto, esta leitura — cinco viagens à rede — rodaria na **abertura do app**, para toda
   * usuária, todas as vezes, por causa de uma tela que a maior parte das sessões nunca abre. Ler o
   * histórico de quem não vai ver nada é trabalho sem consumidor.
   */
  enabled: boolean,
): Loadable & { reload: () => void } => {
  const [state, setState] = useState<Loadable>({
    records: null,
    loading: enabled,
    failed: false,
    reason: null,
  });

  const load = useCallback(() => {
    if (!enabled) {
      setState({ records: null, loading: false, failed: false, reason: null });
      return;
    }
    let active = true;
    setState((s) => ({ ...s, loading: true, failed: false }));
    washDays
      .finishHistory()
      .then((records) => active && setState({ records, loading: false, failed: false, reason: null }))
      // ⚠️ Nunca uma lista que finge zero: erro é erro, e a tela oferece nova tentativa (EC3).
      .catch(
        (error: unknown) =>
          active && setState({ records: null, loading: false, failed: true, reason: reasonOf(error) }),
      );
    return () => {
      active = false;
    };
  }, [washDays, enabled]);

  useEffect(() => load(), [load]);

  return { ...state, reload: load };
};
