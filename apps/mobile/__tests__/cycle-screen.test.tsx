import type { CareBoard, LocalDate } from '@app/core';
import { fireEvent, render } from '@testing-library/react-native';

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
  hairProfileId: 'hp-1',
  assessmentAlgorithmVersion: 'v1',
  scheduleAlgorithmVersion: 'v1',
  pausedOn: null,
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

/**
 * SPEC-021 (F29) — o mês contado por ela mesma. O que este bloco protege: os números são
 * contagens, o fecho só aparece quando o ciclo fechou, e nada aqui vira julgamento.
 */
describe('CycleScreen — resumo de ciclo (SPEC-021)', () => {
  const done = (careId: string, on: string) => ({
    id: `x-${careId}`,
    scheduledCareId: careId,
    executedAt: `${on}T10:00:00Z`,
    executedOn: on,
    voidedAt: null,
  });

  it('em andamento, conta o que já foi e o que ainda falta', async () => {
    const s = await render(
      <CycleScreen
        board={board({ executions: [done('c1', '2026-09-01')] })}
        today={'2026-09-10' as LocalDate}
        onBack={jest.fn()}
      />,
    );
    s.getByText('Como está indo');
    // c1 feito, c2 atrasado (05/09 já passou), c3 ainda por vir: dois já decididos, um no futuro.
    s.getByText('Até aqui, você concluiu 1 de 2 cuidados.');
    // Em aberto, não "em falta": um cuidado que ainda não chegou não é dívida (EC5).
    s.getByText('Ainda falta 1 no ciclo.');
    expect(s.queryByText('Ciclo encerrado')).toBeNull();
  });

  it('encerrado, fecha o mês e oferece o próximo', async () => {
    const onStartNext = jest.fn();
    const s = await render(
      <CycleScreen
        board={board({ executions: [done('c1', '2026-09-01')] })}
        today={'2026-10-20' as LocalDate}
        onBack={jest.fn()}
        onStartNext={onStartNext}
      />,
    );
    s.getByText('Ciclo encerrado');
    s.getByText('Você concluiu 1 dos 3 cuidados deste ciclo.');
    await fireEvent.press(s.getByText('Montar o próximo ciclo'));
    expect(onStartNext).toHaveBeenCalled();
  });

  it('sem nada registrado, diz que o resumo aparece conforme ela registra', async () => {
    const s = await render(
      <CycleScreen board={board()} today={'2026-09-01' as LocalDate} onBack={jest.fn()} />,
    );
    s.getByText(/O resumo aparece conforme você registra/);
    // Zeros leriam como resultado; a frase acima lê como começo (EC1/FR4).
    expect(s.queryByText(/você concluiu 0/i)).toBeNull();
  });

  it('zero avaliações some, em vez de virar cobrança', async () => {
    const s = await render(
      <CycleScreen
        board={board({ executions: [done('c1', '2026-09-01')] })}
        today={'2026-09-10' as LocalDate}
        onBack={jest.fn()}
      />,
    );
    expect(s.queryByText(/avaliou 0/)).toBeNull();
  });

  /** AC4 — a mesma barreira da SPEC-019, agora sobre números: contagem não pode virar nota. */
  it('o resumo não pontua, não compara e não elogia nem cobra', async () => {
    const s = await render(
      <CycleScreen
        board={board({ executions: [done('c1', '2026-09-01')] })}
        today={'2026-10-20' as LocalDate}
        onBack={jest.fn()}
        onStartNext={jest.fn()}
      />,
    );
    const forbidden = [
      /\d+\s*%/,
      /\b(score|nota|pontuação|aderência|desempenho|meta)\b/i,
      /\b(parabéns|muito bem|mandou bem|você falhou|faltou com|deixou de)/i,
      /\b(melhor que|pior que|ciclo anterior|usuárias|média das)/i,
    ];
    for (const pattern of forbidden) expect(s.queryByText(pattern)).toBeNull();

    for (const sample of ['70%', 'sua nota', 'parabéns!', 'melhor que o ciclo anterior']) {
      expect(forbidden.some((p) => p.test(sample))).toBe(true);
    }
  });
});

/**
 * A Hoje já trata "não sobrou nada" como fim de ciclo e oferece o próximo (D-82). Se aqui o fim
 * fosse só a data, as duas telas discordariam sobre o mesmo fato — e ela veria "chegou ao fim" numa
 * e "como está indo" na outra, no mesmo dia.
 */
describe('CycleScreen — o ciclo pode acabar antes da data (SPEC-021 BR4)', () => {
  it('resolveu tudo antes do fim: o resumo fecha e oferece o próximo', async () => {
    const settled = board({
      cares: [care('c1', '2026-09-01'), care('c2', '2026-09-05', 'skipped')],
      executions: [
        {
          id: 'x1',
          scheduledCareId: 'c1',
          executedAt: '2026-09-01T10:00:00Z',
          executedOn: '2026-09-01',
          voidedAt: null,
        },
      ],
    });
    const onStartNext = jest.fn();
    const s = await render(
      <CycleScreen
        board={settled}
        today={'2026-09-10' as LocalDate}
        onBack={jest.fn()}
        onStartNext={onStartNext}
      />,
    );
    // Ainda estamos dentro das quatro semanas, e mesmo assim o ciclo acabou.
    s.getByText('Ciclo encerrado');
    s.getByText('Montar o próximo ciclo');
    expect(s.queryByText('Como está indo')).toBeNull();
  });
});
