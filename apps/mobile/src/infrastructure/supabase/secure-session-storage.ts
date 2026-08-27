import * as SecureStore from 'expo-secure-store';

/**
 * supabase-js storage adapter backed by the OS secure storage (SPEC-001 §10, D-53/D-59).
 * - Values are split into chunks because SecureStore caps a single value at ~2 KB; chunking is
 *   not cryptography — the OS keychain/keystore does the encryption.
 * - If secure storage is unavailable, fall back to memory only (session not persisted). Never to
 *   insecure storage.
 */
const CHUNK = 1800;
const countKey = (key: string) => `${key}.n`;
const chunkKey = (key: string, i: number) => `${key}.${i}`;

export interface SessionStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const memory = new Map<string, string>();
let secureBroken = false;

const guard = async <T>(op: () => Promise<T>, fallback: () => T): Promise<T> => {
  if (secureBroken) return fallback();
  try {
    return await op();
  } catch {
    secureBroken = true; // ponytail: sticky fallback; no retry logic until it's needed
    console.warn('[auth] secure storage unavailable — session will not persist');
    return fallback();
  }
};

export const secureSessionStorage: SessionStorage = {
  getItem: (key) =>
    guard(
      async () => {
        const n = Number(await SecureStore.getItemAsync(countKey(key)));
        if (!n) return null;
        const parts = await Promise.all(
          Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(chunkKey(key, i))),
        );
        return parts.some((p) => p == null) ? null : parts.join('');
      },
      () => memory.get(key) ?? null,
    ),
  setItem: (key, value) =>
    guard(
      async () => {
        const n = Math.ceil(value.length / CHUNK);
        for (let i = 0; i < n; i++) {
          await SecureStore.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK, (i + 1) * CHUNK));
        }
        await SecureStore.setItemAsync(countKey(key), String(n));
      },
      () => {
        memory.set(key, value);
      },
    ),
  removeItem: (key) =>
    guard(
      async () => {
        const n = Number(await SecureStore.getItemAsync(countKey(key)));
        for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(chunkKey(key, i));
        await SecureStore.deleteItemAsync(countKey(key));
      },
      () => {
        memory.delete(key);
      },
    ),
};
