import type { InsightsPort, ProductPort, ShelfUsage } from '@app/core';
import { buildShelfUsage } from '@app/core';
import { useCallback, useEffect, useState } from 'react';

type Loadable = { view: ShelfUsage | null; loading: boolean; failed: boolean };

/**
 * SPEC-049 (P6) — a prateleira **ativa** cruzada com os registros dela.
 *
 * Duas leituras, e as duas precisam existir: sem a prateleira não dá para dizer o que **nunca**
 * apareceu, e sem os fatos não dá para contar o que apareceu. Ler só uma responderia metade da
 * pergunta e pareceria completa.
 *
 * Só carrega com a capability — ler o histórico de quem não vai ver nada é trabalho sem consumidor;
 * o gate de verdade é o do servidor.
 */
export const useShelfUsage = (
  insights: InsightsPort,
  products: ProductPort,
  enabled: boolean,
): Loadable & { reload: () => void } => {
  const [state, setState] = useState<Loadable>({ view: null, loading: enabled, failed: false });

  const load = useCallback(() => {
    if (!enabled) {
      setState({ view: null, loading: false, failed: false });
      return;
    }
    let active = true;
    setState((s) => ({ ...s, loading: true, failed: false }));
    Promise.all([products.list(), insights.facts()])
      .then(([shelf, facts]) => {
        if (!active) return;
        setState({ view: buildShelfUsage(shelf, facts), loading: false, failed: false });
      })
      .catch(() => active && setState({ view: null, loading: false, failed: true }));
    return () => {
      active = false;
    };
  }, [insights, products, enabled]);

  useEffect(() => load(), [load]);

  return { ...state, reload: load };
};
