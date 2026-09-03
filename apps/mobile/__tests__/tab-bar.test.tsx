import { fireEvent, render } from '@testing-library/react-native';

import { TABS, TabBar } from '@/design/TabBar';
import { CareTabScreen } from '@/features/care/CareTabScreen';

/**
 * SPEC-026 fatia 1 + SPEC-027 — as quatro categorias.
 *
 * O que estes testes protegem não é a barra: é a promessa de que **nenhuma capability volta a se
 * esconder**. Antes da fatia 1, a prateleira (`F26`) e "meu cabelo mudou" (`F23`) moravam dentro da
 * tela de assinatura e exclusão de conta — não por decisão, mas porque não havia onde pendurá-las.
 * AC2 e AC10 existem para que isso não aconteça de novo em silêncio.
 */
describe('TabBar (SPEC-026 / SPEC-027)', () => {
  it('tem as quatro categorias do produto, e Você não é uma delas', () => {
    expect(TABS.map((t) => t.label)).toEqual(['Hoje', 'Cuidados', 'Prateleira', 'Progresso']);
    /**
     * ⚠️ A barreira de arquitetura, e a razão dela.
     *
     * O avatar do cabeçalho já é a porta de **Você**. Uma aba com o mesmo destino seria uma segunda
     * porta para a mesma tela — e, pior, uma delas abriria a tela empilhada sobre a aba atual e a
     * outra como aba, produzindo duas versões do mesmo lugar. Enquanto o avatar existir, "Você" não
     * volta para a barra.
     *
     * Community continua COMMITTED e continua fora da barra (§0.4).
     */
    expect(TABS.some((t) => /você|comunidade|community/i.test(t.label))).toBe(false);
  });

  /**
   * FR2 — a ativa se lê em vários canais. O teste cobre o que uma leitora de tela recebe: sem
   * `selected`, "Hoje" e "Cuidados" são indistinguíveis para quem não enxerga a cor nem a pastilha.
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
    await fireEvent.press(s.getByLabelText('Prateleira, aba 3 de 4'));
    expect(onChange).toHaveBeenCalledWith('shelf');
  });
});

/**
 * AC2 — nenhuma capability de rotina mora na gaveta de configurações. A prateleira saiu da Conta na
 * SPEC-026 e virou **aba** na SPEC-027; "meu cabelo mudou" fez o mesmo caminho e parou aqui.
 */
describe('CareTabScreen (SPEC-026 / SPEC-027 / SPEC-034)', () => {
  it('guarda "meu cabelo mudou" e os guias, que antes não tinham lugar', async () => {
    const onOpenHairEvents = jest.fn();
    const s = await render(
      <CareTabScreen profile={{ name: 'Ana', onPress: jest.fn() }} onOpenHairEvents={onOpenHairEvents} />,
    );
    await fireEvent.press(s.getByText('Contar o que mudou'));
    expect(onOpenHairEvents).toHaveBeenCalled();
    // SPEC-031 — os guias, alcançáveis sem nenhum cuidado agendado.
    s.getByText('Hidratação');
  });

  /**
   * ⚠️ **Nenhuma segunda porta para uma aba.** A prateleira é aba desde a SPEC-027 e o **ciclo**
   * virou o conteúdo da aba Progresso na SPEC-034 — a barra inferior já é a porta das duas. Um
   * cartão aqui cujo botão apenas troca de aba é a duplicação que a direção recusa.
   */
  it('não oferece uma segunda porta para a prateleira nem para o ciclo, que agora são abas', async () => {
    const s = await render(
      <CareTabScreen profile={{ name: 'Ana', onPress: jest.fn() }} onOpenHairEvents={jest.fn()} />,
    );
    expect(s.queryByText(/prateleira/i)).toBeNull();
    expect(s.queryByText('Ver meu ciclo')).toBeNull();
    expect(s.queryByText('Meu ciclo')).toBeNull();
  });

  /**
   * ⚠️ **Esta aba deixou de depender de plano.** Antes ela recebia `hasPlan` só para decidir se o
   * cartão do ciclo oferecia o botão; sem o cartão, nada aqui depende de cronograma — os guias e
   * "meu cabelo mudou" valem com plano ou sem.
   */
  it('funciona sem plano ativo, porque nada aqui depende de cronograma', async () => {
    const s = await render(
      <CareTabScreen profile={{ name: 'Ana', onPress: jest.fn() }} onOpenHairEvents={jest.fn()} />,
    );
    expect(s.getByText('Contar o que mudou')).toBeTruthy();
    expect(s.queryByText(/Seu ciclo aparece assim que/)).toBeNull();
  });
});
