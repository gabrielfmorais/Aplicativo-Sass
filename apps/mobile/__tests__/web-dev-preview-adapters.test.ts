import { createLocalNotificationAdapter } from '@/infrastructure/notifications/local-notification-adapter.web';
import { discardSessionIfFreshInstall } from '@/infrastructure/supabase/fresh-install.web';
import { secureSessionStorage } from '@/infrastructure/supabase/secure-session-storage.web';

/**
 * The web builds exist only for the development preview (docs/runbooks/WEB-DEV-PREVIEW.md, D-80).
 * These tests pin the two properties that make them safe to keep around: the session never reaches
 * a storage an XSS could read, and notifications never claim a permission the platform cannot
 * honour. Both are exactly the kind of thing a later "let's make web nicer" change would undo.
 */
describe('web dev-preview adapters', () => {
  it('keeps the session in memory only — never in a browser store (D-53/D-59/D-80)', async () => {
    const store = { setItem: jest.fn(), getItem: jest.fn(), removeItem: jest.fn() };
    Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true });
    Object.defineProperty(globalThis, 'sessionStorage', { value: store, configurable: true });

    await secureSessionStorage.setItem('k', 'refresh-token');
    expect(await secureSessionStorage.getItem('k')).toBe('refresh-token');
    await secureSessionStorage.removeItem('k');
    expect(await secureSessionStorage.getItem('k')).toBeNull();

    expect(store.setItem).not.toHaveBeenCalled();
    expect(store.getItem).not.toHaveBeenCalled();
  });

  it('never grants notification permission and schedules nothing (fail closed)', async () => {
    const adapter = createLocalNotificationAdapter();
    expect(await adapter.ensurePermission()).toBe(false);
    await expect(adapter.reconcile([])).resolves.toBeUndefined();
  });

  it('has no fresh-install marker to write — every page load is already a fresh install', async () => {
    await expect(discardSessionIfFreshInstall('sb-key')).resolves.toBeUndefined();
  });
});
