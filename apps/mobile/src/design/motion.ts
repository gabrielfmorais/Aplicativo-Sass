import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * SPEC-018 FR4 — a preferência de redução de movimento do sistema, como estado de React.
 *
 * Nasceu extraída do `HairFlow`, que já a lia, no momento em que a segunda animação do app precisou
 * exatamente da mesma resposta. Um lugar só evita o defeito clássico: uma tela respeita a
 * preferência, a outra esquece, e quem ligou "reduzir movimento" descobre isso do pior jeito.
 *
 * **`null` significa "ainda não sabemos", e existe por causa de um defeito real.** A leitura da
 * preferência é assíncrona. Enquanto ela não volta, um `false` otimista faz a animação **começar** —
 * e quando a resposta chega dizendo "reduza o movimento", ela já rodou. Quem ligou a preferência via
 * a animação assim mesmo, em toda troca de passo, com o código parecendo correto. Por isso o estado
 * inicial é a ignorância, e cabe a quem anima decidir o que fazer com ela: **não animar** é a única
 * resposta certa, porque o contrário não tem como ser desfeito depois.
 *
 * Se a consulta falhar, isto permanece `null` para sempre — e o app fica **sem animação**, nunca sem
 * conteúdo. Uma animação é sempre opcional; ver a tela, não.
 */
export function useReduceMotion(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => active && setReduced(value))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
