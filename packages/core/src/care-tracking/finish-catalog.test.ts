import { describe, expect, it } from 'vitest';

import { FINISH_TECHNIQUES } from './domain/wash-day.ts';
import {
  NAMED_FINISH_TECHNIQUES,
  buildFinishCatalog,
  type FinishHistoryRecord,
} from './domain/finish-catalog.ts';

/**
 * SPEC-056 (F38, fatia shell) — o catálogo de finalizações.
 *
 * ⚠️ O que estes testes guardam não é layout: é que a lista é **sempre as nomeadas, na ordem do
 * vocabulário** (nunca um ranking), que a contagem é fiel, e que `other`/`unknown` nunca viram entrada.
 */

const rec = (technique: FinishHistoryRecord['technique']): FinishHistoryRecord => ({ technique });

describe('NAMED_FINISH_TECHNIQUES — o catálogo é o vocabulário sem as saídas (BR1)', () => {
  it('são as seis nomeadas, e other/unknown ficam de fora', () => {
    expect([...NAMED_FINISH_TECHNIQUES]).toEqual([
      'fitagem_tradicional',
      'fitagem_estruturada',
      'dedoliss',
      'rake_and_shake',
      'plopping',
      'twist_out',
    ]);
    expect(NAMED_FINISH_TECHNIQUES).not.toContain('other');
    expect(NAMED_FINISH_TECHNIQUES).not.toContain('unknown');
  });

  it('deriva de FINISH_TECHNIQUES — cresce com o vocabulário aprovado, sem other/unknown', () => {
    const esperado = FINISH_TECHNIQUES.filter((t) => t !== 'other' && t !== 'unknown');
    expect([...NAMED_FINISH_TECHNIQUES]).toEqual([...esperado]);
  });
});

describe('buildFinishCatalog — contagem, nunca ranking (SPEC-056)', () => {
  it('sem registro: as seis nomeadas, todas em zero, na ordem do vocabulário', () => {
    const c = buildFinishCatalog([]);
    expect(c.map((e) => e.technique)).toEqual([...NAMED_FINISH_TECHNIQUES]);
    expect(c.every((e) => e.count === 0)).toBe(true);
  });

  it('conta cada finalização pelo nome', () => {
    const c = buildFinishCatalog([rec('plopping'), rec('plopping'), rec('twist_out')]);
    const at = (t: string) => c.find((e) => e.technique === t)?.count;
    expect(at('plopping')).toBe(2);
    expect(at('twist_out')).toBe(1);
    expect(at('dedoliss')).toBe(0);
  });

  /** ⚠️ **A ordem é a do vocabulário, jamais a contagem** (NG2) — ordenar por "mais usada" é ranking. */
  it('a ordem não muda por contagem: a última do vocabulário com o maior número segue por último', () => {
    const c = buildFinishCatalog([rec('twist_out'), rec('twist_out'), rec('twist_out')]);
    expect(c.map((e) => e.technique)).toEqual([...NAMED_FINISH_TECHNIQUES]);
    expect(c[c.length - 1]?.technique).toBe('twist_out');
    expect(c[c.length - 1]?.count).toBe(3);
  });

  /** ⚠️ **other/unknown não viram entrada e não contam para nenhum nome** (BR1). */
  it('registros de other/unknown são ignorados, mas não quebram a contagem das nomeadas', () => {
    const c = buildFinishCatalog([rec('other'), rec('unknown'), rec('other'), rec('dedoliss')]);
    expect(c).toHaveLength(NAMED_FINISH_TECHNIQUES.length);
    expect(c.some((e) => (e.technique as string) === 'other')).toBe(false);
    expect(c.find((e) => e.technique === 'dedoliss')?.count).toBe(1);
    // A soma das contagens do catálogo ignora os dois `other` e o `unknown`.
    expect(c.reduce((n, e) => n + e.count, 0)).toBe(1);
  });
});
