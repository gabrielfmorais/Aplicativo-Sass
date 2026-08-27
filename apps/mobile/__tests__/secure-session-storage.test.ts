// The mock is self-contained so jest's hoisting cannot hit a temporal-dead-zone on module state.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k: string) => {
      store.delete(k);
    }),
  };
});

import * as SecureStore from 'expo-secure-store';

import { secureSessionStorage } from '@/infrastructure/supabase/secure-session-storage';

const mock = SecureStore as unknown as {
  __store: Map<string, string>;
  setItemAsync: jest.Mock;
};

describe('secureSessionStorage (SPEC-001 AC7)', () => {
  it('round-trips values larger than the SecureStore chunk limit and removes every chunk', async () => {
    const value = 'x'.repeat(5000);
    await secureSessionStorage.setItem('sb-session', value);
    expect(mock.__store.size).toBe(4); // 3 chunks + count
    for (const v of mock.__store.values()) expect(v.length).toBeLessThanOrEqual(1800);
    expect(await secureSessionStorage.getItem('sb-session')).toBe(value);
    await secureSessionStorage.removeItem('sb-session');
    expect(mock.__store.size).toBe(0);
    expect(await secureSessionStorage.getItem('sb-session')).toBeNull();
  });

  it('never touches insecure storage: when secure storage fails it keeps the session in memory only', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    mock.setItemAsync.mockRejectedValueOnce(new Error('keychain unavailable'));
    await secureSessionStorage.setItem('sb-session', 'token-data');
    expect(mock.__store.size).toBe(0);
    expect(await secureSessionStorage.getItem('sb-session')).toBe('token-data');
    await secureSessionStorage.removeItem('sb-session');
    expect(await secureSessionStorage.getItem('sb-session')).toBeNull();
  });
});
