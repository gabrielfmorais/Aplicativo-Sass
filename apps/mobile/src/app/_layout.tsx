import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';

import { AuthProvider } from '@/bootstrap/auth';
import { SafeAreaRoot } from '@/design/safe-area';

/** Root layout. Composition only — no business logic here (ADR-001). */
export default function RootLayout() {
  return (
    /**
     * SPEC-060 FR1 — a área segura nasce aqui, e com `initialWindowMetrics` por dentro: sem ela o
     * primeiro frame sai com inset 0 e o segundo com 59, e o que se vê ao abrir o app no iPhone é o
     * cabeçalho pulando.
     */
    <SafeAreaRoot>
      {/*
        SPEC-060 FR8 — a barra de status declarada, não herdada por acaso. O app é
        `userInterfaceStyle: "light"` sobre um canvas osso, então o conteúdo dela é escuro.
      */}
      <StatusBar style="dark" />
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </SafeAreaRoot>
  );
}
