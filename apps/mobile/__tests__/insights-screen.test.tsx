import type { InsightsView } from '@app/core';
import { fireEvent, render } from '@testing-library/react-native';

import { InsightsScreen } from '@/features/insights/InsightsScreen';

/**
 * SPEC-047 (P2) — **Seus padrões**.
 *
 * ⚠️ O que estes testes guardam: **observação nunca vira causa**, **nada é inventado para preencher
 * a tela**, e o gate premium é **adição, nunca muro** (D-83).
 */

const view = (over: Partial<InsightsView> = {}): InsightsView => ({
  enoughData: true,
  ratedCares: 8,
  ratedCaresMissing: 0,
  ratedCaresWithRecord: 6,
  observations: [
    {
      key: 'product:p1',
      kind: 'product',
      subject: 'Máscara da Ana',
      detail: 'esteve em 4 dos 6 cuidados que você avaliou bem',
    },
  ],
  ...over,
});

const screen = (over: Partial<Parameters<typeof InsightsScreen>[0]> = {}) =>
  render(<InsightsScreen view={view()} loading={false} entitled onBack={jest.fn()} {...over} />);

describe('Seus padrões (SPEC-047)', () => {
  it('diz, antes de qualquer número, que é repetição e não causa', async () => {
    const s = await screen();
    s.getByText(/A Huna mostra o que apareceu junto — não o que causou o quê/);
  });

  it('mostra a repetição com o número dos registros dela', async () => {
    const s = await screen();
    s.getByText('Máscara da Ana');
    s.getByText('esteve em 4 dos 6 cuidados que você avaliou bem');
  });

  /** Rastreabilidade: ela consegue ver de onde saiu cada número (Blueprint §12). */
  it('diz em quantos registros dela a leitura se apoia', async () => {
    const s = await screen();
    s.getByText('Com base em 8 cuidados que você avaliou');
  });

  /**
   * ⚠️ **O estado de poucos dados é conteúdo, não placeholder** — e é a maior parte da vida útil da
   * capability para quem começou agora.
   */
  it('com poucos dados, diz que ainda está conhecendo a rotina dela', async () => {
    const s = await screen({
      view: view({ enoughData: false, ratedCares: 2, ratedCaresMissing: 3, observations: [] }),
    });
    s.getByText('A Huna ainda está conhecendo sua rotina');
    s.getByText(/Você já avaliou 2 cuidados/);
  });

  it('e sem nenhum registro avaliado, explica o que falta em vez de girar', async () => {
    const s = await screen({
      view: view({ enoughData: false, ratedCares: 0, ratedCaresMissing: 5, observations: [] }),
    });
    s.getByText('A Huna ainda está conhecendo sua rotina');
    s.getByText(/Ainda não há nenhum/);
  });

  /** ⚠️ Nada é inventado para preencher: sem observação, não aparece cartão de observação nenhum. */
  it('não inventa observação quando não há nenhuma', async () => {
    const s = await screen({ view: view({ observations: [] }) });
    expect(s.queryByText(/esteve em/)).toBeNull();
  });

  /**
   * ⚠️ **Premium é adição, não muro** (D-83): a tela existe para quem não tem, explica o que o
   * premium acrescenta, e **não** diz que o Free é uma versão quebrada esperando desbloqueio.
   */
  it('sem a capability, explica o que o premium acrescenta — e não bloqueia com cadeado', async () => {
    const s = await screen({ entitled: false });
    s.getByText('Faz parte do premium');
    expect(s.queryByText(/bloquead|desbloqu|cadeado|não disponível/i)).toBeNull();
  });

  it('e sem a capability não mostra número nenhum dos registros dela', async () => {
    const s = await screen({ entitled: false });
    expect(s.queryByText(/esteve em/)).toBeNull();
    expect(s.queryByText(/Com base em/)).toBeNull();
  });

  it('quando a leitura falha, diz o que houve e oferece tentar de novo', async () => {
    const onRetry = jest.fn();
    const s = await screen({ view: null, loading: false, failed: true, onRetry });
    s.getByText(/Não foi possível ler seus registros/);
    fireEvent.press(s.getByText('Tentar novamente'));
    expect(onRetry).toHaveBeenCalled();
  });

  /** ⚠️ A barreira de linguagem, na tela e não só no core. */
  it('nenhum verbo de efeito e nenhuma afirmação sobre o cabelo dela', async () => {
    const s = await screen();
    expect(s.queryByText(/melhorou|piorou|funciona|recuper|ajud|por causa|graças/i)).toBeNull();
    expect(s.queryByText(/seu cabelo (está|ficou)|danificad|saudável/i)).toBeNull();
  });

  it('nenhuma nota, porcentagem ou comparação com outras pessoas', async () => {
    const s = await screen();
    expect(s.queryByText(/\d+\s?%/)).toBeNull();
    expect(s.queryByText(/nota|score|ranking|média|outras usuárias|a maioria/i)).toBeNull();
  });

  /**
   * SPEC-047 fatia 2 — técnica e produto convivem, e o **verbo muda**: um produto *esteve em*, uma
   * técnica *você fez em*. Nenhum dos dois afirma efeito.
   */
  it('mostra técnica ao lado de produto, cada uma com o seu verbo', async () => {
    const s = await screen({
      view: view({
        observations: [
          {
            key: 'product:p1',
            kind: 'product',
            subject: 'Máscara da Ana',
            detail: 'esteve em 4 dos 6 cuidados que você avaliou bem',
          },
          {
            key: 'technique:air_dried',
            kind: 'technique',
            subject: 'Secou naturalmente',
            detail: 'você fez em 5 dos 6 cuidados que você avaliou bem',
          },
        ],
      }),
    });
    s.getByText('Máscara da Ana');
    s.getByText('Secou naturalmente');
    s.getByText('você fez em 5 dos 6 cuidados que você avaliou bem');
    expect(s.queryByText(/melhorou|funciona|ajud|por causa/i)).toBeNull();
  });

  /**
   * SPEC-048 (`F38`) — a finalização entra como **terceiro verbo**, e a tela não a distingue das
   * outras: é mais uma repetição nos registros dela.
   *
   * ⚠️ **Nada aqui indica.** *"Você finalizou assim em 3 dos 6"* é contagem; *"a melhor finalização
   * para o seu cabelo"* é o conteúdo do `F38`, atrás de D-26/D-70 — e é a frase que esta barreira
   * impede de aparecer por distração.
   */
  it('mostra a finalização registrada, sem indicar nenhuma', async () => {
    const s = await screen({
      view: view({
        observations: [
          {
            key: 'finish:plopping',
            kind: 'finish',
            subject: 'Plopping',
            detail: 'você finalizou assim em 3 dos 6 cuidados que você avaliou bem',
          },
        ],
      }),
    });
    s.getByText('Plopping');
    s.getByText('você finalizou assim em 3 dos 6 cuidados que você avaliou bem');
    expect(
      s.queryByText(/melhor|recomend|indicad|ideal|passo a passo|para o seu cabelo|defini(ç|c)|frizz/i),
    ).toBeNull();
  });
});

