import { describe, expect, it } from 'vitest';

import { HUNA_AVATARS, isHunaAvatar } from './application/ports.ts';

/**
 * SPEC-042 (F34) — as marcas da Huna.
 *
 * 🔒 **A barreira é a direção canônica do hero (SPEC-036), aplicada a um círculo de 40px.** As
 * marcas são abstratas: fluxo, mechas, movimento. **Sem personagem, sem rosto, sem cabeça, sem
 * corpo, sem silhueta humana** — e num avatar um rosto erra por definição, que é o motivo de quatro
 * tentativas de hero terem sido reprovadas.
 */
describe('marcas da Huna (SPEC-042)', () => {
  it('são estas seis, e todas nomeiam fluxo', () => {
    expect([...HUNA_AVATARS]).toEqual([
      'flow_plum',
      'flow_wine',
      'flow_berry',
      'flow_violet',
      'flow_amber',
      'flow_teal',
    ]);
    for (const avatar of HUNA_AVATARS) {
      expect(avatar.startsWith('flow_')).toBe(true);
    }
  });

  /**
   * ⚠️ Se você chegou aqui acrescentando uma marca com **pessoa** — rosto, cabeça, corpo,
   * personagem, silhueta —, ela não entra: a direção do hero foi decidida pelo dono em 2026-09-03
   * (SPEC-036) e só muda com uma decisão nova e explícita dele.
   */
  it('nenhuma marca nomeia pessoa, rosto ou personagem (SPEC-036)', () => {
    for (const avatar of HUNA_AVATARS) {
      expect(avatar).not.toMatch(/face|rosto|girl|woman|mulher|person|avatar_?her|head|body|char/i);
    }
  });

  it('o vocabulário é fechado — o mesmo valor que o CHECK do banco recusa', () => {
    for (const avatar of HUNA_AVATARS) expect(isHunaAvatar(avatar)).toBe(true);
    expect(isHunaAvatar('flow_neon')).toBe(false);
    expect(isHunaAvatar('photo')).toBe(false);
    expect(isHunaAvatar('')).toBe(false);
  });
});
