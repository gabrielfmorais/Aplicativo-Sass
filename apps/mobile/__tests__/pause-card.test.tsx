import type { ResumeOutcome } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { PauseCard } from '@/features/care/PauseCard';

const shifted = (over: Partial<ResumeOutcome> = {}): ResumeOutcome => ({
  action: 'shifted',
  shiftDays: 4,
  careCount: 3,
  ...over,
});

const renderCard = (props: Partial<React.ComponentProps<typeof PauseCard>> = {}) =>
  render(
    <PauseCard
      pausedOn={null}
      busy={false}
      onPause={jest.fn()}
      onPreviewResume={jest.fn(async () => shifted())}
      onResume={jest.fn()}
      {...props}
    />,
  );

/**
 * SPEC-022 fatia 3. Duas coisas a proteger: ela **sabe antes de confirmar** (FR4), e nada em
 * nenhum dos dois momentos cobra nada dela — "parar sem perder nada, e voltar sem culpa".
 */
describe('PauseCard (SPEC-022)', () => {
  it('andando, oferece pausar e diz o que a pausa faz por ela', async () => {
    const onPause = jest.fn();
    const s = await renderCard({ onPause });
    s.getByText(/nada fica atrasado e nenhum lembrete chega/);
    await fireEvent.press(s.getByText('Pausar'));
    expect(onPause).toHaveBeenCalled();
  });

  it('pausada, diz o estado e desde quando', async () => {
    const s = await renderCard({ pausedOn: '2026-08-28' });
    s.getByText('Seu cronograma está pausado');
    s.getByText(/Desde sex, 28\/08/);
    // FR2 em palavra, na tela: é o que explica por que nada aparece atrasado.
    s.getByText(/Nada está atrasado e nenhum lembrete vai chegar/);
  });

  /** FR4 — a diferença entre ela decidir e ela descobrir. */
  it('mostra o que vai acontecer ANTES de oferecer o botão de voltar', async () => {
    const onResume = jest.fn();
    const s = await renderCard({ pausedOn: '2026-08-28', onResume });

    // Antes de perguntar, não há botão de confirmar.
    expect(s.queryByText('Voltar aos meus cuidados')).toBeNull();

    await fireEvent.press(s.getByText('Quero voltar'));
    expect(await s.findByText(/3 cuidados restantes andam 4 dias para frente/)).toBeTruthy();
    expect(onResume).not.toHaveBeenCalled();

    await fireEvent.press(s.getByText('Voltar aos meus cuidados'));
    expect(onResume).toHaveBeenCalled();
  });

  it('continuar pausado é uma saída de verdade, não um link escondido', async () => {
    const onResume = jest.fn();
    const s = await renderCard({ pausedOn: '2026-08-28', onResume });
    await fireEvent.press(s.getByText('Quero voltar'));
    await s.findByText('Continuar pausado');

    await fireEvent.press(s.getByText('Continuar pausado'));
    expect(onResume).not.toHaveBeenCalled();
    await waitFor(() => s.getByText('Quero voltar'));
  });

  /** A volta longa não é uma avalanche: é a oferta de um ciclo novo, dita antes. */
  it('quando o deslocamento não cabe, explica que o próximo ciclo é montado agora', async () => {
    const s = await renderCard({
      pausedOn: '2026-07-01',
      onPreviewResume: jest.fn(async () => shifted({ action: 'new_cycle', shiftDays: 60, careCount: 5 })),
    });
    await fireEvent.press(s.getByText('Quero voltar'));
    expect(await s.findByText(/montamos o próximo a partir de agora/)).toBeTruthy();
  });

  /** Falhar em prever não pode virar uma retomada às cegas. */
  it('se a previsão falha, a pergunta volta em vez de o app confirmar o que não sabe explicar', async () => {
    const onResume = jest.fn();
    const s = await renderCard({
      pausedOn: '2026-08-28',
      onPreviewResume: jest.fn(async () => Promise.reject(new Error('rede'))),
      onResume,
    });
    await fireEvent.press(s.getByText('Quero voltar'));
    await waitFor(() => s.getByText('Quero voltar'));
    expect(s.queryByText('Voltar aos meus cuidados')).toBeNull();
    expect(onResume).not.toHaveBeenCalled();
  });

  /**
   * AC8 — "parar sem perder nada, e voltar sem culpa". Uma palavra de reprovação em qualquer um dos
   * dois momentos desfaz o objetivo inteiro.
   */
  it('não cobra, não repreende e não promete resultado', async () => {
    const andando = await renderCard();
    const pausada = await renderCard({ pausedOn: '2026-08-28' });
    await fireEvent.press(pausada.getByText('Quero voltar'));
    await pausada.findByText(/andam 4 dias/);

    const forbidden = [
      // "atrasado" **não** entra: a tela usa a palavra para dizer que nada está atrasado, que é o
      // oposto de cobrar. A barreira é sobre repreensão, não sobre vocabulário — e uma barreira
      // grosseira demais é tão inútil quanto uma que nunca casa, só que ruidosa.
      /\b(você falhou|deixou de|abandonou|desistiu|você perdeu)/i,
      /\b(volte logo|não desista|continue firme|parabéns)/i,
      /\d+\s*%/,
    ];
    for (const pattern of forbidden) {
      expect(andando.queryByText(pattern)).toBeNull();
      expect(pausada.queryByText(pattern)).toBeNull();
    }
    for (const sample of ['você falhou', 'volte logo', '40%', 'deixou de fazer']) {
      expect(forbidden.some((p) => p.test(sample))).toBe(true);
    }
  });
});
