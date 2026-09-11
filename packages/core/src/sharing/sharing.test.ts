import { describe, expect, it } from 'vitest';

import { MILESTONES_V1, type JourneyView } from '../journey/index.ts';
import type { Progress } from '../progress/index.ts';
import type { ShareMoment } from './domain/share-moment.ts';
import { buildShareCard } from './application/build-share-card.ts';
import {
  careDoneMoment,
  cycleClosedMoment,
  cycleMoments,
  cycleMoment,
  journeyMoment,
  milestoneMoments,
  progressMoment,
  washDayMoment,
} from './application/moments.ts';
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
  level: {
    level: 2,
    name: 'Em ritmo',
    toNext: 45,
    nextName: 'Constante',
    pointsIntoLevel: 75,
    levelSpan: 120,
  },
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

  /**
   * ⚠️ **O Wash Day é o cuidado, do lugar onde ela conta o ritual.** O herói é o cuidado e a
   * sequência é o contexto — nada do que ela marcou (quantos produtos, quais técnicas) vira número no
   * card, porque contagem lê como "quanto mais, melhor" (D-103).
   */
  it('Wash Day: o ritual do dia, com a sequência como contexto', () => {
    const m = washDayMoment({ careLabel: 'Hidratação', journey: journey() });
    expect(m.value).toBe('Hidratação');
    expect(m.valueLabel).toBe('o meu ritual de hoje');
    expect(m.footnote).toBe('5 em sequência');
  });

  it('e sem sequência, o Wash Day se basta', () => {
    expect(washDayMoment({ careLabel: 'Nutrição', journey: null }).footnote).toBeNull();
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
      washDayMoment({ careLabel: 'Hidratação', journey: journey() }),
      cycleMoment(progress()),
    ];
    expect(new Set(todos.map((m) => m.key)).size).toBe(todos.length);
  });
});

/**
 * SPEC-068 — **a escolha do card do Progresso, num lugar testável.**
 *
 * ⚠️ Ela morava na tela (`apps/mobile/src/app/index.tsx`, 900+ linhas, zero cobertura), e guarda
 * três invariantes que ninguém veria quebrar ali.
 */
describe('SPEC-068 — qual card o Progresso oferece (F46)', () => {
  const cycle = { endsOn: '2026-09-30' } as unknown as Parameters<typeof cycleMoments>[0]['cycle'];
  const em = (over: Partial<Progress> = {}) =>
    cycleMoments({ progress: progress(over), cycle, today: '2026-09-15' });

  it('em andamento: o ciclo corrente, e o progresso quando acrescenta', () => {
    expect(em().map((m) => m.kind)).toEqual(['cycle', 'progress']);
  });

  /** ⚠️ **Nunca os dois cards de ciclo**: encerrado ou em andamento, um só. */
  it('encerrado pela data: o card do ciclo encerrado, e só ele', () => {
    const fim = cycleMoments({ progress: progress(), cycle, today: '2026-10-01' });
    expect(fim.map((m) => m.kind)).toEqual(['cycle_closed', 'progress']);
  });

  /** A segunda entrada de "encerrado": ela resolveu tudo antes do prazo (D-82). */
  it('resolver tudo antes do prazo também fecha o ciclo', () => {
    expect(em({ planned: 0, overdue: 0 }).map((m) => m.kind)).toEqual(['cycle_closed', 'progress']);
  });

  /**
   * ⛔ **EC4 — zero cuidado atendido não vira card.** Um ciclo em branco não é conquista, é cobrança
   * de véspera; e é aqui que a regra mora, não no botão da tela.
   */
  it('sem cuidado atendido, nenhum card de ciclo — mas o de até aqui continua', () => {
    expect(em({ done: 0 }).map((m) => m.kind)).toEqual(['progress']);
  });

  /** E sem nada em lugar nenhum, a lista é vazia: a tela não oferece o que não existe. */
  it('sem ciclo e sem história, não há o que oferecer', () => {
    expect(em({ done: 0, lifetimeDone: 0 })).toEqual([]);
  });
});

