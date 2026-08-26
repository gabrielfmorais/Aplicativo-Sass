/**
 * Typed error hierarchy (SYSTEM-ARCHITECTURE §10).
 * `userMessage` is safe to show to the user; `message` is for logs only and
 * must never contain tokens, SQL or personal data.
 */
export type AppErrorKind =
  'domain' | 'validation' | 'authorization' | 'not_found' | 'conflict' | 'infrastructure';

export abstract class AppError extends Error {
  abstract readonly kind: AppErrorKind;
  /** Message safe for end users (generic, localisable key or text). */
  readonly userMessage: string;
  /** Stable machine-readable code, e.g. `care.already_completed`. */
  readonly code: string;
  override readonly cause?: unknown;

  protected constructor(code: string, message: string, userMessage: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.userMessage = userMessage;
    if (cause !== undefined) this.cause = cause;
  }
}

/** An invariant of the domain was violated. */
export class DomainError extends AppError {
  readonly kind = 'domain' as const;
  constructor(code: string, message: string, userMessage = 'Não foi possível concluir a operação.') {
    super(code, message, userMessage);
  }
}

/** External input failed schema validation. `issues` are field-level and user-safe. */
export class ValidationError extends AppError {
  readonly kind = 'validation' as const;
  readonly issues: ReadonlyArray<{ path: string; message: string }>;
  constructor(issues: ReadonlyArray<{ path: string; message: string }>, code = 'validation.failed') {
    super(
      code,
      `Validation failed: ${issues.map((i) => i.path).join(', ')}`,
      'Verifique os dados informados.',
    );
    this.issues = issues;
  }
}

/** The caller is not allowed to perform the action. Never reveals why. */
export class AuthorizationError extends AppError {
  readonly kind = 'authorization' as const;
  constructor(code = 'authorization.denied', message = 'Authorization denied') {
    super(code, message, 'Você não tem acesso a este recurso.');
  }
}

/**
 * Resource does not exist OR is not accessible by the caller.
 * Deliberately indistinguishable from AuthorizationError at the API edge (anti-enumeration).
 */
export class NotFoundError extends AppError {
  readonly kind = 'not_found' as const;
  constructor(code = 'not_found', message = 'Not found') {
    super(code, message, 'Não encontrado.');
  }
}

/** Idempotency / version conflict. Callers should usually reconcile silently. */
export class ConflictError extends AppError {
  readonly kind = 'conflict' as const;
  constructor(code = 'conflict', message = 'Conflict') {
    super(code, message, 'Essa ação já foi registrada.');
  }
}

/** Network, database or provider failure. Retryable by default. */
export class InfrastructureError extends AppError {
  readonly kind = 'infrastructure' as const;
  readonly retryable: boolean;
  constructor(code: string, message: string, options: { retryable?: boolean; cause?: unknown } = {}) {
    super(code, message, 'Algo deu errado. Tente novamente.', options.cause);
    this.retryable = options.retryable ?? true;
  }
}

export const isAppError = (value: unknown): value is AppError => value instanceof AppError;
