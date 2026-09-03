import { Pressable, StyleSheet, Text as RNText, View, type TextStyle } from 'react-native';

import { DropIcon, GrowthIcon, ShelfIcon, StrandsIcon } from '@/design/icons';
import { HIT_TARGET, color, radius, space, type } from '@/design/tokens';

/**
 * SPEC-026 fatia 1 (FR1–FR6) + SPEC-027 — as quatro categorias da Huna.
 *
 * **O problema que ela resolve.** Em seis SPECs o produto ganhou nove capabilities Free e nenhuma
 * ganhou um lugar: a rota tinha sete modos booleanos, cada um com um "voltar", e **a prateleira
 * (`F26`) e "meu cabelo mudou" (`F23`) moravam dentro da tela de assinatura e exclusão de conta** —
 * não por decisão, mas porque não havia onde pendurá-las. Um produto que faz nove coisas e parece
 * fazer duas.
 *
 * **Quatro, e a regra continua a mesma:** *muitas capabilities, poucas categorias, poucas decisões
 * por tela*. Sete abas trocariam "escondido" por "sobrecarregado", que é o mesmo problema de cabeça
 * para baixo.
 *
 * ⚠️ **A quarta vaga é da PRATELEIRA, e não de "Você" (SPEC-027, decisão do dono).** A fatia 7 tinha
 * mandado "Você" para o avatar do cabeçalho e deixado a quarta vaga vazia para a Community. A 390px
 * a barra de três lê como **inacabada** — mas a correção não é devolver "Você" à barra: **o avatar
 * do cabeçalho já é a porta do perfil, e duas entradas para o mesmo destino são o começo da
 * confusão**. A vaga vai para uma função de produto.
 *
 * **Por que a prateleira, e não outra.** `F26` não é uma tela terminal: é o **dado** de onde saem o
 * Wash Day (`F25`), a Smart Shelf, a Hair Intelligence e, no fim, as recomendações — a cadeia
 * inteira do §0.4. Ela mora dois toques abaixo de "Cuidados" e é a coisa que a usuária mais precisa
 * alcançar depois de "hoje". Community continua futura e não ocupa a barra.
 *
 * ⚠️ **A prateleira saiu de Cuidados ao virar aba.** Duas portas para a mesma tela é exatamente o
 * que a direção proíbe, e a regra não vale só para o perfil.
 *
 * **A ativa se lê em quatro canais** (FR2): a pastilha atrás do ícone, o peso da palavra, a cor da
 * palavra e a cor do ícone. Cor sozinha não é estado — é a mesma regra do `Tag` da SPEC-016, e vale
 * mais ainda aqui, onde a diferença entre duas abas é a única pista de onde ela está.
 *
 * ⚠️ **A pastilha era invisível, e isso foi medido, não achado.** Ela vinha em `accentSoft`
 * (#F6E9EF) sobre uma barra em `brandTint` (#F6EDF0): **1,03:1**. Dois cremes praticamente iguais —
 * o canal existia no código e não existia na tela, e sobravam três. Agora a pastilha é **ameixa
 * sólida** com o ícone em branco (8,91:1): o estado ativo passa a ter um bloco de cor, que é o que
 * se enxerga de relance com o polegar em cima da barra.
 *
 * ⚠️ **A pastilha substituiu o traço de cima.** O traço flutuava acima do ícone, encostava no
 * conteúdo da tela e lia como uma linha perdida entre o cartão e a barra. A pastilha **abraça** o
 * ícone: ela pertence à aba, e não ao espaço entre as duas coisas.
 *
 * ⚠️ **O ícone não muda entre ativo e inativo.** Trocar o desenho somaria um canal e nenhuma
 * informação: ícone aqui é reconhecimento, não estado.
 */
export const TABS = [
  { key: 'today', label: 'Hoje', Icon: DropIcon },
  { key: 'care', label: 'Cuidados', Icon: StrandsIcon },
  { key: 'shelf', label: 'Prateleira', Icon: ShelfIcon },
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
            <View style={[styles.pill, on && styles.pillOn]}>
              <tab.Icon color={on ? color.onFilled : color.inkMuted} size={24} />
            </View>
            <RNText
              numberOfLines={1}
              style={[
                (on ? styles.labelOn : styles.labelOff) as TextStyle,
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
    /**
     * SPEC-027 — creme, não branco.
     *
     * A barra era `surface` puro sobre um canvas quente, e era a superfície mais permanente do app
     * e a que menos pertencia à marca: uma faixa branca embaixo de toda tela. O creme tingido é o
     * mesmo bloco de identidade dos cartões de marca (FR16), e a borda em `accentBorder` fecha a
     * tela por baixo em vez de só separar dois brancos.
     */
    backgroundColor: color.brandTint,
    borderTopWidth: 1,
    borderTopColor: color.accentBorder,
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
  /**
   * A pastilha. Existe sempre — invisível quando a aba está apagada — porque uma pastilha que só
   * aparece na ativa mudaria a altura da linha ao trocar de aba, e a barra inteira daria um pulo.
   */
  pill: {
    minWidth: 56,
    height: 32,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillOn: { backgroundColor: color.accent },
  /**
   * O rótulo é `caption` nos dois estados, com o peso mudando: `bodyStrong` na ativa somava dois
   * pontos de corpo e empurrava as outras três palavras, e "Progresso" a 13pt já usa a largura
   * inteira da coluna numa tela de 320pt.
   */
  labelOn: { ...type.caption, fontWeight: '700' },
  labelOff: type.caption,
});
