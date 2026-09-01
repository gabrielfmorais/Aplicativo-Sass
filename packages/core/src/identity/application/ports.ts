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

/**
 * SPEC-018 — `profiles`: o nome que ela escolheu, e nada mais.
 *
 * Duas ausências diferentes, e a diferença é o produto inteiro: **linha ausente** significa que
 * ainda não perguntamos, e **`displayName` nulo** significa que perguntamos e ela preferiu não
 * dizer. Sem essa distinção o app volta a perguntar o nome a cada abertura para quem escolheu não
 * responder — que é a definição de não ouvir.
 *
 * Sem RPC: a linha não guarda invariante de servidor, é a declaração dela sobre ela mesma. RLS mais
 * `with check` é toda a autorização (§10).
 */
export type UserProfile = { readonly displayName: string | null };

export interface ProfilePort {
  /** O perfil dela, ou `null` quando a pergunta nunca foi feita. */
  get(): Promise<UserProfile | null>;
  /** Registra a resposta. `null` grava "prefiro não dizer" — que também é ter respondido. */
  save(displayName: string | null): Promise<void>;
}
