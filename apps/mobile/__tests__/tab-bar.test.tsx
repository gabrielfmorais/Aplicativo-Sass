import { fireEvent, render } from '@testing-library/react-native';

import { TABS, TabBar } from '@/design/TabBar';
import { CareTabScreen } from '@/features/care/CareTabScreen';

/**
 * SPEC-026 fatia 1 — as quatro categorias.
 *
 * O que estes testes protegem não é a barra: é a promessa de que **nenhuma capability volta a se
 * esconder**. Antes desta fatia, a prateleira (`F26`) e "meu cabelo mudou" (`F23`) moravam dentro
 * da tela de assinatura e exclusão de conta — não por decisão, mas porque não havia onde
 * pendurá-las. AC2 e AC10 existem para que isso não aconteça de novo em silêncio.
 */
describe('TabBar (SPEC-026)', () => {
  it('tem exatamente quatro categorias, e Community não é uma delas ainda', () => {
    expect(TABS.map((t) => t.label)).toEqual(['Hoje', 'Cuidados', 'Progresso', 'Você']);
    // NG5 — Community continua COMMITTED e ausente da tela até existir escala e moderação.
    expect(TABS.some((t) => /comunidade|community/i.test(t.label))).toBe(false);
  });

  /**
   * FR2 — a ativa se lê em três canais. O teste cobre o que uma leitora de tela recebe: sem
   * `selected`, "Hoje" e "Cuidados" são indistinguíveis para quem não enxerga a cor nem o traço.
   */
  it('anuncia qual aba está ativa, e a posição de cada uma', async () => {
    const s = await render(<TabBar active="care" onChange={jest.fn()} />);
    const care = s.getByLabelText('Cuidados, aba 2 de 4');
    expect(care.props.accessibilityState?.selected).toBe(true);
    expect(s.getByLabelText('Hoje, aba 1 de 4').props.accessibilityState?.selected).toBe(false);
  });

  it('troca de aba ao toque', async () => {
    const onChange = jest.fn();
    const s = await render(<TabBar active="today" onChange={onChange} />);
    await fireEvent.press(s.getByLabelText('Progresso, aba 3 de 4'));
    expect(onChange).toHaveBeenCalledWith('progress');
  });
});

/**
 * AC2 — a prateleira saiu da Conta e passou a morar em Cuidados, junto do ciclo: é rotina, e rotina
 * não mora na gaveta de configurações.
 */
describe('CareTabScreen (SPEC-026)', () => {
  it('reúne o ciclo e a prateleira, que antes estavam em telas diferentes', async () => {
    const onOpenCycle = jest.fn();
    const onOpenShelf = jest.fn();
    const s = await render(<CareTabScreen hasPlan onOpenCycle={onOpenCycle} onOpenShelf={onOpenShelf} />);
    await fireEvent.press(s.getByText('Ver meu ciclo'));
    await fireEvent.press(s.getByText('Ver minha prateleira'));
    expect(onOpenCycle).toHaveBeenCalled();
    expect(onOpenShelf).toHaveBeenCalled();
  });

  /**
   * EC1 — sem plano o ciclo não existe. Um botão que abre uma tela vazia é pior que um botão
   * ausente: a tela diz o que falta, e a prateleira continua acessível porque não depende de plano.
   */
  it('sem plano, diz o que falta em vez de abrir um ciclo que não existe', async () => {
    const onOpenCycle = jest.fn();
    const s = await render(
      <CareTabScreen hasPlan={false} onOpenCycle={onOpenCycle} onOpenShelf={jest.fn()} />,
    );
    expect(s.queryByText('Ver meu ciclo')).toBeNull();
    expect(s.getByText(/Seu ciclo aparece assim que/)).toBeTruthy();
    expect(s.getByText('Ver minha prateleira')).toBeTruthy();
  });
});
