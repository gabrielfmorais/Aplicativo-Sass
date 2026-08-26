/**
 * Minimal Result type for use cases that prefer explicit failure over thrown errors.
 * Kept intentionally small — no monadic library.
 */
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => !r.ok;

export const mapResult = <T, U, E>(r: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  r.ok ? ok(fn(r.value)) : r;

/** Unwrap or throw the error (use at the boundary, never in domain code). */
export const unwrap = <T, E>(r: Result<T, E>): T => {
  if (r.ok) return r.value;
  throw r.error;
};
