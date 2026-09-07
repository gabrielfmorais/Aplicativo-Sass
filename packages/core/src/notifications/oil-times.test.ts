import { describe, expect, it } from 'vitest';

import { localDateFromString } from '../shared/index.ts';
import type { TodayView } from '../care-tracking/index.ts';
import {
  MAX_NOTIFICATIONS_PER_DAY,
  NOTIFICATION_HORIZON_DAYS,
  OIL_NOTIFICATION_BUDGET,
  buildNotificationIntents,
  type NotificationIntent,
  type NotificationPreferences,
} from './index.ts';

/**
 * ⚠️ **SPEC-053 — vários horários de óleo no mesmo dia, no lugar onde eles viram lembrete.**
 *
 * O que este arquivo protege, em ordem de importância: que **nenhum horário que ela pediu seja
 * descartado em silêncio**, que o volume **nunca estoure o orçamento da plataforma**, e que uma
 * rotina **sem** horários continue se comportando exatamente como antes desta SPEC.
 */

const TODAY = localDateFromString('2026-09-07');

/** Uma Hoje vazia: aqui só interessa o óleo, e o resto do app não pode contaminar a contagem. */
const emptyView: TodayView = {
  overdue: [],
  today: [],
  upcoming: [],
  history: [],
} as unknown as TodayView;

const prefs: NotificationPreferences = {
  enabled: true,
  reminderTimeLocal: '19:00',
  checkinReminderEnabled: false,
};

const build = (over: Partial<Parameters<typeof buildNotificationIntents>[0]> = {}) =>
  buildNotificationIntents({
    view: emptyView,
    preferences: prefs,
    today: TODAY,
    nowLocalTime: '07:00',
    oil: { dueOn: '2026-09-07', times: [], everyDays: null },
    ...over,
  });

const oilOf = (intents: readonly NotificationIntent[]) => intents.filter((i) => i.type === 'oil_due');

