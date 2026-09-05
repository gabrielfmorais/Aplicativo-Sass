import type { CareBoard, LocalDate } from '@app/core';
import { fireEvent, render } from '@testing-library/react-native';

import { ProgressTabScreen } from '@/features/care/ProgressTabScreen';

const PROFILE = { name: 'Ana', onPress: jest.fn() };
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
  washDayExecutionIds: [],
  careFinishes: [],
  cares: [care('c1', '2026-09-01'), care('c2', '2026-09-05'), care('c3', '2026-09-16')],
  executions: [],
  checkInMarks: [],
  checkIns: [],
  lifetimeDoneCount: 0,
  ...over,
});

/**
 * SPEC-019. A tela conta o mês e não julga: o que este bloco protege é a forma completa das quatro
 * semanas, a honestidade do "onde estou", e a ausência de qualquer nota.
 */
describe('Progresso — a forma do mês (SPEC-019 / SPEC-034)', () => {
  it('mostra as quatro semanas, inclusive as que não têm nada', async () => {
    const s = await render(
      <ProgressTabScreen board={board()} today={'2026-09-10' as LocalDate} profile={PROFILE} />,
    );
    for (const n of [1, 2, 3, 4]) s.getByText(`Semana ${n}`);
    // As semanas 2 e 4 não têm cuidado; some-las faria a forma do mês parecer outra.
    expect(s.getAllByText('Nenhum cuidado planejado nesta semana.')).toHaveLength(2);
  });

  it('diz em palavra em que semana ela está', async () => {
    const s = await render(
      <ProgressTabScreen board={board()} today={'2026-09-10' as LocalDate} profile={PROFILE} />,
    );
    // Cor sozinha não conta: quem não distingue a tinta precisa ler onde está.
    expect(s.getAllByText('você está aqui')).toHaveLength(1);
  });

  /** FR4 — melhor admitir que ela não está em nenhuma semana do que marcar uma ao acaso. */
  it('quando hoje está fora do ciclo, não marca semana nenhuma e diz isso', async () => {
    const s = await render(
      <ProgressTabScreen board={board()} today={'2026-10-20' as LocalDate} profile={PROFILE} />,
    );
    expect(s.queryByText('você está aqui')).toBeNull();
    s.getByText(/Hoje já está fora delas/);
  });

  /** BR6 — 'já está fora' e 'ainda não começou' são estados opostos, e uma frase só mentiria num deles. */
  it('quando o ciclo ainda não começou, diz quando ele começa', async () => {
    const s = await render(
      <ProgressTabScreen board={board()} today={'2026-08-20' as LocalDate} profile={PROFILE} />,
    );
    expect(s.queryByText('você está aqui')).toBeNull();
    expect(s.queryByText(/já está fora/)).toBeNull();
    s.getByText(/Ele começa em/);
  });

  it('mostra o estado de cada cuidado em palavra', async () => {
    const s = await render(
      <ProgressTabScreen
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
        profile={PROFILE}
      />,
    );
    s.getByText(/feita$/);
    s.getByText(/atrasada$/);
    s.getByText(/pulada$/);
  });

  /** EC4 — reagendar pode passar do fim do plano. Sumir com o cuidado seria mentir. */
  it('separa o que caiu depois do ciclo em vez de inventar uma quinta semana', async () => {
    const s = await render(
      <ProgressTabScreen
        board={board({ cares: [care('c1', '2026-09-01'), care('depois', '2026-10-05')] })}
        today={'2026-09-10' as LocalDate}
        profile={PROFILE}
      />,
    );
    s.getByText('Depois deste ciclo');
    expect(s.queryByText('Semana 5')).toBeNull();
  });

  /**
   * ⚠️ **SPEC-034 — aba não volta, e é por isso que o "voltar" sumiu.** O ciclo era uma tela
   * empilhada **sob o ramo de Cuidados**: abri-lo da Hoje ou do Progresso acendia *Cuidados* na
   * barra e o rodapé oferecia *"Voltar aos cuidados"* — para uma aba de onde ela nunca veio. Agora
   * o ciclo **é** a aba, e sai-se dela tocando outra (a mesma regra da Prateleira, SPEC-027).
   */
  it('não volta para lugar nenhum, e não oferece nenhuma ação de escrita', async () => {
    const s = await render(
      <ProgressTabScreen board={board()} today={'2026-09-10' as LocalDate} profile={PROFILE} />,
    );
    expect(s.queryByText('Voltar aos cuidados')).toBeNull();
    // NG5 — concluir, pular e reagendar continuam na Hoje. Uma ação a mais aqui seria um segundo
    // caminho de escrita para as mesmas transições.
    for (const forbidden of ['Fiz hoje', 'Pular', 'Reagendar', 'Desfazer']) {
      expect(s.queryByText(forbidden)).toBeNull();
    }
    // O único toque da tela é o avatar do cabeçalho — a porta de Você (SPEC-027).
    expect(s.getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual([
      'Ana — abrir seu perfil',
    ]);
  });

  /**
   * AC6/NG2 — a barreira. A SPEC-009 já pagou este preço: a tentação de resumir um ciclo em um
   * número é constante, e um número sobre uma amostra desta não significa nada. As amostras abaixo
   * **precisam** casar, senão a barreira não protege coisa alguma — foi exatamente o erro que a
   * auditoria da SPEC-007 encontrou (âncoras que nunca casavam, com CI verde).
   */
  it('não pontua o ciclo, não compara com ninguém e não sugere mudar o cronograma', async () => {
    const s = await render(
      <ProgressTabScreen board={board()} today={'2026-09-10' as LocalDate} profile={PROFILE} />,
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
describe('Progresso — resumo de ciclo (SPEC-021)', () => {
  const done = (careId: string, on: string) => ({
    id: `x-${careId}`,
    scheduledCareId: careId,
    executedAt: `${on}T10:00:00Z`,
    executedOn: on,
    voidedAt: null,
  });

  /**
   * ⚠️ **Um resumo só enquanto o ciclo corre, e não dois.** Antes havia o `ProgressSummary` desta
   * aba e o `CycleSummary` "Como está indo" da tela do ciclo — dois cartões dizendo *"concluiu 1 de
   * 2"* com palavras diferentes. Fundidas as telas, eles ficariam **um embaixo do outro**, que é o
   * defeito que a auditoria da SPEC-026 já achou uma vez. Em andamento quem conta é o
   * `ProgressSummary`; o `CycleSummary` volta só no fim, quando tem o que o outro não tem.
   *
   * E o que **falta** deixou de precisar de uma frase: as quatro semanas estão logo abaixo, e nelas
   * o cuidado que ainda não chegou aparece com data e estado. Mostrar é melhor que contar.
   */
  it('em andamento, conta o que já foi — e o que falta está nas semanas, não numa frase', async () => {
    const s = await render(
      <ProgressTabScreen
        board={board({ executions: [done('c1', '2026-09-01')] })}
        today={'2026-09-10' as LocalDate}
        profile={PROFILE}
      />,
    );
    // c1 feito, c2 atrasado (05/09 já passou), c3 ainda por vir: dois já decididos, um no futuro.
    s.getByText('Neste plano, você concluiu 1 de 2 cuidados até aqui.');
    // O que ainda não chegou está desenhado na semana 3, com data e estado.
    s.getByText(/qua, 16\/09 · planejada/);
    // Nada de dois resumos empilhados, e nada de fecho antes da hora.
    expect(s.queryByText('Como está indo')).toBeNull();
    expect(s.queryByText('Ciclo encerrado')).toBeNull();
  });

  it('encerrado, fecha o mês e oferece o próximo', async () => {
    const onStartNext = jest.fn();
    const s = await render(
      <ProgressTabScreen
        board={board({ executions: [done('c1', '2026-09-01')] })}
        today={'2026-10-20' as LocalDate}
        profile={PROFILE}
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
      <ProgressTabScreen board={board()} today={'2026-09-01' as LocalDate} profile={PROFILE} />,
    );
    s.getByText(/O resumo aparece conforme você registra/);
    // Zeros leriam como resultado; a frase acima lê como começo (EC1/FR4).
    expect(s.queryByText(/você concluiu 0/i)).toBeNull();
  });

  it('zero avaliações some, em vez de virar cobrança', async () => {
    const s = await render(
      <ProgressTabScreen
        board={board({ executions: [done('c1', '2026-09-01')] })}
        today={'2026-09-10' as LocalDate}
        profile={PROFILE}
      />,
    );
    expect(s.queryByText(/avaliou 0/)).toBeNull();
  });

  /** AC4 — a mesma barreira da SPEC-019, agora sobre números: contagem não pode virar nota. */
  it('o resumo não pontua, não compara e não elogia nem cobra', async () => {
    const s = await render(
      <ProgressTabScreen
        board={board({ executions: [done('c1', '2026-09-01')] })}
        today={'2026-10-20' as LocalDate}
        profile={PROFILE}
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
describe('Progresso — o ciclo pode acabar antes da data (SPEC-021 BR4)', () => {
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
      <ProgressTabScreen
        board={settled}
        today={'2026-09-10' as LocalDate}
        profile={PROFILE}
        onStartNext={onStartNext}
      />,
    );
    // Ainda estamos dentro das quatro semanas, e mesmo assim o ciclo acabou.
    s.getByText('Ciclo encerrado');
    s.getByText('Montar o próximo ciclo');
    expect(s.queryByText('Como está indo')).toBeNull();
  });
});

/**
 * SPEC-034 — o que a fusão consertou, e que teste nenhum protegia antes.
 */
describe('Progresso — o que a fusão consertou (SPEC-034)', () => {
  const doneOn = (careId: string, on: string) => ({
    id: `x-${careId}`,
    scheduledCareId: careId,
    executedAt: `${on}T10:00:00Z`,
    executedOn: on,
    voidedAt: null,
  });

  /**
   * ⚠️ **O check-in dela estava sendo jogado fora.** `buildCycleView` já carregava o check-in de
   * cada cuidado e a tela do ciclo mostrava só data e estado — a única coisa que o app sabe sobre
   * **como foi** era invisível fora do dia em que ela respondeu.
   *
   * É a resposta **dela**, e o texto diz isso: não é nota do app, não é média, não é tendência
   * (SPEC-009 §2). Uma resposta por cuidado é fato; a linha que as ligasse seria um gráfico.
   */
  it('mostra a avaliação que ela mesma deu, e a nomeia como dela', async () => {
    const s = await render(
      <ProgressTabScreen
        board={board({
          executions: [doneOn('c1', '2026-09-01')],
          checkInMarks: [],
          checkIns: [{ id: 'ci1', careExecutionId: 'x-c1', overallFeel: 4 }],
        })}
        today={'2026-09-10' as LocalDate}
        profile={PROFILE}
      />,
    );
    s.getByText('Você avaliou: 4 de 5');
    // Um cuidado sem check-in não ganha uma linha vazia nem um zero que leria como resultado.
    expect(s.queryByText(/Você avaliou: 0/)).toBeNull();
  });

  /**
   * ⚠️ **As duas telas podiam discordar sobre o mesmo plano.** A `CycleScreen` derivava o
   * `Progress` com `buildTodayView(cares, executions, today, checkIns)` — **sem `pausedOn`** —
   * enquanto a aba passava a pausa. Com o plano pausado, uma dizia "atrasada" e a outra não, e o
   * fecho do ciclo podia diferir entre elas. É exatamente o que o comentário de `buildTodayView`
   * avisa que não pode acontecer (SPEC-022 BR2). Uma leitura só, uma verdade só.
   */
  it('pausada, nada atrasa — a pausa chega à derivação do ciclo', async () => {
    const paused = board({ pausedOn: '2026-09-03' });
    const s = await render(
      <ProgressTabScreen board={paused} today={'2026-09-10' as LocalDate} profile={PROFILE} />,
    );
    // c2 é de 05/09 e hoje é 10/09: sem a pausa, esta linha diria "atrasada".
    expect(s.queryByText(/atrasada/)).toBeNull();
    s.getByText(/sex, 04\/09 · planejada|sáb, 05\/09 · planejada/);
  });

  /**
   * ⚠️ **Nada aqui está preso a três tipos de cuidado** (D-102/`F36`). As semanas iteram o que o
   * plano contém, então um quarto tipo aparece sem tocar nesta tela — e o `Record` tipado de
   * `careColor` faz o typecheck cobrar a cor dele, em vez de renderizar um ponto cinza.
   */
  it('desenha o cuidado a partir do plano, sem lista fixa de tipos', async () => {
    const s = await render(
      <ProgressTabScreen
        board={board({
          cares: [
            { ...care('c1', '2026-09-01'), careTypeCode: 'nutrition' as const },
            { ...care('c2', '2026-09-09'), careTypeCode: 'reconstruction' as const },
          ],
        })}
        today={'2026-09-10' as LocalDate}
        profile={PROFILE}
      />,
    );
    s.getByText('Nutrição');
    s.getByText('Reconstrução');
  });
});
