import {
  HAIR_EVENT_TYPES,
  HairEventTypeSchema,
  HairProfileInputSchema,
  hairProfileFromRow,
} from './index.ts';

const valid = {
  hairPattern: 'curly',
  strandThickness: 'medium',
  scalpTendency: 'balanced',
  washFrequency: 'twice_weekly',
  chemicalTreatments: ['coloring'],
  heatUsage: 'one_to_two_weekly',
  currentConcerns: ['frizz', 'dryness'],
  primaryGoal: 'definition_and_frizz_control',
} as const;

describe('hair-profile: input validation at the trust boundary (SPEC-002 §6/BR6)', () => {
  it('accepts a complete valid answer set', () => {
    expect(HairProfileInputSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts "unknown"/"varies" and an empty chemical_treatments (= none)', () => {
    expect(
      HairProfileInputSchema.safeParse({
        ...valid,
        hairPattern: 'unknown',
        washFrequency: 'varies',
        chemicalTreatments: [],
        currentConcerns: ['no_major_concern'],
      }).success,
    ).toBe(true);
  });

  it('rejects values outside the approved sets', () => {
    expect(HairProfileInputSchema.safeParse({ ...valid, hairPattern: 'afro' }).success).toBe(false);
    expect(HairProfileInputSchema.safeParse({ ...valid, chemicalTreatments: ['tint'] }).success).toBe(false);
  });

  it('requires at least one current concern', () => {
    expect(HairProfileInputSchema.safeParse({ ...valid, currentConcerns: [] }).success).toBe(false);
  });

  it('makes no_major_concern exclusive', () => {
    expect(
      HairProfileInputSchema.safeParse({ ...valid, currentConcerns: ['no_major_concern', 'frizz'] }).success,
    ).toBe(false);
    expect(
      HairProfileInputSchema.safeParse({ ...valid, currentConcerns: ['no_major_concern'] }).success,
    ).toBe(true);
  });

  it('rejects duplicates in multi-selects', () => {
    expect(
      HairProfileInputSchema.safeParse({ ...valid, chemicalTreatments: ['coloring', 'coloring'] }).success,
    ).toBe(false);
    expect(HairProfileInputSchema.safeParse({ ...valid, currentConcerns: ['frizz', 'frizz'] }).success).toBe(
      false,
    );
  });

  it('rejects unknown fields (client cannot smuggle unsupported data — AC7)', () => {
    expect(HairProfileInputSchema.safeParse({ ...valid, porosity: 'high' }).success).toBe(false);
  });
});

describe('hair-profile: reading a stored row (SPEC-002 §9)', () => {
  const row = {
    id: 'p1',
    created_at: '2026-08-29T00:00:00.000Z',
    hair_pattern: 'curly',
    strand_thickness: 'medium',
    scalp_tendency: 'balanced',
    wash_frequency: 'twice_weekly',
    chemical_treatments: ['coloring'],
    heat_usage: 'one_to_two_weekly',
    current_concerns: ['frizz', 'dryness'],
    primary_goal: 'definition_and_frizz_control',
  };

  it('maps every column to the snapshot', () => {
    const snap = hairProfileFromRow(row);
    expect(snap.hairProfileId).toBe('p1');
    expect(snap.currentConcerns).toEqual(['frizz', 'dryness']);
  });

  // A tampered client could bypass the zod uniqueness refine and store duplicates the DB CHECKs allow;
  // the mapper normalises set-valued arrays so the engine input can never be double-weighted.
  it('dedupes set-valued arrays on read', () => {
    const snap = hairProfileFromRow({
      ...row,
      chemical_treatments: ['coloring', 'coloring'],
      current_concerns: ['frizz', 'frizz', 'dryness'],
    });
    expect(snap.chemicalTreatments).toEqual(['coloring']);
    expect(snap.currentConcerns).toEqual(['frizz', 'dryness']);
  });
});

/**
 * SPEC-020 — o enum de eventos. Espelha o `CHECK` de `public.hair_events`: o de cá recusa antes da
 * chamada, o de lá recusa um cliente adulterado, e é o segundo que importa.
 */
describe('hair events (SPEC-020)', () => {
  it('aceita exatamente a lista fechada e recusa o resto', () => {
    for (const type of HAIR_EVENT_TYPES) {
      expect(HairEventTypeSchema.safeParse(type).success).toBe(true);
    }
    expect(HairEventTypeSchema.safeParse('inventei_um_tipo').success).toBe(false);
    expect(HairEventTypeSchema.safeParse('').success).toBe(false);
  });

  /**
   * Os nove valores do Blueprint §6. Travados por contagem **e** por conteúdo: acrescentar um
   * décimo é mudança de produto — cada valor é uma palavra que a interface mostra a ela.
   */
  it('é a lista que o produto aprovou, nem uma a mais', () => {
    expect(HAIR_EVENT_TYPES).toHaveLength(9);
    expect(HAIR_EVENT_TYPES).toContain('bleaching_or_highlights');
    expect(HAIR_EVENT_TYPES).toContain('noticed_change');
  });
});
