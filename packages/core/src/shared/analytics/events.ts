/**
 * Typed analytics event catalogue (ADR-010).
 *
 * Rules:
 * - Names are snake_case, `<object>_<past_tense_verb>`, and describe behaviour, not UI.
 * - Properties may contain only opaque ids, domain enums, aggregated numbers, booleans and
 *   platform/app version. NEVER personal data or free text.
 * - Adding an event requires updating this union in the PR of the SPEC that emits it.
 *
 * The catalogue is intentionally EMPTY in the Foundation (SPEC-000). Product SPECs add members.
 */

/** Values allowed in event properties. */
export type AnalyticsPropertyValue = string | number | boolean | null;

export interface AnalyticsEventBase<
  TName extends string,
  TProps extends Record<string, AnalyticsPropertyValue>,
> {
  readonly name: TName;
  readonly props: TProps;
}

/**
 * Discriminated union of every event the product may emit.
 * `never` until the first product SPEC adds an event — this makes `track()` uncallable with
 * ad-hoc names, which is the point.
 */
export type AnalyticsEvent = never;

export type AnalyticsEventName = AnalyticsEvent extends { name: infer N } ? N : never;
