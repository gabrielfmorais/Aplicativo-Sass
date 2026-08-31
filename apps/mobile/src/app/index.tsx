import type {
  CareBoard,
  CareTrackingPort,
  HairPlanPort,
  HairProfilePort,
  HairProfileSnapshot,
  Instant,
  LocalDate,
  NotificationPreferences,
  NotificationPreferencesPort,
  NotificationSchedulerPort,
  PlanPreferencesPort,
} from '@app/core';
import { DEFAULT_NOTIFICATION_PREFERENCES, buildNotificationIntents, buildTodayView } from '@app/core';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { Button, Card, Loading, Screen, Stack, Text } from '@/design/primitives';

import { useAuth } from '@/bootstrap/auth';
import { AccountScreen } from '@/features/account/AccountScreen';
import { DevSignIn } from '@/features/auth/DevSignIn';
import { SignInScreen } from '@/features/auth/SignInScreen';
import { TodayScreen } from '@/features/care/TodayScreen';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { PlanScreen } from '@/features/plan/PlanScreen';
import { reasonOf } from '@/shared/failure-detail';

type Loadable<T> = 'loading' | 'error' | T;

/** The device's wall clock as `HH:MM`, so the pure builder can skip a slot that already passed. */
const localTimeOf = (instant: Instant): string =>
  new Date(instant).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false });

/**
 * The shared failure surface. Every load that can fail lands here, so it is worth being a real
 * screen rather than a bare sentence: the message, one action, and — only under `__DEV__` — the
 * reason (D-87/D-90).
 */
function Retry({ text, detail, onRetry }: { text: string; detail?: string; onRetry: () => void }) {
  return (
    <Screen scroll={false} style={styles.center}>
      <Card>
        <Stack gap="lg">
          <Text variant="heading" accessibilityLiveRegion="polite">
            {text}
          </Text>
          <Button label="Tentar novamente" onPress={onRetry} />
          {__DEV__ && detail ? (
            <Text variant="caption" tone="faint">
              {detail}
            </Text>
          ) : null}
        </Stack>
      </Card>
    </Screen>
  );
}

/**
 * Authenticated home. Three gates, each answered by one read:
 * no hair profile → onboarding (SPEC-002); no active plan → preview and confirmation (SPEC-004);
 * active plan → the daily screen (SPEC-005). The account stays reachable from either plan screen.
 */
