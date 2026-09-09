/**
 * SPEC-070 FR1/FR2 — **quando a leitura do board pode tomar a tela, e quando não pode.**
 *
 * A regra vive aqui, e não dentro da rota, por uma razão medida: `apps/mobile/src/app/index.tsx`
 * tem 900+ linhas e nenhuma cobertura (a mesma medição que decidiu a ADR-012). O defeito que esta
 * regra conserta era **uma linha** lá dentro — `setBoard('loading')` incondicional —, e ele
 * atravessou todas as SPECs da Hoje sem que nada ficasse vermelho.
 *
 * **O defeito.** Toda ação da Hoje termina numa releitura do board. Com a troca incondicional para
 * `'loading'`, a rota devolvia um spinner de tela cheia, a árvore inteira era desmontada, e a
 * `ScrollView` do `Screen` remontava com o scroll em 0. Concluir, pular, reagendar, desfazer, o
 * check-in, cada marcação, a etapa de finalização e a técnica **devolviam a usuária ao topo**.
 *
 * **A regra.** A tela cheia só aparece quando **não há nada a preservar**: a primeira carga, e a
 * nova tentativa depois de um erro. Com um board bom na tela, a releitura é silenciosa e a troca
 * acontece quando o dado novo chega.
 */
export type BoardPhase = 'loading' | 'error' | 'loaded';

/**
 * A leitura que está no ar pode trocar a tela por um spinner?
 *
 * Só quando não há board na tela. ⚠️ `'error'` conta como "nada a preservar": a tela de erro não é
 * o conteúdo dela, e a nova tentativa merece dizer que está tentando.
 */
export const readingTakesOverScreen = (current: BoardPhase): boolean => current !== 'loaded';

/**
 * A **falha** da leitura pode trocar a tela por um erro de tela cheia?
 *
 * Só quando a tela já era o spinner — isto é, quando a leitura que falhou era a primeira. ⚠️ Com um
 * board bom na tela, a falha **não apaga o que ela está vendo**: a escrita dela deu certo e só a
 * releitura não voltou. Quem avisa é o cartão onde ela tocou, não um erro que engole a tela.
 */
export const readFailureTakesOverScreen = (current: BoardPhase): boolean => current === 'loading';
