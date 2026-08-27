import type { HairProfilePort, HairProfileSnapshot } from '@app/core';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/bootstrap/auth';
import { AccountScreen } from '@/features/account/AccountScreen';
import { SignInScreen } from '@/features/auth/SignInScreen';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';

/** Authenticated home: onboarding until a hair-profile snapshot exists, then the account screen. */
function AuthenticatedApp({ hairProfile }: { hairProfile: HairProfilePort }) {
  const { auth, deletion } = useAuth();
  // 'loading' → checking; 'error' → read failed (retry); null → no snapshot yet; snapshot → onboarded.
  const [profile, setProfile] = useState<'loading' | 'error' | HairProfileSnapshot | null>('loading');

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
  return <AccountScreen auth={auth} deletion={deletion} />;
}

/** Single route: authentication then hair-profile onboarding decide what is shown (SPEC-001/SPEC-002). */
export default function IndexRoute() {
  const { state, auth, hairProfile } = useAuth();
  if (state === 'loading') return null;
  if (state.status !== 'authenticated') return <SignInScreen auth={auth} />;
  return <AuthenticatedApp hairProfile={hairProfile} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  button: { padding: 14, borderWidth: 1, borderRadius: 8, alignItems: 'center', minHeight: 48 },
});
