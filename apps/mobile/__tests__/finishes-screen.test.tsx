import type { FinishHistoryRecord, WashDayPort } from '@app/core';
import { InfrastructureError } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { FinishesScreen } from '@/features/care/FinishesScreen';

/**
 * SPEC-056 (F38, fatia shell) — a área de Finalizações.
 *
 * ⚠️ O que estes testes guardam: as seis nomeadas aparecem, a contagem é fiel, e **nenhum texto da
 * tela afirma efeito capilar, "melhor", ranking ou "como fazer"** (D-26/D-70) — a barreira que deixa
 * a área utilizável antes do sign-off.
 */

const makeWashDays = (over: Partial<WashDayPort> = {}): WashDayPort => ({
  getFor: jest.fn(async () => {
    throw new Error('não usado');
  }),
  markProduct: jest.fn(async () => undefined),
  markTechnique: jest.fn(async () => undefined),
  setScalpFeel: jest.fn(async () => undefined),
  setFinishStatus: jest.fn(async () => undefined),
  setFinishTechnique: jest.fn(async () => {}),
  lastUsedFor: jest.fn(async () => []),
  finishHistory: jest.fn(async () => []),
  ...over,
});

const rec = (technique: FinishHistoryRecord['technique']): FinishHistoryRecord => ({ technique });

const NAMED_LABELS = [
  'Fitagem tradicional',
  'Fitagem estruturada',
  'Dedoliss',
  'Rake and shake',
  'Plopping',
  'Twist out',
];

const renderScreen = async (washDays: WashDayPort) => {
  const onBack = jest.fn();
  const view = await render(<FinishesScreen washDays={washDays} onBack={onBack} />);
  return { ...view, onBack };
};

describe('FinishesScreen (SPEC-056)', () => {
  it('sem registro: as seis nomeadas aparecem, e é a descoberta — não um vazio', async () => {
    const s = await renderScreen(makeWashDays());
    await waitFor(() => s.getByText('Finalizações'));
    for (const label of NAMED_LABELS) expect(s.getByText(label)).toBeTruthy();
    // Cada uma diz o estado em palavra (FR4), sem parecer erro.
    expect(s.getAllByText('Você ainda não registrou').length).toBe(NAMED_LABELS.length);
  });

  it('conta o que ela registrou, e ignora other/unknown (BR1)', async () => {
    const s = await renderScreen(
      makeWashDays({
        finishHistory: jest.fn(async () => [
          rec('plopping'),
          rec('plopping'),
          rec('twist_out'),
          rec('other'),
          rec('unknown'),
        ]),
      }),
    );
    await waitFor(() => s.getByText('Plopping'));
    expect(s.getByText('Você registrou 2 vezes')).toBeTruthy();
    expect(s.getByText('Você registrou 1 vez')).toBeTruthy();
    // other/unknown não têm cartão nenhum.
    expect(s.queryByText('Outra finalização')).toBeNull();
    expect(s.queryByText('Não sei o nome')).toBeNull();
  });

  /**
   * ⚠️ **A barreira D-26/D-70.** Nenhum texto da tela pode afirmar efeito, "melhor", ranking ou
   * "como fazer" — é isso que separa a fatia shell do resto do F38, que espera sign-off.
   */
  it('não afirma efeito, "melhor", ranking nem "como fazer"', async () => {
    const s = await renderScreen(makeWashDays({ finishHistory: jest.fn(async () => [rec('plopping')]) }));
    await waitFor(() => s.getByText('Finalizações'));
    const proibido =
      /melhor|ideal|recomend|indicad|como fazer|passo a passo|para o seu cabelo|efeito|ranking|mais usada|top |favorita/i;
    for (const node of s.queryAllByText(proibido)) {
      throw new Error(`texto proibido na tela: "${node.props.children}"`);
    }
    expect(s.getByText('Plopping')).toBeTruthy();
  });

  it('erro na leitura: cartão de erro com tentar de novo (EC3), nunca uma lista fingindo zero', async () => {
    const finishHistory = jest
      .fn<Promise<readonly FinishHistoryRecord[]>, []>()
      .mockRejectedValueOnce(new InfrastructureError('care.wash_day_read_failed', 'boom'))
      .mockResolvedValueOnce([rec('dedoliss')]);
    const s = await renderScreen(makeWashDays({ finishHistory }));
    await waitFor(() => s.getByText('Não foi possível abrir suas finalizações agora.'));
    fireEvent.press(s.getByText('Tentar novamente'));
    await waitFor(() => s.getByText('Dedoliss'));
    expect(finishHistory).toHaveBeenCalledTimes(2);
  });
});
