import type {
  AuthPort,
  HunaAvatar,
  ProfilePort,
  DeletionRequestPort,
  EntitlementsPort,
  NotificationPreferences,
  NotificationPreferencesPort,
  NotificationSchedulerPort,
  PlanPreferencesPort,
} from '@app/core';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Button, Card, Screen, Stack, Text } from '@/design/primitives';
import { ProfileIdentity } from '@/features/account/ProfileIdentity';
import { HIT_TARGET, space } from '@/design/tokens';
import { NotificationSettings } from '@/features/account/NotificationSettings';
import { PlanCustomizationSection } from '@/features/account/PlanCustomizationSection';
import { SubscriptionSection } from '@/features/account/SubscriptionSection';

/**
 * Authenticated home for SPEC-001: logout and the account-deletion request contract (FR5/FR6),
 * plus every setting the later SPECs added.
 *
 * SPEC-016 slice 4 fixed something that was not cosmetic: this screen was a `View` with
 * `justifyContent: 'center'` and **no scroll view at all**. With subscription, weekday preferences,
 * reminders, reassessment, deletion and sign-out stacked in it, everything below the fold was
 * simply unreachable on a phone — the web preview's tall window was hiding it. It scrolls now.
 *
 * Order is deliberate: what she can *gain* first, what she can *change* next, and the two
 * irreversible things last and quietest. A destructive action should never be the first thing a
 * thumb finds.
 */
