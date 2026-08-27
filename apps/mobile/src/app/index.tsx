import type { HairPlanPort, HairProfilePort, HairProfileSnapshot, LocalDate } from '@app/core';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/bootstrap/auth';
import { AccountScreen } from '@/features/account/AccountScreen';
import { SignInScreen } from '@/features/auth/SignInScreen';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { PlanScreen } from '@/features/plan/PlanScreen';

/**
 * Authenticated home: onboarding until a hair-profile snapshot exists (SPEC-002), then the plan —
 * preview + confirmation while there is no active plan, the active schedule afterwards (SPEC-004).
 * The account screen stays reachable from the plan.
 */
function AuthenticatedApp({
  hairProfile,
  hairPlan,
  today,
  newRequestId,
}: {
  hairProfile: HairProfilePort;
  hairPlan: HairPlanPort;
  today: () => LocalDate;
  newRequestId: () => string;
}) {
  const { auth, deletion } = useAuth();
  // 'loading' → checking; 'error' → read failed (retry); null → no snapshot yet; snapshot → onboarded.
  const [profile, setProfile] = useState<'loading' | 'error' | HairProfileSnapshot | null>('loading');
  const [showAccount, setShowAccount] = useState(false);

  const load = useCallback(() => {
    setProfile('loading');
    let active = true;
    hairProfile
      .getCurrent()
      .then((p) => active && setProfile(p))
      .catch(() => active && setProfile('error'));
    return () => {
      active = false;
    };
  }, [hairProfile]);
  useEffect(() => load(), [load]);

  if (profile === 'loading') return null;
  if (profile === 'error') {
    return (
      <View style={styles.center}>
        <Text accessibilityLiveRegion="polite">Não foi possível carregar seu perfil.</Text>
        <Pressable style={styles.button} onPress={load} accessibilityRole="button">
          <Text>Tentar novamente</Text>
        </Pressable>
      </View>
    );
  }
  if (!profile) return <OnboardingScreen hairProfile={hairProfile} onSaved={setProfile} />;
  if (showAccount) {
    return (
      <View style={styles.stack}>
        <AccountScreen auth={auth} deletion={deletion} />
        <Pressable style={styles.button} onPress={() => setShowAccount(false)} accessibilityRole="button">
          <Text>Voltar ao cronograma</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <PlanScreen
      profile={profile}
      plans={hairPlan}
      today={today()}
      newRequestId={newRequestId}
      onOpenAccount={() => setShowAccount(true)}
    />
  );
}

/** Single route: authentication, then hair profile, then plan (SPEC-001/SPEC-002/SPEC-004). */
export default function IndexRoute() {
  const { state, auth, hairProfile, hairPlan, today, newRequestId } = useAuth();
  if (state === 'loading') return null;
  if (state.status !== 'authenticated') return <SignInScreen auth={auth} />;
  return (
    <AuthenticatedApp
      hairProfile={hairProfile}
      hairPlan={hairPlan}
      today={today}
      newRequestId={newRequestId}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  stack: { flex: 1, padding: 24, gap: 12 },
  button: { padding: 14, borderWidth: 1, borderRadius: 8, alignItems: 'center', minHeight: 48 },
});
