import type { HunaAvatar } from '../../identity/index.ts';
import type { JourneyView } from '../../journey/index.ts';
import type { ShareCardContent, ShareCardOptions } from '../domain/share-card.ts';
import { MAX_SHARE_NAME } from '../domain/share-card.ts';

/**
 * SPEC-044 — o card, construído a partir do que a Jornada **já** decidiu.
 *
 * ⚠️ **Nenhum número é calculado aqui** (BR4). Nível, pontos, sequência e cuidados atendidos entram
 * prontos da `JourneyView`; recalcular abriria a porta para o card e a tela discordarem sobre a
 * mesma conquista, e o desacordo apareceria justamente no lugar em que ela mostra o app para outras
 * pessoas.
 *
 * ⚠️ **A assinatura é a barreira de privacidade** (BR1). Só entra o que está aqui: a view da
 * Jornada, o nome, o avatar e a escolha dela. **Não há como um `user_id` chegar ao card** — ele não
 * é parâmetro, e o tipo de saída não tem onde guardá-lo.
 */
export const buildShareCard = (input: {
  journey: JourneyView;
  displayName: string | null;
  avatar: HunaAvatar | null;
  options: ShareCardOptions;
}): ShareCardContent => {
  const { journey, displayName, avatar, options } = input;

  /**
   * A sequência é a conquista quando existe; sem ela, o card fala do nível.
   *
   * ⚠️ **Primeira pessoa**, e é escolha de produto: o card sai da mão dela para quem não é ela, e
   * *"cuidados do seu plano"* falaria com a pessoa errada.
   */
  const hasStreak = journey.streak > 0;

  return {
    headline: journey.level.name,
    value: hasStreak ? String(journey.streak) : String(journey.points),
    valueLabel: hasStreak
      ? journey.streak === 1
        ? 'cuidado do meu plano em sequência'
        : 'cuidados do meu plano em sequência'
      : 'pontos de constância',
    footnote:
      journey.caresAttended > 0
        ? `${journey.caresAttended} ${journey.caresAttended === 1 ? 'cuidado' : 'cuidados'} do meu plano até aqui`
        : null,
    // Um nome que ela nunca deu não vira card por ela ter ligado um controle (EC6).
    displayName: options.showName && displayName ? truncate(displayName) : null,
    avatar: options.showAvatar ? avatar : null,
  };
};

/** EC5 — trunca em vez de vazar do quadro. A reticência avisa que foi cortado. */
const truncate = (name: string): string =>
  name.length <= MAX_SHARE_NAME ? name : `${name.slice(0, MAX_SHARE_NAME - 1).trimEnd()}…`;
