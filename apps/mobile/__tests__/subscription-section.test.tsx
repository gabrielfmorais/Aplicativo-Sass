import type { EntitlementsPort } from '@app/core';
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';

import { SubscriptionSection } from '@/features/account/SubscriptionSection';

const portWith = (get: EntitlementsPort['get']): EntitlementsPort => ({ get });

describe('SubscriptionSection (SPEC-010 G3)', () => {
  it('shows the free plan when no entitlements are granted', async () => {
    render(<SubscriptionSection entitlements={portWith(async () => [])} />);
    await waitFor(() => screen.getByText('Plano atual: Gratuito'));
    expect(screen.getByText(/Em breve: personalize/)).toBeTruthy();
  });

  it('shows premium active when plan_customization is granted', async () => {
    render(<SubscriptionSection entitlements={portWith(async () => ['plan_customization'])} />);
    await waitFor(() => screen.getByText('Premium ativo'));
    expect(screen.getByText(/personalização do seu cronograma/)).toBeTruthy();
  });

  it('fails closed to free-with-retry when the read fails', async () => {
    const get = jest
      .fn<ReturnType<EntitlementsPort['get']>, []>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([]);
    render(<SubscriptionSection entitlements={portWith(get)} />);
    await waitFor(() => screen.getByText(/o acesso é o do plano gratuito/));
    // Retry re-reads and, on success, resolves to the free state.
    await fireEvent.press(screen.getByText('Tentar novamente'));
    await waitFor(() => screen.getByText('Plano atual: Gratuito'));
    expect(get).toHaveBeenCalledTimes(2);
  });
});
