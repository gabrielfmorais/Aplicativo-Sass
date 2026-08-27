// identity — public surface (SPEC-001).
export { EmailSchema, OtpCodeSchema, type Email, type OtpCode } from './domain/email.ts';
export { redactEmail, redactForLog } from './domain/redact.ts';
export { UNAUTHENTICATED, type AuthSession, type AuthState } from './domain/session.ts';
export type { AuthPort, DeletionRequestPort, OAuthProvider } from './application/ports.ts';
