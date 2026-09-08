import { fireEvent, render } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { DataSourcesScreen } from '@/features/account/DataSourcesScreen';

/**
 * SPEC-057 (F32) — a tela de atribuição das fontes abertas do catálogo.
 *
 * ⚠️ O que estes testes guardam: a atribuição EXIGIDA pelas licenças (OBF + ODbL + CC BY-SA) está
 * presente e os links abrem; e nada aqui afirma coisa sobre cabelo (é crédito de fonte, não conteúdo).
 */
describe('DataSourcesScreen (SPEC-057)', () => {
  it('atribui Open Beauty Facts e nomeia as licenças exigidas', async () => {
    const s = await render(<DataSourcesScreen onBack={jest.fn()} />);
    s.getByText('Fontes de dados');
    s.getByText('Open Beauty Facts');
    // As duas licenças que as obrigações exigem citar (aparecem no corpo e no link):
    s.getByText(/Open Database License \(ODbL\)/);
    expect(s.getAllByText(/CC BY-SA 3\.0/).length).toBeGreaterThan(0);
    s.getByText('Licença dos dados — ODbL 1.0');
    s.getByText('Licença das imagens — CC BY-SA 3.0');
  });

  it('os links de licença abrem no navegador (atribuição com link, como a licença pede)', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const s = await render(<DataSourcesScreen onBack={jest.fn()} />);
    await fireEvent.press(s.getByText('Licença das imagens — CC BY-SA 3.0'));
    expect(open).toHaveBeenCalledWith('https://creativecommons.org/licenses/by-sa/3.0/');
    open.mockRestore();
  });

  it('deixa claro que a prateleira dela não vem dessas fontes', async () => {
    const s = await render(<DataSourcesScreen onBack={jest.fn()} />);
    s.getByText(/A sua prateleira, os seus registros e o seu plano são seus/);
  });

  /** ⚠️ Crédito de fonte, nunca conteúdo capilar (D-26). */
  it('não afirma nada sobre cabelo', async () => {
    const s = await render(<DataSourcesScreen onBack={jest.fn()} />);
    for (const node of s.queryAllByText(/melhor|ideal|recomend|para o seu cabelo|frizz|macie|saud/i)) {
      throw new Error(`texto proibido: "${node.props.children}"`);
    }
  });
});
