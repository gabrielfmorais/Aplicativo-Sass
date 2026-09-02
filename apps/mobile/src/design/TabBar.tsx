import { Pressable, StyleSheet, Text as RNText, View, type TextStyle } from 'react-native';

import { HIT_TARGET, color, radius, space, type } from '@/design/tokens';

/**
 * SPEC-026 fatia 1 (FR1–FR6) — as quatro categorias da Huna.
 *
 * **O problema que ela resolve.** Em seis SPECs o produto ganhou nove capabilities Free e nenhuma
 * ganhou um lugar: a rota tinha sete modos booleanos, cada um com um "voltar", e **a prateleira
 * (`F26`) e "meu cabelo mudou" (`F23`) moravam dentro da tela de assinatura e exclusão de conta** —
 * não por decisão, mas porque não havia onde pendurá-las. Um produto que faz nove coisas e parece
 * fazer duas.
 *
 * **Quatro, e não sete.** A regra é *muitas capabilities, poucas categorias, poucas decisões por
 * tela*. Sete abas trocariam "escondido" por "sobrecarregado", que é o mesmo problema de cabeça
 * para baixo. Community é a quinta, prevista aqui e ausente da tela até existir escala e moderação
 * (§0.4).
 *
 * **A ativa se lê em três canais** (FR2): a palavra ganha peso, a cor muda, e um traço aparece
 * acima. Cor sozinha não é estado — é a mesma regra do `Tag` da SPEC-016, e vale mais ainda aqui,
 * onde a diferença entre duas abas é a única pista de onde ela está.
 */
export const TABS = [
  { key: 'today', label: 'Hoje' },
  { key: 'care', label: 'Cuidados' },
  { key: 'progress', label: 'Progresso' },
  { key: 'you', label: 'Você' },
] as const;

export type TabKey = (typeof TABS)[number]['key'];

export function TabBar({ active, onChange }: { active: TabKey; onChange: (tab: TabKey) => void }) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const on = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            /**
             * O rótulo já diz a palavra; o que o leitor de tela **não** teria é a posição. "Hoje,
             * aba 1 de 4" é a diferença entre saber onde se está e adivinhar.
             */
            accessibilityLabel={`${tab.label}, aba ${TABS.indexOf(tab) + 1} de ${TABS.length}`}
            style={styles.tab}
          >
            {/* O traço é o terceiro canal, e some junto com a seleção — não é decoração. */}
            <View style={[styles.mark, on ? styles.markOn : styles.markOff]} />
            <RNText
              style={[
                (on ? type.bodyStrong : type.caption) as TextStyle,
                { color: on ? color.accent : color.inkMuted },
              ]}
            >
              {tab.label}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    paddingTop: space.sm,
    // Respiro no pé para não encostar na barra do sistema. Não é `safe area` — é folga de leitura;
    // a área segura de verdade é do `Screen`, que já a trata.
    paddingBottom: space.lg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: HIT_TARGET,
    gap: space.xs,
  },
  mark: { height: 3, width: 20, borderRadius: radius.pill },
  markOn: { backgroundColor: color.accent },
  markOff: { backgroundColor: 'transparent' },
});
