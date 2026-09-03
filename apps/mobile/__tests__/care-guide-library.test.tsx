import { CARE_GUIDES, CARE_TYPE_CODES } from '@app/core';
import { fireEvent, render } from '@testing-library/react-native';

import { CareGuideLibrary } from '@/features/care/CareGuideLibrary';

/**
 * SPEC-031 — os guias fora de um cuidado agendado.
 *
 * ⚠️ **O que estes testes protegem é um achado, não um layout.** Os guias da SPEC-007 existiam desde
 * sempre e só eram alcançáveis por "Como fazer" **dentro do cartão de um cuidado**. Numa terça sem
 * cuidado nenhum, o conhecimento que o app já tem era inalcançável — a mesma classe de problema que
 * criou a SPEC-026, com o agravante de não haver sequer uma tela errada onde ele morasse.
 */
describe('CareGuideLibrary (SPEC-031)', () => {
  it('lista os três tipos de cuidado, sem depender de plano ou de agenda', async () => {
    const s = await render(<CareGuideLibrary />);
    s.getByText('Hidratação');
    s.getByText('Nutrição');
    s.getByText('Reconstrução');
  });

  /**
   * ⚠️ **Fechados por padrão, e isso é o oposto da decisão da Hoje — de propósito.** Colapsar os
   * cartões da Hoje foi reprovado porque escondia **ação**. Aqui não há ação: é leitura, e três
   * guias abertos de uma vez seriam três telas de texto que ninguém pediu.
   */
  it('abre e fecha um guia, e começa fechado', async () => {
    const s = await render(<CareGuideLibrary />);
    const firstStep = CARE_GUIDES.hydration.steps[0] as string;
    expect(s.queryByText(`1. ${firstStep}`)).toBeNull();

    await fireEvent.press(s.getByLabelText(/^Hidratação, \d+ minutos$/));
    s.getByText(`1. ${firstStep}`);

    await fireEvent.press(s.getByLabelText(/^Hidratação, \d+ minutos$/));
    expect(s.queryByText(`1. ${firstStep}`)).toBeNull();
  });

  /**
   * ⚠️ **A duração aparece uma vez, e essa barreira nasceu de um defeito visto a 390px.** A linha
   * mostra "~20 min" para dar o custo antes de abrir; o painel mostrava de novo logo abaixo, e o
   * resultado era o mesmo dado duas vezes, um sobre o outro.
   */
  it('não repete a duração quando o guia abre', async () => {
    const s = await render(<CareGuideLibrary />);
    const minutes = CARE_GUIDES.hydration.durationMin;
    /**
     * ⚠️ **Conta antes e depois, e não uma contagem absoluta.** A primeira versão deste teste
     * exigia exatamente uma ocorrência de "~20 min" e falhou — não por defeito, mas porque **os
     * três guias duram o mesmo**, e cada linha mostra a sua. O que importa não é quantas existem:
     * é que **abrir não cria mais nenhuma**.
     */
    const before = s.getAllByText(`~${minutes} min`).length;
    await fireEvent.press(s.getByLabelText(/^Hidratação, \d+ minutos$/));
    expect(s.getAllByText(`~${minutes} min`).length).toBe(before);
  });
  /**
   * ⚠️ **A biblioteca segue o core, não uma lista escrita à mão.** `ORDER` era o literal
   * `['hydration', 'nutrition', 'reconstruction']`: um quarto tipo de cuidado (a Restauração do
   * `F36`, D-102) entraria no engine, no banco e em `CARE_GUIDES` e **não apareceria aqui** — sem
   * erro de compilação e sem teste vermelho, apenas um guia inalcançável. Esta é a asserção que
   * falharia.
   */
  it('lista um guia por tipo de cuidado que o core define', async () => {
    const s = await render(<CareGuideLibrary />);
    const rows = s.getAllByLabelText(/^.+, \d+ minutos$/);
    expect(rows).toHaveLength(CARE_TYPE_CODES.length);
  });
});
