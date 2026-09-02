import { describe, expect, it } from 'vitest';

import {
  SCALP_FEELS,
  ScalpFeelSchema,
  WASH_DAY_TECHNIQUES,
  WashDayTechniqueSchema,
} from './domain/wash-day.ts';

/**
 * SPEC-024 BR2/AC7 — o vocabulário é a capability.
 *
 * Texto livre seria mais fácil de escrever e **não se compara nem se agrega**: `P5`, `P6`, `P7` e
 * `P8` leem *técnica × produto × resultado*, e nenhum deles consegue ler um parágrafo. O que estes
 * testes protegem não é a lista — é a razão de ela ser fechada.
 */
describe('vocabulário de técnicas do Wash Day (SPEC-024)', () => {
  it('é fechado: qualquer coisa fora da lista é recusada antes da chamada', () => {
    for (const technique of WASH_DAY_TECHNIQUES) {
      expect(WashDayTechniqueSchema.safeParse(technique).success).toBe(true);
    }
    // O mesmo valor que o `CHECK` do banco recusa (pgTAP §11): a validação de cá evita a viagem, a
    // de lá é a que importa contra um cliente adulterado.
    expect(WashDayTechniqueSchema.safeParse('selar_as_cuticulas').success).toBe(false);
    expect(WashDayTechniqueSchema.safeParse('').success).toBe(false);
  });

  it('não repete valor', () => {
    expect(new Set(WASH_DAY_TECHNIQUES).size).toBe(WASH_DAY_TECHNIQUES.length);
  });

  /**
   * A barreira que mantém o `F25` fora do gate de domínio (D-26/D-70).
   *
   * Cada valor nomeia o que ela **faz**. No instante em que um nomear o que aquilo **provoca**, a
   * lista deixa de ser vocabulário de registro e vira orientação capilar — que exige sign-off de
   * revisor de domínio, e que esta capability não tem. As amostras precisam casar, senão a barreira
   * não protege coisa alguma.
   */
  it('nomeia o gesto, nunca o efeito', () => {
    // Os códigos são em inglês (o idioma do código), então a barreira também é: um padrão em
    // pt-BR nunca casaria com o que está escrito e passaria sempre, que é uma barreira que não
    // protege nada — o defeito que a auditoria da SPEC-007 encontrou.
    const effect = [
      /seal/,
      /repair|restor|rebuild/,
      /strengthen|fortif/,
      /hydrat|nourish|moistur/,
      /shine|shiny|soft|defin|frizz/,
      /damag|health/,
    ];
    for (const technique of WASH_DAY_TECHNIQUES) {
      for (const pattern of effect) expect(pattern.test(technique)).toBe(false);
    }
    for (const sample of ['seal_cuticles', 'repair_bonds', 'adds_shine', 'hydrates_deeply']) {
      expect(effect.some((p) => p.test(sample))).toBe(true);
    }
  });
});

/**
 * SPEC-025 BR2/NG1/AC7 — o vocabulário do couro cabeludo.
 *
 * É o `scalp_tendency` da SPEC-002 sem o `unknown`, e essa escolha é a capability inteira:
 * reaproveitar um conjunto que **já passou pelo gate de domínio** é o que mantém o `F31` fora do
 * D-26. Uma palavra a mais e o dado muda de natureza.
 */
describe('vocabulário de couro cabeludo (SPEC-025)', () => {
  it('é fechado, e não repete valor', () => {
    for (const feel of SCALP_FEELS) expect(ScalpFeelSchema.safeParse(feel).success).toBe(true);
    expect(new Set(SCALP_FEELS).size).toBe(SCALP_FEELS.length);
    // O mesmo valor que o `CHECK` do banco recusa (pgTAP §11).
    expect(ScalpFeelSchema.safeParse('itchy').success).toBe(false);
  });

  /**
   * A barreira que separa **cosmética capilar** de **dado de saúde**.
   *
   * Coceira, descamação, dor, ferida e queda são o que mais se pede num check-in de couro cabeludo,
   * e são exatamente o que muda a natureza do dado: base legal LGPD com a tabela `consents`, que não
   * existe (D-32), **e** sign-off de domínio (D-26). Duas chaves, nenhuma delas do agente. As
   * amostras precisam casar, senão a barreira não protege coisa alguma.
   */
  it('não nomeia sintoma clínico', () => {
    const symptom = [
      /itch|scratch/,
      /flak|dandruff|scal(e|y)/,
      /pain|sore|wound|lesion/,
      /inflam|irritat/,
      /loss|shed|thinning/,
    ];
    for (const feel of SCALP_FEELS) {
      for (const pattern of symptom) expect(pattern.test(feel)).toBe(false);
    }
    for (const sample of ['itchy', 'flaky_dandruff', 'painful_sore', 'inflamed', 'hair_loss']) {
      expect(symptom.some((p) => p.test(sample))).toBe(true);
    }
  });

  /** BR3 — não é escala: nenhum valor carrega juízo, e "normal"/"saudável" seriam juízo. */
  it('não nomeia um valor como o certo', () => {
    for (const feel of SCALP_FEELS) {
      expect(/normal|healthy|ideal|good|bad|worse|better/.test(feel)).toBe(false);
    }
  });
});
