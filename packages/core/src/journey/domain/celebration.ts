import type { JourneyView } from './journey.ts';

/**
 * SPEC-043 OQ1 — **a celebração no lugar dela.**
 *
 * O Blueprint §24 termina o fluxo da Jornada em *"celebração no lugar dela"*, e até aqui esse nó não
 * existia: pontos, sequência e marcos subiam **em silêncio**. Esta é a detecção pura — o que houve de
 * conquista **nova** entre a Jornada de antes e a de agora.
 *
 * ⚠️ **Nunca comemora a linha de base.** `prev === null` é a primeira leitura da sessão: os marcos já
 * alcançados não são conquista do momento, e dar parabéns por eles na abertura seria a Huna
 * celebrando algo que ela fez semanas atrás — o oposto de "no lugar dela, na hora".
 *
 * ⚠️ **Aderência, nunca quantidade** (D-103). Marco e nível saem de `caresAttended`/`streak`/`points`,
 * todos ancorados em cuidado **planejado** — o ad-hoc não concede ponto (SPEC-052). Comemorar aqui
 * não é comemorar fazer mais: é comemorar **manter o plano**. Nada nesta detecção olha para cuidado
 * fora do cronograma, e nada premia frequência.
 *
 * ⚠️ **Uma conquista por evento.** Um cuidado cruza no máximo um marco de contagem e um de sequência;
 * empilhar dois cartões vira ruído — exatamente o risco que fez a OQ1 ser adiada (*"com ela mal-feita
 * vira ruído"*). Marco tem prioridade sobre subir de nível (é o mais específico), e entre marcos, o
 * primeiro da régua.
 */
export type Celebration =
  | { readonly kind: 'milestone'; readonly key: string; readonly label: string }
  | { readonly kind: 'level'; readonly level: number; readonly name: string };

export const detectCelebration = (prev: JourneyView | null, next: JourneyView): Celebration | null => {
  if (!prev) return null;
  const newlyReached = next.milestones.find(
    (m) => m.reached && !prev.milestones.some((p) => p.key === m.key && p.reached),
  );
  if (newlyReached) return { kind: 'milestone', key: newlyReached.key, label: newlyReached.label };
  if (next.level.level > prev.level.level)
    return { kind: 'level', level: next.level.level, name: next.level.name };
  return null;
};
