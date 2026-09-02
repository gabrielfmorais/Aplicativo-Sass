import { Pressable, StyleSheet, Text as RNText, View, type TextStyle } from 'react-native';

import { DropIcon, GrowthIcon, StrandsIcon } from '@/design/icons';
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
 * **Três, e a quarta reservada.** A regra é *muitas capabilities, poucas categorias, poucas decisões
 * por tela*. Sete abas trocariam "escondido" por "sobrecarregado", que é o mesmo problema de cabeça
 * para baixo.
 *
 * ⚠️ **"Você" saiu daqui e virou o avatar do cabeçalho** (SPEC-026 fatia 7): o nome dela é um
 * convite, "Você" era um rótulo. **A vaga liberada fica vaga** — as três categorias cobrem o
 * produto, e pôr algo aqui agora seria complexidade para preencher espaço. É **Community** que
 * ocupa a quarta quando escala e moderação existirem (§0.4), e é para ela que a vaga está aberta.
 *
 * **A ativa se lê em quatro canais** (FR2): peso da palavra, cor, um traço acima e a cor do ícone.
 * Cor sozinha não é estado — é a mesma regra do `Tag` da SPEC-016, e vale mais ainda aqui, onde a
 * diferença entre duas abas é a única pista de onde ela está.
 *
 * ⚠️ **O ícone não muda entre ativo e inativo.** Trocar o desenho somaria um quinto canal e nenhuma
 * informação: ícone aqui é reconhecimento, não estado.
 */
export const TABS = [
  { key: 'today', label: 'Hoje', Icon: DropIcon },
  { key: 'care', label: 'Cuidados', Icon: StrandsIcon },
  { key: 'progress', label: 'Progresso', Icon: GrowthIcon },
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
            {/* O traço é um dos canais, e some junto com a seleção — não é decoração. */}
            <View style={[styles.mark, on ? styles.markOn : styles.markOff]} />
            <tab.Icon color={on ? color.accent : color.inkMuted} />
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
