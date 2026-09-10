import type { FinishHistoryRecord, LocalDate } from '@app/core';
import { fireEvent, render } from '@testing-library/react-native';

import { FinishDetailScreen } from '@/features/care/FinishDetailScreen';

/**
 * SPEC-070 (F38, a biblioteca) — a tela de uma finalização.
 *
 * ⚠️ O que estes testes guardam é a **fronteira de domínio**: a tela mostra contagem, datas e o que
 * ela **notou**, e não afirma efeito, indicação, "melhor", ranking nem ensina a fazer (D-26/D-70).
 */

const rec = (
  executedOn: string,
  marks: FinishHistoryRecord['marks'] = null,
  technique: FinishHistoryRecord['technique'] = 'plopping',
): FinishHistoryRecord => ({ technique, executedOn: executedOn as LocalDate, marks });

const renderScreen = async (records: readonly FinishHistoryRecord[]) => {
  const onBack = jest.fn();
  const view = await render(<FinishDetailScreen technique="plopping" records={records} onBack={onBack} />);
  return { ...view, onBack };
};

describe('FinishDetailScreen (SPEC-070)', () => {
  it('nunca registrada: diz isso sem cobrar, e não inventa um número em destaque', async () => {
    const s = await renderScreen([]);
    s.getByText('Plopping');
    s.getByText('Você ainda não registrou esta finalização');
    // ⚠️ Um "0" grande leria como cobrança, e nunca ter usado não é uma falta dela.
    expect(s.queryByText('0')).toBeNull();
  });

  it('com história: a contagem e a última vez, saindo por máximo (BR3)', async () => {
    const s = await renderScreen([rec('2026-03-04'), rec('2026-09-07'), rec('2026-06-15')]);
    s.getByText('3');
    s.getByText('Última vez em seg, 07/09');
    // As ocorrências, da mais nova para a mais velha.
    s.getByText('Suas últimas vezes');
    s.getByText('qua, 04/03');
  });

  /**
   * ⚠️ **Observação, nunca causa** (BR5) — a frase inteira vem do core, e nomeia o denominador.
   */
  it('mostra o que ela notou, com o denominador nomeado', async () => {
    const s = await renderScreen([
      rec('2026-09-01', ['definition']),
      rec('2026-09-02', ['definition']),
      rec('2026-09-03', ['definition']),
      rec('2026-09-04', []),
    ]);
    s.getByText('Definição');
    s.getByText('você notou em 3 dos 4 cuidados com Plopping que você avaliou');
  });

  /** ⚠️ *"Você notou em 1 de 1"* não é observação — abaixo da amostra a tela diz o que falta (BR7). */
  it('abaixo da amostra mínima não observa nada, e diz quanto falta', async () => {
    const s = await renderScreen([rec('2026-09-01', ['frizz']), rec('2026-09-02', ['frizz'])]);
    expect(s.queryByText(/você notou em/)).toBeNull();
    s.getByText(/Avalie mais 1 cuidado com Plopping/);
  });

  /** ⚠️ *"…em 0 dos 4"* não é observação, é acusação (BR8). */
  it('a marca que ela nunca notou simplesmente não aparece', async () => {
    const s = await renderScreen([
      rec('2026-09-01', ['shine']),
      rec('2026-09-02', []),
      rec('2026-09-03', []),
    ]);
    s.getByText('Brilho');
    expect(s.queryByText('Frizz')).toBeNull();
    expect(s.queryByText(/em 0 /)).toBeNull();
  });

  /**
   * ⚠️ **A superfície de "Como fazer" é honesta e vazia.** Não existe conteúdo aprovado de
   * finalização (SPEC-039 §8), e inventar um passo a passo para preencher é o que a D-26 proíbe.
   */
  it('diz que o passo a passo está em revisão, sem prometer data e sem ensinar nada', async () => {
    const s = await renderScreen([rec('2026-09-01')]);
    s.getByText(/em revisão profissional/);
    expect(s.queryByText(/em breve/i)).toBeNull();
  });

  it('nenhum texto afirma efeito, indicação, "melhor" ou ranking (D-26/D-70)', async () => {
    const s = await renderScreen([
      rec('2026-09-01', ['definition']),
      rec('2026-09-02', ['definition']),
      rec('2026-09-03', ['softness']),
    ]);
    const proibido =
      /melhor|ideal|recomend|indicad|para o seu cabelo|melhora|deixa seu|resulta|eficaz|ranking|mais usada|favorita|%/i;
    for (const node of s.queryAllByText(proibido)) {
      throw new Error(`texto proibido na tela: "${String(node.props.children)}"`);
    }
  });

  /** A nota de cada cuidado não vira coluna: uma fileira de 1 a 5 ao lado da técnica vira placar. */
  it('o histórico mostra datas, nunca notas', async () => {
    const s = await renderScreen([rec('2026-09-01', ['shine']), rec('2026-09-02', [])]);
    s.getByText('qua, 02/09');
    expect(s.queryByText('1 = nada bom · 5 = muito bom')).toBeNull();
  });

  it('voltar chama quem abriu', async () => {
    const s = await renderScreen([]);
    fireEvent.press(s.getByText('Voltar'));
    expect(s.onBack).toHaveBeenCalled();
  });
});
