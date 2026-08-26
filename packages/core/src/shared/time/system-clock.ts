import type { Clock } from './clock.js';
import { instantFromEpochMs } from './instant.js';

/**
 * The ONLY place in @app/core allowed to read the ambient clock (ADR-008; eslint override).
 * Wire it at the composition root; never import it from domain or application code.
 */
export const systemClock: Clock = {
  now: () => instantFromEpochMs(Date.now()),
};
