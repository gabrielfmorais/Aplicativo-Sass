// identity — public surface (SPEC-001, SPEC-018).
export { EmailSchema, OtpCodeSchema, type Email, type OtpCode } from './domain/email.ts';
export { DISPLAY_NAME_MAX_LENGTH, DisplayNameSchema, type DisplayName } from './domain/display-name.ts';
export { redactEmail, redactForLog } from './domain/redact.ts';
export { UNAUTHENTICATED, type AuthSession, type AuthState } from './domain/session.ts';
export { HUNA_AVATARS, isHunaAvatar, type HunaAvatar } from './application/ports.ts';
export type {
  AuthPort,
  DeletionRequestPort,
  OAuthProvider,
  ProfilePort,
  UserProfile,
} from './application/ports.ts';
