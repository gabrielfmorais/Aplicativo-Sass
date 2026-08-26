import { cryptoIdGenerator, isUuid, uuidFromString } from './ids.js';

describe('ids', () => {
  it('generates valid v4 uuids from Web Crypto', () => {
    const id = cryptoIdGenerator.next();
    expect(isUuid(id)).toBe(true);
    expect(cryptoIdGenerator.next()).not.toBe(id);
  });
  it('validates strings', () => {
    expect(isUuid('nope')).toBe(false);
    expect(() => uuidFromString('nope')).toThrow(TypeError);
    expect(uuidFromString('123e4567-e89b-42d3-a456-426614174000')).toBe(
      '123e4567-e89b-42d3-a456-426614174000',
    );
  });
});
