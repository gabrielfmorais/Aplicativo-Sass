import type { InsightsView, Observation } from '@app/core';
import { render } from '@testing-library/react-native';

import { InsightsScreen } from '@/features/insights/InsightsScreen';

/**
 * ⚠️ **SPEC-064 — o core entrega QUATRO dimensões e a tela renderizava as quatro igual.**
 *
 * A SPEC-047 passou três fatias dando a cada uma o **verbo certo** — *"esteve em"*, *"você fez em"*,
 * *"você finalizou assim em"*, *"você notou em"* —, e a tela lia o `kind` **uma vez**, só para
 * separar as marcações. O resultado era uma lista de cartões brancos iguais em que não dava para
 * saber se aquilo era um produto, um jeito de fazer ou uma finalização.
 *
 * ⛔ **E a restrição que decidiu o desenho:** o core diz que *"a frase inteira vem pronta, e é de
 * propósito: espalhar a redação por dentro da tela é como uma afirmação causal entraria sem ninguém
 * notar"*. Então a hierarquia vem de **fora** da frase — nunca de dentro dela.
 */

const obs = (kind: Observation['kind'], subject: string, detail: string): Observation => ({
  key: `${kind}:${subject}`,
  kind,
  subject,
  count: 4,
  detail,
});

const view = (over: Partial<InsightsView> = {}): InsightsView =>
  ({
    enoughData: true,
    ratedCares: 7,
    ratedCaresMissing: 0,
    ratedCaresWithRecord: 6,
    observations: [],
    patterns: [],
    ...over,
  }) as InsightsView;

const tela = (v: InsightsView) =>
  render(<InsightsScreen view={v} entitled loading={false} onBack={jest.fn()} />);

describe('SPEC-064 FR1 — cada achado diz de que dimensão fala', () => {
  it.each([
    ['product', 'Produto', 'Máscara da feira', 'esteve em 4 dos 6 cuidados que você avaliou bem'],
    ['technique', 'Técnica', 'Secou naturalmente', 'você fez em 3 dos 6 cuidados que você avaliou bem'],
    ['finish', 'Finalização', 'Plopping', 'você finalizou assim em 3 dos 6 cuidados que você avaliou bem'],
  ] as const)('%s aparece rotulado como "%s"', async (kind, rotulo, subject, detail) => {
    const s = await tela(view({ observations: [obs(kind, subject, detail)] }));
    s.getByText(rotulo);
    s.getByText(subject);
  });

  /**
   * ⛔ **FR3 — a seção de marcações NÃO ganha rótulo.** O título dela já diz o que são, e é a única
   * seção cujo conteúdo é **resultado** e não entrada (SPEC-051): a marca é o que ela **observou**.
   */
  it('a seção de marcações não repete um rótulo de dimensão', async () => {
    const s = await tela({
      ...view({ observations: [obs('noticed', 'Frizz', 'você notou em 4 dos 6 cuidados que você avaliou')] }),
    });
    s.getByText('O que você tem notado');
    s.getByText('Frizz');
    expect(s.queryByText('Você notou')).toBeNull();
  });
});

describe('SPEC-064 FR5 — os dois vazios pesam igual', () => {
  /**
   * ⚠️ **Com só marcações, a seção "O que se repete" fica vazia** — e ela e a de combinações dizem
   * a mesma coisa: *ainda não há*. A auditoria pegou as duas com pesos diferentes, uma dentro de
   * cartão e a outra solta, o que fazia a primeira parecer um achado. As duas continuam presentes.
   */
  it('a tela só com marcações mostra os dois estados, e nenhum deles some', async () => {
    const s = await tela(
      view({ observations: [obs('noticed', 'Frizz', 'você notou em 4 dos 6 cuidados que você avaliou')] }),
    );
    s.getByText('O que se repete');
    s.getByText('Suas combinações');
    s.getByText(/A Huna ainda está conhecendo suas combinações/);
  });
});

describe('SPEC-064 AC2 — a frase do core aparece literal', () => {
  /**
   * ⚠️ **A barreira mais importante desta SPEC.** Por mais que destacar o número ajudasse a
   * escanear, decompor a frase é exatamente o que o core proíbe: é assim que uma afirmação causal
   * entra sem ninguém notar. Se alguém um dia partir o texto para estilizar um pedaço, isto quebra.
   */
  it('o texto sai inteiro, sem recomposição', async () => {
    const detail = 'esteve em 4 dos 6 cuidados que você avaliou bem';
    const s = await tela(view({ observations: [obs('product', 'Máscara da feira', detail)] }));
    s.getByText(detail);
  });
});

describe('SPEC-064 AC4 — nada novo afirma causa, mérito ou nota', () => {
  /**
   * As recusas de SPEC-047/050/051 continuam inteiras: esta rodada é **apresentação**, e um rótulo
   * de dimensão descreve **de onde o dado saiu**, nunca o que o produto faz.
   */
  /**
   * ⚠️ **`nota`, e não `nota` solto** — a primeira versão deste teste reprovou o título
   * legítimo *"O que você tem **nota**do"*. A palavra proibida é o **substantivo** (a nota que a
   * Huna daria), e o verbo *notar* é justamente o vocabulário aprovado da SPEC-051. Uma barreira
   * larga demais reprova o produto certo e ensina a afrouxá-la, que é pior que não tê-la.
   */
  const PROIBIDO = new RegExp(
    [
      'melhor',
      'ideal',
      'recomend',
      'indicad',
      'funciona',
      'eficaz',
      // ⚠️ Com fronteira de palavra: a proibida é a **nota** (substantivo), e *notar* é o
      // vocabulário aprovado da SPEC-051. A primeira versão usava `nota` solto e reprovou o
      // título legítimo "O que você tem notado" — barreira larga demais reprova o produto certo
      // e ensina a afrouxá-la, que é pior que não tê-la.
      String.raw`\bnotas?\b`,
      'score',
      'pontuação',
      '%',
      'porcentagem',
      'ranking',
    ].join('|'),
    'i',
  );

  it('a tela cheia de achados não introduz nenhuma dessas palavras', async () => {
    const s = await tela(
      view({
        observations: [
          obs('product', 'Máscara da feira', 'esteve em 4 dos 6 cuidados que você avaliou bem'),
          obs('technique', 'Secou naturalmente', 'você fez em 3 dos 6 cuidados que você avaliou bem'),
          obs('finish', 'Plopping', 'você finalizou assim em 3 dos 6 cuidados que você avaliou bem'),
          obs('noticed', 'Frizz', 'você notou em 4 dos 6 cuidados que você avaliou'),
        ],
        patterns: [
          {
            key: 'p1',
            subject: 'Máscara da feira + Plopping',
            // As duas contagens do par (SPEC-050): em quantos apareceram juntos, e em quantos
            // desses ela avaliou bem. A frase pronta vem do core, como a da observação.
            cares: 4,
            wellRated: 4,
            detail: 'apareceram juntos em 4 cuidados que você avaliou, e em 4 deles você avaliou bem',
          },
        ],
      }),
    );
    expect(s.queryByText(PROIBIDO)).toBeNull();
  });
});
