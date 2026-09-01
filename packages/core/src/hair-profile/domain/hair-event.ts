import { z } from 'zod';

/**
 * SPEC-020 — o que ela declara que aconteceu com o cabelo dela.
 *
 * Lista fechada, espelhando o `CHECK` de `public.hair_events`. Duas listas para o mesmo enum é o
 * preço de validar nos dois lados da fronteira (P07): a de cá recusa antes da chamada, a de lá
 * recusa um cliente adulterado — e a segunda é a que importa.
 *
 * **Isto não é regra capilar.** Nenhum valor aqui diz o que fazer, o que esperar ou como o cabelo
 * ficou; são nomes de coisas que acontecem. É exatamente essa contenção que mantém a capability
 * fora do gate de domínio (D-26/D-70) — e ela se perde na primeira palavra a mais.
 */
export const HAIR_EVENT_TYPES = [
  'chemical_treatment',
  'coloring',
  'bleaching_or_highlights',
  'haircut',
  'intense_heat',
  'beach_or_pool',
  'braids_or_protective_style',
  'care_pause',
  'noticed_change',
] as const;

export const HairEventTypeSchema = z.enum(HAIR_EVENT_TYPES);

export type HairEventType = z.infer<typeof HairEventTypeSchema>;

/** Um evento como ela o vê. Anulados nunca chegam aqui — somem da lista, não do banco (BR6). */
export type HairEvent = {
  readonly id: string;
  readonly eventType: HairEventType;
  /** Dia civil dela (ADR-008). */
  readonly occurredOn: string;
  readonly createdAt: string;
};
