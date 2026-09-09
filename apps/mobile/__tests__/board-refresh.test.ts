import { readFailureTakesOverScreen, readingTakesOverScreen } from '@/shared/board-refresh';

/**
 * SPEC-070 FR1/FR2 — **a barreira contra o defeito que devolvia a usuária ao topo.**
 *
 * ⚠️ Estes testes existem porque o defeito era **uma linha** dentro de uma rota de 900+ linhas sem
 * cobertura, e ele atravessou todas as SPECs da Hoje com o CI verde. Repor `setBoard('loading')`
 * incondicional faz o primeiro teste abaixo falhar **nomeando a regra**.
 */
describe('SPEC-070 — revalidação do board não desmonta a tela', () => {
  it('com board na tela, a leitura NÃO toma a tela — é o que preserva o scroll dela', () => {
    // O defeito: aqui era sempre `true`, a árvore inteira virava spinner, a `ScrollView` remontava
    // no topo, e cada toque da Hoje custava o lugar dela.
    expect(readingTakesOverScreen('loaded')).toBe(false);
  });

  it('sem nada a preservar, a tela cheia é a resposta certa', () => {
    // Primeira carga: não há board para manter, e um spinner é honesto.
    expect(readingTakesOverScreen('loading')).toBe(true);
    // Nova tentativa depois do erro: a tela de erro não é conteúdo dela, e dizer "estou tentando"
    // é melhor que um botão que parece não ter feito nada.
    expect(readingTakesOverScreen('error')).toBe(true);
  });

  it('a falha de uma revalidação NÃO apaga o que ela está vendo', () => {
    // A escrita dela deu certo; só a releitura não voltou. Trocar a tela por um erro cheio seria
    // punir uma ação bem-sucedida — quem avisa é o cartão onde ela tocou.
    expect(readFailureTakesOverScreen('loaded')).toBe(false);
  });

  it('a falha da PRIMEIRA carga toma a tela, porque não há alternativa honesta', () => {
    expect(readFailureTakesOverScreen('loading')).toBe(true);
  });

  it('uma falha durante a nova tentativa não regride a tela de erro para outra coisa', () => {
    // Já estava em erro e continuou em erro: a troca é desnecessária, e não fazê-la evita um
    // repinte a cada tentativa.
    expect(readFailureTakesOverScreen('error')).toBe(false);
  });
});
