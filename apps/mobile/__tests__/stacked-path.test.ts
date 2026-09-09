import { EMPTY_PATH, openFromTab, pop, push } from '@/shared/stacked-path';

/**
 * ⚠️ **SPEC-061 / ADR-012 — o núcleo de navegação do app não tinha um único teste.**
 *
 * Medido antes desta SPEC: nenhuma das 54 suítes importava `app/index.tsx`, o arquivo de 884 linhas
 * que decide **todo** destino do app. Toda tela era testada isolada, com props na mão; a ligação
 * entre elas não era testada por ninguém.
 *
 * Isto prova a parte que dá para provar sem montar a árvore inteira: as regras do caminho.
 */

describe('SPEC-061 — abrir a partir de uma aba recomeça o caminho', () => {
  /**
   * ⚠️ **Não é `push`, e a diferença é visível.** Tocar "Sua jornada" na Hoje enquanto a Conta está
   * aberta não pode deixar a Conta embaixo: a origem é a **aba**, e voltar dali é voltar para a aba.
   */
  it('a aba é a raiz: o caminho fica com um degrau só', () => {
    expect(openFromTab('journey')).toEqual(['journey']);
    // Mesmo partindo de um caminho fundo, abrir de uma aba não empilha.
    expect(pop(openFromTab('journey'))).toEqual(EMPTY_PATH);
  });
});

describe('SPEC-061 — a pilha de dois níveis deixa de ser escrita à mão', () => {
  /**
   * ⚠️ **A regra que esta SPEC veio consertar.** `dataSources` voltava para `you` porque alguém
   * escreveu `setStacked('you')` no `onBack` **daquela tela** — quem lesse Fontes de dados não tinha
   * como saber que ela era o segundo degrau de algo. Agora é o caminho que sabe.
   */
  it('Conta → Fontes de dados → voltar cai na Conta, sem ninguém dizer para onde', () => {
    const conta = openFromTab('you');
    const fontes = push(conta, 'dataSources');

    expect(fontes).toEqual(['you', 'dataSources']);

    expect(pop(fontes)).toEqual(['you']);
  });

  /** E o degrau seguinte devolve à aba — o fim do caminho é sempre a raiz. */
  it('voltar do primeiro degrau devolve à aba', () => {
    expect(pop(openFromTab('you'))).toEqual(EMPTY_PATH);
  });

  /** Voltar de um caminho já vazio não estoura nem inventa degrau negativo. */
  it('voltar da raiz não faz nada', () => {
    expect(pop(EMPTY_PATH)).toEqual(EMPTY_PATH);
  });
});

describe('SPEC-061 — compartilhar volta para onde ela veio, por estrutura', () => {
  /**
   * ⚠️ Antes, a volta do share era escolhida **por um condicional na tela**:
   * `setStacked(shareFrom === 'journey' ? 'journey' : null)`. Dois lugares para manter em acordo — a
   * origem guardada num estado e a volta escrita à mão. Agora o caminho responde sozinho.
   */
  it('da Jornada volta para a Jornada; de uma aba volta para a aba', () => {
    const daJornada = push(openFromTab('journey'), 'share');
    expect(pop(daJornada)).toEqual(['journey']);

    const daAba = push(EMPTY_PATH, 'share');
    expect(pop(daAba)).toEqual(EMPTY_PATH);
  });
});

describe('SPEC-061 — as operações não mutam o caminho recebido', () => {
  /**
   * O caminho é estado do React. Mutar em vez de derivar faria o `setState` não perceber a mudança —
   * a tela ficaria parada com o estado já trocado, que é a pior forma de bug de navegação.
   */
  it('push e pop devolvem caminhos novos', () => {
    const original = openFromTab('you');
    const depois = push(original, 'dataSources');
    expect(original).toEqual(['you']);
    expect(depois).not.toBe(original);
    expect(pop(depois)).not.toBe(depois);
  });
});
