import {
  HAIR_EVENT_TYPES,
  HairEventTypeSchema,
  HairProfileInputSchema,
  PERCEIVED_POROSITIES,
  ROUTINE_AVAILABILITIES,
  PRODUCT_CATEGORIES,
  PRODUCT_NAME_MAX_LENGTH,
  ProductCategorySchema,
  ProductNameSchema,
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
  perceivedPorosity: 'wets_and_dries_fast',
  routineAvailability: 'minimal',
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

  /**
   * SPEC-037 (F35) — as duas entradas novas, e **obrigatórias numa avaliação nova**.
   *
   * ⚠️ Opcional aqui teria sido o caminho fácil (nenhuma fixture quebraria) e teria criado um
   * terceiro estado — ausente, `null` e `'unknown'` — para dizer duas coisas. Uma avaliação nova
   * sempre responde; quem pode faltar é a **linha antiga**, e essa é a `HairProfileSnapshot`.
   */
  it('exige as duas entradas da avaliação ampliada', () => {
    const { perceivedPorosity: _p, routineAvailability: _r, ...missing } = valid;
    expect(HairProfileInputSchema.safeParse(missing).success).toBe(false);
    expect(HairProfileInputSchema.safeParse({ ...valid, perceivedPorosity: null }).success).toBe(false);
  });

  /** Comportamento observado, não classe capilar: `low_porosity` é a tradução que a D-26 barra. */
  it('recusa vocabulário de classificação de porosidade', () => {
    expect(HairProfileInputSchema.safeParse({ ...valid, perceivedPorosity: 'low' }).success).toBe(false);
    expect(HairProfileInputSchema.safeParse({ ...valid, perceivedPorosity: 'high_porosity' }).success).toBe(
      false,
    );
    for (const v of PERCEIVED_POROSITIES) {
      expect(HairProfileInputSchema.safeParse({ ...valid, perceivedPorosity: v }).success).toBe(true);
    }
    for (const v of ROUTINE_AVAILABILITIES) {
      expect(HairProfileInputSchema.safeParse({ ...valid, routineAvailability: v }).success).toBe(true);
    }
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
    perceived_porosity: 'wets_and_dries_fast',
    routine_availability: 'minimal',
  };

  it('maps every column to the snapshot', () => {
    const snap = hairProfileFromRow(row);
    expect(snap.hairProfileId).toBe('p1');
    expect(snap.currentConcerns).toEqual(['frizz', 'dryness']);
    expect(snap.perceivedPorosity).toBe('wets_and_dries_fast');
    expect(snap.routineAvailability).toBe('minimal');
  });

  /**
   * SPEC-037 — ⚠️ **a barreira que separa "não perguntamos" de "ela não sabe".**
   *
   * `hair_profiles` é append-only e imutável (D-62): as avaliações anteriores a esta SPEC existem,
   * não podem ser preenchidas e chegam com `null`. Se um dia alguém "simplificar" o mapper trocando
   * `null` por `'unknown'` — ou pior, por um default —, o motor do F36 passaria a ler como resposta
   * dela uma coisa que ela nunca disse, e nada avisaria. É isso que este teste trava.
   */
  it('uma avaliação anterior à pergunta chega como null, e null não vira "unknown"', () => {
    const { perceived_porosity: _p, routine_availability: _r, ...old } = row;
    const snap = hairProfileFromRow({ ...old, perceived_porosity: null, routine_availability: null });
    expect(snap.perceivedPorosity).toBeNull();
    expect(snap.routineAvailability).toBeNull();

    // E o contrário também: "não sei dizer" é uma RESPOSTA, e continua sendo uma.
    const said = hairProfileFromRow({ ...row, perceived_porosity: 'unknown' });
    expect(said.perceivedPorosity).toBe('unknown');
  });

  it('recusa um valor fora do vocabulário nas colunas novas', () => {
    expect(() => hairProfileFromRow({ ...row, perceived_porosity: 'low_porosity' })).toThrow();
    expect(() => hairProfileFromRow({ ...row, routine_availability: 'muito' })).toThrow();
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

/** SPEC-023 — o nome é dela; a categoria é organização de prateleira, nunca afirmação capilar. */
describe('products (SPEC-023)', () => {
  it('normaliza espaço e nada mais — o produto se chama como ela chama', () => {
    expect(ProductNameSchema.parse('  Máscara   da feira  ')).toBe('Máscara da feira');
    expect(ProductNameSchema.parse('shampoo x')).toBe('shampoo x');
  });

  it('recusa o que o banco recusa: vazio, só espaço e acima de 80', () => {
    expect(ProductNameSchema.safeParse('').success).toBe(false);
    expect(ProductNameSchema.safeParse('   ').success).toBe(false);
    expect(ProductNameSchema.safeParse('a'.repeat(PRODUCT_NAME_MAX_LENGTH)).success).toBe(true);
    expect(ProductNameSchema.safeParse('a'.repeat(PRODUCT_NAME_MAX_LENGTH + 1)).success).toBe(false);
  });

  /** Sete valores neutros. Um oitavo que descreva efeito abriria o gate D-26 sem avisar. */
  it('a categoria é a lista fechada, e nenhum valor promete nada', () => {
    expect(PRODUCT_CATEGORIES).toHaveLength(7);
    expect(ProductCategorySchema.safeParse('mask').success).toBe(true);
    expect(ProductCategorySchema.safeParse('reconstrutor').success).toBe(false);
  });
});
