import type { JourneyView } from '@app/core';
import { fireEvent, render } from '@testing-library/react-native';

import { JourneyScreen } from '@/features/journey/JourneyScreen';

/**
 * SPEC-043 (F40/F41/F42) — **Sua jornada**.
 *
 * ⚠️ **A tensão que estes testes guardam:** o produto recusou pontuar em três SPECs (009/019/021), e
 * as barreiras da aba Progresso continuam de pé. A Jornada não contradiz aquilo porque mede outro
 * objeto — **aderência ao plano**, não o cabelo. O preço é não se disfarçar: nada aqui pode soar
 * como leitura capilar, e nada aqui pode cobrar.
 */

const view = (over: Partial<JourneyView> = {}): JourneyView => ({
  points: 20,
  level: { level: 1, name: 'Começando', toNext: 40, nextName: 'Em ritmo' },
  streak: 2,
  caresAttended: 2,
  milestones: [
    { key: 'first_care', label: 'Primeiro cuidado', reached: true },
    { key: 'cares_5', label: '5 cuidados do seu plano', reached: false },
  ],
  frozen: false,
  ...over,
});

describe('Sua jornada (SPEC-043)', () => {
  it('diz o que é, e o que não é, na primeira frase', async () => {
    const s = await render(<JourneyScreen view={view()} loading={false} onBack={jest.fn()} />);
    s.getByText('Sua jornada');
    s.getByText(/Não é uma nota, e não é sobre o cabelo/);
  });

  it('mostra nível, pontos e o que falta — sem transformar em porcentagem', async () => {
    const s = await render(<JourneyScreen view={view()} loading={false} onBack={jest.fn()} />);
    s.getByText('Começando');
    s.getByText(/20 pontos · faltam 40 para Em ritmo/);
    expect(s.queryByText(/\d+%/)).toBeNull();
  });

  /**
   * ⚠️ **A proibição central da D-103.** A sequência conta **cuidados do plano**, não dias — dizer
   * "dias seguidos" prometeria um streak diário, que num plano de 4 a 12 cuidados por mês só se
   * cumpre lavando mais.
   */
  it('a sequência é de CUIDADOS DO PLANO, nunca de dias', async () => {
    const s = await render(<JourneyScreen view={view()} loading={false} onBack={jest.fn()} />);
    s.getByText('cuidados do seu plano em sequência');
    expect(s.queryByText(/dias seguidos|dias consecutivos|todo dia/i)).toBeNull();
    s.getByText(/Dia sem cuidado planejado não interrompe nada/);
  });

  it('pausada, a sequência aparece guardada — e não como perda', async () => {
    const s = await render(
      <JourneyScreen view={view({ frozen: true })} loading={false} onBack={jest.fn()} />,
    );
    s.getByText(/sua sequência está guardada/);
    expect(s.queryByText(/perdeu|perder|quebrou|zerou/i)).toBeNull();
  });

  /** ⚠️ Nada aqui afirma nada sobre o cabelo dela — seria avaliação capilar por outro nome. */
  it('não fala do cabelo dela em lugar nenhum', async () => {
    const s = await render(<JourneyScreen view={view()} loading={false} onBack={jest.fn()} />);
    expect(s.queryByText(/hidrat|nutri|reconstru|saud|bonit|brilho|frizz|dano|seu cabelo está/i)).toBeNull();
  });

  /** ⚠️ E não cobra: marco não alcançado é marco que ainda não chegou, não uma falha. */
  it('não cobra nem ameaça a sequência', async () => {
    const s = await render(<JourneyScreen view={view()} loading={false} onBack={jest.fn()} />);
    expect(s.queryByText(/não perca|falta pouco para perder|você está atrasada|meta/i)).toBeNull();
  });

  it('enquanto carrega, não inventa número nenhum', async () => {
    const s = await render(<JourneyScreen view={null} loading onBack={jest.fn()} />);
    expect(s.queryByText('Sua jornada')).toBeNull();
  });
  /**
   * ⚠️ **"Não carregou" não pode se passar por "carregando".** Antes, uma leitura que falhava
   * deixava a tela girando *"Abrindo sua jornada…"* para sempre: sem erro, sem saída e sem nova
   * tentativa — e é justamente a tela em que ficar sem resposta dói mais.
   */
  it('quando a leitura falha, diz o que houve e oferece tentar de novo', async () => {
    const onRetry = jest.fn();
    const s = await render(
      <JourneyScreen view={null} loading={false} failed onRetry={onRetry} onBack={jest.fn()} />,
    );
    s.getByText(/não foi possível abrir sua jornada/i);
    expect(s.queryByText('Abrindo sua jornada…')).toBeNull();
    fireEvent.press(s.getByText('Tentar novamente'));
    expect(onRetry).toHaveBeenCalled();
  });

  /** Sem plano ativo não é falha (EC1) — e continua sem inventar número nenhum. */
  it('sem plano, convida em vez de acusar erro', async () => {
    const s = await render(<JourneyScreen view={null} loading={false} onBack={jest.fn()} />);
    s.getByText(/sua jornada começa com o seu plano/i);
    expect(s.queryByText('Tentar novamente')).toBeNull();
  });
});
