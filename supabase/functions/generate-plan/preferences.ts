import { isWeekday, normalizePreferredWeekdays, type PlanPreferences, type Weekday } from '@app/core';

/**
 * SPEC-015 FR3/G2 — the premium gate for `plan_customization`, decided here and nowhere else.
 *
 * Kept out of `index.ts` so it can be tested without a Supabase client or a running server: the two
 * reads are passed in as thunks, and every call site of those thunks is one visible line in
 * `index.ts`. What is worth testing is the *decision*, and the decision is entirely here.
 *
 * Both reads run with HER JWT (`has_entitlement` is INVOKER and RLS-scoped; `plan_preferences` is
 * her own row). Nothing about the customisation comes from the request body — the client cannot
 * even offer a weekday, let alone an entitlement — so a tampered client has nothing to forge.
 *
 * Fail closed at every step (§16): no entitlement, a failed read, a missing row, a malformed value
 * or an empty set all return `undefined`, and `buildPlan` then produces exactly the free,
 * engine-default plan.
 */

/** Shape of a supabase-js result, narrowed to what this decision reads. */
export type Read = () => Promise<{ data: unknown; error: unknown }>;

export const premiumPreferences = async (
  hasEntitlement: Read,
  readStoredWeekdays: Read,
): Promise<PlanPreferences | undefined> => {
  const entitlement = await hasEntitlement();
  // `!== true` and not `=== false`: null, undefined or anything unexpected must deny, never grant.
  if (entitlement.error || entitlement.data !== true) return undefined;

  const stored = await readStoredWeekdays();
  if (stored.error || !stored.data) return undefined;

  const raw = (stored.data as { preferred_weekdays?: unknown }).preferred_weekdays;
  if (!Array.isArray(raw)) return undefined;

  // The CHECK constraint already bounds the column, but a column is not a contract: anything that
  // is not a weekday is dropped rather than handed to the placement layer.
  const preferredWeekdays = normalizePreferredWeekdays(raw.filter((d): d is Weekday => isWeekday(d)));
  return preferredWeekdays.length === 0 ? undefined : { preferredWeekdays };
};
