import type { OilRoutineView } from '@app/core';
import { render } from '@testing-library/react-native';

import { CareTabScreen } from '@/features/care/CareTabScreen';

/**
 * ⚠️ **SPEC-067 — a ordem desta aba é decisão, e antes era a ordem de chegada.**
 *
 * Medido a 390×844 no DEV real: os guias — o conteúdo que dá **nome** à aba — começavam a 1393px de
 * uma página de 1640, ou seja **1,65 tela** abaixo do topo, enquanto a configuração da rotina de
 * óleo ocupava 792px logo depois do cabeçalho. Cada SPEC acrescentou o seu bloco no fim do arquivo,
 * e a SPEC-031 escreveu que os guias *"ganham endereço"* — ganharam o mais distante.
 *
 * ⛔ **É por isso que a ordem é teste, e não só comentário:** um bloco novo tem de **escolher** onde
 * entra. Cair no fim volta a ser uma decisão tomada por acidente.
 */

const oilView: OilRoutineView = {
  state: 'none',
  everyDays: null,
  dueOn: null,
  daysLate: 0,
  lastDoneOn: null,
  doneCount: 0,
  times: [],
};

const oil = {
  view: oilView,
  busy: false,
  onChoose: jest.fn(),
  onTurnOff: jest.fn(),
  times: { onAdd: jest.fn(), onUpdate: jest.fn(), onToggleReminder: jest.fn(), onRemove: jest.fn() },
};

const profile = { name: 'Millie', onPress: jest.fn() };

/** Os títulos, na ordem em que a tela os desenha. */
const titulos = (tree: unknown): string[] => {
  const ALVO = ['Como fazer cada cuidado', 'Finalizações', 'Rotina de óleo', 'Meu cabelo mudou'];
  const encontrados: string[] = [];
  const walk = (n: unknown): void => {
    if (typeof n === 'string') {
      if (ALVO.includes(n.trim()) && !encontrados.includes(n.trim())) encontrados.push(n.trim());
      return;
    }
    if (!n || typeof n !== 'object') return;
    const kids = (n as { children?: unknown }).children;
    if (Array.isArray(kids)) kids.forEach(walk);
  };
  walk(tree);
  return encontrados;
};

describe('SPEC-067 — Cuidados abre pelo cuidado', () => {
  /**
   * **A régua:** conteúdo que ela **consulta** antes de configuração que ela **ajusta uma vez**
   * (BR1); rotina mantida com frequência antes de evento raro (BR2).
   *
   * ⛔ *"Meu cabelo mudou"* por último **não** é juízo sobre a importância dele — é frequência.
   */
  it('desenha conteúdo, depois configuração, depois o evento raro', async () => {
    const s = await render(
      <CareTabScreen profile={profile} onOpenFinishes={jest.fn()} onOpenHairEvents={jest.fn()} oil={oil} />,
    );
    expect(titulos(s.toJSON())).toEqual([
      'Como fazer cada cuidado',
      'Finalizações',
      'Rotina de óleo',
      'Meu cabelo mudou',
    ]);
  });

  /**
   * BR3 — os dois blocos condicionais podem não existir, e **nada se desloca por cima do conteúdo**.
   * Sem isto, alguém "consertaria" a ordem pondo o óleo de volta no topo para preencher o espaço.
   */
  it('sem óleo e sem eventos, o conteúdo continua abrindo a aba', async () => {
    const s = await render(<CareTabScreen profile={profile} onOpenFinishes={jest.fn()} />);
    expect(titulos(s.toJSON())).toEqual(['Como fazer cada cuidado', 'Finalizações']);
  });

  /** AC2 — nada perdeu destino: as duas portas continuam lá, com o mesmo rótulo. */
  it('as portas continuam existindo', async () => {
    const s = await render(
      <CareTabScreen profile={profile} onOpenFinishes={jest.fn()} onOpenHairEvents={jest.fn()} oil={oil} />,
    );
    s.getByText('Ver finalizações');
    s.getByText('Contar o que mudou');
  });
});
