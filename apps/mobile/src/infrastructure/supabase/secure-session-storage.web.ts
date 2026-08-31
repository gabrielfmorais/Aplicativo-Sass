import type { SessionStorage } from './secure-session-storage';

/**
 * Web build of the session storage — **development preview only** (see
 * `docs/runbooks/WEB-DEV-PREVIEW.md`). The browser has no OS keychain, and the honest options are
 * memory or `localStorage`; `localStorage` would put a refresh token where any XSS can read it, so
 * this keeps the same rule the native adapter already follows: never fall back to insecure
 * storage (SPEC-001 §10, D-53/D-59).
 *
 * Consequence, on purpose: a full page reload signs you out. Fast Refresh keeps the module alive,
 * so editing a screen does not.
 */
const memory = new Map<string, string>();

export const secureSessionStorage: SessionStorage = {
  getItem: async (key) => memory.get(key) ?? null,
  setItem: async (key, value) => {
    memory.set(key, value);
  },
  removeItem: async (key) => {
    memory.delete(key);
  },
};
