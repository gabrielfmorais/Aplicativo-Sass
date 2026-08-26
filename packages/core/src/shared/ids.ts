/**
 * Id generation via Web Crypto (available on Hermes/Expo, Node ≥ 19 and Deno).
 * Engines never call this directly — ids are inputs; use cases receive an `IdGenerator` port.
 */
export type Uuid = string & { readonly __brand: 'Uuid' };

export interface IdGenerator {
  next(): Uuid;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): value is Uuid => UUID_RE.test(value);

export const uuidFromString = (value: string): Uuid => {
  if (!isUuid(value)) throw new TypeError('Invalid UUID');
  return value as Uuid;
};

/**
 * Web Crypto surface we rely on. Declared locally because core compiles with `lib: ES2022`
 * only (no DOM, no @types/node) so that nothing runtime-specific leaks in.
 */
type WebCryptoLike = { randomUUID(): string };
const webCrypto = (): WebCryptoLike => {
  const c = (globalThis as unknown as { crypto?: WebCryptoLike }).crypto;
  if (!c || typeof c.randomUUID !== 'function') throw new Error('Web Crypto randomUUID is not available');
  return c;
};

/** Default generator backed by the host's Web Crypto implementation (Hermes, Node ≥ 19, Deno). */
export const cryptoIdGenerator: IdGenerator = {
  next: () => webCrypto().randomUUID() as Uuid,
};
