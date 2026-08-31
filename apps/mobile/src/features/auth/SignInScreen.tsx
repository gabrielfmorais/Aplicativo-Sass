import type { AuthPort, OAuthProvider } from '@app/core';
import { EmailSchema, OtpCodeSchema } from '@app/core';
import { useState } from 'react';
import { Platform } from 'react-native';

import { Button, Field, Screen, Stack, Text } from '@/design/primitives';
import { space } from '@/design/tokens';

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
    <Screen scroll={false}>
      <Stack gap="xs" style={{ paddingTop: space.xxl }}>
        <Text variant="overline" tone="accent">
          SEU CUIDADO CAPILAR
        </Text>
        <Text variant="display" accessibilityRole="header">
          Entrar
        </Text>
        <Text variant="body" tone="muted">
          Um cronograma feito para o seu cabelo, semana a semana.
        </Text>
      </Stack>

      <Stack gap="sm">
        {Platform.OS === 'ios' && (
          <Button
            label="Continuar com Apple"
            variant="secondary"
            disabled={busy}
            onPress={() => provider('apple')}
          />
        )}
        <Button
          label="Continuar com Google"
          variant="secondary"
          disabled={busy}
          onPress={() => provider('google')}
        />
      </Stack>

      <Stack gap="sm">
        <Text variant="caption" tone="faint">
          ou entre com seu email
        </Text>
        <Field
          value={email}
          onChangeText={setEmail}
          placeholder="seu@email.com"
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          editable={!busy && phase !== 'waiting_for_otp'}
        />
        {phase === 'waiting_for_otp' ? (
          <>
            <Field
              value={code}
              onChangeText={setCode}
              placeholder="Código de 6 dígitos"
              accessibilityLabel="Código"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              editable={!busy}
            />
            <Button label="Confirmar código" onPress={verifyOtp} busy={busy} />
            <Button label="Reenviar código" variant="ghost" disabled={busy} onPress={requestOtp} />
          </>
        ) : (
          <Button label="Continuar com email" onPress={requestOtp} busy={busy} />
        )}
      </Stack>

      {message ? (
        <Text variant="caption" tone="muted" accessibilityLiveRegion="polite">
          {message}
        </Text>
      ) : null}
    </Screen>
  );
}
