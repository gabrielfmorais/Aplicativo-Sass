import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { HairFlow } from '@/design/HairFlow';
import { WelcomeScreen } from '@/features/auth/WelcomeScreen';

/**
 * SPEC-018 — a entrada da Huna. O que vale testar aqui não é a aparência: é que a marca aparece
 * antes do formulário, que existe **uma** saída, e que o hero não atrapalha quem usa leitor de tela.
 */
describe('WelcomeScreen (SPEC-018 FR1)', () => {
  it('apresenta a marca e uma proposta de valor antes de pedir qualquer coisa', async () => {
    const screen = await render(<WelcomeScreen onStart={jest.fn()} />);

    await waitFor(() => screen.getByText('Huna'));
    screen.getByText('Seu cabelo. Sua rotina. Sua evolução.');
    // Nada de campo, nada de provedor: esta tela não pede nada.
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.queryByText(/Continuar com/)).toBeNull();
  });

  it('tem exatamente uma ação, e ela leva adiante', async () => {
    const onStart = jest.fn();
    const screen = await render(<WelcomeScreen onStart={onStart} />);

    await waitFor(() => screen.getByText('Começar'));
    expect(screen.getAllByRole('button')).toHaveLength(1);

    await fireEvent.press(screen.getByText('Começar'));
    expect(onStart).toHaveBeenCalled();
  });

  /**
   * BR3 — nada aqui pode prometer resultado capilar nem citar número que não temos. Uma promessa
   * de resultado seria conteúdo capilar substantivo e cairia no gate D-26; um número inventado
   * seria dado inventado. As duas coisas são fáceis de escrever sem perceber, então ficam travadas.
   */
  it('não promete resultado nem cita prova social que não existe', async () => {
    const screen = await render(<WelcomeScreen onStart={jest.fn()} />);
    await waitFor(() => screen.getByText('Huna'));

    expect(screen.queryByText(/milhões|milhares|\d+\s*%|nº 1|número 1/i)).toBeNull();
    expect(screen.queryByText(/cabelo mais|recupera|transforma seu cabelo|garantimos/i)).toBeNull();
  });
});

describe('HairFlow (SPEC-018 BR4)', () => {
  /** É decoração. Anunciá-la só colocaria ruído entre a usuária e a ação da tela. */
  it('é invisível para tecnologia assistiva', async () => {
    const screen = await render(<HairFlow />);
    expect(screen.queryByRole('image')).toBeNull();
    expect(screen.root?.props.accessibilityElementsHidden).toBe(true);
    expect(screen.root?.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});
