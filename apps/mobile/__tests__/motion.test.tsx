import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';

import { Reveal } from '@/design/Reveal';
import { Chip, Text } from '@/design/primitives';

/**
 * SPEC-018 FR4. Duas garantias, e as duas são sobre não perder nada por causa de movimento:
 * conteúdo aparece mesmo que a animação não rode, e quem pediu menos movimento não recebe nenhum.
 */
describe('movimento (SPEC-018 FR4)', () => {
  afterEach(() => jest.restoreAllMocks());

  const reduceMotion = (enabled: boolean) =>
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(enabled);

  it('Reveal mostra o conteúdo — uma animação nunca é pré-requisito para ler a tela', async () => {
    reduceMotion(false);
    const s = await render(
      <Reveal>
        <Text>Falta pouco.</Text>
      </Reveal>,
    );
    s.getByText('Falta pouco.');
  });

  it('com redução de movimento ligada, o Reveal não anima nada', async () => {
    reduceMotion(true);
    const timing = jest.spyOn(Animated, 'timing');
    const s = await render(
      <Reveal>
        <Text>Falta pouco.</Text>
      </Reveal>,
    );
    await waitFor(() => expect(timing).not.toHaveBeenCalled());
    s.getByText('Falta pouco.');
  });

  /**
   * O defeito que este teste existe para impedir: a leitura da preferência é assíncrona, e um
   * `false` otimista fazia a animação **começar** antes da resposta. Quando ela chegava dizendo
   * "reduza o movimento", já era tarde — a transição tinha rodado, em toda troca de passo, com o
   * código parecendo correto.
   */
  it('não anima enquanto não sabe a preferência — e mostra o conteúdo mesmo assim', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockReturnValue(new Promise(() => {}));
    const timing = jest.spyOn(Animated, 'timing');
    const s = await render(
      <Reveal>
        <Text>Falta pouco.</Text>
      </Reveal>,
    );
    expect(timing).not.toHaveBeenCalled();
    // E o conteúdo não fica refém da resposta: uma animação é opcional, ver a tela não é.
    s.getByText('Falta pouco.');
  });

  it('sem essa preferência, o Reveal anima a entrada', async () => {
    reduceMotion(false);
    const timing = jest.spyOn(Animated, 'timing');
    await render(
      <Reveal>
        <Text>Falta pouco.</Text>
      </Reveal>,
    );
    await waitFor(() => expect(timing).toHaveBeenCalled());
  });

  it('a opção escolhida responde ao toque, e só ao marcar', async () => {
    reduceMotion(false);
    const timing = jest.spyOn(Animated, 'timing');
    const s = await render(<Chip label="Cacheado" selected={false} onPress={jest.fn()} />);
    expect(timing).not.toHaveBeenCalled();

    // Marcar responde…
    await s.rerender(<Chip label="Cacheado" selected onPress={jest.fn()} />);
    await waitFor(() => expect(timing).toHaveBeenCalled());

    // …desmarcar, não: uma fileira de opções pulando a cada toque é ruído, não resposta.
    timing.mockClear();
    await s.rerender(<Chip label="Cacheado" selected={false} onPress={jest.fn()} />);
    expect(timing).not.toHaveBeenCalled();
  });

  it('a reação ao toque não substitui o estado: o chip continua marcado para tecnologia assistiva', async () => {
    reduceMotion(true);
    const onPress = jest.fn();
    const s = await render(<Chip label="Cacheado" selected onPress={onPress} />);
    expect(s.getByRole('radio').props.accessibilityState).toMatchObject({ checked: true });
    await fireEvent.press(s.getByText('Cacheado'));
    expect(onPress).toHaveBeenCalled();
  });
});
