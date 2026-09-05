import { describe, expect, it } from 'vitest';

import { CHECKIN_MARKS } from './domain/care-tracking.ts';
import {
  FINISH_STATUSES,
  FINISH_TECHNIQUES,
  FinishStatusSchema,
  FinishTechniqueSchema,
  SCALP_FEELS,
  WASH_DAY_TECHNIQUES,
  WashDayTechniqueSchema,
} from './domain/wash-day.ts';

/**
 * SPEC-039 §8 (F37) — **a barreira estrutural contra a fusão.**
 *
 * A D-102 diz, em prosa, que finalização e técnica são etapas diferentes e que fundi-las destrói o
 * `P8`. Prosa não reprova commit. E a fusão não é hipotética: **seis das catorze técnicas já são
 * movimentos de finalização** (`air_dried`, `blow_dried`, `diffuser`, `scrunched`,
 * `heat_protectant`, `protective_style`), então a lista aceitaria `fitagem` amanhã sem que nada
 * apitasse — nem o compilador, nem o `CHECK`, nem uma revisão distraída.
 *
 * Estes testes são o apito.
 */
describe('finalização é uma etapa, não uma técnica (SPEC-039 §8)', () => {
  /**
   * TRAVA 1 — a lista de técnicas está **congelada** no que a SPEC-024 aprovou.
   *
   * Acrescentar uma técnica de lavagem continua possível: é mudar esta lista, de propósito, tendo
   * lido por quê. O que deixa de ser possível é acrescentar **em silêncio** — que é como uma
   * finalização entraria.
   */
  it('as catorze técnicas da SPEC-024 são exatamente estas', () => {
    expect([...WASH_DAY_TECHNIQUES]).toEqual([
      'pre_wash_oil',
      'scalp_massage',
      'double_cleanse',
      'co_wash',
      'left_on_longer',
      'cold_rinse',
      'detangled_with_fingers',
      'wide_tooth_comb',
      'air_dried',
      'blow_dried',
      'heat_protectant',
      'scrunched',
      'diffuser',
      'protective_style',
    ]);
    // Se você chegou aqui acrescentando uma FINALIZAÇÃO (fitagem, dedoliss, day after, técnica por
    // curvatura): ela não mora nesta lista. A etapa é `wash_day_finish` (SPEC-039), e o vocabulário
    // de técnicas de finalização é o `F38` — conteúdo capilar substantivo, atrás do gate D-26/D-70.
  });

  /**
   * TRAVA 2 — os dois vocabulários não se tocam.
   *
   * Uma técnica responde *como*; a etapa responde *se aconteceu* (BR3). Um valor que servisse aos
   * dois seria a prova de que alguém confundiu as perguntas.
   */
  it('nenhum valor pertence aos dois vocabulários', () => {
    const techniques = new Set<string>(WASH_DAY_TECHNIQUES);
    for (const status of FINISH_STATUSES) {
      expect(techniques.has(status)).toBe(false);
    }
    for (const technique of WASH_DAY_TECHNIQUES) {
      expect(FinishStatusSchema.safeParse(technique).success).toBe(false);
    }
    for (const status of FINISH_STATUSES) {
      expect(WashDayTechniqueSchema.safeParse(status).success).toBe(false);
    }
  });

  /**
   * TRAVA 3 — a etapa não é um vocabulário de finalização disfarçado.
   *
   * `done` e `skipped` dizem se aconteceu. No dia em que alguém tentar pendurar aqui o **conteúdo**
   * do `F38` — que finalização foi, para que serve, para quem é —, este teste cai, e a conversa que
   * ele força é a do gate D-26/D-70.
   */
  it('a etapa tem duas respostas, e nenhuma delas nomeia uma técnica', () => {
    expect([...FINISH_STATUSES]).toEqual(['done', 'skipped']);
    for (const invented of ['fitagem', 'dedoliss', 'day_after', 'plopping', 'finger_coil']) {
      expect(FinishStatusSchema.safeParse(invented).success).toBe(false);
    }
  });

  /**
   * BR1 — `skipped` é uma **resposta**; a ausência é "ainda não disse".
   *
   * A mesma distinção do `F35`, e pela mesma razão: preencher a ausência com um valor faria o
   * produto ler como fato dela algo que ela nunca disse. É por isso que a coluna nasceu **sem
   * DEFAULT** e que o tipo do registro é `FinishStatus | null`, e não `FinishStatus`.
   */
  it('pular é uma resposta, e não a ausência de uma', () => {
    expect(FinishStatusSchema.safeParse('skipped').success).toBe(true);
    expect(FinishStatusSchema.safeParse(null).success).toBe(false);
    expect(FinishStatusSchema.safeParse('unknown').success).toBe(false);
  });
});

/**
 * SPEC-048 (F38) — **TRAVA 4: o vocabulário de QUAL finalização, e a fronteira dele.**
 *
 * A lista veio do dono (2026-09-04) e entra como **`candidate`**. O que estas asserções guardam é a
 * separação que a SPEC-039 §8 criou: ela continua valendo agora que a finalização **tem** nome.
 */
