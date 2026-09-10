import type { FinishHistoryRecord, LocalDate } from '@app/core';
import { fireEvent, render } from '@testing-library/react-native';

import { FinishesScreen } from '@/features/care/FinishesScreen';

/**
 * SPEC-056 (fatia shell) + SPEC-070 (a biblioteca) — a área de Finalizações.
 *
 * ⚠️ O que estes testes guardam: as seis nomeadas aparecem **na ordem do vocabulário**, a contagem e
 * a última vez são fiéis, tocar numa abre a dela, e **nenhum texto da tela afirma efeito capilar,
 * "melhor", ranking ou "como fazer"** (D-26/D-70) — a barreira que deixa a área utilizável antes do
 * sign-off.
 */

const rec = (
  technique: FinishHistoryRecord['technique'],
  executedOn = '2026-09-01',
  marks: FinishHistoryRecord['marks'] = null,
): FinishHistoryRecord => ({ technique, executedOn: executedOn as LocalDate, marks });

const NAMED_LABELS = [
  'Fitagem tradicional',
  'Fitagem estruturada',
  'Dedoliss',
  'Rake and shake',
  'Plopping',
  'Twist out',
];

const renderScreen = async (
  records: readonly FinishHistoryRecord[] | null,
  over: Record<string, unknown> = {},
) => {
  const onBack = jest.fn();
  const onOpen = jest.fn();
  const onRetry = jest.fn();
  const view = await render(
    <FinishesScreen
      records={records}
      failed={false}
      reason={null}
      onRetry={onRetry}
      onOpen={onOpen}
      onBack={onBack}
      {...over}
    />,
  );
  return { ...view, onBack, onOpen, onRetry };
};

describe('FinishesScreen (SPEC-056 / SPEC-070)', () => {
  it('sem registro: as seis nomeadas aparecem, e é a descoberta — não um vazio', async () => {
    const s = await renderScreen([]);
    s.getByText('Finalizações');
    for (const label of NAMED_LABELS) expect(s.getByText(label)).toBeTruthy();
  });

  /**
   * ⚠️ **A queixa do dono, virada em barreira.** Seis cartões diziam *"Você ainda não registrou"*,
   * com o mesmo peso, um embaixo do outro. A ausência passou a ser dita pelo **peso** da linha e pela
   * falta da linha de fato — repor a frase em cada item faz este teste falhar.
   */
  it('não repete uma frase de ausência em cada linha (SPEC-070 FR6)', async () => {
    const s = await renderScreen([]);
    expect(s.queryAllByText(/ainda não registrou/i)).toHaveLength(0);
  });

  it('conta o que ela registrou e diz quando foi a última, ignorando other/unknown (BR1/BR9)', async () => {
    const s = await renderScreen([
      rec('plopping', '2026-08-02'),
      rec('plopping', '2026-09-04'),
      rec('twist_out', '2026-07-01'),
      rec('other', '2026-09-09'),
      rec('unknown', '2026-09-09'),
    ]);
    s.getByText('Plopping');
    expect(s.getByText('2')).toBeTruthy();
    // ⚠️ A última vez sai por MÁXIMO, não pela ordem em que os fatos chegaram (BR3).
    expect(s.getByText('última em sex, 04/09')).toBeTruthy();
    // other/unknown não têm linha nenhuma.
    expect(s.queryByText('Outra finalização')).toBeNull();
    expect(s.queryByText('Não sei o nome')).toBeNull();
  });

  /** ⚠️ A ordem é a do vocabulário, **jamais** a contagem nem a recência — as duas seriam a `P7`. */
  it('a ordem não muda por contagem nem por recência (BR1/BR2)', async () => {
    const s = await renderScreen([rec('twist_out', '2026-09-09'), rec('twist_out', '2026-09-08')]);
    const tree = JSON.stringify(s.toJSON());
    for (let i = 1; i < NAMED_LABELS.length; i += 1) {
      expect(tree.indexOf(NAMED_LABELS[i - 1]!)).toBeLessThan(tree.indexOf(NAMED_LABELS[i]!));
    }
  });

  it('tocar numa finalização abre a dela (FR7)', async () => {
    const s = await renderScreen([rec('plopping')]);
    fireEvent.press(s.getByText('Plopping'));
    expect(s.onOpen).toHaveBeenCalledWith('plopping');
  });

  /** Sem registro ela ainda abre: a tela dela diz o nome e o que falta para haver observação. */
  it('a que ela nunca usou também abre', async () => {
    const s = await renderScreen([]);
    fireEvent.press(s.getByText('Dedoliss'));
    expect(s.onOpen).toHaveBeenCalledWith('dedoliss');
  });

  /**
   * ⚠️ **A barreira D-26/D-70.** Nenhum texto da tela pode afirmar efeito, "melhor", ranking ou
   * "como fazer" — é isso que separa esta área do resto do F38, que espera sign-off.
   */
  it('não afirma efeito, "melhor", ranking nem "como fazer"', async () => {
    const s = await renderScreen([rec('plopping')]);
    const proibido =
      /melhor|ideal|recomend|indicad|passo a passo|para o seu cabelo|efeito|ranking|mais usada|top |favorita/i;
    for (const node of s.queryAllByText(proibido)) {
      throw new Error(`texto proibido na tela: "${String(node.props.children)}"`);
    }
    expect(s.getByText('Plopping')).toBeTruthy();
  });

  it('erro na leitura: cartão de erro com tentar de novo (EC3), nunca uma lista fingindo zero', async () => {
    const s = await renderScreen(null, { failed: true });
    s.getByText('Não foi possível abrir suas finalizações agora.');
    // ⚠️ Nenhuma das seis aparece: uma lista em zero seria uma resposta que ninguém deu.
    expect(s.queryByText('Plopping')).toBeNull();
    fireEvent.press(s.getByText('Tentar novamente'));
    expect(s.onRetry).toHaveBeenCalled();
  });
});
