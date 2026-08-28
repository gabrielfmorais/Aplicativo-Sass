/**
 * Public surface of @app/core.
 * Bounded contexts are added here only when their SPEC is approved (docs/specs/).
 */
export const CORE_VERSION = '0.0.0-foundation' as const;

export * from './shared/index.ts';
export * from './identity/index.ts';
export * from './hair-profile/index.ts';
export * from './diagnostic/index.ts';
export * from './schedule/index.ts';
export * from './care-tracking/index.ts';
export * from './content/index.ts';