describe('SPEC-053 — a rotina de óleo com vários horários', () => {
  /**
   * ⚠️ **A regressão que vale mais que as outras.** Toda rotina que existe hoje está sem horários, e
   * a evolução não pode pedir nada de quem já usava (FR4).
   */
  it('sem horários, o comportamento é o da SPEC-040: um lembrete, no horário global', () => {
    const oil = oilOf(build());
    expect(oil).toHaveLength(1);
    expect(oil[0]).toMatchObject({ date: '2026-09-07', time: '19:00', id: 'oil_due:2026-09-07' });
  });

  it('um horário por lembrete, cada um no horário DELE (FR3/AC3)', () => {
    const oil = oilOf(
      build({ oil: { dueOn: '2026-09-07', times: ['12:00', '17:00', '23:00'], everyDays: 1 } }),
    );
    const hoje = oil.filter((i) => i.date === '2026-09-07');
    expect(hoje.map((i) => i.time)).toEqual(['12:00', '17:00', '23:00']);
    // ⚠️ E nenhum deles no horário global: o lembrete das 12:00 tem de tocar às 12:00.
    expect(hoje.every((i) => i.time !== '19:00')).toBe(true);
  });

  /**
   * ⚠️ **Sem o `slot` no id, esta SPEC seria silenciosamente impossível.** O id era `tipo:data` — um
   * por tipo por dia —, então o segundo e o terceiro horário teriam o id do primeiro e a
   * reconciliação manteria **um**. Ela pediria três, receberia um, e nada acusaria o erro.
   */
  it('cada lembrete tem id próprio — dois horários no mesmo dia não colidem', () => {
    const oil = oilOf(
      build({ oil: { dueOn: '2026-09-07', times: ['08:00', '12:00', '20:00'], everyDays: 2 } }),
    );
    expect(new Set(oil.map((i) => i.id)).size).toBe(oil.length);
    expect(oil.some((i) => i.id === 'oil_due:2026-09-07:08:00')).toBe(true);
  });

  it('projeta as próximas ocorrências pelo intervalo dela (FR9)', () => {
    const datas = [
      ...new Set(
        oilOf(build({ oil: { dueOn: '2026-09-07', times: ['09:00'], everyDays: 7 } })).map((i) => i.date),
      ),
    ];
    expect(datas).toEqual(['2026-09-07', '2026-09-14', '2026-09-21']);
    // ⚠️ Nada além do horizonte: 2026-09-28 já está fora dos 14 dias.
    expect(datas.every((d) => d <= '2026-09-21')).toBe(true);
  });

  /**
   * ⛔ **O dono proibiu teto arbitrário baixo.** Dez horários são aceitos: o que encolhe é o
   * **horizonte**, nunca a escolha dela.
   */
  it('dez horários são aceitos — nenhum é recusado (AC2)', () => {
    const dez = Array.from({ length: 10 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`);
    const oil = oilOf(build({ oil: { dueOn: '2026-09-07', times: dez, everyDays: 1 } }));
    const hoje = oil.filter((i) => i.date === '2026-09-07');
    expect(hoje).toHaveLength(10);
    expect(hoje.map((i) => i.time)).toEqual(dez);
  });

  /**
   * ⚠️ **O teto que existe é o da PLATAFORMA, e ele nunca é ultrapassado.** Sem isto, dez horários
   * gerariam 140 agendamentos, o iOS descartaria o excedente em silêncio, e ninguém saberia quais
   * sobraram.
   */
  it('o volume nunca passa do orçamento da plataforma, com 1, 3 ou 10 horários (AC5/BR5)', () => {
    for (const n of [1, 3, 10, 40]) {
      const times = Array.from({ length: n }, (_, i) => `${String(i % 24).padStart(2, '0')}:30`);
      const oil = oilOf(build({ oil: { dueOn: '2026-09-07', times: [...new Set(times)], everyDays: 1 } }));
      expect(oil.length).toBeLessThanOrEqual(OIL_NOTIFICATION_BUDGET);
    }
    // E o orçamento é o que sobra do limite do iOS depois do resto do app.
    expect(OIL_NOTIFICATION_BUDGET).toBe(64 - NOTIFICATION_HORIZON_DAYS * MAX_NOTIFICATIONS_PER_DAY);
  });

  /** ⚠️ E o que se perde é sempre o **mais distante** — o que a próxima abertura repõe. */
  it('quando o orçamento aperta, o que sobra é o mais próximo', () => {
    const dez = Array.from({ length: 10 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`);
    const oil = oilOf(build({ oil: { dueOn: '2026-09-07', times: dez, everyDays: 1 } }));
    const datas = [...new Set(oil.map((i) => i.date))].sort();
    expect(datas[0]).toBe('2026-09-07');
    // Três dias e meio cabem em 36 slots; o décimo quarto dia não entra.
    expect(datas.at(-1)! < '2026-09-21').toBe(true);
  });

  it('um horário de hoje que já passou não é agendado (FR7 da SPEC-008, agora por horário)', () => {
    const oil = oilOf(
      build({ oil: { dueOn: '2026-09-07', times: ['08:00', '20:00'], everyDays: 1 }, nowLocalTime: '14:00' }),
    );
    const hoje = oil.filter((i) => i.date === '2026-09-07');
    expect(hoje.map((i) => i.time)).toEqual(['20:00']);
    // ⚠️ E amanhã o das 08:00 volta: o que passou foi o slot de hoje, não o horário.
    expect(oil.some((i) => i.date === '2026-09-08' && i.time === '08:00')).toBe(true);
  });

  /** SPEC-022, herdada e intocada: pausada, **nada** toca — com quantos horários for. */
  it('pausada, zero lembretes, com qualquer número de horários (AC6)', () => {
    expect(
      build({ oil: { dueOn: '2026-09-07', times: ['08:00', '12:00', '20:00'], everyDays: 1 }, paused: true }),
    ).toEqual([]);
  });

  it('sem rotina, nenhum lembrete de óleo — mesmo com horários órfãos', () => {
    expect(oilOf(build({ oil: { dueOn: null, times: ['08:00'], everyDays: 1 } }))).toHaveLength(0);
  });

  /**
   * ⚠️ **BR6 — os lembretes dela ficam FORA do teto diário de 2, e isso é decisão.**
   *
   * O teto existe para o que o **app** decide cutucar. Aplicá-lo aqui descartaria em silêncio o
   * segundo horário que ela pediu — exatamente o *"teto arbitrário baixo"* que o dono proibiu.
   */
  it('o teto diário de 2 não corta os horários dela (BR6)', () => {
    const oil = oilOf(
      build({ oil: { dueOn: '2026-09-07', times: ['08:00', '12:00', '18:00', '22:00'], everyDays: 1 } }),
    );
    expect(oil.filter((i) => i.date === '2026-09-07')).toHaveLength(4);
    expect(MAX_NOTIFICATIONS_PER_DAY).toBe(2); // e o teto continua existindo para o resto
  });

  /** BR7 — o texto continua sem dizer o que o óleo faz, em qualquer horário. */
  it('nenhum texto de lembrete afirma efeito capilar', () => {
    const oil = oilOf(build({ oil: { dueOn: '2026-09-07', times: ['08:00', '22:00'], everyDays: 1 } }));
    expect(oil.length).toBeGreaterThan(0);
    for (const i of oil) {
      const texto = `${i.title} ${i.body}`;
      expect(texto).not.toMatch(/hidrata|nutre|sela|repara|fortalec|melhora|precisa|deve/i);
    }
  });
});
