import type { HairProfilePort, HairProfileSnapshot, LocalDate } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { PlanRationale } from '@/features/care/PlanRationale';

/** O snapshot que gerou o plano ativo — o de **origem**, não o de hoje. */
const origem: HairProfileSnapshot = {
  hairProfileId: 'hp-origem',
  createdAt: '2026-08-01T10:00:00Z',
  hairPattern: 'curly',
  strandThickness: 'medium',
  scalpTendency: 'balanced',
  washFrequency: 'twice_weekly',
  chemicalTreatments: [],
  heatUsage: 'almost_never',
  currentConcerns: ['dryness'],
  primaryGoal: 'softness_and_hydration',
  perceivedPorosity: 'absorbs_normally',
  routineAvailability: 'moderate',
};

/** O perfil corrente depois de uma reavaliação abandonada: outro objetivo, outra evidência. */
const corrente: HairProfileSnapshot = {
  ...origem,
  hairProfileId: 'hp-corrente',
  createdAt: '2026-09-01T10:00:00Z',
  currentConcerns: ['breakage'],
  primaryGoal: 'reduce_breakage_and_strengthen',
};

const port = (getById: jest.Mock): HairProfilePort =>
  ({ getById, getCurrent: jest.fn(), save: jest.fn() }) as unknown as HairProfilePort;

const renderRationale = (getById: jest.Mock, version = 'v1') =>
  render(
    <PlanRationale
      hairProfile={port(getById)}
      hairProfileId="hp-origem"
      startsOn={'2026-09-01' as LocalDate}
      assessmentAlgorithmVersion={version}
      scheduleAlgorithmVersion="v1"
    />,
  );

/**
 * SPEC-017 (F21). A explicação tem de descrever **o plano que ela tem** — e, quando não puder
 * descrevê-lo com honestidade, sumir.
 */
describe('PlanRationale (SPEC-017)', () => {
  it('abre fechada e revela a evidência do plano quando tocada', async () => {
    const getById = jest.fn(async () => origem);
    const s = await renderRationale(getById);

    await waitFor(() => s.getByText('Por que este cronograma?'));
    // FR1 — divulgação progressiva: nada de conteúdo antes do toque.
    expect(s.queryByText(/Você quer mais maciez/)).toBeNull();

    await fireEvent.press(s.getByText('Por que este cronograma?'));
    s.getByText('• Você quer mais maciez e hidratação.');
    // D-26/BR2 — o aviso vem colado à leitura que ele qualifica.
    s.getByText(/não é diagnóstico médico/);
  });

  /**
   * A armadilha de §2.1, e a razão de a OQ1 existir: reavaliar e desistir no meio deixa um perfil
   * novo salvo e o plano antigo ativo. Explicar pelo perfil corrente descreveria, com toda a
   * confiança, um cronograma que ela não tem.
   */
  it('explica pelo snapshot de origem, não pelo perfil de hoje', async () => {
    const getById = jest.fn(async (id: string) => (id === 'hp-origem' ? origem : corrente));
    const s = await renderRationale(getById);

    await waitFor(() => s.getByText('Por que este cronograma?'));
    await fireEvent.press(s.getByText('Por que este cronograma?'));

    expect(getById).toHaveBeenCalledWith('hp-origem');
    s.getByText('• Você quer mais maciez e hidratação.');
    // A evidência do perfil abandonado não pode vazar para cá.
    expect(s.queryByText(/reduzir a quebra/i)).toBeNull();
  });

  /** FR4 — ausência é melhor que uma explicação possivelmente errada. */
  it('some quando o snapshot de origem não existe mais', async () => {
    const s = await renderRationale(jest.fn(async () => null));
    await waitFor(() => expect(s.queryByText('Por que este cronograma?')).toBeNull());
  });

  it('some quando a leitura falha, sem oferecer "tentar novamente"', async () => {
    const s = await renderRationale(jest.fn(async () => Promise.reject(new Error('rede'))));
    await waitFor(() => expect(s.queryByText('Por que este cronograma?')).toBeNull());
    expect(s.queryByText(/Tentar novamente/)).toBeNull();
  });

  /**
   * Reproduzir com a engine de hoje um plano gerado por outra daria uma explicação coerente e
   * falsa. Hoje só existe a v1, então isto nunca dispara — e é por isso que o teste existe.
   */
  it('some quando o plano foi gerado por outra versão da engine, e nem lê o perfil', async () => {
    const getById = jest.fn(async () => origem);
    const s = await renderRationale(getById, 'v2');
    await waitFor(() => expect(s.queryByText('Por que este cronograma?')).toBeNull());
    expect(getById).not.toHaveBeenCalled();
  });

  /**
   * O defeito que a validação visual a 390px pegou: a Hoje mostrava **uma** linha onde o preview
   * mostrava duas, porque eu derivava de `assess` e não de `buildPlan`. O mesmo plano com duas
   * explicações diferentes em duas telas é pior do que nenhuma explicação.
   */
  it('mostra a mesma evidência que o preview — avaliação **e** cronograma', async () => {
    const s = await renderRationale(jest.fn(async () => origem));
    await waitFor(() => s.getByText('Por que este cronograma?'));
    await fireEvent.press(s.getByText('Por que este cronograma?'));

    s.getByText('• Você quer mais maciez e hidratação.');
    // A evidência do cronograma, que `assess` sozinho não produz.
    s.getByText('• A frequência dos cuidados acompanha a sua rotina de lavagem.');
  });

  /**
   * BR1 — a evidência é **do plano**. Uma frase que ligue a explicação a um cuidado específico
   * inventaria causalidade por cuidado, que é o que o produto se proíbe.
   */
  it('fala do cronograma, nunca de um cuidado individual', async () => {
    const s = await renderRationale(jest.fn(async () => origem));
    await waitFor(() => s.getByText('Por que este cronograma?'));
    await fireEvent.press(s.getByText('Por que este cronograma?'));

    const forbidden = [/\beste cuidado\b/i, /\bpor isso você vai\b/i, /\bhidratação está aqui\b/i];
    for (const pattern of forbidden) expect(s.queryByText(pattern)).toBeNull();
    for (const sample of ['este cuidado', 'Hidratação está aqui porque']) {
      expect(forbidden.some((p) => p.test(sample))).toBe(true);
    }
  });
});
