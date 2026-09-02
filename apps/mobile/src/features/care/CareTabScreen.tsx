import { StyleSheet } from 'react-native';

import { Button, Card, Screen, ScreenHeader, Text } from '@/design/primitives';

/**
 * SPEC-026 fatia 1 (FR6) — **Cuidados**: tudo o que é rotina, num lugar só.
 *
 * O cronograma do dia continua na **Hoje**, que é onde ela age. Aqui mora o que ela consulta e
 * mantém: a forma do mês e a prateleira.
 *
 * **A prateleira estava dentro da Conta** — a tela de assinatura, lembretes e exclusão de conta.
 * Não foi decisão: quando o `F26` chegou, não havia outro lugar para pendurá-lo. Uma capability de
 * cuidado diário na gaveta de configurações é uma capability que praticamente não existe.
 *
 * Cartões, não uma lista de links: cada um diz **o que é** antes de oferecer o botão, porque um
 * menu de rótulos obriga a abrir para descobrir, e abrir para descobrir é uma decisão a mais por
 * tela (§6 da direção).
 */
export function CareTabScreen({
  onOpenCycle,
  onOpenShelf,
  hasPlan,
  profile,
}: {
  onOpenCycle: () => void;
  onOpenShelf: () => void;
  /**
   * EC1 — sem plano ativo o ciclo não existe, e um botão que abre uma tela vazia é pior que um
   * botão ausente: a tela diz o que falta em vez de fingir que há algo lá.
   */
  hasPlan: boolean;
  /** SPEC-026 fatia 7 — o acesso a **Você**, no cabeçalho. A tela só repassa. */
  profile: { readonly name: string | null; readonly onPress: () => void };
}) {
  return (
    <Screen>
      <ScreenHeader eyebrow="Sua rotina" title="Cuidados" profile={profile} />

      <Card>
        <Text variant="heading" accessibilityRole="header">
          Meu ciclo
        </Text>
        <Text tone="muted">As quatro semanas do seu cronograma e o que aconteceu em cada uma.</Text>
        {hasPlan ? (
          <Button label="Ver meu ciclo" variant="secondary" onPress={onOpenCycle} style={styles.action} />
        ) : (
          <Text variant="caption" tone="faint">
            Seu ciclo aparece assim que você tiver um cronograma.
          </Text>
        )}
      </Card>

      <Card>
        <Text variant="heading" accessibilityRole="header">
          Minha prateleira
        </Text>
        <Text tone="muted">
          Os produtos que você já tem em casa. Serve para o app não sugerir o que você não tem.
        </Text>
        <Button
          label="Ver minha prateleira"
          variant="secondary"
          onPress={onOpenShelf}
          style={styles.action}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** Duas portas do mesmo tamanho, e nenhuma é a ação primária da tela: nenhuma ocupa a linha. */
  action: { alignSelf: 'flex-start' },
});