export function AccountScreen({
  auth,
  deletion,
  entitlements,
  profile,
  displayName,
  avatar,
  onNameChanged,
  onAvatarChanged,
  planPreferences,
  notificationPreferences,
  notificationScheduler,
  onNotificationPreferencesChanged,
  onReassess,
  onCustomize,
  onBack,
}: {
  auth: AuthPort;
  deletion: DeletionRequestPort;
  entitlements: EntitlementsPort;
  /** SPEC-035 — o nome dela é editável aqui: o dado já existia, faltava a porta. */
  profile: ProfilePort;
  displayName: string | null;
  /** SPEC-042 (F34) — a marca da Huna que ela escolheu, ou `null`. */
  avatar: HunaAvatar | null;
  onNameChanged: (name: string | null) => void;
  onAvatarChanged: (avatar: HunaAvatar | null) => void;
  planPreferences: PlanPreferencesPort;
  notificationPreferences: NotificationPreferencesPort;
  notificationScheduler: NotificationSchedulerPort;
  onNotificationPreferencesChanged: (preferences: NotificationPreferences) => void;
  /** Absent while she has no active plan: there would be nothing to replace (SPEC-014). */
  onReassess?: () => void;
  /**
   * SPEC-015 — opens the preview of a plan built with her preferred weekdays. Absent while she has
   * no active plan: the preview is already the next screen she sees, so there is nothing to open.
   */
  onCustomize?: () => void;
  /**
   * The way back to the cares. It lives inside this screen rather than beside it: the account is a
   * full page on the warm canvas now, and a control floating outside its frame would sit on a
   * different background with different padding. Optional so a test can render the screen alone.
   */
  onBack?: () => void;
}) {
  const [requestedAt, setRequestedAt] = useState<string | null | 'loading' | 'error'>('loading');
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      deletion
        .current()
        .then((r) => setRequestedAt(r?.requestedAt ?? null))
        // Terminal, not "still loading". Leaving it on `loading` left a spinner that never ended and
        // no way to try again — a failed read has to be a state she can act on (FR4/AC4).
        .catch(() => setRequestedAt('error')),
    [deletion],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = (op: () => Promise<void>, fallback: string) =>
    void op()
      .then(refresh)
      .catch(() => setMessage(fallback));

  return (
    <Screen>
      {/*
        ⚠️ **A saída subiu para o topo, e isso conserta um rodapé duplo.** "Voltar" vivia no
        `footer` fixo da tela — mas esta tela é **empilhada sobre uma aba**, então a barra de abas
        continua embaixo: eram duas faixas de rodapé, uma em cima da outra, comendo 100pt da tela
        num aparelho de 844. No topo, à esquerda, ele é o que uma tela empilhada tem: uma saída, e
        não um rodapé.
      */}
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <Text variant="bodyStrong" tone="accent">
            ‹ Voltar
          </Text>
        </Pressable>
      ) : null}

      {/*
        SPEC-035 — a ordem **é** a mensagem, e antes ela não dizia nada.

        Reavaliação, assinatura, dias preferidos, lembretes, exclusão e sair chegavam como seis
        cartões brancos idênticos: tudo com o mesmo peso, cobrança e exclusão no mesmo plano do
        cabelo dela. Agora há quatro blocos com pesos diferentes e uma regra explícita —
        **identidade e cabelo antes de conta, cobrança e exclusão**.
      */}
      <ProfileIdentity
        profile={profile}
        name={displayName}
        avatar={avatar}
        onNameChanged={onNameChanged}
        onAvatarChanged={onAvatarChanged}
      />

      {onReassess ? (
        <Stack gap="md">
          <Text variant="overline" tone="accent" accessibilityRole="header">
            Seu cabelo
          </Text>
          <Card>
            <Text variant="heading" accessibilityRole="header">
              Reavaliar meu cabelo
            </Text>
            <Text tone="muted">
              Responda as perguntas de novo para receber um cronograma novo. O cronograma atual será
              substituído; o que você já registrou continua salvo.
            </Text>
            <Button label="Reavaliar" variant="secondary" onPress={onReassess} />
          </Card>
        </Stack>
      ) : null}

      <Stack gap="md">
        <Text variant="overline" tone="accent" accessibilityRole="header">
          Suas preferências
        </Text>
        <PlanCustomizationSection
          entitlements={entitlements}
          planPreferences={planPreferences}
          {...(onCustomize ? { onApply: onCustomize } : {})}
        />
        <NotificationSettings
          preferences={notificationPreferences}
          scheduler={notificationScheduler}
          onChanged={onNotificationPreferencesChanged}
        />
      </Stack>

      <Stack gap="md">
        <Text variant="overline" tone="accent" accessibilityRole="header">
          Seu plano
        </Text>
        <SubscriptionSection entitlements={entitlements} />
      </Stack>

      {/*
        Último, e quieto de propósito: sair e excluir são as duas coisas que ela não desfaz tocando
        de novo, então nenhuma delas pode estar onde o polegar cai por acidente.
      */}
      <Stack gap="md">
        <Text variant="overline" tone="faint" accessibilityRole="header">
          Conta e dados
        </Text>
        {/* Inline, e não o `Loading` de página inteira: isto é um sub-estado dentro de uma página que
            rola, e uma tela flex-1 dentro de um scroll view colapsa. */}
        {requestedAt === 'loading' ? (
          <Text tone="muted">Carregando sua conta…</Text>
        ) : requestedAt === 'error' ? (
          <Card>
            <Text tone="muted" accessibilityLiveRegion="polite">
              Não foi possível carregar sua conta.
            </Text>
            <Button label="Tentar novamente" variant="secondary" onPress={() => void refresh()} />
          </Card>
        ) : requestedAt ? (
          <Card tone="muted">
            <Text accessibilityLiveRegion="polite">
              Exclusão da conta solicitada em {new Date(requestedAt).toLocaleDateString()}. Você pode cancelar
              o pedido.
            </Text>
            <Button
              label="Cancelar exclusão"
              variant="secondary"
              onPress={() => act(deletion.cancel, 'Não foi possível cancelar.')}
            />
          </Card>
        ) : (
          <Button
            label="Solicitar exclusão da conta"
            variant="ghost"
            onPress={() => act(deletion.request, 'Não foi possível solicitar.')}
          />
        )}
        <Button
          label="Sair"
          variant="secondary"
          onPress={() => act(auth.signOut, 'Não foi possível sair.')}
        />
      </Stack>

      {message ? (
        <Text accessibilityLiveRegion="polite" tone="danger">
          {message}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** Alvo confortável e alinhado à esquerda com o conteúdo — uma saída se procura no canto. */
  back: { minHeight: HIT_TARGET, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: space.md },
  backPressed: { opacity: 0.7 },
});
