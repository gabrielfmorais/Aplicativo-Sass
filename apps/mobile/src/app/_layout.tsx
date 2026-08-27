import { Stack } from 'expo-router';

import { AuthProvider } from '@/bootstrap/auth';

/** Root layout. Composition only — no business logic here (ADR-001). */
export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
