import { CARE_TYPE_CODES } from '../schedule/index.ts';
import { CARE_GUIDES, CareGuideSchema, type CareGuide } from './index.ts';

const guides = Object.values(CARE_GUIDES);
const wellFormed: CareGuide = CARE_GUIDES.hydration;

describe('CareGuideSchema (SPEC-007 §9.1)', () => {
  it('accepts every shipped guide', () => {
    for (const guide of guides) {
      expect(CareGuideSchema.safeParse(guide).success).toBe(true);
    }
  });

  it('rejects a procedure that is too short or too long to be one', () => {
    expect(CareGuideSchema.safeParse({ ...wellFormed, steps: ['a b', 'c d'] }).success).toBe(false);
    expect(
      CareGuideSchema.safeParse({ ...wellFormed, steps: Array.from({ length: 7 }, () => 'passo') }).success,
    ).toBe(false);
  });

  it('rejects fewer than two or more than three common mistakes', () => {
    expect(CareGuideSchema.safeParse({ ...wellFormed, commonMistakes: ['um'] }).success).toBe(false);
    expect(
      CareGuideSchema.safeParse({ ...wellFormed, commonMistakes: ['um', 'dois', 'três', 'quatro'] }).success,
    ).toBe(false);
  });

  it('rejects a non-positive duration', () => {
    expect(CareGuideSchema.safeParse({ ...wellFormed, durationMin: 0 }).success).toBe(false);
  });

  it('rejects an unknown care type and any extra field', () => {
    expect(CareGuideSchema.safeParse({ ...wellFormed, careTypeCode: 'detox' }).success).toBe(false);
    expect(CareGuideSchema.safeParse({ ...wellFormed, brand: 'x' }).success).toBe(false);
  });
});

describe('care guide coverage (FR1/AC1)', () => {
  it('ships exactly one guide per care type, keyed by its own code', () => {
    expect(Object.keys(CARE_GUIDES).sort()).toEqual([...CARE_TYPE_CODES].sort());
    for (const code of CARE_TYPE_CODES) {
      expect(CARE_GUIDES[code].careTypeCode).toBe(code);
    }
  });
});

describe('domain-content governance (D-26/D-70 — AC3)', () => {
  it('never ships content that skipped domain review', () => {
    for (const guide of guides) {
      expect(['candidate', 'validated']).toContain(guide.validationStatus);
    }
  });

  it('states an engineering-hypothesis source while the content is only `candidate`', () => {
    for (const guide of guides.filter((g) => g.validationStatus === 'candidate')) {
      expect(guide.rationaleSource).toMatch(/hipótese de engenharia/i);
    }
  });
});

/**
 * BR3 (AC4): the content is procedural and cosmetic. It must not read as medicine, promise a
 * result, name a commercial product, or invent a dosage — a domain reviewer signs off on hair
 * guidance, not on claims engineering slipped in.
 */
describe('content stays cosmetic, never medical or commercial (BR3 — AC4)', () => {
  // `®`, `™` and `%` are non-word characters: behind a `\b` they can never match, so an assertion
  // written that way passes on real violations. Each pattern therefore ships with a sample that
  // MUST match it — a guard that fails loudly if a future edit reintroduces that mistake.
  const FORBIDDEN: ReadonlyArray<readonly [string, RegExp, string]> = [
    ['diagnóstico', /\bdiagn[oó]stic\w*/i, 'faz o diagnóstico do fio'],
    [
      'tratamento médico',
      /\b(m[eé]dic\w*|dermatolog\w*|dermatit\w*|alopec\w*|seborrei\w*|patolog\w*)\b/i,
      'indicado para dermatite',
    ],
    [
      'cura / remédio',
      /\b(cura|curar|rem[eé]dio\w*|medicament\w*|prescri\w*|receit\w*)\b/i,
      'cura a quebra dos fios',
    ],
    ['promessa de resultado', /\bgarant\w*|\bcomprovadamente\b|100\s*%/i, 'garante 100% de brilho'],
    ['marca ou produto comercial', /\bmarca\b|®|™/i, 'use o Produto®'],
    [
      'dosagem química',
      /\b\d+\s*(ml|g|gramas)\b|\d+\s*%|\b(formol|am[oô]nia|[aá]cido)\b/i,
      'aplique 30 ml de ácido',
    ],
  ];

  it.each(FORBIDDEN)('contains no %s', (_label, pattern) => {
    for (const guide of guides) {
      const text = [guide.whatItIs, ...guide.steps, ...guide.commonMistakes].join(' | ');
      expect(text).not.toMatch(pattern);
    }
  });

  it.each(FORBIDDEN)('the %s check can actually detect a violation', (_label, pattern, sample) => {
    expect(sample).toMatch(pattern);
  });

  it('defers every timing to the product packaging instead of inventing one', () => {
    for (const guide of guides) {
      const text = [...guide.steps, ...guide.commonMistakes].join(' ');
      expect(text).toMatch(/embalagem/i);
      // A concrete "deixe agir N minutos" would be engineering inventing a hair-care rule (D-26).
      expect(text).not.toMatch(/\b\d+\s*(min|minutos?|horas?)\b/i);
    }
  });
});
