import { Stack } from 'expo-router';

/** Root layout. Composition only — no business logic here (ADR-001). */
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
