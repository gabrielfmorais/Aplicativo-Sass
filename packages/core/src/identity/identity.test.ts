import { EmailSchema, OtpCodeSchema, redactEmail, redactForLog } from './index.ts';

describe('identity: input validation at the trust boundary', () => {
  it('normalises and validates emails', () => {
    expect(EmailSchema.parse('  Ana@Example.COM ')).toBe('ana@example.com');
    expect(EmailSchema.safeParse('not-an-email').success).toBe(false);
  });
  it('accepts only 6-digit codes', () => {
    expect(OtpCodeSchema.parse(' 123456 ')).toBe('123456');
    expect(OtpCodeSchema.safeParse('12345').success).toBe(false);
    expect(OtpCodeSchema.safeParse('abcdef').success).toBe(false);
  });
});

describe('identity: redaction (AC11)', () => {
  it('masks emails and strips credentials, recursively', () => {
    expect(redactEmail('ana@example.com')).toBe('a***@e***');
    const out = redactForLog({
      email: 'ana@example.com',
      access_token: 'eyJ...',
      refresh_token: 'r',
      otp: '123456',
      nested: { id_token: 'x', userId: 'u-1', provider_payload: { name: 'Ana' } },
      list: [{ code: '1' }],
    }) as Record<string, unknown>;
    expect(out).toEqual({
      email: 'a***@e***',
      access_token: '[redacted]',
      refresh_token: '[redacted]',
      otp: '[redacted]',
      nested: { id_token: '[redacted]', userId: 'u-1', provider_payload: '[redacted]' },
      list: [{ code: '[redacted]' }],
    });
    expect(JSON.stringify(out)).not.toMatch(/eyJ|123456|Ana/);
  });
});
