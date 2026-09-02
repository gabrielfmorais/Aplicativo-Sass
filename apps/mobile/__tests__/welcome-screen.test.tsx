import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { HunaFigure, PROFILE, RIBBONS } from '@/design/HunaFigure';
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

describe('HunaFigure (SPEC-018 BR4 / SPEC-028)', () => {
  /** É decoração. Anunciá-la só colocaria ruído entre a usuária e a ação da tela. */
  it('é invisível para tecnologia assistiva', async () => {
    const screen = await render(<HunaFigure />);
    expect(screen.root?.props.accessibilityElementsHidden).toBe(true);
    expect(screen.root?.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  /**
   * SPEC-028 — a barreira contra a volta da **massa única**.
   *
   * A recusa da direção foi explícita: "nenhuma leitura de capacete, nenhuma massa única atrás da
   * cabeça". O cabelo é feito de fitas que se cruzam, e "muitas fitas" não é um detalhe de estilo —
   * é a única razão de o desenho ter profundidade. Quatro formas opacas leem flat, e foi assim que
   * as três versões anteriores foram reprovadas.
   *
   * O teste mede o que a recusa significa em números: fitas suficientes, em **planos** diferentes,
   * e com fitas passando **na frente** da figura.
   */
  it('o cabelo é feito de muitas fitas, em planos, e algumas passam na frente', () => {
    expect(RIBBONS.length).toBeGreaterThanOrEqual(16);
    const layers = new Set(RIBBONS.map((r) => r.layer));
    expect(layers.size).toBeGreaterThanOrEqual(4);
    // O plano 2 é o que cruza o rosto e o corpo: sem ele a figura fica colada num fundo.
    expect(RIBBONS.filter((r) => r.layer === 2).length).toBeGreaterThan(0);
    // E há fio fino de verdade, não só massa: é o que responde ao movimento por último.
    expect(RIBBONS.some((r) => r.width.max <= 10)).toBe(true);
  });

  /**
   * ⚠️ **Translucidez é o que constrói profundidade.** Uma fita translúcida sobre outra cria um
   * terceiro tom que nenhuma das duas tem. Se todas fossem opacas, o desenho voltaria a ser um
   * empilhamento de recortes — exatamente o "flat demais" que a direção recusou.
   */
  it('há sobreposição translúcida, e não só formas opacas empilhadas', () => {
    expect(RIBBONS.filter((r) => r.opacity < 1).length).toBeGreaterThan(RIBBONS.length / 2);
  });

  /**
   * SPEC-027/028 — a barreira contra a volta da figura **de frente**.
   *
   * A primeira versão era frontal e lia como microfone a 390px: de frente o cabelo só pode ser
   * moldura atrás de um oval claro. Um perfil não é verificável por pixel num teste unitário, mas é
   * verificável por **estrutura** — uma silhueta de frente é simétrica em torno do eixo vertical, e
   * um perfil não é. O nariz fica muito além do centro do rosto; num desenho frontal nenhum ponto do
   * contorno faria isso.
   */
  it('desenha o rosto de perfil, e não de frente', () => {
    const points = [...PROFILE.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)/g)]
      .map((m) => ({ x: Number(m[1]), y: Number(m[2]) }))
      .filter((q) => Number.isFinite(q.x) && Number.isFinite(q.y));

    /**
     * ⚠️ **Só a cabeça, e por quê.** A primeira versão deste teste media a silhueta **inteira** e
     * passou a reprovar sozinha quando o ombro foi estreitado: o "centro do rosto" era, na verdade,
     * o centro do corpo. Uma barreira que quebra ao mexer numa parte que ela não vigia não está
     * medindo o que diz medir.
     */
    const head = points.filter((q) => q.y <= 225);
    const top = Math.min(...head.map((q) => q.y));
    const jaw = Math.max(...head.map((q) => q.y));
    const widest = head.reduce((best, q) => (q.x > best.x ? q : best));

    /**
     * A propriedade que separa perfil de frente, e que sobrevive a redimensionar a cabeça: numa
     * silhueta **frontal** o ponto mais largo é a têmpora, na metade de cima do crânio. Num
     * **perfil** o ponto mais à frente é o nariz, e nariz fica na metade de baixo. Nenhum desenho de
     * frente consegue satisfazer isto.
     */
    expect(widest.y).toBeGreaterThan((top + jaw) / 2);

    // E o nariz é uma saliência de verdade, não um arredondamento: bem à frente do meio do crânio.
    const centre = (Math.min(...head.map((q) => q.x)) + Math.max(...head.map((q) => q.x))) / 2;
    expect(widest.x - centre).toBeGreaterThan(30);
  });
});
