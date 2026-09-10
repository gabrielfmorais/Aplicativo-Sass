/**
 * SPEC-061 / ADR-012 — **o caminho empilhado, como dado puro.**
 *
 * A navegação empilhada era um valor só (`stacked: 'you' | 'journey' | … | null`), e a pilha de dois
 * níveis vivia **à mão**: `dataSources` voltava para `you` porque alguém escreveu `setStacked('you')`
 * no `onBack` daquela tela. Quem lesse a tela de Fontes de dados não tinha como saber que ela era o
 * segundo degrau de algo.
 *
 * Aqui o caminho é um **array**, e as três operações são funções puras. Isso importa por dois
 * motivos concretos:
 *
 * 1. ⚠️ **O gesto de borda do iPhone e o botão "Voltar" precisam ser a MESMA coisa.** Os dois chamam
 *    `pop`. Não há um segundo caminho de saída que possa divergir do primeiro — que é exatamente a
 *    forma de defeito que este projeto já mediu três vezes (a peça existe, a ligação não).
 * 2. O núcleo de navegação do app vivia num arquivo de 884 linhas com **zero cobertura de teste**
 *    (medido). Isto é a parte dele que dá para provar sem montar a árvore inteira.
 */
export type StackedKey =
  | 'hairEvents'
  | 'you'
  | 'journey'
  | 'share'
  | 'insights'
  | 'shelfUsage'
  | 'finishes'
  /** SPEC-070 — a tela de uma finalização. Empilha SOBRE 'finishes', então voltar cai na lista. */
  | 'finishDetail'
  /** SPEC-071 — a configuração da rotina de óleo, que saiu de dentro da aba Cuidados. */
  | 'oilRoutine'
  | 'dataSources';

export type StackedPath = readonly StackedKey[];

export const EMPTY_PATH: StackedPath = [];

/**
 * Abrir **a partir de uma aba**: a aba é a raiz, então o caminho recomeça.
 *
 * ⚠️ Não é `push`. Tocar "Sua jornada" na Hoje com a Conta aberta não deve deixar a Conta embaixo:
 * a origem é a aba, e o caminho tem um degrau só.
 */
export const openFromTab = (key: StackedKey): StackedPath => [key];

/** Abrir **a partir de uma tela já empilhada**: acrescenta um degrau (Conta → Fontes de dados). */
export const push = (path: StackedPath, key: StackedKey): StackedPath => [...path, key];

/**
 * Voltar um degrau. É o que o botão "Voltar" **e** o gesto de borda fazem.
 *
 * De `['you','dataSources']` cai em `['you']` — a volta que antes era um `setStacked('you')` escrito
 * à mão dentro da tela de Fontes de dados.
 */
export const pop = (path: StackedPath): StackedPath => path.slice(0, -1);
