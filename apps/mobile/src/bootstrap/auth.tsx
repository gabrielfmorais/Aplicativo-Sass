import type { AuthPort, AuthState, DeletionRequestPort } from '@app/core';
import { UNAUTHENTICATED } from '@app/core';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { createSupabaseAuthAdapter } from '@/infrastructure/supabase/auth-adapter';
import { supabase } from '@/infrastructure/supabase/client';
import { createDeletionRequestAdapter } from '@/infrastructure/supabase/deletion-request-adapter';
import { discardSessionIfFreshInstall } from '@/infrastructure/supabase/fresh-install';

type AuthContextValue = { state: AuthState | 'loading'; auth: AuthPort; deletion: DeletionRequestPort };
const AuthContext = createContext<AuthContextValue | null>(null);

/** Composition root for identity (SPEC-001). Redirect URL must be allow-listed in Supabase Auth. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState | 'loading'>('loading');
  const auth = useMemo(
    () => createSupabaseAuthAdapter(supabase, WebBrowser, Linking.createURL('auth/callback')),
    [],
  );
  const deletion = useMemo(
    () =>
      createDeletionRequestAdapter(supabase, () => {
        if (state === 'loading' || state.status !== 'authenticated') throw new Error('not authenticated');
        return state.session.userId;
      }),
    [state],
  );

  useEffect(() => {
    let active = true;
    discardSessionIfFreshInstall('sb-session')
      .then(() => auth.getState())
      .then((s) => active && setState(s))
      .catch(() => active && setState(UNAUTHENTICATED));
    const unsubscribe = auth.onStateChange((s) => active && setState(s));
    // Refresh only while the app is in the foreground (SPEC-001 §10).
    const sub = AppState.addEventListener('change', (status) =>
      status === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh(),
    );
    return () => {
      active = false;
      unsubscribe();
      sub.remove();
    };
  }, [auth]);

  return <AuthContext.Provider value={{ state, auth, deletion }}>{children}</AuthContext.Provider>;
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
