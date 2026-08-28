import type {
  AuthPort,
  AuthState,
  CareTrackingPort,
  DeletionRequestPort,
  HairPlanPort,
  HairProfilePort,
  Instant,
  LocalDate,
  NotificationPreferencesPort,
  NotificationSchedulerPort,
} from '@app/core';
import { UNAUTHENTICATED, cryptoIdGenerator, systemClock, toLocalDate } from '@app/core';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { createSupabaseAuthAdapter } from '@/infrastructure/supabase/auth-adapter';
import { supabase } from '@/infrastructure/supabase/client';
import { createDeletionRequestAdapter } from '@/infrastructure/supabase/deletion-request-adapter';
import { createCareTrackingAdapter } from '@/infrastructure/supabase/care-tracking-adapter';
import { createHairPlanAdapter } from '@/infrastructure/supabase/hair-plan-adapter';
import { createHairProfileAdapter } from '@/infrastructure/supabase/hair-profile-adapter';
import { createNotificationPreferencesAdapter } from '@/infrastructure/supabase/notification-preferences-adapter';
import { createLocalNotificationAdapter } from '@/infrastructure/notifications/local-notification-adapter';
import { discardSessionIfFreshInstall } from '@/infrastructure/supabase/fresh-install';

type AuthContextValue = {
  state: AuthState | 'loading';
  auth: AuthPort;
  deletion: DeletionRequestPort;
  hairProfile: HairProfilePort;
  hairPlan: HairPlanPort;
  careTracking: CareTrackingPort;
  notificationPreferences: NotificationPreferencesPort;
  notificationScheduler: NotificationSchedulerPort;
  /** The user's civil day (ADR-008): the composition root owns the clock, screens never read it. */
  today: () => LocalDate;
  /** Current instant — used only to decide whether the undo window is still open (SPEC-005). */
  now: () => Instant;
  /** The device's IANA timezone; the server computes the civil day from it (SPEC-005 §9/T22). */
  timeZone: () => string;
  /** Fresh idempotency key for a user-initiated server write (SPEC-004 AC9 / SPEC-005 AC14). */
  newRequestId: () => string;
};
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
  const hairProfile = useMemo(
    () =>
      createHairProfileAdapter(supabase, () => {
        if (state === 'loading' || state.status !== 'authenticated') throw new Error('not authenticated');
        return state.session.userId;
      }),
    [state],
  );

  const notificationPreferences = useMemo(
    () =>
      createNotificationPreferencesAdapter(supabase, () => {
        if (state === 'loading' || state.status !== 'authenticated') throw new Error('not authenticated');
        return state.session.userId;
      }),
    [state],
  );
  const notificationScheduler = useMemo(() => createLocalNotificationAdapter(), []);

  const hairPlan = useMemo(() => createHairPlanAdapter(supabase), []);
  const careTracking = useMemo(() => createCareTrackingAdapter(supabase), []);
  const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

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

  return (
    <AuthContext.Provider
      value={{
        state,
        auth,
        deletion,
        hairProfile,
        hairPlan,
        careTracking,
        notificationPreferences,
        notificationScheduler,
        today: () => toLocalDate(systemClock.now(), timeZone()),
        now: () => systemClock.now(),
        timeZone,
        newRequestId: () => cryptoIdGenerator.next(),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
