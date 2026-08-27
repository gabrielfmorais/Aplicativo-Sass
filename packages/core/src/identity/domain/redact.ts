/**
 * Redaction for application-controlled logs/telemetry (SPEC-001 BR9 / AC11).
 * Anything that looks like a credential is replaced; emails are masked.
 */
const SECRET_KEY = /token|otp|code|secret|password|authorization|payload|session|jwt|key$/i;

export const redactEmail = (email: string): string => {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain.slice(0, 1)}***`;
};

export const redactForLog = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redactForLog);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SECRET_KEY.test(k)
          ? '[redacted]'
          : /email/i.test(k) && typeof v === 'string'
            ? redactEmail(v)
            : redactForLog(v),
      ]),
    );
  }
  return value;
};
