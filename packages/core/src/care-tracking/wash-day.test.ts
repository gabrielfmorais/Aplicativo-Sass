import { describe, expect, it } from 'vitest';

import { WASH_DAY_TECHNIQUES, WashDayTechniqueSchema } from './domain/wash-day.ts';

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
