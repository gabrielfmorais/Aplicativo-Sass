import type { Progress } from '@app/core';
import { render } from '@testing-library/react-native';

import { ProgressSummary } from '@/features/care/ProgressSummary';

const progress = (over: Partial<Progress> = {}): Progress => ({
  elapsed: 0,
  done: 0,
  skipped: 0,
  overdue: 0,
  checkInCount: 0,
  averageFeel: null,
  lifetimeDone: 0,
  ...over,
});

const renderSummary = (p: Progress) => render(<ProgressSummary progress={p} />);

describe('ProgressSummary (SPEC-009 §14)', () => {
  it('explains itself instead of showing a zero that reads like failure (AC6)', async () => {
    const screen = await renderSummary(progress());
    screen.getByText('Seu plano começou agora. O resumo aparece conforme você registra os cuidados.');
    expect(screen.queryByText(/de 0 cuidados/)).toBeNull();
  });

  it('states the fraction and the scope (AC8)', async () => {
    const screen = await renderSummary(progress({ elapsed: 5, done: 3, skipped: 1, overdue: 1 }));
    screen.getByText('Neste plano, você concluiu 3 de 5 cuidados até aqui.');
  });

  it('mentions skipped cares only when there are any (AC7)', async () => {
    const none = await renderSummary(progress({ elapsed: 2, done: 2 }));
    expect(none.queryByText(/Pulou/)).toBeNull();

    const some = await renderSummary(progress({ elapsed: 3, done: 2, skipped: 1 }));
    some.getByText('Pulou 1.');
  });

  it('shows only the count while the average is withheld (AC4)', async () => {
    const screen = await renderSummary(progress({ elapsed: 2, done: 2, checkInCount: 2 }));
    screen.getByText('Você avaliou 2 cuidados.');
    expect(screen.queryByText(/média/)).toBeNull();
  });

  it('labels the average as her own answer (AC8/BR6)', async () => {
    const screen = await renderSummary(progress({ elapsed: 4, done: 4, checkInCount: 4, averageFeel: 4.3 }));
    screen.getByText('Você avaliou 4 cuidados · média 4,3 de 5 (sua avaliação).');
  });

  it('says nothing about check-ins when there are none', async () => {
    const screen = await renderSummary(progress({ elapsed: 2, done: 2 }));
    expect(screen.queryByText(/avaliou/)).toBeNull();
  });

  it('reports a fully skipped plan without softening it (EC9)', async () => {
    const screen = await renderSummary(progress({ elapsed: 5, done: 0, skipped: 5 }));
    screen.getByText('Neste plano, você concluiu 0 de 5 cuidados até aqui.');
    screen.getByText('Pulou 5.');
  });
});

/**
 * AC9 — the whole risk of a progress screen is inventing precision or implying a result. This is
 * the assertion that would fail if someone later added "73%", a health score, or "seu cabelo
 * melhorou": a claim the data cannot support, in a product that is cosmetic and not medical.
 */
describe('never claims more than the data supports (AC9)', () => {
  const FORBIDDEN: ReadonlyArray<readonly [string, RegExp, string]> = [
    ['porcentagem', /\d+\s*%/, '73%'],
    ['score', /\bscore\b|\bpontuaç\w*|\bnota do cabelo\b/i, 'seu score é 8'],
    ['tendência ou melhora', /\bmelhor\w*|\bpior\w*|\bevoluç\w*|\btendênc\w*|\bprogred\w*/i, 'você melhorou'],
    [
      'claim causal ou de saúde',
      /\bsaudáve\w*|\brecuperaç\w*|\bdiagnóstic\w*|\btratament\w*/i,
      'cabelo mais saudável',
    ],
  ];

  const everyText = (screen: Awaited<ReturnType<typeof render>>): string => {
    const rendered = JSON.stringify(screen.toJSON());
    // Without this the assertions below would pass vacuously on an empty render.
    expect(rendered).toContain('Seu progresso');
    return rendered;
  };

  it.each(FORBIDDEN)('shows no %s in any state', async (_label, pattern) => {
    const states: Progress[] = [
      progress(),
      progress({ elapsed: 5, done: 3, skipped: 1, overdue: 1 }),
      progress({ elapsed: 5, done: 5, checkInCount: 5, averageFeel: 4.6 }),
      progress({ elapsed: 5, done: 0, skipped: 5, checkInCount: 1 }),
      // The lifetime line (SPEC-014) renders only when it exceeds the plan total, so without this
      // state the barrier would never see it — a guard that skips the newest text is not a guard.
      progress({ elapsed: 2, done: 1, lifetimeDone: 14, checkInCount: 3, averageFeel: 4.5 }),
    ];
    for (const state of states) {
      expect(everyText(await renderSummary(state))).not.toMatch(pattern);
    }
  });

  // A check that cannot detect a violation is a claim, not a check.
  it.each(FORBIDDEN)('the %s check can actually detect a violation', (_label, pattern, sample) => {
    expect(sample).toMatch(pattern);
  });
});
