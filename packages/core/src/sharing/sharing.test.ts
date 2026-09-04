import { describe, expect, it } from 'vitest';

import { MILESTONES_V1, type JourneyView } from '../journey/index.ts';
import type { Progress } from '../progress/index.ts';
import { buildShareCard } from './application/build-share-card.ts';
import { careDoneMoment, cycleMoment, journeyMoment, milestoneMoments } from './application/moments.ts';
import { DEFAULT_SHARE_OPTIONS, SHARE_FORMATS, captureSizeOf } from './domain/share-card.ts';
import { SHARE_MOMENT_KINDS } from './domain/share-moment.ts';

/**
 * SPEC-044 (F45) e SPEC-045 (F46) — **o card e os momentos**.
 *
 * ⚠️ **Privacidade é a capability, não um extra dela** (D-103). O que estes testes guardam não é
 * layout: é que **nada dela sai sem ela ter ligado**, que identificador interno não tem por onde
 * chegar ao card, e que **nenhum momento afirma nada sobre o cabelo dela**.
 */

const journey = (over: Partial<JourneyView> = {}): JourneyView => ({
  points: 135,
  level: { level: 2, name: 'Em ritmo', toNext: 45, nextName: 'Constante' },
  streak: 5,
  caresAttended: 9,
  milestones: [
    { key: 'first_care', label: 'Primeiro cuidado', reached: true },
    { key: 'cares_25', label: '25 cuidados do seu plano', reached: false },
  ],
  frozen: false,
  ...over,
});

const progress = (over: Partial<Progress> = {}): Progress => ({
  elapsed: 12,
  done: 10,
  skipped: 1,
  overdue: 1,
  planned: 2,
  total: 14,
  checkInCount: 6,
  lifetimeDone: 23,
  averageFeel: 4.2,
  ...over,
});

