import type { Uuid } from '../../shared/ids.ts';

/** What the domain knows about an authenticated user (SPEC-001 BR1): only the id. */
export type AuthSession = { readonly userId: Uuid };

/** Authentication state (SPEC-001 §14). Account lifecycle (deletion requested) is read separately. */
export type AuthState =
  | { readonly status: 'unauthenticated' }
  | { readonly status: 'authenticated'; readonly session: AuthSession };

export const UNAUTHENTICATED: AuthState = { status: 'unauthenticated' };
