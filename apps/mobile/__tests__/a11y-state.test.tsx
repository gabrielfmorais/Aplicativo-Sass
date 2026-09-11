import { render } from '@testing-library/react-native';

import { Button, Chip } from '@/design/primitives';

/**
 * SPEC-072 — **o estado de acessibilidade tem de chegar à plataforma, e o nativo não pode regredir.**
 *
 * A SPEC-051 mediu, no DEV real, que `aria-checked` voltava **nulo na página inteira**: o
 * `react-native-web` 0.21 descarta o `accessibilityState` legado, e o estado nunca chegava ao DOM.
 * O custo registrado foi grande — a 390px o estado de um controle deixou de ser aferível por ARIA, e
 * a validação teve de inferir seleção pela cor.
 *
 * ⚠️ **O que ESTES testes provam é a metade nativa:** declarar `aria-*` produz **exatamente** o mesmo
 * `accessibilityState` de antes, porque o `Pressable` do RN 0.86 funde `aria-X ?? accessibilityState?.X`.
 * É a garantia de que nada regride no iPhone.
 *
 * ⛔ **A metade web não se prova aqui** — este preset renderiza a árvore nativa, não o DOM. Ela se
 * prova medindo a página a 390px, e é o que a evidência da SPEC-072 registra.
 */
describe('SPEC-072 — o estado nativo é idêntico ao de antes', () => {
  it('o Chip anuncia checked e disabled como o vocabulário nativo espera', async () => {
    const s = await render(<Chip label="Plopping" selected onPress={jest.fn()} />);
    const estado = s.getByRole('radio').props.accessibilityState as Record<string, unknown>;
    expect(estado.checked).toBe(true);
    expect(estado.disabled).toBeFalsy();
  });

  it('o Chip desabilitado anuncia os dois estados, independentes (EC2)', async () => {
    const s = await render(<Chip label="Plopping" selected disabled onPress={jest.fn()} />);
    const estado = s.getByRole('radio').props.accessibilityState as Record<string, unknown>;
    expect(estado.checked).toBe(true);
    expect(estado.disabled).toBe(true);
  });

  /**
   * ⚠️ **BR2 — `aria-disabled` ANUNCIA, `disabled` RECUSA.** Os dois andam juntos: sem o segundo o
   * controle seria anunciado como recusado e ainda aceitaria o toque.
   */
  it('o Button ocupado recusa o toque E anuncia que está ocupado', async () => {
    const aoTocar = jest.fn();
    const s = await render(<Button label="Criando…" busy onPress={aoTocar} />);
    const botao = s.getByRole('button');
    const estado = botao.props.accessibilityState as Record<string, unknown>;
    expect(estado.busy).toBe(true);
    expect(estado.disabled).toBe(true);
    expect(botao.props.onPress).toBeUndefined();
  });

  /** BR3 — nada é declarado a mais: um botão comum não inventa `expanded` nem `checked`. */
  it('um botão comum não anuncia estado que não tem', async () => {
    const s = await render(<Button label="Voltar" onPress={jest.fn()} />);
    const estado = s.getByRole('button').props.accessibilityState as Record<string, unknown>;
    expect(estado.expanded).toBeUndefined();
    expect(estado.checked).toBeUndefined();
    expect(estado.selected).toBeUndefined();
  });
});
