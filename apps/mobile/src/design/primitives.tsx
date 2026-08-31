import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import {
  CONTENT_MAX_WIDTH,
  HIT_TARGET,
  HIT_TARGET_MIN,
  color,
  elevation,
  radius,
  space,
  type,
} from './tokens';

/**
 * SPEC-016 FR1 — the shared vocabulary. Every primitive here has a real consumer in the same slice
 * that introduced it (AC3); none exists on the theory that a screen will want it one day.
 *
 * These own *appearance*. They own no business rule, no data fetching and no navigation — a screen
 * still receives its ports as props (ADR-001).
 */

// ---------------------------------------------------------------------------------------- Text

export function Text({
  variant = 'body',
  tone = 'default',
  center,
  style,
  children,
  ...rest
}: {
  variant?: keyof typeof type;
  tone?: 'default' | 'muted' | 'faint' | 'accent' | 'onFilled' | 'danger' | 'success';
  center?: boolean;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
} & Omit<React.ComponentProps<typeof RNText>, 'style' | 'children'>) {
  const tones = {
    default: color.ink,
    muted: color.inkMuted,
    faint: color.inkFaint,
    accent: color.accent,
    onFilled: color.onFilled,
    danger: color.danger,
    success: color.success,
  } as const;
  return (
    <RNText
      style={[type[variant] as TextStyle, { color: tones[tone] }, center && styles.center, style]}
      {...rest}
    >
      {children}
    </RNText>
  );
}

// -------------------------------------------------------------------------------------- Screen

/**
 * The page frame: warm canvas, comfortable gutters, and a width cap so the web preview shows
 * something phone-shaped instead of a row of chips 1500px wide.
 */
export function Screen({
  children,
  scroll = true,
  footer,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Pinned below the scroll area — for a primary action that must stay reachable. */
  footer?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const body = <View style={[styles.content, style]}>{children}</View>;
  return (
    <View style={styles.screen}>
      <View style={styles.column}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {body}
          </ScrollView>
        ) : (
          body
        )}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------------------------- Loading

/**
 * SPEC-016 FR4/EC5 — the state a slow connection actually produces.
 *
 * Every screen that waits on a read used to `return null`, which is a white screen: indistinguishable
 * from a crash, from a blank plan, and from an app that simply stopped. A spinner alone is barely
 * better — it says "something", not "what" — so the label is not optional decoration, it is the
 * state in words, which is the rule everywhere else here too.
 */
export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <View style={[styles.screen, styles.loading]}>
      <ActivityIndicator color={color.accent} accessibilityRole="progressbar" accessibilityLabel={label} />
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

// -------------------------------------------------------------------------------------- Button

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  busy = false,
  disabled = false,
  accessibilityLabel,
  accessibilityState,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  /**
   * `sm` is for the tertiary row that sits under a primary action. It is quieter, not smaller to
   * hit: the target stays above the 44pt floor (BR4) — only the padding and the type shrink.
   */
  size?: 'md' | 'sm';
  /** Shows a spinner and blocks presses — the double-submit guard is still the caller's job. */
  busy?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  /**
   * Merged over the computed state. `expanded` for a button that toggles something; `busy` for one
   * whose label already says it is working ("Criando…"), where a spinner would replace the very
   * words that explain the wait.
   */
  accessibilityState?: { expanded?: boolean; busy?: boolean };
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy, ...accessibilityState }}
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        buttonVariant[variant].container,
        pressed && !off && buttonVariant[variant].pressed,
        off && styles.buttonOff,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={buttonVariant[variant].spinner} />
      ) : (
        <Text
          variant={size === 'sm' ? 'caption' : 'bodyStrong'}
          tone={buttonVariant[variant].tone}
          style={size === 'sm' ? styles.buttonSmLabel : undefined}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const buttonVariant = {
  primary: {
    container: { backgroundColor: color.accent },
    pressed: { backgroundColor: color.accentPressed },
    tone: 'onFilled',
    spinner: color.onFilled,
  },
  secondary: {
    container: { backgroundColor: color.surface, borderWidth: 1, borderColor: color.borderStrong },
    pressed: { backgroundColor: color.surfacePressed },
    tone: 'default',
    spinner: color.ink,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    pressed: { backgroundColor: color.surfaceMuted },
    tone: 'muted',
    spinner: color.inkMuted,
  },
  // A `danger` variant used to sit here with no consumer, and its pressed state painted danger text
  // on a danger fill — 1:1, invisible. Deleted rather than fixed: no destructive action exists in
  // this product yet, and AC3 says a primitive earns its place by having a real consumer.
} as const satisfies Record<
  string,
  {
    container: ViewStyle;
    pressed: ViewStyle;
    tone: 'onFilled' | 'default' | 'muted';
    spinner: string;
  }
>;

// ---------------------------------------------------------------------------------------- Chip

/**
 * The onboarding's whole interaction, so it earns its polish. Selected is accent-tinted rather than
 * filled black: it reads as chosen without shouting, and keeps a row of chips calm.
 */
export function Chip({
  label,
  selected,
  onPress,
  multi = false,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** `true` renders as a checkbox to assistive tech; `false` as a radio within its group. */
  multi?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, disabled }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipOn : styles.chipOff,
        pressed && !disabled && (selected ? styles.chipOnPressed : styles.chipOffPressed),
      ]}
    >
      <Text variant={selected ? 'bodyStrong' : 'body'} tone={selected ? 'accent' : 'default'}>
        {label}
      </Text>
    </Pressable>
  );
}

