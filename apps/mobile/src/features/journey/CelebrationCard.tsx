import type { Celebration } from '@app/core';

import { Reveal } from '@/design/Reveal';
import { Button, Card, Row, Stack, Text } from '@/design/primitives';

/**
 * SPEC-043 OQ1 — **a celebração no lugar dela.**
 *
 * O fluxo da Jornada (Blueprint §24) termina em *"celebração no lugar dela"*, e até aqui esse nó não
 * existia: marcos e níveis subiam em silêncio. Este cartão é o momento — aparece na Hoje, na hora em
 * que ela cruza um marco ou sobe de nível, e some quando ela quer.
 *
 * ⚠️ **Fala de ADERÊNCIA, nunca de cabelo** (D-26) e nunca de fazer mais (D-103). *"Você chegou aqui
 * mantendo o seu plano"* é sobre constância; qualquer palavra sobre o cabelo dela ou sobre lavar mais
 * seria a linha que a Jornada inteira recusa. Barreira de teste na tela.
 *
 * ⚠️ **Discreto, não ruído.** É a razão de a OQ1 ter sido adiada (*"com ela mal-feita vira ruído"*):
 * um cartão que ela fecha, uma entrada suave que respeita redução de movimento (via `Reveal`), e
 * dispara raramente — só numa conquista de verdade, uma por evento (`detectCelebration`).
 */
const copyOf = (c: Celebration): { over: string; title: string; body: string } =>
  c.kind === 'milestone'
    ? { over: 'Conquista', title: c.label, body: 'Você chegou aqui mantendo o seu plano.' }
    : { over: 'Novo nível', title: c.name, body: 'Sua constância na jornada subiu de nível.' };

export function CelebrationCard({
  celebration,
  onShare,
  onDismiss,
}: {
  celebration: Celebration;
  onShare: () => void;
  onDismiss: () => void;
}) {
  const { over, title, body } = copyOf(celebration);
  // `key` remonta o Reveal quando a conquista muda, reiniciando a entrada — uma conquista nova
  // anima de novo em vez de aparecer parada.
  const key = celebration.kind === 'milestone' ? celebration.key : `level:${celebration.level}`;
  return (
    <Reveal key={key}>
      <Card tone="accent">
        <Stack gap="sm">
          <Text variant="overline" tone="accent" accessibilityRole="header">
            {over}
          </Text>
          <Text variant="heading">{title}</Text>
          <Text tone="muted">{body}</Text>
          <Row gap="sm">
            <Button label="Compartilhar" variant="secondary" onPress={onShare} />
            <Button label="Fechar" variant="ghost" onPress={onDismiss} />
          </Row>
        </Stack>
      </Card>
    </Reveal>
  );
}
