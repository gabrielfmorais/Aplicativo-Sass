import { AppError } from '@app/core';

/**
 * Why something failed, as a short string, for the developer only.
 *
 * D-87 bought this lesson once: the app said "Não foi possível carregar seu perfil." and the real
 * reason — the table did not exist on the remote project — was invisible without opening devtools.
 * D-90 bought it again one layer over, and cost more: "Não foi possível criar seu cronograma.
 * Tente novamente." while the actual answer from the edge gateway was
 * `404 NOT_FOUND: Requested function was not found`. The retry the sentence invited could never
 * have worked, and nothing on screen said so.
 *
 * **The user never sees this.** Every call site renders it behind `__DEV__`, which the bundler
 * strips from a release build entirely. It is never logged, never sent anywhere, and never becomes
 * an analytics property (SECURITY-BASELINE §3): it exists on screen, in development, and nowhere
 * else. Keeping it out of logs is what lets it be this specific.
 */
export const reasonOf = (error: unknown): string =>
  error instanceof AppError
    ? `${error.code}: ${error.message}`
    : error instanceof Error
      ? error.message
      : String(error);