// ----------------------------------------------------------------------------------------- Tag

/**
 * A small, non-interactive label that names a *state* or a *kind* — "Atrasada há 2 dias", "Feito",
 * "Hidratação".
 *
 * It exists because the alternative is colour alone, and colour alone is not a state: a user with
 * low vision, a colour-blind user or anyone glancing at the screen in sunlight gets nothing from a
 * red dot. Every tag carries its meaning in words, and the hue is the *second* channel (SPEC-016 §14).
 * Not pressable on purpose — a tag that could be tapped would compete with the action beside it.
 */
export function Tag({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'success' | 'danger';
}) {
  // Care-type hues are absent on purpose: a care already says its type in its own title, so a tag
  // repeating it would be decoration, and none of the four tones here is speculative (AC3).
  const tones = {
    neutral: { fg: color.inkMuted, bg: color.surfaceMuted },
    accent: { fg: color.accent, bg: color.accentSoft },
    success: { fg: color.success, bg: color.successSoft },
    danger: { fg: color.danger, bg: color.dangerSoft },
  } as const;
  const picked = tones[tone];
  return (
    <View style={[styles.tag, { backgroundColor: picked.bg }]}>
      {/* Not upper-cased: "ATRASADA HÁ 2 DIAS" in pt-BR loses its accents' shape and reads slower
          than the sentence it replaces. Weight and tint carry the emphasis instead. */}
      <RNText style={[type.caption as TextStyle, styles.tagLabel, { color: picked.fg }]}>{label}</RNText>
    </View>
  );
}

// ---------------------------------------------------------------------------------------- Card

export function Card({
  children,
  tone = 'surface',
  style,
}: {
  children: ReactNode;
  tone?: 'surface' | 'muted' | 'accent';
  style?: StyleProp<ViewStyle>;
}) {
  const tones = {
    surface: { backgroundColor: color.surface, borderColor: color.border },
    muted: { backgroundColor: color.surfaceMuted, borderColor: color.border },
    accent: { backgroundColor: color.accentSoft, borderColor: color.accentBorder },
  } as const;
  return <View style={[styles.card, tones[tone], style]}>{children}</View>;
}

// --------------------------------------------------------------------------------- ProgressBar

export function ProgressBar({ value, total, label }: { value: number; total: number; label?: string }) {
  const clamped = total > 0 ? Math.min(Math.max(value / total, 0), 1) : 0;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: value }}
      {...(label ? { accessibilityLabel: label } : {})}
      style={styles.progressTrack}
    >
      <View style={[styles.progressFill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

// --------------------------------------------------------------------------------------- Field

export function Field({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  editable = true,
  ...rest
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  accessibilityLabel: string;
  editable?: boolean;
} & Omit<
  React.ComponentProps<typeof TextInput>,
  'value' | 'onChangeText' | 'placeholder' | 'accessibilityLabel' | 'editable' | 'style'
>) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      accessibilityLabel={accessibilityLabel}
      placeholderTextColor={color.inkFaint}
      style={[styles.field, !editable && styles.fieldOff]}
      {...(placeholder ? { placeholder } : {})}
      {...rest}
    />
  );
}

// ------------------------------------------------------------------------------- Stack helpers

/** Vertical rhythm without every screen re-deriving margins. */
export function Stack({
  gap = 'lg',
  children,
  style,
}: {
  gap?: keyof typeof space;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[{ gap: space[gap] }, style]}>{children}</View>;
}

/** Wrapping row — the chip groups, mainly. */
export function Row({
  gap = 'sm',
  children,
  style,
}: {
  gap?: keyof typeof space;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.row, { gap: space[gap] }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  screen: { flex: 1, backgroundColor: color.canvas, alignItems: 'center' },
  loading: { justifyContent: 'center', gap: space.md },
  column: { flex: 1, width: '100%', maxWidth: CONTENT_MAX_WIDTH },
  scrollContent: { flexGrow: 1 },
  content: { paddingHorizontal: space.xl, paddingTop: space.xxl, paddingBottom: space.xl, gap: space.xl },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xl,
    borderTopWidth: 1,
    borderTopColor: color.border,
    backgroundColor: color.canvas,
    gap: space.sm,
  },
  button: {
    minHeight: HIT_TARGET,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  buttonSm: { minHeight: HIT_TARGET_MIN, paddingHorizontal: space.md, borderRadius: radius.sm },
  buttonSmLabel: { fontWeight: '600' },
  buttonOff: { opacity: 0.45 },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
  },
  tagLabel: { fontWeight: '700' },
  chip: {
    minHeight: HIT_TARGET,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  chipOff: { backgroundColor: color.surface, borderColor: color.border },
  chipOffPressed: { backgroundColor: color.surfacePressed },
  chipOn: { backgroundColor: color.accentSoft, borderColor: color.accent },
  chipOnPressed: { backgroundColor: color.accentBorder },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.sm, ...elevation.card },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.accent },
  field: {
    minHeight: HIT_TARGET,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
    color: color.ink,
    ...type.body,
  },
  fieldOff: { opacity: 0.5 },
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
