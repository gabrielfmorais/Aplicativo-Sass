import type { JourneyView, SharePort } from '@app/core';
import { careDoneMoment, journeyMoment, milestoneMoments } from '@app/core';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { SharePreviewScreen } from '@/features/sharing/SharePreviewScreen';

/**
 * SPEC-044 (F45) — **o preview é o consentimento** (BR2).
 *
 * ⚠️ O que estes testes guardam não é layout: é que **nada dela sai sem ela ter ligado**, que o
 * padrão é privado, e que a tela **não finge** poder compartilhar onde a plataforma não pode.
 */

const journey: JourneyView = {
  points: 135,
  level: { level: 2, name: 'Em ritmo', toNext: 45, nextName: 'Constante' },
  streak: 5,
  caresAttended: 9,
  milestones: [],
  frozen: false,
};

const port = (over: Partial<SharePort> = {}): SharePort => ({
  isAvailable: async () => true,
  share: async () => {},
  ...over,
});

/**
 * O card é `react-native-svg`, e o `getByText` do RNTL não atravessa os nós de texto do SVG — mas
 * a árvore serializada os contém. Inspecionar **a árvore** é, aliás, a barreira mais forte: é
 * exatamente o que vai virar pixel no PNG que sai do aparelho.
 */
const cardText = (s: { toJSON: () => unknown }) => JSON.stringify(s.toJSON());

const screen = (over: Partial<Parameters<typeof SharePreviewScreen>[0]> = {}) =>
  render(
    <SharePreviewScreen
      moments={[journeyMoment(journey)]}
      displayName="Millie"
      avatar="flow_berry"
      share={port()}
      onBack={jest.fn()}
      {...over}
    />,
  );

describe('Compartilhar (SPEC-044)', () => {
  it('diz, na primeira frase, que nada sai sem ela escolher', async () => {
    const s = await screen();
    // "Compartilhar" é o título **e** o botão do rodapé: os dois têm de existir.
    expect(s.getAllByText('Compartilhar').length).toBeGreaterThanOrEqual(2);
    s.getByText(/Nada sai daqui sem você escolher/);
  });

  /**
   * ⚠️ **O padrão é privado** (BR6). O nome existe, o avatar existe, e mesmo assim o card sai sem os
   * dois até ela decidir o contrário.
   */
  it('o card começa sem nome, mesmo havendo nome', async () => {
    const s = await screen();
    // O controle existe (há nome a oferecer)…
    s.getByText('Meu nome');
    // …e o nome NÃO está no card.
    expect(cardText(s)).not.toContain('Millie');
  });

  it('e o nome só aparece depois que ela liga', async () => {
    const s = await screen();
    fireEvent.press(s.getByText('Meu nome'));
    await waitFor(() => expect(cardText(s)).toContain('Millie'));
  });

  /** EC6 — controle de nome para quem nunca deu o nome seria um botão que não faz nada. */
  it('sem nome e sem marca, não oferece controles vazios — explica', async () => {
    const s = await screen({ displayName: null, avatar: null });
    expect(s.queryByText('Meu nome')).toBeNull();
    expect(s.queryByText('Minha marca')).toBeNull();
    s.getByText(/sai sem nome e sem marca/i);
  });

  /**
   * ⚠️ **FR6 — onde não dá para compartilhar, a tela diz isso.** Um botão que não faz nada seria
   * pior que um botão ausente, e "compartilhado!" sem nada ter saído seria a mentira que a
   * disciplina fail-closed existe para evitar.
   */
  it('sem folha de compartilhamento, não mostra um botão morto', async () => {
    const s = await screen({ share: port({ isAvailable: async () => false }) });
    await waitFor(() => s.getByText(/não está disponível aqui/i));
    // E não sobra um botão de compartilhar: só o título e o "Voltar".
    expect(s.getAllByText('Compartilhar')).toHaveLength(1);
  });

  /** Fail closed: uma checagem que falhou não vira "pode compartilhar". */
  it('se a checagem de disponibilidade falha, não promete o share', async () => {
    const s = await screen({
      share: port({
        isAvailable: async () => {
          throw new Error('nope');
        },
      }),
    });
    await waitFor(() => s.getByText(/não está disponível aqui/i));
  });

  /**
   * ⚠️ **BR1 — nada interno na tela.** Se um id chegasse até aqui, é aqui que ele apareceria antes
   * de sair para o feed de outra pessoa.
   */
  it('nenhum identificador interno aparece na tela', async () => {
    const s = await screen();
    const tree = cardText(s);
    expect(tree).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
    expect(tree).not.toMatch(/user_?id|userId|fact_?id|token|session/i);
  });

  /** BR3/D-83 — o ato de compartilhar é Free: a tela não sabe o que é entitlement. */
  it('não fala de assinatura, premium ou upgrade em lugar nenhum', async () => {
    const s = await screen();
    expect(s.queryByText(/premium|assinatura|assinar|upgrade|desbloqueie/i)).toBeNull();
  });
  /**
   * ⚠️ **Leitor de tela não lê texto dentro de SVG**, e o preview **é** o consentimento (BR2): sem
   * rótulo, quem não enxerga consentiria com algo que não consegue perceber.
   */
  it('descreve o card para leitor de tela, respeitando as escolhas dela', async () => {
    const s = await screen();
    s.getByLabelText(/Card da Huna. Sem o seu nome. Sem a sua marca./);
    fireEvent.press(s.getByText('Meu nome'));
    await waitFor(() => s.getByLabelText(/Com o seu nome, Millie./));
  });
});
/**
 * SPEC-045 (F46) — **os momentos**. O `F45` prometeu que o `F46` acrescentaria gatilhos e **não
 * outro caminho**: estes testes guardam essa promessa — a tela é a mesma, muda a lista.
 */
describe('Momentos compartilháveis (SPEC-045)', () => {
  const marco = { key: 'first_care', label: 'Primeiro cuidado', reached: true };

  it('com um momento só, não oferece um seletor que não decide nada', async () => {
    const s = await screen();
    expect(s.queryByText('O que compartilhar')).toBeNull();
  });

  it('com vários, ela escolhe — e o card muda', async () => {
    const j = { ...journey, milestones: [marco] };
    const s = await screen({ moments: [journeyMoment(j), ...milestoneMoments(j)] });
    s.getByText('O que compartilhar');
    expect(cardText(s)).toContain('Em ritmo');

    fireEvent.press(s.getByText('Primeiro cuidado'));
    await waitFor(() => expect(cardText(s)).toContain('Marco alcançado'));
  });

  /** O primeiro momento é o padrão: quem vem da Hoje vê o cuidado que acabou de fazer. */
  it('o momento do lugar de onde ela veio é o que abre', async () => {
    const s = await screen({
      moments: [careDoneMoment({ careLabel: 'Hidratação', journey }), journeyMoment(journey)],
    });
    expect(cardText(s)).toContain('Cuidado feito');
    expect(cardText(s)).toContain('Hidratação');
  });

  /** Sem conquista não há card — e isso não é erro, é a tela sendo honesta (SPEC-044 EC1). */
  it('sem momento nenhum, convida em vez de mostrar um card vazio', async () => {
    const s = await screen({ moments: [] });
    s.getByText(/vira card/i);
    expect(s.queryByText('Formato')).toBeNull();
  });
});
