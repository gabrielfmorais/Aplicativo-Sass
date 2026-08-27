import type { AuthPort, OAuthProvider } from '@app/core';
import { EmailSchema, OtpCodeSchema } from '@app/core';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Phase = 'idle' | 'busy' | 'waiting_for_otp';

/**
 * Entry screen (SPEC-001 FR1/FR3/§14): Apple (iOS), Google, Email OTP with a typed 6-digit code.
 * Messages never reveal whether an email has an account (BR8).
 */
export function SignInScreen({ auth }: { auth: AuthPort }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const busy = phase === 'busy';

  /** Runs an auth operation; on failure shows a generic message and returns to `errorPhase`. */
  const run = async (op: () => Promise<Phase>, fallback: string, errorPhase: Phase) => {
    setPhase('busy');
    setMessage(null);
    try {
      setPhase(await op());
    } catch {
      setMessage(fallback);
      setPhase(errorPhase);
    }
  };

  const requestOtp = () => {
    const parsed = EmailSchema.safeParse(email);
    if (!parsed.success) return setMessage('Digite um email válido.');
    void run(
      async () => {
        await auth.requestOtp(parsed.data);
        setMessage('Se este email puder receber códigos, enviamos um agora.');
        return 'waiting_for_otp';
      },
      'Não foi possível enviar o código. Tente novamente.',
      phase === 'waiting_for_otp' ? 'waiting_for_otp' : 'idle',
    );
  };

  const verifyOtp = () => {
    const parsedCode = OtpCodeSchema.safeParse(code);
    if (!parsedCode.success) return setMessage('Digite os 6 dígitos do código.');
    void run(
      async () => {
        await auth.verifyOtp(EmailSchema.parse(email), parsedCode.data);
        return 'busy'; // session listener unmounts this screen
      },
      'Código inválido ou expirado.',
      'waiting_for_otp',
    );
  };

  const provider = (p: OAuthProvider) =>
    void run(
      async () => ((await auth.signInWithProvider(p)) ? 'busy' : 'idle'), // cancelled → idle, no error
      'Não foi possível entrar com esse provedor. Tente novamente.',
      'idle',
    );

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        Entrar
      </Text>
      {Platform.OS === 'ios' && (
        <Pressable
          style={styles.button}
          disabled={busy}
          onPress={() => provider('apple')}
          accessibilityRole="button"
        >
          <Text>Continuar com Apple</Text>
        </Pressable>
      )}
      <Pressable
        style={styles.button}
        disabled={busy}
        onPress={() => provider('google')}
        accessibilityRole="button"
      >
        <Text>Continuar com Google</Text>
      </Pressable>

      <TextInput
        style={styles.input}
        placeholder="seu@email.com"
        accessibilityLabel="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        editable={!busy && phase !== 'waiting_for_otp'}
        value={email}
        onChangeText={setEmail}
      />
      {phase === 'waiting_for_otp' ? (
        <>
          <TextInput
            style={styles.input}
            placeholder="Código de 6 dígitos"
            accessibilityLabel="Código"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            value={code}
            onChangeText={setCode}
          />
          <Pressable style={styles.button} disabled={busy} onPress={verifyOtp} accessibilityRole="button">
            <Text>Confirmar código</Text>
          </Pressable>
          <Pressable disabled={busy} onPress={requestOtp} accessibilityRole="button">
            <Text>Reenviar código</Text>
          </Pressable>
        </>
      ) : (
        <Pressable style={styles.button} disabled={busy} onPress={requestOtp} accessibilityRole="button">
          <Text>Continuar com email</Text>
        </Pressable>
      )}
      {busy && <Text accessibilityLiveRegion="polite">Aguarde…</Text>}
      {message && <Text accessibilityLiveRegion="polite">{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  button: { padding: 14, borderWidth: 1, borderRadius: 8, alignItems: 'center', minHeight: 48 },
  input: { padding: 12, borderWidth: 1, borderRadius: 8, minHeight: 48 },
});
