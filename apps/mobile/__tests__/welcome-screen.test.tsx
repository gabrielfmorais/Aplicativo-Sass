import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { HunaFigure } from '@/design/HunaFigure';
import { SCENES } from '@/design/huna-hero';
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

describe('HunaFigure (SPEC-018 BR4 / SPEC-036)', () => {
  const scenes = Object.entries(SCENES);

  /** É decoração. Anunciá-lo só colocaria ruído entre a usuária e a ação da tela. */
  it('é invisível para tecnologia assistiva', async () => {
    const screen = await render(<HunaFigure />);
    expect(screen.root?.props.accessibilityElementsHidden).toBe(true);
    expect(screen.root?.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  /**
   * SPEC-036 — **poucas mechas grandes**, em toda cena, e a barreira é dos dois lados.
   *
   * O teto existe porque uma versão anterior tinha vinte fitas finas e a 390px o olho parava de
   * seguir a curva para começar a contar listras — *"sem dezenas de fios"* é literal na direção. O
   * piso de largura existe porque massa estreita não dá volume, dá risco.
   */
  it.each(scenes)('a cena %s é feita de poucas mechas grandes', (_name, scene) => {
    expect(scene.strands.length).toBeGreaterThanOrEqual(3);
    expect(scene.strands.length).toBeLessThanOrEqual(4);
    expect(scene.strands.every((s) => s.width.max >= 50)).toBe(true);
  });

  /**
   * ⚠️ **As duas cenas são composições DIFERENTES, não a mesma recortada.** Enquadrar a composição
   * vertical numa caixa larga foi tentado e reprovado: lia como imagem cortada, porque era. A
   * barreira compara as espinhas — se um dia alguém "simplificar" reutilizando a mesma lista, o
   * defeito volta em silêncio.
   */
  it('a abertura e o banner não compartilham as mesmas mechas', () => {
    const key = (s: (typeof SCENES)['portrait']) => JSON.stringify(s.strands.map((r) => r.spine));
    expect(key(SCENES.portrait)).not.toBe(key(SCENES.banner));
  });

  /**
   * ⚠️ **Translucidez é o que impede a volta das "listras duras".** Massa opaca sobre massa opaca
   * cria uma **borda**, e uma fileira de bordas paralelas lê como fita — foi assim que uma versão
   * anterior virou cortina. No máximo uma massa por cena pode ser opaca: a que faz de fundo.
   */
  it.each(scenes)('na cena %s, no máximo uma massa é opaca', (_name, scene) => {
    expect(scene.strands.filter((s) => s.opacity === 1).length).toBeLessThanOrEqual(1);
  });

  /**
   * ⚠️ **Movimento lento, e cada mecha no seu tempo.** Se duas dividissem período e atraso, elas
   * andariam em bloco e o conjunto pareceria uma imagem girando inteira. O teto de amplitude guarda
   * o "lento e elegante" que a direção pede.
   */
  it.each(scenes)('na cena %s cada mecha tem o seu próprio balanço, lento', (_name, scene) => {
    const phases = scene.strands.map((s) => `${s.sway.seconds}:${s.sway.delay}`);
    expect(new Set(phases).size).toBe(scene.strands.length);
    /**
     * ⚠️ **Amplitude simétrica em torno de zero é o que guarda um defeito que existiu.** O balanço
     * ia de `0` a `1` e a rotação de `-graus` a `+graus`: parado — com redução de movimento
     * ligada, ou no primeiro quadro de qualquer pessoa, antes de a preferência ser conhecida — o
     * valor 0 punha cada mecha no **extremo** do arco, e a animação começava com um pulo.
     */
    expect(scene.strands.every((s) => s.sway.degrees > 0 && s.sway.degrees <= 3)).toBe(true);
    expect(scene.strands.every((s) => s.sway.seconds >= 8)).toBe(true);
  });
});