describe('qual finalização — vocabulário candidate e disjunto (SPEC-048)', () => {
  it('é exatamente a lista que o dono aprovou', () => {
    expect([...FINISH_TECHNIQUES]).toEqual([
      'fitagem_tradicional',
      'fitagem_estruturada',
      'dedoliss',
      'rake_and_shake',
      'plopping',
      'twist_out',
      'other',
      'unknown',
    ]);
    // ⚠️ `day_after` ficou **de fora** por decisão do dono: revitalização é conceito separado.
    expect(FinishTechniqueSchema.safeParse('day_after').success).toBe(false);
  });

  /**
   * ⚠️ **Os três vocabulários não se tocam.** Técnica responde *como lavou*; a etapa responde *se
   * finalizou*; a técnica de finalização responde *qual*. Um valor que servisse a dois seria a
   * prova de que alguém confundiu as perguntas — e é assim que a fusão que a D-102 proibiu
   * recomeçaria.
   */
  it('nenhum valor pertence a dois vocabulários', () => {
    const tecnicas = new Set<string>(WASH_DAY_TECHNIQUES);
    const etapas = new Set<string>(FINISH_STATUSES);
    for (const value of FINISH_TECHNIQUES) {
      expect(tecnicas.has(value)).toBe(false);
      expect(etapas.has(value)).toBe(false);
      expect(WashDayTechniqueSchema.safeParse(value).success).toBe(false);
      expect(FinishStatusSchema.safeParse(value).success).toBe(false);
    }
    for (const technique of WASH_DAY_TECHNIQUES) {
      expect(FinishTechniqueSchema.safeParse(technique).success).toBe(false);
    }
    for (const status of FINISH_STATUSES) {
      expect(FinishTechniqueSchema.safeParse(status).success).toBe(false);
    }
  });

  /**
   * ⚠️ **Sem texto livre** (SPEC-024): `other` cobre o que está fora da lista e `unknown` é "fiz e
   * não sei o nome". Texto livre não se compara nem se agrega, e destruiria `P5`/`P6`/`P7`/`P8`.
   */
  it('other e unknown existem justamente para não haver campo aberto', () => {
    expect(FinishTechniqueSchema.safeParse('other').success).toBe(true);
    expect(FinishTechniqueSchema.safeParse('unknown').success).toBe(true);
    expect(FinishTechniqueSchema.safeParse('fitagem inventada por mim').success).toBe(false);
  });

  /**
   * ⚠️ **`null` NÃO é `unknown`.** Ausência é "ainda não disse qual"; `unknown` é uma resposta —
   * *"fiz e não sei o nome"*. A mesma distinção que o `F35` teve de fazer, e pela mesma razão:
   * preencher a ausência faria o produto ler como fato dela algo que ela nunca disse.
   */
  it('ausência e "não sei o nome" são coisas diferentes', () => {
    expect(FinishTechniqueSchema.safeParse(null).success).toBe(false);
    expect(FinishTechniqueSchema.safeParse('unknown').success).toBe(true);
  });
});

/**
 * SPEC-051 (`P13`) — **o vocabulário do que ela notou, congelado.**
 *
 * ⚠️ Mudar esta lista depois **quebra a série histórica** (Blueprint §8): comparar ao longo do tempo
 * exige que a palavra signifique a mesma coisa em janeiro e em junho. A trava existe para a mudança
 * ser uma decisão, nunca um descuido.
 */
describe('SPEC-051 — o que ela notou (TRAVA 5)', () => {
  it('a lista é exatamente a metade `cabelo` do Blueprint §8', () => {
    expect([...CHECKIN_MARKS]).toEqual(['softness', 'shine', 'frizz', 'definition', 'dryness']);
  });

  /**
   * ⛔ **A metade `couro` NÃO entra nesta fatia.** *Sensível · coçando · descamando* é sintoma, e a
   * fronteira com o clínico é fina: é a **OQ2 da SPEC-025**, atrás de **duas** chaves que não são do
   * agente — base legal LGPD (D-32) e sign-off de domínio (D-26).
   */
  it('nenhum valor de couro cabeludo atravessa para cá', () => {
    for (const couro of [...SCALP_FEELS, 'itching', 'flaking', 'sensitive', 'normal'])
      expect((CHECKIN_MARKS as readonly string[]).includes(couro)).toBe(false);
  });

  /** ⚠️ Os quatro vocabulários seguem estruturalmente disjuntos. */
  it('não colide com técnicas, finalizações nem etapas', () => {
    for (const outro of [...WASH_DAY_TECHNIQUES, ...FINISH_TECHNIQUES, ...FINISH_STATUSES])
      expect((CHECKIN_MARKS as readonly string[]).includes(outro)).toBe(false);
  });

  /**
   * ⚠️ **A lista mistura sinais de propósito, e isso é a decisão — não um descuido.** Dar direção a
   * cada qualidade dobraria vocabulário e toques; separar em "o que ficou bom" e "o que incomodou"
   * exigiria que engenharia decidisse que frizz é ruim. A pergunta é neutra, e a nota de 1 a 5
   * continua carregando a valência.
   */
  it('nenhum valor carrega direção embutida', () => {
    for (const mark of CHECKIN_MARKS) expect(mark).not.toMatch(/_good$|_bad$|_high$|_low$|^no_/);
  });

  /** ⛔ **Sem texto livre**, aqui como na SPEC-024: não se compara, não se agrega, e é PII. */
  it('a lista é fechada e não tem escape para texto livre', () => {
    for (const escape of ['other', 'unknown', 'custom', 'free_text'])
      expect((CHECKIN_MARKS as readonly string[]).includes(escape)).toBe(false);
  });
});
