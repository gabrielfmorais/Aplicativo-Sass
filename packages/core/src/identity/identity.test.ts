import {
  DISPLAY_NAME_MAX_LENGTH,
  DisplayNameSchema,
  EmailSchema,
  OtpCodeSchema,
  redactEmail,
  redactForLog,
} from './index.ts';

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

/**
 * SPEC-018 FR5 — o nome dela. As regras aqui espelham as constraints de `profiles`: o que o banco
 * recusa, a UI precisa recusar antes, para que o erro chegue como "faltou algo" e não como falha.
 */
describe('identity: display name (SPEC-018)', () => {
  it('normalises whitespace instead of rejecting it', () => {
    expect(DisplayNameSchema.parse('  Gabriela  ')).toBe('Gabriela');
    expect(DisplayNameSchema.parse('Ana   Maria')).toBe('Ana Maria');
  });
  it('refuses what the database refuses: empty, blank and over the limit', () => {
    expect(DisplayNameSchema.safeParse('').success).toBe(false);
    expect(DisplayNameSchema.safeParse('   ').success).toBe(false);
    expect(DisplayNameSchema.safeParse('a'.repeat(DISPLAY_NAME_MAX_LENGTH)).success).toBe(true);
    expect(DisplayNameSchema.safeParse('a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1)).success).toBe(false);
  });
  /** Um nome não é ASCII. Recusar acento ou hífen seria dizer a alguém que o nome dela está errado. */
  it('accepts the names people actually have', () => {
    for (const name of ['Maria José', "D'Ávila", 'Ana-Clara', 'Thaís', '晴']) {
      expect(DisplayNameSchema.safeParse(name).success).toBe(true);
    }
  });
});
