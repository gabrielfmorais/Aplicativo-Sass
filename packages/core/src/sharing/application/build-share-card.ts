import type { HunaAvatar } from '../../identity/index.ts';
import type { ShareCardContent, ShareCardOptions } from '../domain/share-card.ts';
import { MAX_SHARE_NAME } from '../domain/share-card.ts';
import type { ShareMoment } from '../domain/share-moment.ts';

/**
 * SPEC-044/SPEC-045 — o card, montado a partir de **um momento** e das escolhas dela.
 *
 * ⚠️ **Nenhum número é calculado aqui** (SPEC-044 BR4). O momento já vem pronto das views que a tela
 * mostrou; recalcular abriria a porta para o card e a tela discordarem sobre a mesma conquista.
 *
 * ⚠️ **A assinatura é a barreira de privacidade** (BR1). Só entra o que está aqui: o momento, o
 * nome, o avatar e a escolha dela. **Não há como um `user_id` chegar ao card** — ele não é
 * parâmetro, e o tipo de saída não tem onde guardá-lo.
 */
export const buildShareCard = (input: {
  moment: ShareMoment;
  displayName: string | null;
  avatar: HunaAvatar | null;
  options: ShareCardOptions;
}): ShareCardContent => {
  const { moment, displayName, avatar, options } = input;

  return {
    headline: moment.headline,
    value: moment.value,
    valueLabel: moment.valueLabel,
    footnote: moment.footnote,
    // Um nome que ela nunca deu não vira card por ela ter ligado um controle (EC6).
    displayName: options.showName && displayName ? truncate(displayName) : null,
    avatar: options.showAvatar ? avatar : null,
  };
};

/** EC5 — trunca em vez de vazar do quadro. A reticência avisa que foi cortado. */
const truncate = (name: string): string =>
  name.length <= MAX_SHARE_NAME ? name : `${name.slice(0, MAX_SHARE_NAME - 1).trimEnd()}…`;
