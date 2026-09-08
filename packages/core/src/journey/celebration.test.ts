import { describe, expect, it } from 'vitest';

import { detectCelebration } from './domain/celebration.ts';
import type { JourneyMilestone, JourneyView } from './domain/journey.ts';

const view = (over: Partial<JourneyView> = {}): JourneyView => ({
  points: 100,
  level: { level: 2, name: 'Em ritmo', toNext: 80, nextName: 'Constante' },
  streak: 3,
  caresAttended: 5,
  milestones: [
    { key: 'first_care', label: 'Primeiro cuidado', reached: true },
    { key: 'cares_5', label: '5 cuidados do seu plano', reached: true },
    { key: 'cares_10', label: '10 cuidados do seu plano', reached: false },
    { key: 'streak_3', label: '3 seguidos', reached: true },
    { key: 'streak_7', label: '7 seguidos', reached: false },
  ],
  frozen: false,
  ...over,
});

const withReached = (base: JourneyView, key: string): JourneyView => ({
  ...base,
  milestones: base.milestones.map((m): JourneyMilestone => (m.key === key ? { ...m, reached: true } : m)),
});

/**
 * SPEC-043 OQ1 — a detecção da celebração.
 *
 * ⚠️ O que estes testes guardam: **nunca comemorar a linha de base** (senão a abertura daria parabéns
 * por conquistas antigas), **uma conquista por evento** (senão vira ruído), e **aderência, nunca
 * quantidade** — a detecção só olha marco/sequência/nível, todos ancorados em cuidado planejado.
 */
describe('detectCelebration (SPEC-043 OQ1)', () => {
  it('nunca comemora a linha de base — a primeira leitura não é conquista do momento', () => {
    // Uma Jornada cheia de marcos já alcançados, chegando pela primeira vez: silêncio.
    expect(detectCelebration(null, view())).toBeNull();
  });

  it('comemora o marco que ACABOU de ser alcançado', () => {
    const before = view();
    const after = withReached(before, 'cares_10');
    expect(detectCelebration(before, after)).toEqual({
      kind: 'milestone',
      key: 'cares_10',
      label: '10 cuidados do seu plano',
    });
  });

  it('um marco que já estava alcançado não comemora de novo', () => {
    // Mesmo marco alcançado nos dois: nada novo, nada a comemorar.
    expect(detectCelebration(view(), view())).toBeNull();
  });

  it('sobe de nível quando não há marco novo', () => {
    const before = view();
    const after = view({ level: { level: 3, name: 'Constante', toNext: 220, nextName: 'Firme' } });
    expect(detectCelebration(before, after)).toEqual({ kind: 'level', level: 3, name: 'Constante' });
  });

  it('o marco tem prioridade sobre subir de nível — o mesmo cuidado pode cruzar os dois', () => {
    const before = view();
    const after = withReached(
      view({ level: { level: 3, name: 'Constante', toNext: 220, nextName: 'Firme' } }),
      'cares_10',
    );
    expect(detectCelebration(before, after)).toEqual({
      kind: 'milestone',
      key: 'cares_10',
      label: '10 cuidados do seu plano',
    });
  });

  /** ⚠️ Uma conquista por evento: dois marcos novos ao mesmo tempo produzem UM cartão, não dois. */
  it('dois marcos novos no mesmo evento comemoram só o primeiro da régua', () => {
    const before = view();
    const after = withReached(withReached(before, 'cares_10'), 'streak_7');
    expect(detectCelebration(before, after)).toEqual({
      kind: 'milestone',
      key: 'cares_10',
      label: '10 cuidados do seu plano',
    });
  });

  it('sem mudança nenhuma, nada a comemorar', () => {
    const before = view();
    expect(detectCelebration(before, { ...before })).toBeNull();
  });
});