function AuthenticatedApp({
  hairProfile,
  hairPlan,
  careTracking,
  notificationPreferences,
  notificationScheduler,
  planPreferences,
  today,
  now,
  timeZone,
  newRequestId,
}: {
  hairProfile: HairProfilePort;
  hairPlan: HairPlanPort;
  careTracking: CareTrackingPort;
  notificationPreferences: NotificationPreferencesPort;
  notificationScheduler: NotificationSchedulerPort;
  planPreferences: PlanPreferencesPort;
  today: () => LocalDate;
  now: () => Instant;
  timeZone: () => string;
  newRequestId: () => string;
}) {
  const { auth, deletion, entitlements } = useAuth();
  const [profile, setProfile] = useState<Loadable<HairProfileSnapshot | null>>('loading');
  const [board, setBoard] = useState<Loadable<CareBoard | null>>('loading');
  const [showAccount, setShowAccount] = useState(false);
  /**
   * SPEC-014 — reassessment reuses the screens that already exist, so it is a mode rather than a
   * route: 'profile' asks the same questions again, 'preview' shows what she would get. Nothing is
   * replaced until she confirms, so leaving at either step leaves the active plan untouched (G3).
   */
  const [reassessing, setReassessing] = useState<null | 'profile' | 'preview'>(null);
  // Why the last load failed. Rendered only under __DEV__ (D-87).
  const [failure, setFailure] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);

  // Read once per session. A failure is treated as "off": not notifying is always safer than
  // notifying from a preference we could not confirm (SPEC-008 §16, fail closed).
  useEffect(() => {
    let active = true;
    notificationPreferences
      .get()
      .then((p) => active && setPrefs(p ?? DEFAULT_NOTIFICATION_PREFERENCES))
      .catch(() => active && setPrefs(DEFAULT_NOTIFICATION_PREFERENCES));
    return () => {
      active = false;
    };
  }, [notificationPreferences]);

  const loadProfile = useCallback(() => {
    setProfile('loading');
    let active = true;
    hairProfile
      .getCurrent()
      // A read that fails is NOT the same as a user with no profile: treating it as "no profile"
      // would push her into onboarding and risk a second snapshot. Absence is `null` (SPEC-002).
      .then((p) => active && setProfile(p))
      .catch((error: unknown) => {
        if (!active) return;
        setFailure(reasonOf(error));
        setProfile('error');
      });
    return () => {
      active = false;
    };
  }, [hairProfile]);
  useEffect(() => loadProfile(), [loadProfile]);

  const loadBoard = useCallback(() => {
    setBoard('loading');
    let active = true;
    careTracking
      .getBoard()
      .then((b) => active && setBoard(b))
      .catch((error: unknown) => {
        if (!active) return;
        setFailure(reasonOf(error));
        setBoard('error');
      });
    return () => {
      active = false;
    };
  }, [careTracking]);
  // Only worth reading once there is a profile: without one there cannot be a plan.
  useEffect(() => {
    if (profile && profile !== 'loading' && profile !== 'error') return loadBoard();
  }, [profile, loadBoard]);

  // FR8 — reconcile whenever the board or the preference changes, which is exactly when the right
  // set of reminders can differ: a care completed, a plan regenerated, reminders turned off.
  const board_ = board;
  useEffect(() => {
    if (board_ === 'loading' || board_ === 'error') return;
    const intents = board_
      ? buildNotificationIntents({
          view: buildTodayView(board_.cares, board_.executions, today(), board_.checkIns),
          preferences: prefs,
          today: today(),
          nowLocalTime: localTimeOf(now()),
        })
      : [];
    void notificationScheduler.reconcile(intents).catch(() => {
      // Scheduling is best effort: a failure here must not break the daily screen, and it must not
      // be reported as success either — the preference stays exactly as the server has it.
    });
  }, [board_, prefs, notificationScheduler, today, now]);

  if (profile === 'loading') return <Loading label="Carregando seu perfil…" />;
  if (profile === 'error') {
    return (
      <Retry
        text="Não foi possível carregar seu perfil."
        {...(failure ? { detail: failure } : {})}
        onRetry={loadProfile}
      />
    );
  }
  if (!profile) return <OnboardingScreen hairProfile={hairProfile} onSaved={setProfile} />;

  if (reassessing === 'profile') {
    return (
      <OnboardingScreen
        hairProfile={hairProfile}
        onSaved={(snapshot) => {
          setProfile(snapshot);
          setReassessing('preview');
        }}
        onCancel={() => setReassessing(null)}
      />
    );
  }
  if (reassessing === 'preview') {
    return (
      <PlanScreen
        profile={profile}
        plans={hairPlan}
        today={today()}
        newRequestId={newRequestId}
        entitlements={entitlements}
        planPreferences={planPreferences}
        onCreated={() => {
          setReassessing(null);
          loadBoard();
        }}
        onCancel={() => setReassessing(null)}
      />
    );
  }

  if (showAccount) {
    return (
      <AccountScreen
        auth={auth}
        deletion={deletion}
        entitlements={entitlements}
        planPreferences={planPreferences}
        notificationPreferences={notificationPreferences}
        notificationScheduler={notificationScheduler}
        onNotificationPreferencesChanged={setPrefs}
        onBack={() => setShowAccount(false)}
        {...(board && board !== 'loading' && board !== 'error'
          ? {
              onReassess: () => {
                setShowAccount(false);
                setReassessing('profile');
              },
              onCustomize: () => {
                setShowAccount(false);
                setReassessing('preview');
              },
            }
          : {})}
      />
    );
  }

  if (board === 'loading') return <Loading label="Carregando seus cuidados…" />;
  if (board === 'error') {
    return (
      <Retry
        text="Não foi possível carregar seus cuidados."
        {...(failure ? { detail: failure } : {})}
        onRetry={loadBoard}
      />
    );
  }
  if (!board) {
    return (
      <PlanScreen
        profile={profile}
        plans={hairPlan}
        today={today()}
        newRequestId={newRequestId}
        entitlements={entitlements}
        planPreferences={planPreferences}
        onCreated={loadBoard}
        onOpenAccount={() => setShowAccount(true)}
      />
    );
  }
  return (
    <TodayScreen
      board={board}
      care={careTracking}
      today={today()}
      now={now}
      timeZone={timeZone()}
      newExecutionId={newRequestId}
      onChanged={loadBoard}
      onOpenAccount={() => setShowAccount(true)}
      onReassess={() => setReassessing('profile')}
    />
  );
}

/** Single route: authentication, then hair profile, then plan, then the daily loop. */
export default function IndexRoute() {
  const {
    state,
    auth,
    hairProfile,
    hairPlan,
    careTracking,
    notificationPreferences,
    notificationScheduler,
    planPreferences,
    today,
    now,
    timeZone,
    newRequestId,
    devSignIn,
  } = useAuth();
  if (state === 'loading') return <Loading />;
  if (state.status !== 'authenticated') {
    // The dev entry sits *beside* the real screen, never inside it: the official Apple / Google /
    // email flows are untouched, and in any build a user could hold `devSignIn` is null (D-85).
    return (
      <>
        <SignInScreen auth={auth} />
        {devSignIn ? <DevSignIn onPress={devSignIn} /> : null}
      </>
    );
  }
  return (
    <AuthenticatedApp
      hairProfile={hairProfile}
      hairPlan={hairPlan}
      careTracking={careTracking}
      notificationPreferences={notificationPreferences}
      notificationScheduler={notificationScheduler}
      planPreferences={planPreferences}
      today={today}
      now={now}
      timeZone={timeZone}
      newRequestId={newRequestId}
    />
  );
}

const styles = StyleSheet.create({
  center: { flexGrow: 1, justifyContent: 'center' },
});
