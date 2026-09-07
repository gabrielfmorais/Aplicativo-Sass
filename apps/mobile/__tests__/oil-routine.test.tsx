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
  times: [],
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
        oil={{
          view: view(),
          busy: false,
          onChoose: jest.fn(),
          onTurnOff: jest.fn(),
          times: {
            onAdd: jest.fn(),
            onUpdate: jest.fn(),
            onToggleReminder: jest.fn(),
            onRemove: jest.fn(),
          },
        }}
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

/**
 * ⚠️ **SPEC-053 — os horários na tela.**
 *
 * O que estes testes protegem, em ordem: que **nenhuma ação que ela precisa exista sem quem a
 * atenda** (o botão morto que a SPEC-027 mediu), que **desligar o lembrete não apague o horário**, e
 * que a tela continue **sem opinião** sobre quantas vezes por dia.
 */
describe('SPEC-053 — os horários da rotina de óleo', () => {
  const acoes = () => ({
    onAdd: jest.fn(),
    onUpdate: jest.fn(),
    onToggleReminder: jest.fn(),
    onRemove: jest.fn(),
  });
  const comHorarios = (times: OilRoutineView['times'], handlers = acoes()) => ({
    handlers,
    render: () =>
      render(
        <OilRoutineCard
          view={view({ state: 'upcoming', everyDays: 3, dueOn: '2026-09-10' as never, times })}
          busy={false}
          onChoose={jest.fn()}
          onTurnOff={jest.fn()}
          times={handlers}
        />,
      ),
  });
  const t = (id: string, at: string, reminderEnabled = true) => ({ id, at, reminderEnabled });

  /**
   * ⚠️ **A seção só aparece com rotina ligada.** Um horário sem rotina é configuração que não
   * descreve nada — e o banco recusa, porque a FK aponta para `oil_routines`.
   */
  it('sem rotina, a seção de horários não existe', async () => {
    const s = await renderCard({}, { times: acoes() });
    expect(s.queryByText('Horários')).toBeNull();
  });

  /**
   * ⚠️ **E sem quem atenda, a seção também não aparece.** Oferecer "adicionar horário" num cartão
   * que não recebeu as ações seria o botão morto que a SPEC-027 achou na aba Prateleira.
   */
  it('com rotina mas sem as ações, a seção não existe', async () => {
    const s = await renderCard({ state: 'upcoming', everyDays: 3, dueOn: '2026-09-10' as never });
    expect(s.queryByText('Horários')).toBeNull();
  });

  it('lista os horários dela e oferece acrescentar', async () => {
    const s = await comHorarios([t('a', '08:00'), t('b', '20:00')]).render();
    await waitFor(() => s.getByText('Horários'));
    s.getByText('08:00');
    s.getByText('20:00');
    s.getByText('Adicionar horário');
  });

  it('acrescenta um horário pelo seletor, sem dependência de picker', async () => {
    const { handlers, render: r } = comHorarios([]);
    const s = await r();
    await fireEvent.press(s.getByText('Adicionar horário'));
    // 08:00 é o ponto de partida do seletor — não uma sugestão: nada na tela o chama de ideal.
    await fireEvent.press(s.getByLabelText('Uma hora depois'));
    await fireEvent.press(s.getByLabelText('Cinco minutos depois'));
    const [botao] = s.getAllByText('Adicionar horário').reverse();
    await fireEvent.press(botao as never);
    expect(handlers.onAdd).toHaveBeenCalledWith('09:05');
  });

  it('edita um horário existente', async () => {
    const { handlers, render: r } = comHorarios([t('a', '08:00')]);
    const s = await r();
    await fireEvent.press(s.getByLabelText('Editar o horário 08:00'));
    await fireEvent.press(s.getByLabelText('Uma hora antes'));
    await fireEvent.press(s.getByText('Salvar horário'));
    expect(handlers.onUpdate).toHaveBeenCalledWith('a', '07:00');
  });

  /** FR3 — desligar o lembrete **não** remove o horário: ele continua na rotina e registrável. */
  it('liga e desliga o lembrete de um horário sem removê-lo', async () => {
    const { handlers, render: r } = comHorarios([t('a', '08:00', true)]);
    const s = await r();
    await fireEvent.press(s.getByText('Lembrete ligado'));
    expect(handlers.onToggleReminder).toHaveBeenCalledWith('a', false);
    expect(handlers.onRemove).not.toHaveBeenCalled();
    // E o horário desligado continua visível, dizendo o próprio estado em palavra.
    const s2 = await comHorarios([t('a', '08:00', false)]).render();
    s2.getByText('08:00');
    s2.getByText('Lembrete desligado');
  });

  it('remove um horário', async () => {
    const { handlers, render: r } = comHorarios([t('a', '08:00'), t('b', '20:00')]);
    const s = await r();
    await fireEvent.press(s.getByLabelText('Remover o horário 20:00'));
    expect(handlers.onRemove).toHaveBeenCalledWith('b');
  });

  /** ⛔ *"Se quiser 10, pode"* — e a tela não trata dez como demais. */
  it('dez horários aparecem inteiros, sem aviso e sem corte', async () => {
    const dez = Array.from({ length: 10 }, (_, i) => t(String(i), `${String(8 + i).padStart(2, '0')}:00`));
    const s = await comHorarios(dez).render();
    for (const h of dez) s.getByText(h.at);
    expect(s.queryByText(/muitos|demais|limite|máximo|excesso/i)).toBeNull();
  });

  /**
   * ⛔ **A barreira do D-26/D-103 nesta seção.** Nenhum horário recomendado, nenhuma quantidade
   * elogiada, nenhuma comparação — e nada que diga o que o óleo faz.
   */
  it('nenhum texto recomenda, elogia ou compara quantidade', async () => {
    const s = await comHorarios([t('a', '08:00'), t('b', '12:00'), t('c', '20:00')]).render();
    expect(
      s.queryByText(/recomend|ideal|melhor|indicad|parabéns|muito bem|continue assim|mais vezes/i),
    ).toBeNull();
    expect(s.queryByText(/hidrata|nutre|sela|repara|fortalec/i)).toBeNull();
  });
});

/**
 * ⚠️ **Uma escrita que falha em silêncio é pior que uma que falha.**
 *
 * A leitura desta rotina falha calada de propósito (SPEC-040): sem ela, a rotina apenas não aparece.
 * Uma **escrita** é outra coisa — ela tocou, nada mudou, e sem uma frase não tem como saber se o app
 * ignorou o toque ou se a rede caiu. O `failure` era calculado desde a SPEC-040 e **nenhuma tela o
 * lia**; a auditoria da SPEC-053 achou a lacuna antes de ela crescer.
 */
describe('rotina de óleo — uma escrita que falha DIZ qual falhou (SPEC-053 §16)', () => {
  it('mostra a frase da falha, e nomeia o horário', async () => {
    const s = await render(
      <OilRoutineCard
        view={view({ state: 'upcoming', everyDays: 3, dueOn: '2026-09-10' as never })}
        busy={false}
        onChoose={jest.fn()}
        onTurnOff={jest.fn()}
        message="Não foi possível adicionar o horário 08:00."
      />,
    );
    s.getByText('Não foi possível adicionar o horário 08:00.');
  });

  it('sem falha, nenhuma frase de erro aparece', async () => {
    const s = await renderCard({ state: 'upcoming', everyDays: 3, dueOn: '2026-09-10' as never });
    expect(s.queryByText(/Não foi possível/)).toBeNull();
  });
});
