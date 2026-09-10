import type { LocalDate, OilRoutineView } from '@app/core';
import { fireEvent, render } from '@testing-library/react-native';

import { OilRoutineScreen } from '@/features/care/OilRoutineScreen';
import { OilRoutineSummary } from '@/features/care/OilRoutineSummary';

/**
 * SPEC-071 (F39) — **a rotina de óleo deixa de estar escondida.**
 *
 * ⚠️ O que estes testes guardam: a aba diz **o estado** (o próximo momento e quantos horários), a
 * configuração tem tela própria, e **nada** aqui recomenda frequência (D-26/D-70), premia usar mais
 * (D-103) ou cobra uma ocorrência vencida (D-28).
 */

const TODAY = '2026-09-10' as LocalDate;
const t = (id: string, at: string, reminderEnabled = true) => ({ id, at, reminderEnabled });

const view = (over: Partial<OilRoutineView> = {}): OilRoutineView => ({
  state: 'upcoming',
  everyDays: 3,
  dueOn: '2026-09-12' as LocalDate,
  daysLate: 0,
  lastDoneOn: null,
  doneCount: 0,
  times: [],
  ...over,
});

const renderSummary = async (v: OilRoutineView, nowTime = '08:00') => {
  const onOpen = jest.fn();
  const s = await render(<OilRoutineSummary view={v} today={TODAY} nowTime={nowTime} onOpen={onOpen} />);
  return { ...s, onOpen };
};

describe('OilRoutineSummary (SPEC-071)', () => {
  it('sem rotina: convida a configurar, sem prometer uma porta que ainda não abre', async () => {
    const s = await renderSummary(view({ state: 'none', dueOn: null, everyDays: null }));
    s.getByText('Rotina de óleo');
    s.getByText('Configurar rotina');
    // ⚠️ O intervalo vem antes dos horários — o banco recusa um horário sem rotina.
    expect(s.queryByText(/crie seus horários/i)).toBeNull();
  });

  it('com rotina: diz o próximo momento e quantos horários ela tem', async () => {
    const s = await renderSummary(view({ times: [t('a', '07:30'), t('b', '18:00')] }));
    s.getByText('Próximo: sáb, 12/09, 07:30');
    s.getByText('2 horários');
    s.getByText('Ver rotina');
  });

  it('hoje, o próximo é o horário que ainda não passou', async () => {
    const s = await renderSummary(
      view({ state: 'due_today', dueOn: TODAY, times: [t('a', '07:30'), t('b', '18:00')] }),
      '09:00',
    );
    s.getByText('Próximo: hoje, 18:00');
  });

  /** ⚠️ Todos os horários passados: o dia continua sendo hoje, e apontar uma hora vencida seria mentir. */
  it('hoje com todos os horários passados diz só o dia', async () => {
    const s = await renderSummary(
      view({ state: 'due_today', dueOn: TODAY, times: [t('a', '07:30')] }),
      '22:00',
    );
    s.getByText('Próximo: hoje');
  });

  it('rotina sem horários volta a ser exatamente a linha da SPEC-040: só o dia', async () => {
    const s = await renderSummary(view());
    s.getByText('Próximo: sáb, 12/09');
    s.getByText('Sem horários definidos');
  });

  /**
   * ⚠️ **"3 horários ativos" foi recusado.** Um horário com o lembrete desligado continua na rotina e
   * continua registrável (SPEC-053 FR3): chamá-lo de inativo seria errado, e tirá-lo da contagem
   * seria pior. A contagem é de todos, e o que não toca aparece ao lado.
   */
  it('conta todos os horários, e diz quantos não tocam', async () => {
    const s = await renderSummary(view({ times: [t('a', '07:30', false), t('b', '18:00')] }));
    s.getByText('2 horários · 1 sem lembrete');
    expect(s.queryByText(/inativ/i)).toBeNull();
  });

  it('sem lembrete desligado, a ressalva não aparece', async () => {
    const s = await renderSummary(view({ times: [t('a', '07:30')] }));
    s.getByText('1 horário');
  });

  /** ⚠️ **Vencida não vira cobrança** (D-28/NG3): diz o dia e para por aí. */
  it('vencida diz o dia em que estava marcada, sem cobrar', async () => {
    const s = await renderSummary(
      view({ state: 'overdue', dueOn: '2026-09-08' as LocalDate, daysLate: 2, times: [t('a', '07:30')] }),
    );
    s.getByText('Estava para ter, 08/09, 07:30');
    expect(s.queryByText(/atrasad|há 2 dias|você não|perdeu|deveria/i)).toBeNull();
  });

  /**
   * ⚠️ **Nem recomendação capilar (D-26/D-70), nem prêmio por usar mais (D-103).** Não há contagem
   * de quantas vezes ela passou óleo, sequência, elogio nem comparação.
   */
  it('não recomenda frequência, não diz o que o óleo faz e não premia usar mais', async () => {
    const s = await renderSummary(view({ doneCount: 12, times: [t('a', '07:30')] }));
    const proibido =
      /recomend|ideal|melhor|indicad|hidrata|nutre|repara|sequência|parabéns|você já fez|12 vezes|mantenha|continue assim/i;
    for (const node of s.queryAllByText(proibido)) {
      throw new Error(`texto proibido no resumo: "${String(node.props.children)}"`);
    }
  });

  it('a porta abre a rotina', async () => {
    const s = await renderSummary(view());
    fireEvent.press(s.getByText('Ver rotina'));
    expect(s.onOpen).toHaveBeenCalled();
  });
});

describe('OilRoutineScreen (SPEC-071)', () => {
  const acoes = () => ({
    onAdd: jest.fn(),
    onUpdate: jest.fn(),
    onToggleReminder: jest.fn(),
    onRemove: jest.fn(),
  });

  /** A configuração inteira continua existindo — ela só mudou de endereço. */
  it('a tela traz a configuração que saiu da aba', async () => {
    const s = await render(
      <OilRoutineScreen
        view={view({ times: [t('a', '07:30')] })}
        busy={false}
        onChoose={jest.fn()}
        onTurnOff={jest.fn()}
        times={acoes()}
        onBack={jest.fn()}
      />,
    );
    s.getByText('A cada 3 dias');
    s.getByText('Desligar a rotina');
    s.getByText('07:30');
  });

  it('voltar chama quem abriu', async () => {
    const onBack = jest.fn();
    const s = await render(
      <OilRoutineScreen
        view={view()}
        busy={false}
        onChoose={jest.fn()}
        onTurnOff={jest.fn()}
        times={acoes()}
        onBack={onBack}
      />,
    );
    fireEvent.press(s.getByText('Voltar'));
    expect(onBack).toHaveBeenCalled();
  });
});
