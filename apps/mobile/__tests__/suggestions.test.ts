import type { CareItem, TodayView } from '@app/core';
import { instantFromString } from '@app/core';

import { MAX_SUGGESTIONS, buildSuggestions } from '@/features/care/suggestions';

/**
 * ⚠️ **`executedOn` é parâmetro, e o padrão de igualar ao planejado era o que escondia um defeito.**
 *
 * Com `executedOn: plannedDate` fixo, nenhum teste deste arquivo podia ver a diferença entre as duas
 * datas — e a frase da oferta usava a **planejada** numa sentença sobre o que ela **fez**.
 */
const done = (id: string, executionId: string, plannedDate: string, executedOn = plannedDate): CareItem =>
  ({
    id,
    careTypeCode: 'hydration',
    plannedDate,
    outcome: 'done',
    checkIn: null,
    execution: {
      id: executionId,
      scheduledCareId: id,
      executedAt: instantFromString('2026-09-09T10:00:00.000Z'),
      executedOn,
      voidedAt: null,
    },
  }) as unknown as CareItem;

const view = (history: readonly CareItem[]): TodayView =>
  ({ overdue: [], today: [], upcoming: [], history }) as unknown as TodayView;

const base = {
  view: view([]),
  washDayExecutionIds: [] as readonly string[],
  productCount: null as number | null,
  dismissed: [] as readonly ('wash_day' | 'shelf_empty')[],
};

/**
 * SPEC-026 fatia 3 — o que a seção pode dizer, e o que ela nunca pode.
 *
 * O risco desta capability não é técnico. É que uma frase escorregue de **fato dela** para
 * **afirmação sobre cabelo** — a distância entre "sua prateleira está vazia" e "seu cabelo precisa
 * de hidratação" é uma palavra, e é a distância entre uma capability Free e o gate D-26.
 */
describe('buildSuggestions (SPEC-026)', () => {
  it('oferece contar um cuidado feito que ainda não tem registro', () => {
    const s = buildSuggestions({ ...base, view: view([done('c1', 'e1', '2026-09-09')]) });
    expect(s).toHaveLength(1);
    expect(s[0]?.key).toBe('wash_day');
    expect(s[0]?.careExecutionId).toBe('e1');
  });

  it('não oferece o que ela já registrou', () => {
    const s = buildSuggestions({
      ...base,
      view: view([done('c1', 'e1', '2026-09-09')]),
      washDayExecutionIds: ['e1'],
    });
    expect(s).toHaveLength(0);
  });

  /**
   * `null` **não** é zero. Uma leitura que não voltou viraria uma afirmação sobre ela feita a partir
   * de nada — e "sua prateleira está vazia" para quem tem doze produtos é pior que silêncio.
   */
  it('não diz que a prateleira está vazia sem saber que está', () => {
    expect(buildSuggestions({ ...base, productCount: null })).toHaveLength(0);
    expect(buildSuggestions({ ...base, productCount: 0 })[0]?.key).toBe('shelf_empty');
    expect(buildSuggestions({ ...base, productCount: 3 })).toHaveLength(0);
  });

  /** FR15 — dispensada some, e não volta. */
  it('respeita o que ela dispensou', () => {
    const s = buildSuggestions({ ...base, productCount: 0, dismissed: ['shelf_empty'] });
    expect(s).toHaveLength(0);
  });

  /** Oferecer três de uma vez transforma a oferta numa lista de pendências (OQ4). */
  it('nunca mostra mais do que o teto', () => {
    const s = buildSuggestions({
      ...base,
      view: view([done('c1', 'e1', '2026-09-09'), done('c2', 'e2', '2026-09-07')]),
      productCount: 0,
    });
    expect(s.length).toBeLessThanOrEqual(MAX_SUGGESTIONS);
    // E só **um** Wash Day: dois cuidados sem registro não viram duas cobranças.
    expect(s.filter((x) => x.key === 'wash_day')).toHaveLength(1);
  });

  /**
   * AC5/AC6 — a barreira. As amostras proibidas precisam casar e as legítimas **não**, senão a
   * barreira não protege coisa alguma: foi exatamente esse o defeito que a auditoria da SPEC-007
   * encontrou, e que a barreira da SPEC-024 repetiu com "Condicionador".
   */
  it('nenhuma frase afirma nada sobre o cabelo dela, sugere cuidado, pontua ou cobra', () => {
    const all = [
      ...buildSuggestions({
        ...base,
        view: view([done('c1', 'e1', '2026-09-09')]),
        productCount: 0,
      }),
    ].map((s) => `${s.text} ${s.action}`);
    expect(all.length).toBeGreaterThan(0);

    const forbidden = [
      /\b(hidrate|nutra|reconstrua|aplique|evite|recomendamos|indicamos|experimente)\b/i,
      /\b(seu cabelo (está|precisa|pede)|ideal para você|combina com)/i,
      /\b(danificad|fragilizad|ressecad|quebradiç|poros)/i,
      /\b(você deveria|não esqueça|falta|pendente|atrasad|complete)/i,
      /\d+\s*%/,
    ];
    for (const line of all) {
      for (const pattern of forbidden) expect(line).not.toMatch(pattern);
    }

    for (const sample of [
      'hidrate os fios',
      'seu cabelo precisa de mais',
      'cabelo danificado',
      'não esqueça de registrar',
      '80%',
    ]) {
      expect(forbidden.some((p) => p.test(sample))).toBe(true);
    }
    // E as frases reais não podem casar com a própria barreira.
    for (const line of all) {
      expect(forbidden.some((p) => p.test(line))).toBe(false);
    }
  });
});

/**
 * ⚠️ **A data da oferta é a do que ela FEZ, não a do que estava planejado.**
 *
 * Medido no DEV real em 2026-09-09: um cuidado planejado para **14/09**, concluído adiantado,
 * produzia *"Você fez hidratação em seg, 14/09"* — uma data no **futuro**, no passado. E o caso
 * comum é o inverso: atrasar acontece o tempo todo, e o app existe para não cobrar por isso (D-28).
 *
 * ⛔ É a confusão que a ADR-001 §2 separa — *"planejado ≠ executado"* — saindo na tela em português.
 */
describe('a oferta de contar usa a data da execução', () => {
  it('cuidado feito depois do previsto reporta o dia em que ela fez', () => {
    const s = buildSuggestions({
      ...base,
      view: view([done('c1', 'e1', '2026-09-07', '2026-09-12')]),
    });
    expect(s[0]?.text).toContain('12/09');
    expect(s[0]?.text).not.toContain('07/09');
  });

  it('cuidado feito adiantado também', () => {
    const s = buildSuggestions({
      ...base,
      view: view([done('c1', 'e1', '2026-09-14', '2026-09-09')]),
    });
    expect(s[0]?.text).toContain('09/09');
    expect(s[0]?.text).not.toContain('14/09');
  });
});
