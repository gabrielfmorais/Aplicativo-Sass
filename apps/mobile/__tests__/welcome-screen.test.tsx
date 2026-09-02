import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { HunaFigure, LOOSE, MASS } from '@/design/HunaFigure';
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

describe('HunaFigure (SPEC-018 BR4 / SPEC-026 FR19)', () => {
  /** É decoração. Anunciá-la só colocaria ruído entre a usuária e a ação da tela. */
  it('é invisível para tecnologia assistiva', async () => {
    const screen = await render(<HunaFigure />);
    expect(screen.queryByRole('image')).toBeNull();
    expect(screen.root?.props.accessibilityElementsHidden).toBe(true);
    expect(screen.root?.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  /**
   * FR19 — a barreira contra a volta do placeholder.
   *
   * O hero anterior desenhava cabelo com `View` arredondada, o que é um **retângulo** — e a direção
   * recusou explicitamente retângulos e listras como representação de cabelo. Um caminho SVG só é
   * curva se tiver comando de Bézier: `C` ou `S`. Um `d` feito só de `M`, `L` e `Z` é um polígono
   * com outro nome, e este teste existe para que ninguém volte a ele sem perceber.
   */
  it('desenha o cabelo com curvas de Bézier, nunca com retas', () => {
    const hair = [MASS, ...LOOSE];
    expect(hair.length).toBeGreaterThan(3);
    for (const d of hair) {
      // Bézier de verdade: cúbica (`C`/`S`) em todo caminho de cabelo.
      expect(d).toMatch(/[CS]\s/);
      // E cada mecha tem **mais de uma**: um segmento só é um arco, e arco não é mecha.
      expect((d.match(/C/g) ?? []).length).toBeGreaterThanOrEqual(2);
    }
    // A âncora: um polígono passaria na primeira asserção se ela fosse frouxa.
    expect('M0 0 L 10 0 L 10 10 Z').not.toMatch(/[CS]\s/);
  });
});
