/**
 * SPEC-045 (F46) — **os momentos que produzem um card**.
 *
 * O `F45` fez a fundação: um caminho (`conquista → preview → ela decide → share`) e um card. O que
 * faltava eram os **gatilhos** — e a promessa do `F45` era que o `F46` acrescentasse *momentos*,
 * **não outro caminho** (SPEC-044 G5). É o que este tipo garante: o momento é **dado**, o caminho
 * continua sendo um só.
 *
 * ⚠️ **O momento já vem escrito.** Ele carrega o texto pronto porque a alternativa — o card decidir
 * o que dizer a partir do tipo — espalharia a cópia de cada momento por dentro do desenho, onde
 * ninguém a encontraria para revisar. Aqui, cada momento é uma frase que dá para ler inteira.
 *
 * ⚠️ **Nada aqui afirma nada sobre o cabelo dela** (D-26/D-70). Um card de cuidado concluído diz
 * *que ela fez*, nunca *o que aquilo fez com o cabelo* — a segunda frase seria alegação capilar, num
 * lugar que ainda por cima sai do app. Barreira de teste.
 */

export const SHARE_MOMENT_KINDS = ['journey', 'milestone', 'care_done', 'cycle'] as const;

export type ShareMomentKind = (typeof SHARE_MOMENT_KINDS)[number];

export type ShareMoment = {
  readonly kind: ShareMomentKind;
  /** Identifica o momento na lista quando há vários do mesmo tipo (marcos). */
  readonly key: string;
  /** O rótulo curto com que ela escolhe **qual** momento compartilhar. */
  readonly chip: string;
  readonly headline: string;
  readonly value: string;
  /** Na **primeira pessoa**: o card sai da mão dela para quem não é ela. */
  readonly valueLabel: string;
  readonly footnote: string | null;
};