/**
 * SPEC-047 fatia 3 — **três silêncios diferentes, e dizer o errado é pior que não dizer nada.**
 *
 * ⚠️ A versão anterior tinha uma frase só: com doze avaliados e nada marcado, ela mandava alcançar
 * um volume que ela **já tinha**. Cada teste aqui prende um motivo real.
 */
describe('Seus padrões — por que ainda não há padrão (SPEC-047 fatia 3)', () => {
  const vazio = (over: Partial<InsightsView>) => screen({ view: view({ observations: [], ...over }) });

  it('nenhum cuidado avaliado: diz que faltam avaliações', async () => {
    const s = await vazio({
      enoughData: false,
      ratedCares: 0,
      ratedCaresMissing: 5,
      ratedCaresWithRecord: 0,
    });
    s.getByText(/Ainda não há nenhum/);
  });

  it('abaixo do mínimo: diz quantos faltam, e não repete o limiar', async () => {
    const s = await vazio({
      enoughData: false,
      ratedCares: 3,
      ratedCaresMissing: 2,
      ratedCaresWithRecord: 1,
    });
    s.getByText(/Faltam 2 para a Huna começar a comparar/);
  });

  /** ⚠️ O caso que estava errado: volume alcançado, registro ausente. */
  it('avaliou bastante mas não marcou nada: aponta o REGISTRO, não o volume', async () => {
    const s = await vazio({
      enoughData: true,
      ratedCares: 12,
      ratedCaresMissing: 0,
      ratedCaresWithRecord: 0,
    });
    s.getByText(/ainda não registrou nada em nenhum deles/);
    // SPEC-048 — a frase nomeia as três dimensões, porque a finalização também é registro.
    s.getByText(/produto, técnica ou finalização/);
    // E não manda alcançar um número que ela já passou.
    expect(s.queryByText(/A partir de 5|Faltam/)).toBeNull();
  });

  it('marcou, mas nada se repetiu: diz exatamente isso', async () => {
    const s = await vazio({ enoughData: true, ratedCares: 9, ratedCaresMissing: 0, ratedCaresWithRecord: 7 });
    s.getByText(/já está comparando os 7 cuidados/);
    s.getByText(/ainda não encontrou nada que se repita/);
  });
});
