import type {
  AuthPort,
  DeletionRequestPort,
  EntitlementsPort,
  NotificationPreferences,
  NotificationPreferencesPort,
  NotificationSchedulerPort,
  PlanPreferencesPort,
} from '@app/core';
import { useCallback, useEffect, useState } from 'react';

import { Button, Card, Screen, Stack, Text } from '@/design/primitives';
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
  planPreferences,
  notificationPreferences,
  notificationScheduler,
  onNotificationPreferencesChanged,
  onReassess,
  onOpenHairEvents,
  onOpenShelf,
  onCustomize,
  onBack,
}: {
  auth: AuthPort;
  deletion: DeletionRequestPort;
  entitlements: EntitlementsPort;
  planPreferences: PlanPreferencesPort;
  notificationPreferences: NotificationPreferencesPort;
  notificationScheduler: NotificationSchedulerPort;
  onNotificationPreferencesChanged: (preferences: NotificationPreferences) => void;
  /** Absent while she has no active plan: there would be nothing to replace (SPEC-014). */
  onReassess?: () => void;
  /** SPEC-020 — contar o que mudou; ausente quando a capability não está disponível. */
  onOpenHairEvents?: () => void;
  /** SPEC-023 — a prateleira; ausente quando a capability não está disponível. */
  onOpenShelf?: () => void;
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
    <Screen
      {...(onBack
        ? { footer: <Button label="Voltar aos cuidados" variant="secondary" onPress={onBack} /> }
        : {})}
    >
      <Text variant="display" accessibilityRole="header">
        Sua conta
      </Text>

      <SubscriptionSection entitlements={entitlements} />

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

      {/* Antes da reavaliação, de propósito: contar o que aconteceu é o passo barato, e é o que
          costuma tornar a reavaliação a decisão certa em vez de um palpite (SPEC-020 FR4). */}
      {onOpenShelf ? (
        <Card>
          <Text variant="heading" accessibilityRole="header">
            Minha prateleira
          </Text>
          <Text tone="muted">
            Os produtos que você já tem em casa. Serve para o app não sugerir o que você não tem.
          </Text>
          <Button label="Ver minha prateleira" variant="secondary" onPress={onOpenShelf} />
        </Card>
      ) : null}

      {onOpenHairEvents ? (
        <Card>
          <Text variant="heading" accessibilityRole="header">
            Meu cabelo mudou
          </Text>
          <Text tone="muted">
            Química, coloração, corte, praia, uma pausa — contar o que aconteceu ajuda o app a não seguir com
            um cronograma feito para antes.
          </Text>
          <Button label="Contar o que mudou" variant="secondary" onPress={onOpenHairEvents} />
        </Card>
      ) : null}

      {onReassess ? (
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
      ) : null}

      {/* Last, and quiet on purpose: leaving and deleting are the two things she cannot undo by
          tapping again, so neither should sit where a thumb lands by accident. */}
      <Stack gap="md">
        <Text variant="overline" tone="muted" accessibilityRole="header">
          Acesso e dados
        </Text>
        {/* Inline, not the full-page `Loading`: this is one sub-state inside a scrolling page, and
            a flex-1 screen dropped into a scroll view collapses. */}
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
