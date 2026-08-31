// SPEC-015 AC2 — the premium gate as the server actually decides it: fail closed on everything
// except an explicit `true` plus a usable weekday set. Pure, no network, no env.
// Run: `deno test` in supabase/functions.
import { premiumPreferences, type Read } from './preferences.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const ok =
  (data: unknown): Read =>
  () =>
    Promise.resolve({ data, error: null });
const fails = (): Read => () => Promise.resolve({ data: null, error: { message: 'boom' } });
const never = (): Read => () => Promise.reject(new Error('must not be read'));

const weekdays = (value: unknown) => ok({ preferred_weekdays: value });

Deno.test('applies her routine when the server says she is entitled', async () => {
  const result = await premiumPreferences(ok(true), weekdays([4, 1]));
  assert(result !== undefined, 'entitled user should get her preferences');
  assert(
    JSON.stringify(result.preferredWeekdays) === JSON.stringify([1, 4]),
    'weekdays should come back normalised (sorted, deduplicated)',
  );
});

Deno.test('a free user gets the engine default, and her stored routine is never even read', async () => {
  // `never()` is the assertion: without the entitlement there is no reason to touch her row at all.
  assert((await premiumPreferences(ok(false), never())) === undefined, 'free must not customise');
});

Deno.test('anything other than an explicit true denies (null, undefined, truthy strings)', async () => {
  for (const value of [null, undefined, 'true', 1, {}]) {
    assert(
      (await premiumPreferences(ok(value), never())) === undefined,
      `entitlement value ${JSON.stringify(value)} must not grant access`,
    );
  }
});

Deno.test('a failed entitlement check denies — an error never opens a paid capability', async () => {
  assert((await premiumPreferences(fails(), never())) === undefined, 'error must fail closed');
});

Deno.test('a failed preference read falls back to the engine default', async () => {
  assert((await premiumPreferences(ok(true), fails())) === undefined, 'read error must fail closed');
});

Deno.test('no stored row, or an empty set, means no customisation', async () => {
  assert((await premiumPreferences(ok(true), ok(null))) === undefined, 'missing row → default');
  assert((await premiumPreferences(ok(true), weekdays([]))) === undefined, 'empty set → default');
});

Deno.test('a malformed column cannot reach the placement layer', async () => {
  // Neither of these can be produced through the app or survive the CHECK constraint. They are here
  // because the placement layer must never be handed something the domain type forbids, whatever
  // the column happens to contain.
  const outOfDomain = await premiumPreferences(ok(true), weekdays([1, 9, -2, 6.5, 'sat', null, 6]));
  assert(outOfDomain !== undefined, 'the two valid weekdays should survive');
  assert(
    JSON.stringify(outOfDomain.preferredWeekdays) === JSON.stringify([1, 6]),
    'only real weekdays should get through',
  );

  assert((await premiumPreferences(ok(true), weekdays('not-an-array'))) === undefined, 'not an array');
  assert((await premiumPreferences(ok(true), weekdays(undefined))) === undefined, 'absent column');
  assert((await premiumPreferences(ok(true), weekdays(['x', 7]))) === undefined, 'nothing valid left');
});
