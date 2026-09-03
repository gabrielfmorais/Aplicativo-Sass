import type { OilRoutineView } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { CareTabScreen } from '@/features/care/CareTabScreen';
import { OilRoutineCard, intervalLabel } from '@/features/care/OilRoutineCard';

/**
 * SPEC-040 (F39) — a rotina de óleo na tela.
 *
 * ⚠️ **O que estes testes protegem não é o layout — é o D-26.** O intervalo é uma marca de
 * calendário que ela escolhe; no dia em que um rótulo disser "recomendado", "ideal" ou o que o óleo
 * faz no cabelo, isto vira afirmação capilar sem sign-off.
 */

const view = (over: Partial<OilRoutineView> = {}): OilRoutineView => ({
  state: 'none',
  everyDays: null,
  dueOn: null,
  daysLate: 0,
  lastDoneOn: null,
  doneCount: 0,
  ...over,
});

const renderCard = async (over: Partial<OilRoutineView> = {}, handlers = {}) =>
  render(
    <OilRoutineCard
      view={view(over)}
      busy={false}
      onChoose={jest.fn()}
      onTurnOff={jest.fn()}
      {...handlers}
    />,
  );

describe('rotina de óleo — o cartão de Cuidados (SPEC-040 FR7)', () => {
  it('sem rotina, convida sem cobrar e não mostra data nenhuma', async () => {
    const s = await renderCard();
    s.getByText('Rotina de óleo');
    expect(s.queryByText('Desligar a rotina')).toBeNull();
    expect(s.queryByText(/Próxima|É hoje|Estava para/)).toBeNull();
  });

  it('oferece os intervalos e marca o escolhido', async () => {
    const s = await renderCard({ state: 'upcoming', everyDays: 7, dueOn: '2026-09-17' as never });
    s.getByText('Todo dia');
    s.getByText('1x por semana');
    s.getByText('A cada 2 dias');
    s.getByText('A cada 3 dias');
    s.getByText('A cada 15 dias');
    s.getByText('Desligar a rotina');
  });

  it('escolher um intervalo chama a porta com o número de dias', async () => {
    const onChoose = jest.fn();
    const s = await renderCard({}, { onChoose });
    await fireEvent.press(s.getByText('A cada 3 dias'));
    expect(onChoose).toHaveBeenCalledWith(3);
  });

  it('desligar chama a porta', async () => {
    const onTurnOff = jest.fn();
    const s = await renderCard(
      { state: 'due_today', everyDays: 2, dueOn: '2026-09-10' as never },
      { onTurnOff },
    );
    await fireEvent.press(s.getByText('Desligar a rotina'));
    expect(onTurnOff).toHaveBeenCalled();
  });

  /**
   * ⚠️ **A barreira do D-26/D-70.** Nenhum rótulo pode dizer o que o óleo faz, nem apresentar um
   * intervalo como o certo. Isso é conteúdo capilar substantivo, e é o `F38`.
   */
  it('não recomenda intervalo nenhum e não afirma nada sobre cabelo (BR4/BR6/NG2)', async () => {
    const s = await renderCard({ state: 'overdue', everyDays: 3, dueOn: '2026-09-01' as never, daysLate: 9 });
    expect(
      s.queryByText(/recomend|ideal|melhor|indicad|deveria|precisa|hidrat|nutri|sela|repara|fortalec|frizz/i),
    ).toBeNull();
  });

  /** NG3 — vencida é um fato datado, não uma nota nem uma cobrança. */
  it('vencida, diz a data sem cobrar', async () => {
    const s = await renderCard({ state: 'overdue', everyDays: 3, dueOn: '2026-09-01' as never, daysLate: 9 });
    s.getByText(/Estava para/);
    expect(s.queryByText(/atrasad|perdeu|falhou|deixou de/i)).toBeNull();
  });

  it('os rótulos de intervalo são só o intervalo', () => {
    expect(intervalLabel(1)).toBe('Todo dia');
    expect(intervalLabel(2)).toBe('A cada 2 dias');
    expect(intervalLabel(7)).toBe('1x por semana');
    expect(intervalLabel(15)).toBe('A cada 15 dias');
  });

  /**
   * ⚠️ **O diário existe na tela, não só no schema** (decisão do dono, 2026-09-03).
   *
   * O banco sempre aceitou `1` e a derivação nunca soube o que é uma semana — mas a lista oferecida
   * começava no 2, e uma capability que aceita um valor no schema e o esconde da tela **não tem**
   * aquele valor.
   */
  it('oferece a rotina diária, e escolhê-la manda 1 para a porta', async () => {
    const onChoose = jest.fn();
    const s = await renderCard({}, { onChoose });
    await fireEvent.press(s.getByText('Todo dia'));
    expect(onChoose).toHaveBeenCalledWith(1);
  });

  /** BR6 — "todo dia" é escolha dela, e nada na tela a apresenta como o certo. */
  it('o diário não é apresentado como recomendado', async () => {
    const s = await renderCard({ state: 'due_today', everyDays: 1, dueOn: '2026-09-03' as never });
    s.getByText('Todo dia');
    expect(s.queryByText(/recomend|ideal|melhor|indicad|todo dia é|o certo/i)).toBeNull();
  });
});

describe('rotina de óleo — o lugar dela (SPEC-040 FR7)', () => {
  const profile = { name: 'Ana', onPress: jest.fn() };

  it('mora em Cuidados, junto do que ela mantém', async () => {
    const s = await render(
      <CareTabScreen
        profile={profile}
        oil={{ view: view(), busy: false, onChoose: jest.fn(), onTurnOff: jest.fn() }}
      />,
    );
    await waitFor(() => s.getByText('Rotina de óleo'));
  });

  /** A aba continua inteira sem a rotina: uma leitura que não voltou não vira tela quebrada. */
  it('sem a rotina carregada, a aba segue funcionando', async () => {
    const s = await render(<CareTabScreen profile={profile} />);
    expect(s.queryByText('Rotina de óleo')).toBeNull();
  });
});
