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

import { Button, Card, Screen, ScreenHeader, Stack, Text } from '@/design/primitives';
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
        ? {
            /*
              SPEC-027 — "Voltar", e não "Voltar aos cuidados".
              Esta tela é empilhada sobre a aba de onde ela foi aberta, e desde que o avatar aparece
              em **quatro** abas, esse destino deixou de ser sempre "os cuidados": aberta da
              Prateleira, o botão prometia um lugar e entregava outro. Um rótulo que nomeia o destino
              errado é pior que um genérico — a aba destacada embaixo já diz para onde se volta.
            */
            footer: <Button label="Voltar" variant="secondary" onPress={onBack} />,
          }
        : {})}
    >
      {/*
        SPEC-026 FR6 — a aba não é "configurações": é **ela**. O cabelo dela vem antes da fatura,
        e por isso "meu cabelo mudou" e "reavaliar" subiram para cima de assinatura e lembretes.
        Enquanto isto era uma tela alcançada por um botão no pé da Hoje, a ordem não custava nada;
        como aba permanente, a primeira coisa visível passa a ser o que a aba **significa**.
      */}
      <ScreenHeader eyebrow="Seu perfil e sua conta" title="Você" />

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

      {/* Last, and quiet on purpose: leaving and deleting are the two things she cannot undo by
          tapping again, so neither should sit where a thumb lands by accident. */}
      <Stack gap="md">
        <Text variant="overline" tone="accent" accessibilityRole="header">
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
