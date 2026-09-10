import { describe, expect, it } from 'vitest';

import type { LocalDate } from '../shared/time/local-date.ts';
import { FINISH_TECHNIQUES } from './domain/wash-day.ts';
import {
  MIN_FINISH_RATED_CARES,
  NAMED_FINISH_TECHNIQUES,
  RECENT_FINISH_OCCURRENCES,
  buildFinishCatalog,
  buildFinishDetail,
  type FinishHistoryRecord,
} from './domain/finish-catalog.ts';

/**
 * SPEC-056 (F38, fatia shell) — o catálogo de finalizações.
 *
 * ⚠️ O que estes testes guardam não é layout: é que a lista é **sempre as nomeadas, na ordem do
 * vocabulário** (nunca um ranking), que a contagem é fiel, e que `other`/`unknown` nunca viram entrada.
 */

const rec = (
  technique: FinishHistoryRecord['technique'],
  executedOn = '2026-09-01',
  marks: FinishHistoryRecord['marks'] = null,
): FinishHistoryRecord => ({ technique, executedOn: executedOn as LocalDate, marks });

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

/**
 * SPEC-070 (F38, a biblioteca) — a última vez e o detalhe por técnica.
 *
 * ⚠️ O que estes testes guardam é a fronteira: **contagem e observação**, nunca ordem de mérito e
 * nunca causa. E o denominador — o cuidado com aquela finalização **que ela avaliou**.
 */
describe('buildFinishCatalog — a última vez (SPEC-070 BR2/BR3)', () => {
  it('nunca registrada: a última vez é null, não uma data inventada', () => {
    const c = buildFinishCatalog([]);
    expect(c.every((e) => e.lastUsedOn === null)).toBe(true);
  });

  /**
   * ⚠️ **Máximo, não a última da lista.** Confiar na ordem do adapter acoplaria o domínio a uma
   * promessa dele — a classe de defeito que a SPEC-063 mediu no `lastUsedFor`.
   */
  it('acha a mais recente mesmo com os fatos fora de ordem', () => {
    const c = buildFinishCatalog([
      rec('plopping', '2026-03-04'),
      rec('plopping', '2026-09-07'),
      rec('plopping', '2026-06-15'),
    ]);
    expect(c.find((e) => e.technique === 'plopping')?.lastUsedOn).toBe('2026-09-07');
  });

  it('atravessa a virada de ano sem criar um Date', () => {
    const c = buildFinishCatalog([rec('dedoliss', '2025-12-31'), rec('dedoliss', '2026-01-01')]);
    expect(c.find((e) => e.technique === 'dedoliss')?.lastUsedOn).toBe('2026-01-01');
  });

  /** ⚠️ A recência **aparece** e **não ordena** — ordenar por ela seria a `P7` por outra porta. */
  it('a ordem continua sendo a do vocabulário, mesmo com a mais recente por último', () => {
    const c = buildFinishCatalog([rec('twist_out', '2026-09-08'), rec('fitagem_tradicional', '2026-01-02')]);
    expect(c.map((e) => e.technique)).toEqual([...NAMED_FINISH_TECHNIQUES]);
  });
});

describe('buildFinishDetail — a história dela com uma técnica (SPEC-070)', () => {
  const marked = (day: string, marks: FinishHistoryRecord['marks']) => rec('plopping', day, marks);

  it('nunca registrada: zero, sem data, sem observação e sem inventar nada', () => {
    const d = buildFinishDetail('plopping', []);
    expect(d).toEqual({
      count: 0,
      lastUsedOn: null,
      recent: [],
      noticed: [],
      ratedMissing: MIN_FINISH_RATED_CARES,
    });
  });

  it('as ocorrências saem da mais nova para a mais velha, com teto nomeado', () => {
    const dias = [
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
    ];
    const d = buildFinishDetail(
      'plopping',
      dias.map((day) => rec('plopping', day)),
    );
    expect(d.count).toBe(7);
    expect(d.recent).toHaveLength(RECENT_FINISH_OCCURRENCES);
    expect(d.recent[0]).toBe('2026-07-01');
    expect(d.recent.at(-1)).toBe('2026-02-01');
  });

  /**
   * ⚠️ **`marks: null` e `marks: []` são coisas diferentes.** Sem check-in o cuidado não diz nada
   * sobre resultado e fica **fora** do denominador; avaliado e sem marca **conta**.
   */
  it('o denominador é o que ela AVALIOU, não o que ela fez (BR6)', () => {
    const d = buildFinishDetail('plopping', [
      marked('2026-09-01', ['definition']),
      marked('2026-09-02', ['definition']),
      marked('2026-09-03', []),
      marked('2026-09-04', null),
      marked('2026-09-05', null),
    ]);
    expect(d.count).toBe(5);
    expect(d.noticed[0]?.of).toBe(3);
    expect(d.noticed).toEqual([
      {
        mark: 'definition',
        count: 2,
        of: 3,
        subject: 'definition',
        detail: 'você notou em 2 dos 3 cuidados com plopping que você avaliou',
      },
    ]);
  });

  /** ⚠️ *"Você notou em 1 de 1"* não é observação: é coincidência com forma de regra (BR7). */
  it('abaixo da amostra mínima não há observação, e a tela sabe quanto falta', () => {
    const d = buildFinishDetail('plopping', [
      marked('2026-09-01', ['frizz']),
      marked('2026-09-02', ['frizz']),
    ]);
    expect(d.noticed).toEqual([]);
    expect(d.ratedMissing).toBe(1);
  });

  it('atingida a amostra, a contagem aparece e o "quanto falta" some', () => {
    const d = buildFinishDetail('plopping', [
      marked('2026-09-01', ['frizz']),
      marked('2026-09-02', ['frizz']),
      marked('2026-09-03', ['frizz']),
    ]);
    expect(d.ratedMissing).toBeNull();
    expect(d.noticed).toEqual([
      {
        mark: 'frizz',
        count: 3,
        of: 3,
        subject: 'frizz',
        detail: 'você notou em 3 dos 3 cuidados com plopping que você avaliou',
      },
    ]);
  });

  /**
   * ⚠️ **A marca com ZERO não vira observação, e isso é recusa.** *"…em 0 dos 4"* não é observação,
   * é acusação — o espelho de *"essa finalização é ideal para você"*, e igualmente alegação capilar.
   */
  it('a marca que ela nunca notou simplesmente não existe na tela (BR8)', () => {
    const d = buildFinishDetail('plopping', [
      marked('2026-09-01', ['shine']),
      marked('2026-09-02', []),
      marked('2026-09-03', []),
    ]);
    expect(d.noticed).toEqual([
      {
        mark: 'shine',
        count: 1,
        of: 3,
        subject: 'shine',
        detail: 'você notou em 1 dos 3 cuidados com plopping que você avaliou',
      },
    ]);
    expect(d.noticed.some((n) => n.count === 0)).toBe(false);
    // ⚠️ E "1 de 3" continua aparecendo: esconder isso escolheria a versão bonita do histórico dela.
    expect(d.noticed[0]?.count).toBe(1);
  });

  it('só olha a técnica pedida — o histórico das outras não vaza para dentro dela', () => {
    const d = buildFinishDetail('plopping', [
      rec('plopping', '2026-09-01', ['softness']),
      rec('twist_out', '2026-09-09', ['softness']),
      rec('twist_out', '2026-09-10', ['softness']),
    ]);
    expect(d.count).toBe(1);
    expect(d.lastUsedOn).toBe('2026-09-01');
  });
});
