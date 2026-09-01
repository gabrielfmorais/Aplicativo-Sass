import type { EntitlementsPort } from '@app/core';
import { EntitlementService } from '@app/core';
import { useCallback, useEffect, useState } from 'react';

import { Button, Card, Stack, Tag, Text } from '@/design/primitives';

/**
 * SPEC-010 G3 — the account's subscription status, read from server truth.
 *
 * This slice ships the provider-agnostic read path only: the paywall purchase flow (RevenueCat
 * native SDK) and the funnel are deferred with the development build and the store products. So
 * there is **no "subscribe" button here yet** — showing one that cannot complete would be
 * dishonest, and honesty is cheaper than the trust it would cost.
 *
 * Every read is fail closed: unknown / error / loading resolves to FREE, never premium — an error
 * must not imply access (§16). The check goes through EntitlementService, never a bare status
 * comparison (ADR-011 / CLAUDE.md §2).
 *
 * **SPEC-016 G7/FR6 — premium reads as addition, never as subtraction.** The free plan is named as
 * a plan she *has*, not as a limitation she is under (D-83: free is a complete, useful app, not a
 * demo). What premium adds is listed as things that appear, never as things that were taken away.
 * Nothing here mentions a price: price and period come from the store at runtime (D-83), and a
 * number typed into a screen is a number that will be wrong one day.
 */

export function SubscriptionSection({ entitlements }: { entitlements: EntitlementsPort }) {
  const [granted, setGranted] = useState<readonly string[] | 'loading' | 'error'>('loading');

  const load = useCallback(() => {
    setGranted('loading');
    let active = true;
    entitlements
      .get()
      .then((codes) => active && setGranted(codes))
      .catch(() => active && setGranted('error'));
    return () => {
      active = false;
    };
  }, [entitlements]);
  useEffect(() => load(), [load]);

  if (granted === 'loading') return <Text tone="muted">Carregando sua assinatura…</Text>;

  // A failed read is treated as free (fail closed), but we still offer a retry so a transient
  // network error is not mistaken for a permanent downgrade.
  if (granted === 'error') {
    return (
      <Card>
        <Text variant="heading" accessibilityRole="header">
          Assinatura
        </Text>
        <Text tone="muted" accessibilityLiveRegion="polite">
          Não foi possível confirmar sua assinatura. Enquanto isso, o acesso é o do plano gratuito.
        </Text>
        <Button label="Tentar novamente" variant="secondary" onPress={load} />
      </Card>
    );
  }

  const canCustomize = EntitlementService.can('plan_customization', granted);

  return (
    <Card tone="accent">
      <Tag label={canCustomize ? 'Premium' : 'Gratuito'} tone={canCustomize ? 'success' : 'accent'} />
      <Text variant="heading" accessibilityRole="header">
        Assinatura
      </Text>
      <Text accessibilityLiveRegion="polite">{canCustomize ? 'Premium ativo' : 'Plano atual: Gratuito'}</Text>

      {canCustomize ? (
        <Text tone="muted">Você tem acesso à personalização do seu cronograma.</Text>
      ) : (
        <Stack gap="xs">
          <Text tone="muted">Em breve: personalize seu cronograma de cuidados com o premium.</Text>
          {/* The sentence that keeps this honest, and that D-83 is about: nothing she uses today
              goes away, and nothing here is a wall in front of the app she already has. A list of
              "what premium adds" used to sit here too and said the same thing twice. */}
          <Text variant="caption" tone="muted">
            Tudo o que você já usa continua no plano gratuito.
          </Text>
        </Stack>
      )}
    </Card>
  );
}
