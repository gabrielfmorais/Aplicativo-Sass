/**
 * Web build of the fresh-install check — **development preview only**. There is no install
 * lifecycle in a browser tab and the web session storage is memory-only
 * (`secure-session-storage.web.ts`), so every page load already *is* a fresh install: there is no
 * residual session that could outlive it, and nothing to discard.
 */
export const discardSessionIfFreshInstall = async (_storageKey: string): Promise<void> => {
  void _storageKey;
};
