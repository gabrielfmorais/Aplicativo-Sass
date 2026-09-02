import { StyleSheet, View } from 'react-native';

import { Button, Card, Row, Text } from '@/design/primitives';
import { color, space } from '@/design/tokens';
import { HomeSection } from '@/features/care/HomeSection';
import type { Suggestion } from '@/features/care/suggestions';

/**
 * SPEC-026 fatia 3 + SPEC-030 — "Sugestões para você", consolidada.
 *
 * **Convite, nunca cobrança.** Cada uma pode ser dispensada e some; o app não conta quantas ela
 * ignorou, não insiste e não volta a pedir na mesma sessão (FR15). Sem contador, sem "faltam 2",
 * sem barra de progresso — a mesma barreira que o `F29` e o `F22` já carregam.
 *
 * A seção inteira **desaparece** quando não há nada a oferecer. Uma seção vazia com um título é
 * pior que nenhuma seção: ocupa a tela para dizer que não tem nada a dizer.
 *
 * ⚠️ **SPEC-030 — um painel, e não um cartão por sugestão.** Cada oferta era um `Card` inteiro em
 * ameixa clara. Com duas na tela viravam dois blocos rosa empilhados logo abaixo do cartão de foco,
 * que também é um bloco tingido: três retângulos coloridos seguidos, e a tela lia como um mural de
 * avisos. Agora é **um** painel com as ofertas separadas por filete — a mesma informação, um terço
 * da moldura, e a seção volta a parecer uma seção em vez de uma pilha.
 *
 * ⚠️ **A ordem dentro da linha é fato → ação, sempre.** O texto diz o que aconteceu; o botão diz o
 * que dá para fazer com isso. Invertido, a oferta viraria comando — e esta seção não manda.
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
    <HomeSection title="Sugestões para você">
      <Card tone="violet" style={styles.panel}>
        {suggestions.map((suggestion, index) => (
          <View key={suggestion.key} style={[styles.item, index < suggestions.length - 1 && styles.divided]}>
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
          </View>
        ))}
      </Card>
    </HomeSection>
  );
}

const styles = StyleSheet.create({
  /**
   * O painel perde o respiro interno porque quem respira é a **linha** — com o padding no cartão, o
   * filete não chegaria às bordas, e um filete que não atravessa lê como risco solto.
   */
  panel: { paddingVertical: 0, paddingHorizontal: 0, gap: 0 },
  item: { paddingHorizontal: space.lg, paddingVertical: space.lg, gap: space.md },
  /** Sobre o roxo suave, a linha neutra some e a ameixa clara se lê como separação, não como cor. */
  divided: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.accentBorder },
  actions: { alignItems: 'center' },
});