const card = (over: Partial<Parameters<typeof buildShareCard>[0]> = {}) =>
  buildShareCard({
    moment: journeyMoment(journey()),
    displayName: 'Millie',
    avatar: 'flow_berry',
    options: DEFAULT_SHARE_OPTIONS,
    ...over,
  });

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
    const c = card({ options: { showName: true, showAvatar: true } });
    expect(c.displayName).toBe('Millie');
    expect(c.avatar).toBe('flow_berry');
  });

  /** SPEC-018 EC6 — quem pulou a pergunta do nome não ganha um nome por ligar o controle. */
  it('ligar o nome não inventa um nome que ela nunca deu', () => {
    const c = card({
      displayName: null,
      avatar: null,
      options: { showName: true, showAvatar: true },
    });
    expect(c.displayName).toBeNull();
    expect(c.avatar).toBeNull();
  });

  it('um nome longo trunca em vez de vazar do quadro (EC5)', () => {
    const c = card({
      displayName: 'Maria Antonieta de Albuquerque',
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
    const texto = JSON.stringify(card({ options: { showName: true, showAvatar: true } }));
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

describe('Momentos — cada gatilho, um card (SPEC-045 F46)', () => {
  it('a jornada: a sequência quando existe, na primeira pessoa', () => {
    const m = journeyMoment(journey());
    expect(m.value).toBe('5');
    expect(m.valueLabel).toBe('cuidados do meu plano em sequência');
    expect(m.headline).toBe('Em ritmo');
  });

  it('sem sequência, a jornada fala dos pontos — e não inventa um zero heroico', () => {
    const m = journeyMoment(journey({ streak: 0 }));
    expect(m.value).toBe('135');
    expect(m.valueLabel).toBe('pontos de constância');
  });

  /**
   * ⚠️ **Só marcos ALCANÇADOS viram card.** Oferecer um marco que ainda não chegou transformaria a
   * lista numa cobrança — e a SPEC-043 é explícita: marco não alcançado é marco que ainda não
   * chegou, nunca uma falha.
   */
  it('marcos: só os alcançados, um card cada', () => {
    const ms = milestoneMoments(journey());
    expect(ms).toHaveLength(1);
    expect(ms[0]?.value).toBe('Primeiro cuidado');
    expect(ms.some((m) => m.value.includes('25'))).toBe(false);
  });

  /**
   * ⚠️ **O rótulo do marco fala com ELA; o card fala com outras pessoas.** Na Jornada, "5 cuidados
   * do seu plano" está certo. No card, "seu" passa a apontar para quem está lendo — e o card diria
   * que a conquista é do leitor. Defeito visto a 390px, com o marco escolhido no seletor.
   *
   * A barreira percorre **todos** os marcos da régua: um marco novo escrito em segunda pessoa
   * quebra aqui em vez de vazar para o card.
   */
  it('nenhum marco chega ao card em segunda pessoa', () => {
    const todos = milestoneMoments(
      journey({ milestones: MILESTONES_V1.map((m) => ({ key: m.key, label: m.label, reached: true })) }),
    );
    expect(todos).toHaveLength(MILESTONES_V1.length);
    for (const m of todos) {
      expect(`${m.value} ${m.valueLabel} ${m.footnote ?? ''}`).not.toMatch(
        /\b(seu|sua|seus|suas|voce|você)\b/i,
      );
    }
    expect(todos.some((m) => m.valueLabel.includes('do meu plano'))).toBe(true);
    /**
     * ⚠️ **E o herói do card continua curto.** Mandar o rótulo inteiro para o `value` punha
     * "5 cuidados do meu plano" no tamanho de um número, e a 390px o card saía escrito
     * **"5 cuidad"**, cortado na borda — SVG não reflui texto, então nada avisa.
     */
    for (const m of todos) expect(m.value.length).toBeLessThanOrEqual(16);
  });

  it('marco nenhum alcançado não produz card nenhum', () => {
    const ms = milestoneMoments(journey({ milestones: [{ key: 'a', label: 'A', reached: false }] }));
    expect(ms).toHaveLength(0);
  });

  it('cuidado concluído: diz o que ela fez, com a sequência como contexto', () => {
    const m = careDoneMoment({ careLabel: 'Hidratação', journey: journey() });
    expect(m.value).toBe('Hidratação');
    expect(m.footnote).toBe('5 em sequência');
  });

  it('e sem sequência, o cuidado concluído se basta', () => {
    const m = careDoneMoment({ careLabel: 'Nutrição', journey: null });
    expect(m.footnote).toBeNull();
  });

  it('ciclo: contagem, e o total da vida quando é maior', () => {
    const m = cycleMoment(progress());
    expect(m.value).toBe('10');
    expect(m.valueLabel).toBe('cuidados do meu plano neste ciclo');
    expect(m.footnote).toBe('23 cuidados do meu plano no total');
  });

  it('singular e plural, porque "1 cuidados" é o detalhe que estraga o card', () => {
    expect(journeyMoment(journey({ streak: 1 })).valueLabel).toBe('cuidado do meu plano em sequência');
    expect(cycleMoment(progress({ done: 1, lifetimeDone: 1 })).valueLabel).toBe(
      'cuidado do meu plano neste ciclo',
    );
    expect(journeyMoment(journey({ caresAttended: 1 })).footnote).toBe('1 cuidado do meu plano até aqui');
  });

  it('cada momento tem uma chave própria — a lista não colide', () => {
    const todos = [
      journeyMoment(journey()),
      ...milestoneMoments(journey()),
      careDoneMoment({ careLabel: 'Hidratação', journey: journey() }),
      cycleMoment(progress()),
    ];
    expect(new Set(todos.map((m) => m.key)).size).toBe(todos.length);
  });
});

describe('Momentos — o que NENHUM deles pode dizer (D-26/D-70 e SPEC-009/019/021)', () => {
  const todos = [
    journeyMoment(journey()),
    journeyMoment(journey({ streak: 0 })),
    ...milestoneMoments(journey()),
    careDoneMoment({ careLabel: 'Hidratação', journey: journey() }),
    careDoneMoment({ careLabel: 'Reconstrução', journey: null }),
    cycleMoment(progress()),
    cycleMoment(progress({ done: 1, lifetimeDone: 1 })),
  ];

  /**
   * ⚠️ **Percentual, nota e média são recusa registrada em três SPECs.** Num card elas seriam a
   * mesma alegação, num lugar que ainda por cima sai do app. O `cycleMoment` em especial **não pode**
   * carregar `averageFeel`: é o número mais próximo de uma nota que o produto tem.
   */
  it('nenhuma porcentagem, nota, média ou comparação', () => {
    for (const m of todos) {
      const texto = `${m.headline} ${m.value} ${m.valueLabel} ${m.footnote ?? ''} ${m.chip}`;
      expect(texto).not.toMatch(/\d+\s?%/);
      expect(texto).not.toMatch(/nota|score|média|desempenho|ranking|melhor que|pior que/i);
      // "10 de 14" convida a calcular a porcentagem que a SPEC recusa.
      expect(texto).not.toMatch(/\d+\s+de\s+\d+/);
    }
  });

  /**
   * ⚠️ **Um card diz que ela FEZ, nunca o que aquilo fez com o cabelo dela.** O nome do cuidado é
   * vocabulário que o app já usa; "cabelo mais hidratado" seria alegação capilar (D-26/D-70).
   */
  it('nenhum momento afirma efeito sobre o cabelo dela', () => {
    for (const m of todos) {
      const frase = `${m.headline} ${m.valueLabel} ${m.footnote ?? ''}`;
      expect(frase).not.toMatch(/cabelo|fio|saud|bonit|brilho|frizz|dano|macie|recuper|melhor/i);
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

/**
 * SPEC-045 — **os tipos de momento, congelados.**
 *
 * O `F46` vai acrescentar gatilhos (Wash Day, progresso, comparação de ciclos). Acrescentar continua
 * possível: é mudar esta lista, de propósito, tendo lido por quê. O que deixa de ser possível é um
 * momento entrar **sem** verbo próprio e sem barreira de linguagem.
 */
describe('Momentos — o vocabulário congelado (SPEC-045)', () => {
  it('os quatro momentos são exatamente estes', () => {
    expect([...SHARE_MOMENT_KINDS]).toEqual(['journey', 'milestone', 'care_done', 'cycle']);
  });

  it('todo momento produzido pelo core declara um kind conhecido', () => {
    const todos = [
      journeyMoment(journey()),
      ...milestoneMoments(journey()),
      careDoneMoment({ careLabel: 'Hidratação', journey: journey() }),
      cycleMoment(progress()),
    ];
    const conhecidos = new Set<string>(SHARE_MOMENT_KINDS);
    for (const m of todos) expect(conhecidos.has(m.kind)).toBe(true);
  });
});
