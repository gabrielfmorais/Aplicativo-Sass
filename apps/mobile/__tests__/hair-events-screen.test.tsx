import type { HairEventPort, LocalDate } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { HairEventsScreen } from '@/features/hair-events/HairEventsScreen';

const TODAY = '2026-09-01' as LocalDate;

const makePort = (overrides: Partial<HairEventPort> = {}): jest.Mocked<HairEventPort> =>
  ({
    list: jest.fn(async () => []),
    record: jest.fn(async () => undefined),
    void: jest.fn(async () => undefined),
    ...overrides,
  }) as unknown as jest.Mocked<HairEventPort>;

const renderScreen = (
  events: HairEventPort,
  extra: Partial<React.ComponentProps<typeof HairEventsScreen>> = {},
) =>
  render(
    <HairEventsScreen
      events={events}
      today={TODAY}
      timeZone={() => 'America/Sao_Paulo'}
      newEventId={() => 'ev-1'}
      onBack={jest.fn()}
      {...extra}
    />,
  );

/**
 * SPEC-020 (F23). O Free **registra**; não interpreta, não aconselha e não diagnostica — é isso que
 * mantém a capability fora do gate de domínio, e é a primeira coisa que se perde sem barreira.
 */
describe('HairEventsScreen (SPEC-020)', () => {
  it('registra o evento escolhido, com o dia dela e o fuso dela', async () => {
    const events = makePort();
    const s = await renderScreen(events);

    await waitFor(() => s.getByText('Nada registrado ainda.'));
    await fireEvent.press(s.getByText('Descoloração ou luzes'));
    await fireEvent.press(s.getByText('Registrar'));

    await waitFor(() =>
      expect(events.record).toHaveBeenCalledWith({
        eventType: 'bleaching_or_highlights',
        occurredOn: '2026-09-01',
        clientEventId: 'ev-1',
        timeZone: 'America/Sao_Paulo',
      }),
    );
  });

  it('não registra nada sem escolher um tipo', async () => {
    const events = makePort();
    const s = await renderScreen(events);
    await waitFor(() => s.getByText('Nada registrado ainda.'));
    expect(s.getByText('Registrar').parent?.props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(s.getByText('Registrar'));
    expect(events.record).not.toHaveBeenCalled();
  });

  /** FR7 — e o servidor confirma: a mesma `clientEventId` devolve o mesmo evento. */
  it('dois toques registram um evento', async () => {
    let release: (() => void) | undefined;
    const events = makePort({
      record: jest.fn(() => new Promise<void>((resolve) => (release = resolve))),
    });
    const s = await renderScreen(events);
    await waitFor(() => s.getByText('Nada registrado ainda.'));
    await fireEvent.press(s.getByText('Corte'));
    await fireEvent.press(s.getByText('Registrar'));

    expect(events.record).toHaveBeenCalledTimes(1);
    for (const button of s.getAllByRole('button')) {
      expect(button.props.accessibilityState?.disabled).toBe(true);
    }
    release?.();
  });

  /** NG3/D-28 — oferecer é o limite. Substituir cronograma continua sendo decisão dela. */
  it('depois de registrar, oferece reavaliar com uma saída igualmente clara', async () => {
    const onReassess = jest.fn();
    const s = await renderScreen(makePort(), { onReassess });
    await waitFor(() => s.getByText('Nada registrado ainda.'));
    await fireEvent.press(s.getByText('Química'));
    await fireEvent.press(s.getByText('Registrar'));

    expect(await s.findByText('Registrado')).toBeTruthy();
    s.getByText('Reavaliar meu cabelo');
    // A recusa é um botão de verdade, não um link escondido.
    await fireEvent.press(s.getByText('Agora não'));
    expect(onReassess).not.toHaveBeenCalled();
    await waitFor(() => s.getByText('O que mudou?'));
  });

  it('sem cronograma para substituir, não oferece o que não faz sentido', async () => {
    const s = await renderScreen(makePort());
    await waitFor(() => s.getByText('Nada registrado ainda.'));
    await fireEvent.press(s.getByText('Praia ou piscina'));
    await fireEvent.press(s.getByText('Registrar'));

    expect(await s.findByText('Registrado')).toBeTruthy();
    expect(s.queryByText('Reavaliar meu cabelo')).toBeNull();
  });

  it('lista o que ela registrou e deixa remover', async () => {
    const events = makePort({
      list: jest.fn(async () => [
        {
          id: 'e1',
          eventType: 'haircut' as const,
          occurredOn: '2026-08-30',
          createdAt: '2026-08-30T10:00:00Z',
        },
      ]),
    });
    const s = await renderScreen(events);
    await waitFor(() => s.getByText('dom, 30/08'));
    // "Corte" aparece duas vezes de propósito: o chip para registrar e a linha do que já foi
    // registrado. É a linha que este teste remove.
    expect(s.getAllByText('Corte')).toHaveLength(2);

    await fireEvent.press(s.getByLabelText('Remover Corte de dom, 30/08'));
    await waitFor(() => expect(events.void).toHaveBeenCalledWith('e1'));
  });

  it('uma leitura que falha não vira uma lista vazia', async () => {
    const events = makePort({ list: jest.fn(async () => Promise.reject(new Error('rede'))) });
    const s = await renderScreen(events);

    expect(await s.findByText('Não foi possível carregar seus registros.')).toBeTruthy();
    expect(s.queryByText('Nada registrado ainda.')).toBeNull();
    // Fingir que ela não registrou nada seria a pior mentira que esta tela pode contar.
    s.getByText('Tentar novamente');
  });

  it('quando a gravação falha, explica e não inventa que registrou', async () => {
    const events = makePort({ record: jest.fn(async () => Promise.reject(new Error('rede'))) });
    const s = await renderScreen(events);
    await waitFor(() => s.getByText('Nada registrado ainda.'));
    await fireEvent.press(s.getByText('Coloração'));
    await fireEvent.press(s.getByText('Registrar'));

    expect(await s.findByText(/Não foi possível registrar agora/)).toBeTruthy();
    expect(s.queryByText('Registrado')).toBeNull();
  });

  /**
   * AC8 — a barreira. Um rótulo a mais e esta tela vira conteúdo capilar substantivo, que exige
   * sign-off de domínio (D-26/D-70). As amostras precisam casar, senão a barreira não protege nada.
   */
  it('não orienta cuidado, não prevê resultado e não qualifica o cabelo dela', async () => {
    const s = await renderScreen(makePort(), { onReassess: jest.fn() });
    await waitFor(() => s.getByText('Nada registrado ainda.'));

    const forbidden = [
      /\b(hidrate|nutra|reconstrua|aplique|evite|recomendamos|indicamos)\b/i,
      // Sem `\b` no fim: um radical não termina em fronteira de palavra, então `/danificad\b/`
      // nunca casaria com "danificado" — a âncora que sempre passa é uma barreira que não protege
      // coisa alguma, e é exatamente o defeito que a auditoria da SPEC-007 encontrou.
      /\b(danificad|fragilizad|saudáve|quebradiç|poros)/i,
      /\b(vai precisar|costuma pedir|tende a|precisa de)/i,
      /\d+\s*%/,
    ];
    for (const pattern of forbidden) expect(s.queryByText(pattern)).toBeNull();

    for (const sample of ['hidrate os fios', 'cabelo danificado', 'costuma pedir mais', '80%']) {
      expect(forbidden.some((p) => p.test(sample))).toBe(true);
    }
  });
});

/**
 * EC4 — a chave de idempotência existe para o caso em que a chamada **chegou** e a resposta se
 * perdeu. Gerar uma chave nova a cada tentativa a desfaz justamente aí: o retry cria o segundo
 * evento em vez de reencontrar o primeiro.
 */
describe('HairEventsScreen — idempotência entre tentativas (SPEC-020 EC4)', () => {
  it('reusa a mesma clientEventId ao tentar de novo, e só troca depois de dar certo', async () => {
    const record = jest
      .fn<Promise<void>, [{ clientEventId: string }]>()
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValue(undefined);
    const events = makePort({ record } as Partial<HairEventPort>);
    let issued = 0;
    const s = await render(
      <HairEventsScreen
        events={events}
        today={TODAY}
        timeZone={() => 'America/Sao_Paulo'}
        newEventId={() => `ev-${++issued}`}
        onBack={jest.fn()}
      />,
    );
    await waitFor(() => s.getByText('Nada registrado ainda.'));

    await fireEvent.press(s.getByText('Calor intenso'));
    await fireEvent.press(s.getByText('Registrar'));
    expect(await s.findByText(/Não foi possível registrar agora/)).toBeTruthy();

    await fireEvent.press(s.getByText('Registrar'));
    await waitFor(() => expect(record).toHaveBeenCalledTimes(2));
    expect(record.mock.calls[0]?.[0]?.clientEventId).toBe('ev-1');
    expect(record.mock.calls[1]?.[0]?.clientEventId).toBe('ev-1');

    // A intenção terminou: a próxima é outra, e merece a própria chave.
    await waitFor(() => s.getByText('Registrado'));
    await fireEvent.press(s.getByText('Voltar'));
    await fireEvent.press(s.getByText('Corte'));
    await fireEvent.press(s.getByText('Registrar'));
    await waitFor(() => expect(record).toHaveBeenCalledTimes(3));
    expect(record.mock.calls[2]?.[0]?.clientEventId).toBe('ev-2');
  });
});
