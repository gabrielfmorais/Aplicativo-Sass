import type { AuthPort, AuthState, Email, OAuthProvider, OtpCode, Uuid } from '@app/core';
import { InfrastructureError, UNAUTHENTICATED } from '@app/core';
import type { Session, SupabaseClient } from '@supabase/supabase-js';

/** The subset of expo-web-browser we use; injected so tests need no native module. */
export interface AuthBrowser {
  openAuthSessionAsync(url: string, redirectUrl: string): Promise<{ type: string; url?: string }>;
}

/** Hooks run on logout to clear app-local state (caches, queues, notifications) — SPEC-001 FR5. */
export type LocalCleanup = () => Promise<void> | void;

const toState = (session: Session | null): AuthState =>
  session ? { status: 'authenticated', session: { userId: session.user.id as Uuid } } : UNAUTHENTICATED;

const infra = (code: string, cause: unknown) =>
  new InfrastructureError(code, 'auth request failed', {
    cause: cause instanceof Error ? cause.message : undefined,
  });

/**
 * AuthPort over Supabase Auth (SPEC-001 §9). Provider sign-in uses the browser OAuth flow with PKCE
 * (D-56): one mechanism for Apple and Google, no native SDK, no route-based deep link — the browser
 * session hands the redirect URL straight back to this function.
 */
export const createSupabaseAuthAdapter = (
  client: SupabaseClient,
  browser: AuthBrowser,
  redirectTo: string,
  cleanups: LocalCleanup[] = [],
): AuthPort => ({
  async requestOtp(email: Email) {
    // Same call and same response whether or not an account exists (BR8).
    const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw infra('auth.otp_request_failed', error);
  },

  async verifyOtp(email: Email, code: OtpCode) {
    const { error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw infra('auth.otp_invalid_or_expired', error);
  },

  async signInWithProvider(provider: OAuthProvider) {
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) throw infra('auth.provider_start_failed', error);
    const result = await browser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) return false; // user cancelled / dismissed
    const params = new URL(result.url).searchParams;
    const code = params.get('code');
    if (!code)
      throw infra('auth.provider_callback_invalid', params.get('error_description') ?? params.get('error'));
    const exchange = await client.auth.exchangeCodeForSession(code); // single use; PKCE verifier consumed
    if (exchange.error) throw infra('auth.provider_exchange_failed', exchange.error);
    return true;
  },

  async signOut() {
    // Local scope only (logout global deferred). Network failure must not prevent local cleanup.
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) console.warn('[auth] server sign-out failed; local session cleared anyway');
    for (const cleanup of cleanups) await cleanup();
  },

  async getState() {
    const { data } = await client.auth.getSession();
    return toState(data.session);
  },

  onStateChange(listener) {
    const { data } = client.auth.onAuthStateChange((_event, session) => listener(toState(session)));
    return () => data.subscription.unsubscribe();
  },
});
