import type { SupabaseClient } from '@supabase/supabase-js';

import { createSupabaseAuthAdapter } from '@/infrastructure/supabase/auth-adapter';

const session = (id: string) => ({ user: { id } }) as never;

const makeClient = () => {
  const auth = {
    signInWithOtp: jest.fn(async () => ({ error: null })),
    verifyOtp: jest.fn(async () => ({ error: null })),
    signInWithOAuth: jest.fn(async () => ({ data: { url: 'https://auth.example/authorize' }, error: null })),
    exchangeCodeForSession: jest.fn(async () => ({ error: null })),
    signOut: jest.fn(async () => ({ error: null })),
    getSession: jest.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: jest.fn((cb: (e: string, s: unknown) => void) => {
      cb('SIGNED_IN', session('u-1'));
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    }),
  };
  return { auth, client: { auth } as unknown as SupabaseClient };
};
const REDIRECT = 'haircare://auth/callback';

describe('Supabase AuthPort adapter (SPEC-001 §9)', () => {
  it('requests OTP with shouldCreateUser so the response is identical with or without an account (AC4)', async () => {
    const { auth, client } = makeClient();
    await createSupabaseAuthAdapter(client, { openAuthSessionAsync: jest.fn() }, REDIRECT).requestOtp(
      'ana@example.com',
    );
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      options: { shouldCreateUser: true },
    });
  });

  it('provider sign-in: cancel returns false without touching the session; success exchanges the code once', async () => {
    const { auth, client } = makeClient();
    const browser = { openAuthSessionAsync: jest.fn(async () => ({ type: 'cancel' as const })) };
    const port = createSupabaseAuthAdapter(client, browser, REDIRECT);
    expect(await port.signInWithProvider('google')).toBe(false);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();

    browser.openAuthSessionAsync.mockResolvedValueOnce({
      type: 'success',
      url: `${REDIRECT}?code=abc123`,
    } as never);
    expect(await port.signInWithProvider('apple')).toBe(true);
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'apple',
      options: { redirectTo: REDIRECT, skipBrowserRedirect: true },
    });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
  });

  it('provider callback without a code is rejected', async () => {
    const { client } = makeClient();
    const browser = {
      openAuthSessionAsync: jest.fn(async () => ({
        type: 'success',
        url: `${REDIRECT}?error=access_denied`,
      })),
    };
    await expect(
      createSupabaseAuthAdapter(client, browser, REDIRECT).signInWithProvider('google'),
    ).rejects.toThrow();
  });

  it('logout revokes locally and runs local cleanup even if the server call fails (AC8)', async () => {
    const { auth, client } = makeClient();
    auth.signOut.mockResolvedValueOnce({ error: { message: 'network' } } as never);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const cleanup = jest.fn();
    await createSupabaseAuthAdapter(client, { openAuthSessionAsync: jest.fn() }, REDIRECT, [
      cleanup,
    ]).signOut();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('maps sessions to domain state exposing only the user id (BR1)', async () => {
    const { auth, client } = makeClient();
    const port = createSupabaseAuthAdapter(client, { openAuthSessionAsync: jest.fn() }, REDIRECT);
    expect(await port.getState()).toEqual({ status: 'unauthenticated' });
    auth.getSession.mockResolvedValueOnce({ data: { session: session('u-9') } } as never);
    expect(await port.getState()).toEqual({ status: 'authenticated', session: { userId: 'u-9' } });
    const seen: unknown[] = [];
    port.onStateChange((s) => seen.push(s));
    expect(seen).toEqual([{ status: 'authenticated', session: { userId: 'u-1' } }]);
  });
});
