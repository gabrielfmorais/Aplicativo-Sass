import type { CareBoard, LocalDate } from '@app/core';
import { render } from '@testing-library/react-native';

import { CycleScreen } from '@/features/care/CycleScreen';

const START = '2026-09-01'; // terça-feira
const care = (
  id: string,
  plannedDate: string,
  status: 'planned' | 'skipped' | 'rescheduled' = 'planned',
) => ({
  id,
  careTypeCode: 'hydration' as const,
  plannedDate,
  status,
  rescheduledToId: null,
});

const board = (over: Partial<CareBoard> = {}): CareBoard => ({
  planId: 'plan-1',
  startsOn: START,
  cares: [care('c1', '2026-09-01'), care('c2', '2026-09-05'), care('c3', '2026-09-16')],
  executions: [],
  checkIns: [],
  lifetimeDoneCount: 0,
  ...over,
});

/**
 * SPEC-019. A tela conta o mês e não julga: o que este bloco protege é a forma completa das quatro
 * semanas, a honestidade do "onde estou", e a ausência de qualquer nota.
 */
describe('CycleScreen (SPEC-019)', () => {
  it('mostra as quatro semanas, inclusive as que não têm nada', async () => {
    const s = await render(
      <CycleScreen board={board()} today={'2026-09-10' as LocalDate} onBack={jest.fn()} />,
    );
    for (const n of [1, 2, 3, 4]) s.getByText(`Semana ${n}`);
    // As semanas 2 e 4 não têm cuidado; some-las faria a forma do mês parecer outra.
    expect(s.getAllByText('Nenhum cuidado planejado nesta semana.')).toHaveLength(2);
  });

  it('diz em palavra em que semana ela está', async () => {
    const s = await render(
      <CycleScreen board={board()} today={'2026-09-10' as LocalDate} onBack={jest.fn()} />,
    );
    // Cor sozinha não conta: quem não distingue a tinta precisa ler onde está.
    expect(s.getAllByText('você está aqui')).toHaveLength(1);
  });

  /** FR4 — melhor admitir que ela não está em nenhuma semana do que marcar uma ao acaso. */
  it('quando hoje está fora do ciclo, não marca semana nenhuma e diz isso', async () => {
    const s = await render(
      <CycleScreen board={board()} today={'2026-10-20' as LocalDate} onBack={jest.fn()} />,
    );
    expect(s.queryByText('você está aqui')).toBeNull();
    s.getByText(/Hoje já está fora delas/);
  });

  /** BR6 — 'já está fora' e 'ainda não começou' são estados opostos, e uma frase só mentiria num deles. */
  it('quando o ciclo ainda não começou, diz quando ele começa', async () => {
    const s = await render(
      <CycleScreen board={board()} today={'2026-08-20' as LocalDate} onBack={jest.fn()} />,
    );
    expect(s.queryByText('você está aqui')).toBeNull();
    expect(s.queryByText(/já está fora/)).toBeNull();
    s.getByText(/Ele começa em/);
  });

  it('mostra o estado de cada cuidado em palavra', async () => {
    const s = await render(
      <CycleScreen
        board={board({
          cares: [
            care('feito', '2026-09-01'),
            care('atrasado', '2026-09-02'),
            care('pulado', '2026-09-03', 'skipped'),
          ],
          executions: [
            {
              id: 'e1',
              scheduledCareId: 'feito',
              executedAt: '2026-09-01T10:00:00Z',
              executedOn: '2026-09-01',
              voidedAt: null,
            },
          ],
        })}
        today={'2026-09-10' as LocalDate}
        onBack={jest.fn()}
      />,
    );
    s.getByText(/feita$/);
    s.getByText(/atrasada$/);
    s.getByText(/pulada$/);
  });

  /** EC4 — reagendar pode passar do fim do plano. Sumir com o cuidado seria mentir. */
  it('separa o que caiu depois do ciclo em vez de inventar uma quinta semana', async () => {
    const s = await render(
      <CycleScreen
        board={board({ cares: [care('c1', '2026-09-01'), care('depois', '2026-10-05')] })}
        today={'2026-09-10' as LocalDate}
        onBack={jest.fn()}
      />,
    );
    s.getByText('Depois deste ciclo');
    expect(s.queryByText('Semana 5')).toBeNull();
  });

  it('volta para os cuidados, e não oferece nenhuma outra ação', async () => {
    const s = await render(
      <CycleScreen board={board()} today={'2026-09-10' as LocalDate} onBack={jest.fn()} />,
    );
    // NG5 — concluir, pular e reagendar continuam na Hoje. Uma ação a mais aqui seria um segundo
    // caminho de escrita para as mesmas transições.
    expect(s.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toHaveLength(1);
    s.getByText('Voltar aos cuidados');
    for (const forbidden of ['Fiz hoje', 'Pular', 'Reagendar', 'Desfazer']) {
      expect(s.queryByText(forbidden)).toBeNull();
    }
  });

  /**
   * AC6/NG2 — a barreira. A SPEC-009 já pagou este preço: a tentação de resumir um ciclo em um
   * número é constante, e um número sobre uma amostra desta não significa nada. As amostras abaixo
   * **precisam** casar, senão a barreira não protege coisa alguma — foi exatamente o erro que a
   * auditoria da SPEC-007 encontrou (âncoras que nunca casavam, com CI verde).
   */
  it('não pontua o ciclo, não compara com ninguém e não sugere mudar o cronograma', async () => {
    const s = await render(
      <CycleScreen board={board()} today={'2026-09-10' as LocalDate} onBack={jest.fn()} />,
    );
    const forbidden = [
      /\d+\s*%/, // percentual
      /\b(score|nota|pontuação|aderência|desempenho)\b/i,
      /\b(usuárias|outras pessoas|média|comparad)/i,
      /\b(sugerimos|recomendamos|você deveria|tente mudar)\b/i,
      /\b(parabéns|muito bem|você falhou|faltou)\b/i,
    ];
    for (const pattern of forbidden) expect(s.queryByText(pattern)).toBeNull();

    // A barreira só vale se as amostras casarem de verdade.
    for (const sample of ['83%', 'nota 7', 'usuárias parecidas', 'recomendamos algo', 'parabéns']) {
      expect(forbidden.some((p) => p.test(sample))).toBe(true);
    }
  });
});
