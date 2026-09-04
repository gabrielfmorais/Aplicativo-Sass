import { describe, expect, it } from 'vitest';

import type { JourneyView } from '../journey/index.ts';
import { buildShareCard } from './application/build-share-card.ts';
import { DEFAULT_SHARE_OPTIONS, SHARE_FORMATS, captureSizeOf } from './domain/share-card.ts';

/**
 * SPEC-044 (F45) — **o card compartilhável**.
 *
 * ⚠️ **Privacidade é a capability, não um extra dela** (D-103). O que estes testes guardam não é
 * layout: é que **nada dela sai sem ela ter ligado**, e que identificador interno não tem por onde
 * chegar ao card.
 */

const journey = (over: Partial<JourneyView> = {}): JourneyView => ({
  points: 135,
  level: { level: 2, name: 'Em ritmo', toNext: 45, nextName: 'Constante' },
  streak: 5,
  caresAttended: 9,
  milestones: [{ key: 'first_care', label: 'Primeiro cuidado', reached: true }],
  frozen: false,
  ...over,
});

const card = (over: Parameters<typeof buildShareCard>[0] | null = null) =>
  buildShareCard(
    over ?? {
      journey: journey(),
      displayName: 'Millie',
      avatar: 'flow_berry',
      options: DEFAULT_SHARE_OPTIONS,
    },
  );

describe('Share card — o padrão é privado (SPEC-044 BR6)', () => {
  /**
   * ⚠️ **O preview é o consentimento, não um aviso.** Um padrão que já trouxesse o nome dela
   * transformaria a tela numa confirmação do que já foi decidido por ela — que é exatamente a
   * inversão que a D-103 proíbe quando exige `preview → ela decide → share`.
   */
  it('nome e avatar começam DESLIGADOS, mesmo existindo', () => {
    const c = card();
    expect(c.displayName).toBeNull();
    expect(c.avatar).toBeNull();
  });

  it('e entram só quando ela liga', () => {
    const c = card({
      journey: journey(),
      displayName: 'Millie',
      avatar: 'flow_berry',
      options: { showName: true, showAvatar: true },
    });
    expect(c.displayName).toBe('Millie');
    expect(c.avatar).toBe('flow_berry');
  });

  /** SPEC-018 EC6 — quem pulou a pergunta do nome não ganha um nome por ligar o controle. */
  it('ligar o nome não inventa um nome que ela nunca deu', () => {
    const c = card({
      journey: journey(),
      displayName: null,
      avatar: null,
      options: { showName: true, showAvatar: true },
    });
    expect(c.displayName).toBeNull();
    expect(c.avatar).toBeNull();
  });

  it('um nome longo trunca em vez de vazar do quadro (EC5)', () => {
    const c = card({
      journey: journey(),
      displayName: 'Maria Antonieta de Albuquerque',
      avatar: null,
      options: { showName: true, showAvatar: false },
    });
    expect(c.displayName).toMatch(/…$/);
    expect((c.displayName ?? '').length).toBeLessThanOrEqual(18);
  });
});

describe('Share card — nada interno atravessa (SPEC-044 BR1)', () => {
  /**
   * ⚠️ **A barreira estrutural.** `buildShareCard` não recebe `user_id`, id de fato nem e-mail, e o
   * tipo de saída não tem onde guardá-los. Este teste fixa isso contra o dia em que alguém quiser
   * "só passar a view inteira" para o card.
   */
  it('nenhum campo do card se parece com identificador', () => {
    const c = card({
      journey: journey(),
      displayName: 'Millie',
      avatar: 'flow_berry',
      options: { showName: true, showAvatar: true },
    });
    const texto = JSON.stringify(c);
    expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i); // uuid
    expect(texto).not.toMatch(/@/); // e-mail
    expect(texto).not.toMatch(/user_?id|userId|fact_?id|token|session/i);
  });

  it('o card só tem os campos que a SPEC declara', () => {
    expect(Object.keys(card()).sort()).toEqual(
      ['avatar', 'displayName', 'footnote', 'headline', 'value', 'valueLabel'].sort(),
    );
  });
});

describe('Share card — o conteúdo vem pronto da Jornada (SPEC-044 BR4/BR5)', () => {
  it('a sequência é a conquista quando existe, na primeira pessoa', () => {
    const c = card();
    expect(c.value).toBe('5');
    expect(c.valueLabel).toBe('cuidados do meu plano em sequência');
    expect(c.headline).toBe('Em ritmo');
  });

  it('sem sequência, o card fala dos pontos — e não inventa um zero heroico', () => {
    const c = card({
      journey: journey({ streak: 0 }),
      displayName: null,
      avatar: null,
      options: DEFAULT_SHARE_OPTIONS,
    });
    expect(c.value).toBe('135');
    expect(c.valueLabel).toBe('pontos de constância');
  });

  it('singular e plural, porque "1 cuidados" é o detalhe que estraga o card', () => {
    const um = card({
      journey: journey({ streak: 1, caresAttended: 1 }),
      displayName: null,
      avatar: null,
      options: DEFAULT_SHARE_OPTIONS,
    });
    expect(um.valueLabel).toBe('cuidado do meu plano em sequência');
    expect(um.footnote).toBe('1 cuidado do meu plano até aqui');
  });

  it('sem cuidado atendido, não há rodapé em vez de um rodapé vazio', () => {
    const c = card({
      journey: journey({ caresAttended: 0 }),
      displayName: null,
      avatar: null,
      options: DEFAULT_SHARE_OPTIONS,
    });
    expect(c.footnote).toBeNull();
  });

  /**
   * ⚠️ **As recusas da SPEC-009/019/021 valem no card exatamente como valem na tela** (BR5). Um
   * percentual ou uma nota aqui seria a mesma alegação recusada três vezes, num lugar em que ela
   * ainda por cima sai do app.
   */
  it('nenhuma porcentagem, nota ou palavra sobre o cabelo dela', () => {
    for (const streak of [0, 1, 5]) {
      const texto = JSON.stringify(
        card({
          journey: journey({ streak }),
          displayName: null,
          avatar: null,
          options: DEFAULT_SHARE_OPTIONS,
        }),
      );
      expect(texto).not.toMatch(/\d+\s?%/);
      expect(texto).not.toMatch(/nota|score|desempenho|ranking|média/i);
      expect(texto).not.toMatch(/cabelo|fio|hidrat|nutri|reconstru|saud|brilho|frizz|dano/i);
    }
  });
});

describe('Share card — os formatos que as redes esperam (SPEC-044 FR2)', () => {
  /**
   * ⚠️ **O PNG tem de sair em 1080.** O rasterizador do SVG usa o tamanho **renderizado** quando não
   * recebe medidas — o card iria para o Instagram com ~210px de largura, e os formatos de 1080
   * existiriam só no papel. Esta é a barreira contra remover as medidas da captura.
   */
  it('a captura usa as medidas do formato, nunca as da tela', () => {
    expect(captureSizeOf('story')).toEqual({ width: 1080, height: 1920 });
    expect(captureSizeOf('feed')).toEqual({ width: 1080, height: 1080 });
  });

  it('9:16 para Stories e 1:1 para feed', () => {
    expect(SHARE_FORMATS.story.width / SHARE_FORMATS.story.height).toBeCloseTo(9 / 16, 3);
    expect(SHARE_FORMATS.feed.width).toBe(SHARE_FORMATS.feed.height);
  });
});
