import { File, Paths } from 'expo-file-system';

import { secureSessionStorage } from './secure-session-storage';

/**
 * Reinstall = logged out (SPEC-001 §10). The OS keychain can outlive an uninstall, but the app's
 * document directory does not: a missing marker file means a fresh install, so any residual session
 * in secure storage is discarded before the Supabase client reads it.
 */
export const discardSessionIfFreshInstall = async (storageKey: string): Promise<void> => {
  const marker = new File(Paths.document, '.installed');
  if (marker.exists) return;
  await secureSessionStorage.removeItem(storageKey);
  await secureSessionStorage.removeItem(`${storageKey}-code-verifier`);
  marker.create();
};
