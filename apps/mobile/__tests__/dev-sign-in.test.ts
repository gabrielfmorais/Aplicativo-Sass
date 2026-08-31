import { devSignInAvailable } from '@/infrastructure/supabase/dev-sign-in';

/**
 * D-85 — the dev entry is only as safe as its guards, so the guards are what gets tested. Each case
 * flips exactly one condition and expects the door to be shut: a guard that only works when the
 * other three also hold is not a guard.
 */
type Conditions = {
  isDev: boolean;
  platform: string;
  appEnv: string | undefined;
  email: string | undefined;
  password: string | undefined;
};

const ALL_GOOD: Conditions = {
  isDev: true,
  platform: 'web',
  appEnv: 'development',
  email: 'dev@example.test',
  password: 'pw',
};

const check = (c: Conditions) => devSignInAvailable(c.isDev, c.platform, c.appEnv, c.email, c.password);
const shutBy = (name: string, override: Partial<Conditions>) => ({ name, ...ALL_GOOD, ...override });

describe('dev web sign-in availability (D-85)', () => {
  it('opens only when every condition holds', () => {
    expect(check(ALL_GOOD)).toBe(true);
  });

  it.each([
    shutBy('not a dev build', { isDev: false }),
    shutBy('on iOS', { platform: 'ios' }),
    shutBy('on Android', { platform: 'android' }),
    shutBy('in preview', { appEnv: 'preview' }),
    shutBy('in production', { appEnv: 'production' }),
    shutBy('with no app env at all', { appEnv: undefined }),
    shutBy('with no email in the environment', { email: undefined }),
    shutBy('with no password in the environment', { password: undefined }),
    shutBy('with an empty email', { email: '' }),
    shutBy('with an empty password', { password: '' }),
  ])('stays shut $name', (c) => {
    expect(check(c)).toBe(false);
  });

  /**
   * The guard that survives the others being defeated: a build ships without the credential in its
   * environment, so even a bundle that somehow kept this code has nothing to sign in as.
   */
  it('is shut by the missing credential alone, whatever the other conditions say', () => {
    expect(check({ ...ALL_GOOD, email: undefined, password: undefined })).toBe(false);
  });
});
