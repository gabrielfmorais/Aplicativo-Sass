import type { Email, OtpCode } from '../domain/email.ts';
import type { AuthState } from '../domain/session.ts';

export type OAuthProvider = 'apple' | 'google';

/** Implemented by apps/mobile infrastructure over Supabase Auth (SPEC-001 §9). */
export interface AuthPort {
  /** Resolves identically whether or not an account exists for the email (BR8). */
  requestOtp(email: Email): Promise<void>;
  verifyOtp(email: Email, code: OtpCode): Promise<void>;
  /** Returns false when the user cancelled the provider flow (§15). */
  signInWithProvider(provider: OAuthProvider): Promise<boolean>;
  /** Local logout: revokes this refresh token server-side and clears local persistence (FR5). */
  signOut(): Promise<void>;
  getState(): Promise<AuthState>;
  onStateChange(listener: (state: AuthState) => void): () => void;
}

/** account_deletion_requests (SPEC-001 §8): a row = active request; cancel = delete own row. */
export interface DeletionRequestPort {
  current(): Promise<{ requestedAt: string } | null>;
  request(): Promise<void>;
  cancel(): Promise<void>;
}
