import type { JourneyView } from '@app/core';
import { render } from '@testing-library/react-native';

import { JourneySummary } from '@/features/journey/JourneySummary';

/**
 * ⚠️ **SPEC-069 — a Jornada em resumo, na Hoje.**
 *
 * O que existia era **uma porta sem informação**: um botão *"Sua jornada"* que gastava uma linha da
 * home para dizer **zero** sobre a jornada dela.
 *
 * ⛔ O que estes testes guardam não é o layout — é a **fronteira da D-103**: a Jornada mede
 * consistência com o **plano**, nunca como o cabelo está, e a home é o lugar mais fácil de essa
 * frase escorregar.
 */

const view = (over: Partial<JourneyView> = {}): JourneyView =>
  ({
    points: 120,
    level: { level: 3, name: 'Constante', toNext: 40, nextName: 'Firme', pointsIntoLevel: 20, levelSpan: 60 },
    streak: 4,
    caresAttended: 12,
    milestones: [],
    frozen: false,
    ...over,
  }) as JourneyView;

const tela = (v: JourneyView = view()) => render(<JourneySummary view={v} onOpen={jest.fn()} />);

describe('SPEC-069 — o resumo diz o que o botão não dizia', () => {
  it('mostra nível, pontos e sequência', async () => {
    const s = await tela();
    s.getByText('Nível 3 · Constante');
    s.getByText('120 pontos');
    s.getByText('4 cuidados em sequência');
    s.getByText('Ver jornada');
  });

  /**
   * ⛔ **"0 cuidados em sequência" não é informação: é uma falta apontada na home.** Apontar falta é
   * o oposto do que a D-103 permite, e a entrada da Jornada nasceu quieta de propósito (SPEC-043).
   */
  it('sem sequência, a linha simplesmente não existe', async () => {
    const s = await tela(view({ streak: 0 }));
    expect(s.queryByText(/sequência/)).toBeNull();
    s.getByText('120 pontos');
  });

  /** O detalhe que estraga um resumo: "1 pontos". */
  it('singular e plural', async () => {
    const s = await tela(view({ points: 1, streak: 1 }));
    s.getByText('1 ponto');
    s.getByText('1 cuidado em sequência');
  });

  /**
   * ⚠️ **A PORTA existe mesmo sem os números — e isto foi um defeito do próprio diff.** A primeira
   * versão só renderizava o cartão com a view carregada: enquanto a jornada carregava a entrada
   * **piscava**, e se a leitura **falhasse** ela perdia o único caminho até a tela da Jornada — que
   * é justamente quem tem o estado de erro com nova tentativa.
   */
  it('sem a jornada carregada, continua sendo porta e não inventa números', async () => {
    const s = await render(<JourneySummary view={null} onOpen={jest.fn()} />);
    s.getByText('Sua jornada');
    s.getByText('Ver jornada');
    expect(s.queryByText(/Nível|pontos|sequência/)).toBeNull();
  });

  /**
   * ⛔ **Nada de cobrança** (D-103): nenhum *"faltam X"*, nenhuma contagem regressiva, nenhum *"não
   * perca"*. O `toNext` existe na view e **não** entra aqui — a progressão é da tela da Jornada.
   */
  it('não cobra o próximo nível nem a sequência', async () => {
    const s = await tela();
    expect(s.queryByText(/faltam|não perca|continue|mantenha|quase|meta/i)).toBeNull();
    expect(s.queryByText(/40/)).toBeNull();
  });

  /**
   * ⛔ **A Jornada mede aderência, nunca o cabelo** (D-103/D-26). Um resumo na home é o lugar mais
   * fácil de essa frase escorregar para "seu cabelo está indo bem".
   */
  it('não afirma nada sobre o cabelo dela', async () => {
    const s = await tela();
    expect(s.queryByText(/cabelo|fio|saud|brilho|frizz|dano|macie|melhor|resultado/i)).toBeNull();
  });
});