describe('Momentos — o que NENHUM deles pode dizer (D-26/D-70 e SPEC-009/019/021)', () => {
  const todos = [
    journeyMoment(journey()),
    journeyMoment(journey({ streak: 0 })),
    ...milestoneMoments(journey()),
    careDoneMoment({ careLabel: 'Hidratação', journey: journey() }),
    careDoneMoment({ careLabel: 'Reconstrução', journey: null }),
    washDayMoment({ careLabel: 'Hidratação', journey: journey() }),
    washDayMoment({ careLabel: 'Reconstrução', journey: null }),
    cycleMoment(progress()),
    cycleMoment(progress({ done: 1, lifetimeDone: 1 })),
    cycleClosedMoment(progress()),
    cycleClosedMoment(progress({ done: 1, lifetimeDone: 1 })),
    progressMoment(progress()) as ShareMoment,
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

describe('SPEC-068 — o seletor é um NOME por momento (F46)', () => {
  /**
   * ⚠️ **Medido a 390px:** com sete momentos, o seletor ocupava **quatro linhas** — os chips mais
   * largos eram os marcos (162px e 170px), porque carregavam a frase inteira escrita para a tela.
   * O chip virou nome; a frase continua no card, logo acima.
   */
  const comMarcos = () =>
    journey({
      milestones: [
        { key: 'first_care', label: 'Primeiro cuidado', reached: true },
        { key: 'cares_5', label: '5 cuidados do seu plano', reached: true },
        { key: 'cares_10', label: '10 cuidados do seu plano', reached: true },
        { key: 'cares_25', label: '25 cuidados do seu plano', reached: true },
        { key: 'streak_3', label: '3 seguidos', reached: true },
        { key: 'streak_7', label: '7 seguidos', reached: true },
      ] as JourneyView['milestones'],
    });

  it('o chip do marco é o nome dele, não a frase da tela', () => {
    const chips = milestoneMoments(comMarcos()).map((m) => m.chip);
    expect(chips).not.toContain('5 cuidados do seu plano');
    expect(chips).toContain('5 cuidados');
  });

  /** ⛔ E encurtar não pode fundir dois marcos num nome só: o seletor tem de continuar escolhendo. */
  it('marcos diferentes continuam com nomes diferentes', () => {
    const todos = milestoneMoments(comMarcos());
    expect(new Set(todos.map((m) => m.chip)).size).toBe(todos.length);
  });

  /** ⚠️ E o card **não** encurtou: a frase inteira, na primeira pessoa, continua sendo o que sai. */
  it('a frase completa continua no card', () => {
    const m = milestoneMoments(comMarcos()).find((x) => x.chip === '5 cuidados');
    expect(`${m?.value} ${m?.valueLabel}`).toBe('5 cuidados do meu plano');
  });
});

describe('SPEC-068 — o ciclo encerrado e o progresso da vida inteira (F46)', () => {
  /**
   * ⚠️ **Ciclo em andamento e ciclo encerrado são conquistas diferentes**, e a tela do Progresso já
   * os trata como estados diferentes (SPEC-021: o resumo só aparece encerrado). O card acompanha.
   */
  it('o ciclo encerrado tem manchete própria, e a mesma contagem', () => {
    const m = cycleClosedMoment(progress());
    expect(m.headline).toBe('Ciclo encerrado');
    expect(m.value).toBe('10');
    expect(m.valueLabel).toBe('cuidados do meu plano neste ciclo');
  });

  /**
   * ⛔ **"Concluído" foi recusado de propósito.** Ele lê como *"cumpri tudo"*, e a contagem não diz
   * isso — ela diz quantos cuidados do plano ela atendeu, sem denominador. "Encerrado" é sobre o
   * calendário; é a palavra que a própria tela usa (SPEC-021).
   */
  it('nenhum card de ciclo afirma que ela cumpriu tudo', () => {
    for (const m of [cycleClosedMoment(progress()), cycleClosedMoment(progress({ done: 1 }))]) {
      expect(`${m.headline} ${m.valueLabel}`).not.toMatch(/conclu[ií]|complet|cumpri|100|tudo/i);
    }
  });

  /** Os dois ciclos ocupam **o mesmo lugar** na lista: só um deles existe por vez. */
  it('em andamento e encerrado dividem a chave, porque são mutuamente exclusivos', () => {
    expect(cycleClosedMoment(progress()).key).toBe(cycleMoment(progress()).key);
  });

  /**
   * ⚠️ **O número que atravessa a troca de plano** (SPEC-014 FR7) — e ⚠️ **é aderência, não volume**:
   * a execução avulsa não entra em `lifetimeDone` (SPEC-052), então ele não sobe por ela fazer mais
   * fora do cronograma.
   */
  it('o progresso da vida inteira é o herói do próprio card', () => {
    const m = progressMoment(progress());
    expect(m?.value).toBe('23');
    expect(m?.valueLabel).toBe('cuidados do meu plano desde o começo');
    expect(m?.footnote).toBe('10 neste ciclo');
  });

  /**
   * ⛔ **No primeiro ciclo ele empataria com o ciclo**, e dois cartões com o mesmo número lado a lado
   * é o defeito que a auditoria da SPEC-026 mediu na Hoje. Não existe em vez de repetir.
   */
  it('não existe quando empataria com o número do ciclo', () => {
    expect(progressMoment(progress({ done: 7, lifetimeDone: 7 }))).toBeNull();
    expect(progressMoment(progress({ done: 0, lifetimeDone: 0 }))).toBeNull();
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
  it('os momentos são exatamente estes', () => {
    expect([...SHARE_MOMENT_KINDS]).toEqual([
      'journey',
      'milestone',
      'care_done',
      'cycle',
      'cycle_closed',
      'progress',
      'wash_day',
      // SPEC-073 (`P25`) — acrescentado de propósito, com verbo próprio e barreira de linguagem
      // (contagem, primeira pessoa, sem denominador) em `insight-moments.test.ts`.
      'insight',
    ]);
  });

  it('todo momento produzido pelo core declara um kind conhecido', () => {
    const todos = [
      journeyMoment(journey()),
      ...milestoneMoments(journey()),
      careDoneMoment({ careLabel: 'Hidratação', journey: journey() }),
      washDayMoment({ careLabel: 'Hidratação', journey: journey() }),
      cycleMoment(progress()),
      cycleClosedMoment(progress()),
      progressMoment(progress()) as ShareMoment,
    ];
    const conhecidos = new Set<string>(SHARE_MOMENT_KINDS);
    for (const m of todos) expect(conhecidos.has(m.kind)).toBe(true);
  });
});
