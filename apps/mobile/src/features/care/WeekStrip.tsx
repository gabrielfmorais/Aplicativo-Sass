import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/design/primitives';
import { HIT_TARGET_MIN, careColor, color, radius, space } from '@/design/tokens';
import type { WeekCare, WeekDay } from '@/features/care/week';

/**
 * SPEC-016 slice 2 — where the week is, at a glance.
 *
 * The daily screen used to answer "what now?" without ever answering "where am I?". A four-week
 * plan is the product's whole shape, and until now it was only visible by scrolling a list of
 * dates. Seven cells put it back: which days carry a care, which are already settled, which are
 * behind. It informs; the plan itself is unchanged, and no rule is evaluated here.
 *
 * **SPEC-026 FR7 — agora é clicável, e a razão de não ser mudou.** A versão da SPEC-016 dizia que
 * um toque teria de significar navegar ou filtrar, e nenhum dos dois existia: uma affordance que não
 * leva a lugar nenhum é pior que affordance nenhuma. Agora leva — tocar num dia mostra o conteúdo
 * daquele dia. Nada mais mudou: a faixa continua sem decidir coisa alguma sobre cuidado.
 *
 * Cada célula é **um** nó de acessibilidade lendo o dia inteiro como frase, porque uma fileira de
 * pontos não é nada para um leitor de tela, e cor nunca é o único portador de estado — o dia
 * selecionado anuncia `selected`, além de mudar de forma.
 */

const dotStyleOf = (care: WeekCare) => {
  const hue = careColor[care.careTypeCode];
  switch (care.outcome) {
    // Filled: it happened. The strongest mark on the strip, because it is the one worth earning.
    case 'done':
      return { backgroundColor: hue.fg, borderColor: hue.fg };
    // Ringed in the alert colour: still open, and its day has passed (D-28 — nothing moves itself).
    case 'overdue':
      return { backgroundColor: color.dangerSoft, borderColor: color.danger };
    // Hollow and grey: she settled the day by not doing it, which is a valid outcome, not a failure.
    case 'skipped':
      return { backgroundColor: 'transparent', borderColor: color.borderStrong };
    case 'planned':
      return { backgroundColor: hue.bg, borderColor: hue.fg };
  }
};

function DayCell({
  day,
  selected,
  onSelect,
}: {
  day: WeekDay;
  selected: boolean;
  onSelect: (date: string) => void;
}) {
  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={day.label}
      onPress={() => onSelect(day.date)}
      style={[styles.cell, day.isToday && styles.cellToday, selected && styles.cellSelected]}
    >
      <Text variant="overline" tone={day.isToday ? 'accent' : 'faint'}>
        {day.initial}
      </Text>
      <Text
        variant={day.isToday ? 'bodyStrong' : 'body'}
        tone={day.isToday ? 'accent' : day.isPast ? 'faint' : 'default'}
      >
        {day.dayOfMonth}
      </Text>
      <View style={styles.dots}>
        {/* Three is the most a single day can hold in a generated plan, and also the most that fits
            legibly. Slicing is a rendering guard, not a rule: the sections below list them all. */}
        {day.cares.slice(0, 3).map((care, index) => (
          <View key={`${care.careTypeCode}-${index}`} style={[styles.dot, dotStyleOf(care)]} />
        ))}
      </View>
    </Pressable>
  );
}

export function WeekStrip({
  week,
  selected,
  onSelect,
}: {
  week: readonly WeekDay[];
  /** O dia que a tela está mostrando. Começa em hoje e só muda por toque dela. */
  selected: string;
  onSelect: (date: string) => void;
}) {
  return (
    <View style={styles.strip}>
      {week.map((day) => (
        <DayCell key={day.date} day={day} selected={day.date === selected} onSelect={onSelect} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', justifyContent: 'space-between', gap: space.xs },
  cell: {
    flex: 1,
    minHeight: HIT_TARGET_MIN + space.lg,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: space.xs,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  cellToday: { backgroundColor: color.accentSoft },
  /**
   * O selecionado se lê por **contorno**, e o hoje por preenchimento. Dois canais diferentes porque
   * são dois fatos diferentes e podem coincidir: no dia em que ela abre o app, o selecionado **é** o
   * hoje, e uma célula que usasse o mesmo recurso para os dois não saberia dizer isso.
   */
  cellSelected: { borderWidth: 1.5, borderColor: color.accent },
  // Fixed height so a day with no cares does not sit taller or shorter than its neighbours.
  dots: { flexDirection: 'row', gap: space.xs, height: space.sm, alignItems: 'center' },
  dot: { width: space.sm, height: space.sm, borderRadius: radius.pill, borderWidth: 1.5 },
});
