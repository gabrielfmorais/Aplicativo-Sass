import { err, isErr, isOk, mapResult, ok, unwrap } from './result.js';

describe('Result', () => {
  it('ok/err discriminate', () => {
    expect(isOk(ok(1))).toBe(true);
    expect(isErr(err('e'))).toBe(true);
    expect(isOk(err('e'))).toBe(false);
  });
  it('mapResult only maps ok', () => {
    expect(mapResult(ok(2), (v) => v * 2)).toEqual(ok(4));
    const e = err('boom');
    expect(mapResult(e, (v: number) => v * 2)).toBe(e);
  });
  it('unwrap returns value or throws error', () => {
    expect(unwrap(ok('v'))).toBe('v');
    expect(() => unwrap(err(new Error('x')))).toThrow('x');
  });
});
