import type { InsightsPort, InsightsView } from '@app/core';
import { buildInsights } from '@app/core';

import { FINISH_TECHNIQUE_LABEL, TECHNIQUE_LABEL } from '@/features/care/WashDayScreen';
import { useCallback, useEffect, useState } from 'react';

type Loadable = { view: InsightsView | null; loading: boolean; failed: boolean };

/**
 * SPEC-047 (P2) — lê os fatos dela e deriva as repetições.
 *
 * ⚠️ **Só carrega quando ela tem a capability.** Não é economia: ler o histórico inteiro de quem
 * não vai ver nada é trabalho sem consumidor, e o gate de verdade é o do servidor (`advanced_insights`
 * via `EntitlementService`) — este `enabled` apenas evita a leitura.
 *
 * `failed` existe porque *"não carregou"* e *"ainda carregando"* são estados diferentes: confundi-los
 * deixaria quem abriu a tela olhando um spinner para sempre.
 */
export const useInsights = (insights: InsightsPort, enabled: boolean): Loadable & { reload: () => void } => {
  const [state, setState] = useState<Loadable>({ view: null, loading: enabled, failed: false });

  const load = useCallback(() => {
    if (!enabled) {
      setState({ view: null, loading: false, failed: false });
      return;
    }
    let active = true;
    setState((s) => ({ ...s, loading: true, failed: false }));
    insights
      .facts()
      .then((facts) => {
        if (!active) return;
        // Os rótulos são cópia de interface e já moram no app (SPEC-024, SPEC-048) — o core
        // recebe os resolvedores em vez de manter listas paralelas que divergiriam.
        setState({
          view: buildInsights(
            facts,
            (technique) => TECHNIQUE_LABEL[technique],
            (finish) => FINISH_TECHNIQUE_LABEL[finish],
          ),
          loading: false,
          failed: false,
        });
      })
      .catch(() => active && setState({ view: null, loading: false, failed: true }));
    return () => {
      active = false;
    };
  }, [insights, enabled]);

  useEffect(() => load(), [load]);

  return { ...state, reload: load };
};
