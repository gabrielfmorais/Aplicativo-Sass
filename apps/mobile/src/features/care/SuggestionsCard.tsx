import { StyleSheet } from 'react-native';

import { Button, Card, Row, Stack, Text } from '@/design/primitives';
import type { Suggestion } from '@/features/care/suggestions';

/**
 * SPEC-026 fatia 3 — "Sugestões para você".
 *
 * **Convite, nunca cobrança.** Cada uma pode ser dispensada e some; o app não conta quantas ela
 * ignorou, não insiste e não volta a pedir na mesma sessão (FR15). Sem contador, sem "faltam 2",
 * sem barra de progresso — a mesma barreira que o `F29` e o `F22` já carregam.
 *
 * A seção inteira **desaparece** quando não há nada a oferecer. Uma seção vazia com um título é
 * pior que nenhuma seção: ocupa a tela para dizer que não tem nada a dizer.
 */
export function SuggestionsCard({
  suggestions,
  onAct,
  onDismiss,
}: {
  suggestions: readonly Suggestion[];
  onAct: (suggestion: Suggestion) => void;
  onDismiss: (suggestion: Suggestion) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <Stack gap="md">
      <Text variant="overline" tone="muted" accessibilityRole="header">
        Sugestões para você
      </Text>
      {suggestions.map((suggestion) => (
        <Card key={suggestion.key} tone="accent">
          <Text>{suggestion.text}</Text>
          <Row gap="sm" style={styles.actions}>
            <Button
              label={suggestion.action}
              variant="secondary"
              size="sm"
              onPress={() => onAct(suggestion)}
            />
            {/* Quieto de propósito: dispensar é dela, e não precisa competir com a oferta. */}
            <Button
              label="Agora não"
              variant="ghost"
              size="sm"
              accessibilityLabel={`Dispensar: ${suggestion.text}`}
              onPress={() => onDismiss(suggestion)}
            />
          </Row>
        </Card>
      ))}
    </Stack>
  );
}

const styles = StyleSheet.create({
  actions: { alignItems: 'center' },
});
