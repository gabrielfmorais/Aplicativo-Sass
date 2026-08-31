import { InfrastructureError } from '@app/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/**
 * DEV-ONLY web sign-in (D-85). **Not a product feature, and not a way around authentication.**
 *
 * Why it exists: the app's email screen asks for a 6-digit code, and the DEV Supabase project sends
 * a Magic Link from the default template. The two do not meet, so the browser preview cannot get
 * past the sign-in screen — which makes the preview useless for anything but the sign-in screen
 * itself. Custom SMTP is deliberately not being configured yet.
 *
 * What it does: a normal `signInWithPassword` against real Supabase Auth with the **anon key**. The
 * session, the JWT and `auth.uid()` are the real thing, so **every RLS policy applies exactly as it
 * does in production**. Nothing is bypassed, nothing is mocked, no `service_role` and no secret of
 * ours is involved — the credential is a throwaway user in the owner's own DEV project.
 *
 * FOUR INDEPENDENT GUARDS, all of which must hold. Any one of them failing returns `null`, and a
 * `null` means the button is never rendered and this code cannot run:
 *
 *   1. `__DEV__` — false in any release build, and the bundler eliminates the branch entirely.
 *   2. `Platform.OS === 'web'` — never on a device, and web is not a shipping platform (D-80).
 *   3. `EXPO_PUBLIC_APP_ENV === 'development'` — preview and production builds set something else.
 *   4. Both credential vars present — they live only in `.env.local`, which is gitignored and
 *      exists on no CI runner and in no EAS build, so in any built artefact they are `undefined`.
 *
 * Guard 4 is the one that matters even if someone defeats the other three: without a value in the
 * environment there is nothing to sign in as.
 */
const DEV_EMAIL = process.env.EXPO_PUBLIC_DEV_LOGIN_EMAIL;
const DEV_PASSWORD = process.env.EXPO_PUBLIC_DEV_LOGIN_PASSWORD;

/** Exposed for the guard test; the four conditions in one place so none can drift. */
export const devSignInAvailable = (
  isDev: boolean = __DEV__,
  platform: string = Platform.OS,
  appEnv: string | undefined = process.env.EXPO_PUBLIC_APP_ENV,
  email: string | undefined = DEV_EMAIL,
  password: string | undefined = DEV_PASSWORD,
): boolean =>
  isDev === true &&
  platform === 'web' &&
  appEnv === 'development' &&
  typeof email === 'string' &&
  email.length > 0 &&
  typeof password === 'string' &&
  password.length > 0;

/**
 * Returns the sign-in action, or `null` when this build has no business offering one.
 *
 * Sign-in only — it deliberately does **not** create the user. The first version did, falling back
 * to `signUp`, and that was wrong twice over: `signUp` sends a confirmation email, so it depends on
 * the very subsystem that is broken here (the DEV project answers
 * `429 over_email_send_rate_limit`), and even when it succeeds it leaves an unconfirmed user that
 * cannot sign in. Creating the user is a one-time, out-of-band step in the Supabase dashboard, with
 * "Auto Confirm User" ticked — see `docs/runbooks/WEB-DEV-PREVIEW.md` §5.
 *
 * So this path touches no email, no template and no SMTP. It is one `signInWithPassword` with the
 * anon key, exactly like any user signing in.
 */
export const createDevSignIn = (client: SupabaseClient): (() => Promise<void>) | null => {
  if (!devSignInAvailable()) return null;
  const email = DEV_EMAIL as string;
  const password = DEV_PASSWORD as string;

  return async () => {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (!error) return;
    throw new InfrastructureError(
      'auth.dev_sign_in_failed',
      `Não entrou como ${email}. Crie esse usuário uma vez no Supabase (Authentication → Users → Add user), marque "Auto Confirm User" e use a senha de EXPO_PUBLIC_DEV_LOGIN_PASSWORD. Detalhe: ${error.message}`,
    );
  };
};
