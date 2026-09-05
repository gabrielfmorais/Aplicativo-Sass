import type {
  AuthPort,
  AuthState,
  CareTrackingPort,
  DeletionRequestPort,
  EntitlementsPort,
  InsightsPort,
  HairEventPort,
  HairPlanPort,
  HairProfilePort,
  Instant,
  LocalDate,
  NotificationPreferencesPort,
  NotificationSchedulerPort,
  PlanPreferencesPort,
  ProductPort,
  ProfilePort,
  JourneyPort,
  SharePort,
  OilRoutinePort,
  WashDayPort,
} from '@app/core';
import { UNAUTHENTICATED, cryptoIdGenerator, systemClock, toLocalDate } from '@app/core';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { createSupabaseAuthAdapter } from '@/infrastructure/supabase/auth-adapter';
import { supabase } from '@/infrastructure/supabase/client';
import { createDeletionRequestAdapter } from '@/infrastructure/supabase/deletion-request-adapter';
import { createDevSignIn } from '@/infrastructure/supabase/dev-sign-in';
import { createCareTrackingAdapter } from '@/infrastructure/supabase/care-tracking-adapter';
import { createEntitlementsAdapter } from '@/infrastructure/supabase/entitlements-adapter';
import { createInsightsAdapter } from '@/infrastructure/supabase/insights-adapter';
import { createHairEventAdapter } from '@/infrastructure/supabase/hair-event-adapter';
import { createHairPlanAdapter } from '@/infrastructure/supabase/hair-plan-adapter';
import { createHairProfileAdapter } from '@/infrastructure/supabase/hair-profile-adapter';
import { createNotificationPreferencesAdapter } from '@/infrastructure/supabase/notification-preferences-adapter';
import { createPlanPreferencesAdapter } from '@/infrastructure/supabase/plan-preferences-adapter';
import { createProductAdapter } from '@/infrastructure/supabase/product-adapter';
import { createJourneyAdapter } from '@/infrastructure/supabase/journey-adapter';
import { createShareAdapter } from '@/infrastructure/sharing/share-adapter';
import { createOilRoutineAdapter } from '@/infrastructure/supabase/oil-routine-adapter';
import { createWashDayAdapter } from '@/infrastructure/supabase/wash-day-adapter';
import { createProfileAdapter } from '@/infrastructure/supabase/profile-adapter';
import { createLocalNotificationAdapter } from '@/infrastructure/notifications/local-notification-adapter';
import { discardSessionIfFreshInstall } from '@/infrastructure/supabase/fresh-install';

type AuthContextValue = {
  state: AuthState | 'loading';
  auth: AuthPort;
  deletion: DeletionRequestPort;
  hairProfile: HairProfilePort;
  hairPlan: HairPlanPort;
  careTracking: CareTrackingPort;
  entitlements: EntitlementsPort;
  insights: InsightsPort;
  notificationPreferences: NotificationPreferencesPort;
  planPreferences: PlanPreferencesPort;
  /** SPEC-020 — o que ela declara que mudou no cabelo dela. */
  hairEvents: HairEventPort;
  /** SPEC-023 — a prateleira dela. */
  products: ProductPort;
  /** SPEC-024 — o que ela realmente usou num cuidado. */
  washDays: WashDayPort;
  /** SPEC-040 (F39) — a rotina de óleo dela. */
  oil: OilRoutinePort;
  /** SPEC-043 (F40/F41/F42) — a Jornada dela. */
  journey: JourneyPort;
  share: SharePort;
  /** SPEC-018 — o nome escolhido por ela; a única coisa em `profiles`. */
  profile: ProfilePort;
  notificationScheduler: NotificationSchedulerPort;
  /** The user's civil day (ADR-008): the composition root owns the clock, screens never read it. */
  today: () => LocalDate;
  /** Current instant — used only to decide whether the undo window is still open (SPEC-005). */
  now: () => Instant;
  /** The device's IANA timezone; the server computes the civil day from it (SPEC-005 §9/T22). */
  timeZone: () => string;
  /** Fresh idempotency key for a user-initiated server write (SPEC-004 AC9 / SPEC-005 AC14). */
  newRequestId: () => string;
  /**
   * DEV-ONLY web sign-in (D-85). `null` in every build a user could ever hold — see the four guards
   * in `dev-sign-in.ts`. The official flows do not go through here.
   */
  devSignIn: (() => Promise<void>) | null;
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
  const planPreferences = useMemo(
    () =>
      createPlanPreferencesAdapter(supabase, () => {
        if (state === 'loading' || state.status !== 'authenticated') throw new Error('not authenticated');
        return state.session.userId;
      }),
    [state],
  );
  const profile = useMemo(
    () =>
      createProfileAdapter(supabase, () => {
        if (state === 'loading' || state.status !== 'authenticated') throw new Error('not authenticated');
        return state.session.userId;
      }),
    [state],
  );
  const notificationScheduler = useMemo(() => createLocalNotificationAdapter(), []);

  const hairPlan = useMemo(() => createHairPlanAdapter(supabase), []);
  // Sem `userId`: a leitura é decidida por RLS e toda escrita passa por RPC (SPEC-020 §10).
  const hairEvents = useMemo(() => createHairEventAdapter(supabase), []);
  const products = useMemo(
    () =>
      createProductAdapter(
        supabase,
        () => {
          if (state === 'loading' || state.status !== 'authenticated') throw new Error('not authenticated');
          return state.session.userId;
        },
        () => systemClock.now(),
      ),
    [state],
  );
  const washDays = useMemo(
    () =>
      createWashDayAdapter(supabase, () => {
        if (state === 'loading' || state.status !== 'authenticated') throw new Error('not authenticated');
        return state.session.userId;
      }),
    [state],
  );
  // Sem `userId`: leitura por RLS, escrita só por RPC — o dia civil e a idempotência são do
  // servidor (SPEC-040 §7).
  const oil = useMemo(() => createOilRoutineAdapter(supabase), []);
  // SPEC-043 — leitura por RLS; conceder é RPC, e a usuária nunca manda pontos.
  const journey = useMemo(() => createJourneyAdapter(supabase), []);
  /** SPEC-044 — o share é porta de **plataforma**, não de servidor: nada aqui fala com o Supabase. */
  const share = useMemo(() => createShareAdapter(), []);
  const careTracking = useMemo(
    () =>
      // SPEC-051 — `userId` só para a marcação do check-in, a única escrita direta desta porta.
      createCareTrackingAdapter(supabase, () => {
        if (state === 'loading' || state.status !== 'authenticated') throw new Error('not authenticated');
        return state.session.userId;
      }),
    [state],
  );
  const entitlements = useMemo(() => createEntitlementsAdapter(supabase), []);
  /** SPEC-047 (P2) — leitura do histórico dela para observar repetições. Só leitura, só dela. */
  const insights = useMemo(() => createInsightsAdapter(supabase), []);
  const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
  const devSignIn = useMemo(() => createDevSignIn(supabase), []);

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
        entitlements,
        insights,
        notificationPreferences,
        planPreferences,
        hairEvents,
        products,
        washDays,
        oil,
        journey,
        share,
        profile,
        notificationScheduler,
        today: () => toLocalDate(systemClock.now(), timeZone()),
        now: () => systemClock.now(),
        timeZone,
        newRequestId: () => cryptoIdGenerator.next(),
        devSignIn,
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
