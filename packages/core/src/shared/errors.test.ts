import {
  AuthorizationError,
  ConflictError,
  DomainError,
  InfrastructureError,
  NotFoundError,
  ValidationError,
  isAppError,
} from './errors.ts';

describe('typed errors', () => {
  it('carry kind, code and a user-safe message', () => {
    const e = new DomainError('plan.no_active', 'no active plan for user');
    expect(e.kind).toBe('domain');
    expect(e.code).toBe('plan.no_active');
    expect(e.name).toBe('DomainError');
    expect(e.userMessage).not.toContain('user');
    expect(isAppError(e)).toBe(true);
    expect(isAppError(new Error('x'))).toBe(false);
  });

  it('validation errors expose field issues', () => {
    const e = new ValidationError([{ path: 'timezone', message: 'invalid' }]);
    expect(e.kind).toBe('validation');
    expect(e.issues[0]?.path).toBe('timezone');
  });

  it('not-found and authorization are distinct kinds but both generic to users', () => {
    expect(new NotFoundError().kind).toBe('not_found');
    expect(new AuthorizationError().kind).toBe('authorization');
    expect(new AuthorizationError().userMessage).not.toMatch(/denied|policy|rls/i);
  });

  it('infrastructure errors are retryable by default and keep the cause', () => {
    const cause = new Error('socket');
    const e = new InfrastructureError('db.unreachable', 'db down', { cause });
    expect(e.retryable).toBe(true);
    expect(e.cause).toBe(cause);
    expect(new InfrastructureError('x', 'y', { retryable: false }).retryable).toBe(false);
    expect(new ConflictError().kind).toBe('conflict');
  });
});
